package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.dto.CicloDto;
import br.jus.tjgo.kaizen.dto.EntradaCicloDto;
import br.jus.tjgo.kaizen.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.MonthDay;
import java.util.List;
import java.util.Map;

/**
 * Fundação do Ciclo Orçamentário (Orçamento de TIC). Produz versões oficiais do PCA-TIC por
 * finalidade: Formação (Versão 1 do ano seguinte) e Revisão (Versões 2–4 do ano vigente).
 * A esteira detalhada (transições por estado×papel) e a integração da publicação com o snapshot
 * de PCA (RF-41/75) e o IFO serão evoluídas em cima desta base.
 */
@Service
@RequiredArgsConstructor
public class CicloOrcamentarioService {

    private final JdbcTemplate jdbc;
    private final PcaService pcaService;
    private final IfoService ifoService;
    private final OrcamentoPapelService papelService;

    private static final String ESTADO_FORMACAO_INICIAL = "aberto_aguardando_proad";
    private static final String ESTADO_REVISAO_JANELA = "janela_aberta";
    private static final String ESTADO_PUBLICADO = "publicado";

    // Domínios validados aqui no backend — os CHECK foram removidos do banco (migration 171).
    // finalidade/subtipo são sempre definidos internamente (nunca input do usuário); a guarda abaixo
    // protege contra regressões de refatoração.
    private static final java.util.Set<String> FINALIDADES = java.util.Set.of("formacao", "revisao");
    private static final java.util.Set<String> SUBTIPOS = java.util.Set.of("ordinaria", "extraordinaria");

    private static String exigirFinalidade(String finalidade) {
        if (finalidade == null || !FINALIDADES.contains(finalidade)) {
            throw new ApiException(400, "Finalidade inválida: " + finalidade);
        }
        return finalidade;
    }

    private static String exigirSubtipo(String subtipo) {
        if (subtipo != null && !SUBTIPOS.contains(subtipo)) {
            throw new ApiException(400, "Subtipo de revisão inválido: " + subtipo);
        }
        return subtipo;
    }

    /** RNF-07 — esteira determinística da Formação (11 estados, RF-19..41). */
    private static final List<String> ESTADOS_FORMACAO = List.of(
            "aberto_aguardando_proad", "em_consulta", "retorno_areas", "consolidacao_cca",
            "validacao_gejut", "apreciacao_sgjt", "em_comites", "autorizado",
            "ajuste_pre_publicacao", "remessa_dg", "publicado");

    /** RNF-07 — esteira determinística da Revisão (rito ágil, RF-60..75). */
    private static final List<String> ESTADOS_REVISAO = List.of(
            "janela_aberta", "em_rito_validacao", "consolidacao_cca", "em_comites",
            "remessa_dg", "publicado");

    /** RF-76 — janelas ordinárias (início, fim, versão gerada). A 1ª abre pelo evento de publicação. */
    private record Janela(int ordem, int versao, MonthDay inicio, MonthDay fim) {}

    private static final List<Janela> JANELAS = List.of(
            new Janela(1, 2, null, MonthDay.of(1, 31)),
            new Janela(2, 3, MonthDay.of(4, 1), MonthDay.of(4, 30)),
            new Janela(3, 4, MonthDay.of(7, 1), MonthDay.of(7, 31)));

    /** RF-31 — corte da Formação: a partir de 01/03 a consulta às unidades fecha (auto-fechamento). */
    private static final MonthDay CORTE_FORMACAO = MonthDay.of(3, 1);

    private static Janela janelaAtiva(LocalDate hoje) {
        MonthDay hm = MonthDay.of(hoje.getMonthValue(), hoje.getDayOfMonth());
        for (Janela j : JANELAS) {
            if (j.inicio() == null) continue;
            if (!hm.isBefore(j.inicio()) && !hm.isAfter(j.fim())) {
                return j;
            }
        }
        return null;
    }

    private static Janela janelaDaVersao(Integer versao) {
        if (versao == null) return null;
        for (Janela j : JANELAS) {
            if (j.versao() == versao) return j;
        }
        return null;
    }

    /**
     * RF-31/67/69 — estado derivado exclusivamente pela data corrente (auto-fechamento). Retorna o
     * estado para o qual o ciclo deve transitar por decurso de prazo, ou null se não há transição:
     *  - Formação em consulta às unidades e já passou o corte (01/03) → consolidação da CCA (RF-31).
     *  - Revisão com janela aberta cuja janela já encerrou → rito de validação (RF-67/69; demandante
     *    deixa de editar, CCA consolida a partir de D+1).
     */
    private static String estadoDerivadoPorData(CicloDto ciclo, LocalDate hoje) {
        MonthDay hm = MonthDay.of(hoje.getMonthValue(), hoje.getDayOfMonth());
        if ("formacao".equals(ciclo.finalidade())) {
            if (("em_consulta".equals(ciclo.estado()) || "retorno_areas".equals(ciclo.estado()))
                    && !hm.isBefore(CORTE_FORMACAO)) {
                return "consolidacao_cca";
            }
        } else if ("revisao".equals(ciclo.finalidade()) && "janela_aberta".equals(ciclo.estado())) {
            Janela j = janelaDaVersao(ciclo.versaoGerada());
            if (j != null && j.fim() != null && hm.isAfter(j.fim())) {
                return "em_rito_validacao";
            }
        }
        return null;
    }

    /**
     * RF-31/69 — aplica (persistindo) o auto-fechamento por data a um ciclo específico. Idempotente:
     * só grava quando há transição a fazer. O gating por papel é ignorado (transição do sistema).
     */
    @Transactional
    public CicloDto sincronizarPorData(long id, Long userId) {
        CicloDto ciclo = getCiclo(id);
        String novo = estadoDerivadoPorData(ciclo, LocalDate.now());
        if (novo != null && !novo.equals(ciclo.estado())) {
            var rows = jdbc.queryForList(
                    "UPDATE ciclo_orcamentario SET estado = ?, updated_at = NOW(), updated_by = ? WHERE id = ? RETURNING *",
                    novo, userId, id);
            if (!rows.isEmpty()) {
                return toDto(rows.get(0));
            }
        }
        return ciclo;
    }

    // ---------- consultas ----------

    public CicloDto getCiclo(long id) {
        var rows = jdbc.queryForList("SELECT * FROM ciclo_orcamentario WHERE id = ?", id);
        if (rows.isEmpty()) {
            throw new ApiException(404, "Ciclo não encontrado");
        }
        return toDto(rows.get(0));
    }

    private CicloDto findCicloMaisRecente(int ano, String finalidade) {
        var rows = jdbc.queryForList(
                "SELECT * FROM ciclo_orcamentario WHERE ano = ? AND finalidade = ? ORDER BY id DESC LIMIT 1",
                ano, finalidade);
        return rows.isEmpty() ? null : toDto(rows.get(0));
    }

    public EntradaCicloDto getEntrada(int anoVigente) {
        int anoFormacao = anoVigente + 1;
        CicloDto formacao = findCicloMaisRecente(anoFormacao, "formacao");
        // RF-31/69 — reflete o auto-fechamento por data já na tela de entrada.
        if (formacao != null) formacao = sincronizarPorData(formacao.id(), null);
        CicloDto revisao = findCicloMaisRecente(anoVigente, "revisao");
        if (revisao != null) revisao = sincronizarPorData(revisao.id(), null);
        Janela ativa = janelaAtiva(LocalDate.now());
        return new EntradaCicloDto(
                anoFormacao,
                formacao,
                anoVigente,
                ativa != null ? ativa.ordem() : null,
                ativa != null ? ativa.versao() : null,
                revisao);
    }

    // ---------- ações ----------

    @Transactional
    public CicloDto getOuAbrirFormacao(int anoFormacao, Long userId) {
        CicloDto existente = findCicloMaisRecente(anoFormacao, "formacao");
        if (existente != null) {
            return existente;
        }
        var rows = jdbc.queryForList(
                "INSERT INTO ciclo_orcamentario (ano, finalidade, estado, versao_gerada, abertura_em, created_by, updated_by) " +
                        "VALUES (?, ?, ?, 1, NOW(), ?, ?) RETURNING *",
                anoFormacao, exigirFinalidade("formacao"), ESTADO_FORMACAO_INICIAL, userId, userId);
        return toDto(rows.get(0));
    }

    @Transactional
    public CicloDto informarProad(long id, String proad, Long userId) {
        if (proad == null || proad.isBlank()) {
            throw new ApiException(400, "PROAD é obrigatório");
        }
        var rows = jdbc.queryForList(
                "UPDATE ciclo_orcamentario SET proad = ?, estado = 'em_consulta', updated_at = NOW(), updated_by = ? " +
                        "WHERE id = ? AND finalidade = 'formacao' RETURNING *",
                proad.trim(), userId, id);
        if (rows.isEmpty()) {
            throw new ApiException(404, "Ciclo de formação não encontrado");
        }
        return toDto(rows.get(0));
    }

    @Transactional
    public CicloDto getOuAbrirRevisao(int anoVigente, Long userId) {
        var abertos = jdbc.queryForList(
                "SELECT * FROM ciclo_orcamentario WHERE ano = ? AND finalidade = 'revisao' AND estado <> 'publicado' " +
                        "ORDER BY id DESC LIMIT 1",
                anoVigente);
        if (!abertos.isEmpty()) {
            return toDto(abertos.get(0));
        }
        Janela ativa = janelaAtiva(LocalDate.now());
        if (ativa == null) {
            throw new ApiException(409, "Nenhuma janela de revisão ativa no momento");
        }
        var rows = jdbc.queryForList(
                "INSERT INTO ciclo_orcamentario (ano, finalidade, subtipo, estado, versao_gerada, abertura_em, created_by, updated_by) " +
                        "VALUES (?, ?, ?, ?, ?, NOW(), ?, ?) RETURNING *",
                anoVigente, exigirFinalidade("revisao"), exigirSubtipo("ordinaria"), ESTADO_REVISAO_JANELA, ativa.versao(), userId, userId);
        return toDto(rows.get(0));
    }

    @Transactional
    public CicloDto abrirRevisaoExtraordinaria(int anoVigente, Long userId) {
        // RF-74: uma revisão não publicada por vez sobre o mesmo PCA-TIC{ano} (garantido pelo índice único).
        Integer maxVersao = jdbc.queryForObject(
                "SELECT COALESCE(MAX(versao_gerada), 1) FROM ciclo_orcamentario WHERE ano = ? AND finalidade = 'revisao'",
                Integer.class, anoVigente);
        int proximaVersao = (maxVersao == null ? 2 : maxVersao + 1);
        var rows = jdbc.queryForList(
                "INSERT INTO ciclo_orcamentario (ano, finalidade, subtipo, estado, versao_gerada, abertura_em, created_by, updated_by) " +
                        "VALUES (?, ?, ?, ?, ?, NOW(), ?, ?) RETURNING *",
                anoVigente, exigirFinalidade("revisao"), exigirSubtipo("extraordinaria"), ESTADO_REVISAO_JANELA, proximaVersao, userId, userId);
        return toDto(rows.get(0));
    }

    @Transactional
    public CicloDto atualizarEstado(long id, String estado, Long userId) {
        if (estado == null || estado.isBlank()) {
            throw new ApiException(400, "Estado é obrigatório");
        }
        // RN-GERAL-01 — transitar é privativo da Autoridade do escopo do estado ATUAL (Editor não transita).
        papelService.exigirTransicao(escopoDoEstado(getCiclo(id).estado()), id);
        var rows = jdbc.queryForList(
                "UPDATE ciclo_orcamentario SET estado = ?, updated_at = NOW(), updated_by = ? WHERE id = ? RETURNING *",
                estado.trim(), userId, id);
        if (rows.isEmpty()) {
            throw new ApiException(404, "Ciclo não encontrado");
        }
        return toDto(rows.get(0));
    }

    /**
     * RNF-07 — encaminha o ciclo ao próximo ator da esteira (transição adjacente determinística).
     * O último passo (→ publicado) é delegado a {@link #publicar} para gravar o snapshot do PCA-TIC.
     */
    @Transactional
    public CicloDto avancar(long id, Long userId) {
        CicloDto ciclo = getCiclo(id);
        List<String> esteira = esteiraDe(ciclo.finalidade());
        int idx = esteira.indexOf(ciclo.estado());
        if (idx < 0) {
            throw new ApiException(409, "Estado atual fora da esteira: " + ciclo.estado());
        }
        if (idx >= esteira.size() - 1) {
            throw new ApiException(409, "Ciclo já está no estado final");
        }
        String proximo = esteira.get(idx + 1);
        if (ESTADO_PUBLICADO.equals(proximo)) {
            return publicar(id, userId);
        }
        return atualizarEstado(id, proximo, userId);
    }

    /** Retorna o ciclo ao ator anterior (correção). Não retrocede a partir de publicado. */
    @Transactional
    public CicloDto retroceder(long id, Long userId) {
        CicloDto ciclo = getCiclo(id);
        if (ESTADO_PUBLICADO.equals(ciclo.estado())) {
            throw new ApiException(409, "Ciclo publicado não pode retroceder");
        }
        List<String> esteira = esteiraDe(ciclo.finalidade());
        int idx = esteira.indexOf(ciclo.estado());
        if (idx <= 0) {
            throw new ApiException(409, "Ciclo já está no estado inicial");
        }
        return atualizarEstado(id, esteira.get(idx - 1), userId);
    }

    private static List<String> esteiraDe(String finalidade) {
        return "revisao".equals(finalidade) ? ESTADOS_REVISAO : ESTADOS_FORMACAO;
    }

    // ---------- gating por papel (RNF-04/07) ----------

    /**
     * Papel-chave que dispara a transição de cada estado (autoritativo: Especificação v2, tabela 8.8).
     * Notas: `remessa_dg` → publicado é o "Registrar publicação" do Gestor CCA (a DG publica no PROAD,
     * ato EXTERNO; o Kaizen apenas reflete). Em `em_comites`, o ato no Kaizen (juntar atas / autorizar)
     * é do escopo SGJT — os comitês deliberam no PROAD, fora do Kaizen.
     */
    private static final Map<String, String> PAPEL_DO_ESTADO = Map.ofEntries(
            Map.entry("aberto_aguardando_proad", "cca"),   // registrar PROAD / encaminhar DFD-Consulta
            Map.entry("em_consulta", "demandante"),         // unidades preenchem/validam/remetem
            Map.entry("retorno_areas", "demandante"),
            Map.entry("consolidacao_cca", "cca"),           // consolidar pós-demandantes → GEJUT
            Map.entry("validacao_gejut", "gejut"),          // conferir → encaminhar à SGJT
            Map.entry("apreciacao_sgjt", "sgjt"),           // emitir produto / pautar / autorizar
            Map.entry("em_comites", "sgjt"),                // juntar atas (Editor SGJT) / autorizar
            Map.entry("autorizado", "cca"),                 // gerar produto final + instruir
            Map.entry("ajuste_pre_publicacao", "cca"),
            Map.entry("remessa_dg", "cca"),                 // registrar publicação (reflete a DG externa)
            Map.entry("janela_aberta", "demandante"),
            Map.entry("em_rito_validacao", "demandante"));

    /** Escopo (cca/demandante/gejut/sgjt) responsável por transitar a partir de um estado (tabela 8.8). */
    private static String escopoDoEstado(String estado) {
        return PAPEL_DO_ESTADO.getOrDefault(estado, "cca");
    }

    /**
     * Estados da Revisão em que o demandante ainda pode editar seus itens. RF-67/69: só dentro da
     * janela (`janela_aberta`); uma vez encerrada (`em_rito_validacao`) o demandante não ajusta mais.
     */
    private static final java.util.Set<String> ESTADOS_REVISAO_EDITAVEL =
            java.util.Set.of("janela_aberta");

    /** Campos do item do PCA-TIC editáveis durante a Revisão (RF-62/63). */
    private static final java.util.Set<String> CAMPOS_REVISAVEIS =
            java.util.Set.of("objeto", "valor_estimado", "status", "data_estimada_contratacao");

    /**
     * RF-62..69 — edita os campos revisáveis de um item do PCA-TIC durante uma Revisão aberta.
     * Só permite quando há um ciclo de revisão do exercício do item em estado editável (dentro da
     * janela). Ignora campos fora da whitelist (o demandante não altera código/área/diretoria).
     */
    @Transactional
    public Map<String, Object> editarItemRevisao(long itemId, Map<String, Object> campos, Long userId) {
        Map<String, Object> item = pcaService.findById(itemId);
        if (item == null) {
            throw new ApiException(404, "Item PCA não encontrado");
        }
        Integer ano = item.get("ano") == null ? null : ((Number) item.get("ano")).intValue();
        CicloDto revisao = ano == null ? null : revisaoEditavelDoAno(ano);
        // RF-67/69 — se a janela já encerrou por data, o auto-fechamento bloqueia a edição aqui.
        if (revisao != null) revisao = sincronizarPorData(revisao.id(), userId);
        if (revisao == null || !ESTADOS_REVISAO_EDITAVEL.contains(revisao.estado())) {
            throw new ApiException(409, "Nenhuma revisão aberta para edição neste exercício");
        }
        // Edição de conteúdo é ação compartilhada Autoridade + Editor do escopo Demandante (RN-GERAL-01).
        papelService.exigirEdicao("demandante", revisao.id());
        Map<String, Object> filtrado = new java.util.LinkedHashMap<>();
        for (Map.Entry<String, Object> e : campos.entrySet()) {
            if (CAMPOS_REVISAVEIS.contains(e.getKey())) {
                filtrado.put(e.getKey(), e.getValue());
            }
        }
        if (filtrado.isEmpty()) {
            throw new ApiException(400, "Nenhum campo revisável informado");
        }
        return pcaService.update(itemId, filtrado, userId);
    }

    private CicloDto revisaoEditavelDoAno(int ano) {
        var rows = jdbc.queryForList(
                "SELECT * FROM ciclo_orcamentario WHERE ano = ? AND finalidade = 'revisao' AND estado <> 'publicado' " +
                        "ORDER BY id DESC LIMIT 1",
                ano);
        return rows.isEmpty() ? null : toDto(rows.get(0));
    }

    @Transactional
    public CicloDto publicar(long id, Long userId) {
        // RN-GERAL-01/04 — registrar a publicação é ato de Autoridade (Gestor CCA no estado remessa_dg).
        papelService.exigirTransicao(escopoDoEstado(getCiclo(id).estado()), id);
        var rows = jdbc.queryForList(
                "UPDATE ciclo_orcamentario SET estado = 'publicado', publicado_em = NOW(), updated_at = NOW(), updated_by = ? " +
                        "WHERE id = ? AND estado <> 'publicado' RETURNING *",
                userId, id);
        if (rows.isEmpty()) {
            throw new ApiException(400, "Ciclo não encontrado ou já publicado");
        }
        CicloDto ciclo = toDto(rows.get(0));
        // RF-41/75 — a publicação pela DG grava a próxima versão do PCA-TIC (snapshot imutável)
        // do ano do ciclo (Formação = Versão 1 do ano seguinte; Revisão = próxima versão do vigente).
        if (ciclo.ano() != null) {
            // RF-41/49/58/75 — materializa cada IFO do ano como Item de PCA oficial (linha em `pcas`)
            // ANTES do snapshot, para que a versão publicada já contenha as inclusões da Formação/Revisão.
            ifoService.converterNaPublicacao(ciclo.ano(), userId);
            // RF-55 — carimba a origem (ciclo/PROAD/finalidade) em TODOS os itens do ano (inclusive os
            // recém-materializados) ANTES do snapshot, para que a versão imutável preserve a rastreabilidade.
            pcaService.stampOrigem(ciclo.ano(), ciclo.id(), ciclo.proad(), ciclo.finalidade(), userId);
            // RF-45/46 — a numeração da versão só avança aqui (publicação), com proveniência do ciclo.
            pcaService.createSnapshot(ciclo.ano(), userId, ciclo.id(), ciclo.finalidade());
        }
        return ciclo;
    }

    // ---------- mapper ----------

    private CicloDto toDto(Map<String, Object> r) {
        return new CicloDto(
                asLong(r.get("id")),
                asInt(r.get("ano")),
                str(r.get("finalidade")),
                str(r.get("subtipo")),
                str(r.get("estado")),
                str(r.get("proad")),
                asInt(r.get("versao_gerada")),
                str(r.get("abertura_em")),
                str(r.get("publicado_em")));
    }

    private static Long asLong(Object v) {
        return v == null ? null : ((Number) v).longValue();
    }

    private static Integer asInt(Object v) {
        return v == null ? null : ((Number) v).intValue();
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }
}
