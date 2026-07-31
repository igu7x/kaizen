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
import java.io.ByteArrayOutputStream;
import com.lowagie.text.Document;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfWriter;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.Element;
import com.lowagie.text.Rectangle;
import java.awt.Color;
import java.util.stream.Collectors;
import java.time.format.DateTimeFormatter;
import java.util.Collections;

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
    private final PermissoesAcoesService permissoesAcoesService;
    private final DelegacaoEdicaoService delegacaoEdicaoService;

    private static final String ESTADO_FORMACAO_INICIAL = "aguardando_proad";
    private static final String ESTADO_REVISAO_INICIAL = "em_consulta_1";
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

    /** Estados possíveis do rito de formação (Especificação v2, seção 8.8.1). */
    private static final List<String> ESTADOS_FORMACAO = List.of(
            "aguardando_proad", "aberto", "em_consulta_1", "em_consulta_2", "consolidacao_cca",
            "validacao_gejut", "apreciacao_sgjt", "em_comites", "remessa_dg", "publicado");

    /** RNF-07 — esteira determinística da Revisão (rito ágil, RF-60..75). */
    private static final List<String> ESTADOS_REVISAO = List.of(
            "em_consulta_1", "em_consulta_2", "consolidacao_cca", "validacao_gejut",
            "em_comites", "remessa_dg", "publicado");

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
        if ("revisao".equals(ciclo.finalidade()) && "em_consulta_1".equals(ciclo.estado())) {
            Janela j = janelaDaVersao(ciclo.versaoGerada());
            if (j != null && j.fim() != null && hm.isAfter(j.fim())) {
                return "em_consulta_2";
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
        
        // Bloqueio no backend: apenas usuários com a tag podem disparar a abertura do ciclo.
        if (userId != null && !permissoesAcoesService.validarAcesso(userId, "PCA_FORMACAO_ABERTURA")) {
            throw new ApiException(403, "Acesso Negado: Você não possui a permissão necessária (PCA_FORMACAO_ABERTURA) para realizar a abertura da Formação do PCA.");
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
                "UPDATE ciclo_orcamentario SET proad = ?, updated_at = NOW(), updated_by = ? " +
                        "WHERE id = ? AND finalidade = 'formacao' RETURNING *",
                proad.trim(), userId, id);
        if (rows.isEmpty()) {
            throw new ApiException(404, "Ciclo de formação não encontrado");
        }
        CicloDto dto = toDto(rows.get(0));
        
        if ("aguardando_proad".equals(dto.estado())) {
            rows = jdbc.queryForList(
                    "UPDATE ciclo_orcamentario SET estado = 'aberto', updated_at = NOW(), updated_by = ? " +
                            "WHERE id = ? RETURNING *",
                    userId, id);
            
            ifoService.gerarIfosRenovacao(id, dto.ano(), userId);
            ifoService.gerarIfosNovaContratacao(id, dto.ano(), userId);
            
            return toDto(rows.get(0));
        }
        
        return dto;
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
                anoVigente, exigirFinalidade("revisao"), exigirSubtipo("ordinaria"), ESTADO_REVISAO_INICIAL, ativa.versao(), userId, userId);
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
                anoVigente, exigirFinalidade("revisao"), exigirSubtipo("extraordinaria"), ESTADO_REVISAO_INICIAL, proximaVersao, userId, userId);
        return toDto(rows.get(0));
    }

    @Transactional
    public CicloDto atualizarEstado(long id, String estado, Long userId) {
        if (estado == null || estado.isBlank()) {
            throw new ApiException(400, "Estado é obrigatório");
        }
        CicloDto cicloAtual = getCiclo(id);
        exigirTagAcao(userId, cicloAtual.estado(), cicloAtual.finalidade(), id);
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
            return publicar(id, userId, null);
        }

        CicloDto atualizado = atualizarEstado(id, proximo, userId);
        
        // Auto-revogar delegações da etapa anterior ao avançar
        delegacaoEdicaoService.revogarPorEstado(id, ciclo.estado());
        
        if ("consolidacao_cca".equals(proximo) && "formacao".equals(ciclo.finalidade())) {
            ifoService.processarNaoRenovacoes(id, userId);
        }
        
        return atualizado;
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
        // Auto-revogar delegações da etapa que está saindo ao retroceder
        delegacaoEdicaoService.revogarPorEstado(id, ciclo.estado());
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
            Map.entry("aguardando_proad", "cca"),   // registrar PROAD
            Map.entry("aberto", "cca"),             // encaminhar DFD-Consulta
            Map.entry("em_consulta_1", "demandante"),         // Demandante avança para validação 2
            Map.entry("em_consulta_2", "demandante"),       // Demandante avança para consolidação
            Map.entry("consolidacao_cca", "cca"),           // consolidar pós-demandantes → GEJUT
            Map.entry("validacao_gejut", "gejut"),          // conferir → encaminhar à SGJT
            Map.entry("apreciacao_sgjt", "sgjt"),           // emitir produto / pautar / autorizar
            Map.entry("em_comites", "sgjt"),                // juntar atas + autorizar (absorve etapa Autorização)
            Map.entry("remessa_dg", "cca"));                // publicar PCA-TIC (CCA apenas)

    /**
     * Mapeamento de máquina de estados em apoio:
     * i. [PROAD] PCA_FOR_REGISTRAR_PROAD
     * ii. [Abertura] PCA_FOR_ENCAMINHAR_CONSULTA
     * iii. [Consulta] PCA_FOR_VALIDAR_DEMANDA_1_CAMADA -> PCA_FOR_VALIDAR_DEMANDA_2_CAMADA
     * iv. [Consolidação] PCA_FOR_CONSOLIDAR_ENCAMINHAR_GEJUT -> PCA_FOR_ENCAMINHAR_SGJT
     * v. [Apreciação] PCA_FOR_PAUTAR_COMITES
     * vi. [comitês] PCA_FOR_AUTORIZAR_COMITES
     * vii. [Remessa à DG] PCA_FOR_REMETER_DG
     */

    /**
     * Camada D — tag de Permissão de Ação exigida para transitar A PARTIR de cada estado.
     * Complementa o gating por papel (Camada B via OrcamentoPapelService). A ausência de tag
     * para um estado (null) significa proteção apenas pela Camada B.
     * Mapeamento derivado da Máquina de Transições (§8.8) e Matriz RACI (§8.9).
     */
    private static final Map<String, String> TAG_DO_ESTADO_FORMACAO = Map.ofEntries(
            Map.entry("aguardando_proad",      "PCA_FOR_REGISTRAR_PROAD"),
            Map.entry("aberto",               "PCA_FOR_ENCAMINHAR_CONSULTA"),
            Map.entry("em_consulta_1",        "PCA_FOR_VALIDAR_DEMANDA_1_CAMADA"),
            Map.entry("em_consulta_2",        "PCA_FOR_VALIDAR_DEMANDA_2_CAMADA"),
            Map.entry("consolidacao_cca",     "PCA_FOR_CONSOLIDAR_ENCAMINHAR_GEJUT"),
            Map.entry("validacao_gejut",      "PCA_FOR_ENCAMINHAR_SGJT"),
            Map.entry("apreciacao_sgjt",      "PCA_FOR_PAUTAR_COMITES"),
            Map.entry("em_comites",           "PCA_FOR_AUTORIZAR_COMITES"),
            Map.entry("remessa_dg",           "PCA_FOR_REMETER_DG"));

    private static final Map<String, String> TAG_DO_ESTADO_REVISAO = Map.ofEntries(
            Map.entry("em_consulta_1",        "PCA_RN_VALIDAR_DEMANDA_1_CAMADA"),
            Map.entry("em_consulta_2",        "PCA_RN_VALIDAR_DEMANDA_2_CAMADA"),
            Map.entry("consolidacao_cca",     "PCA_RN_CONSOLIDAR_ENCAMINHAR_GEJUT"),
            Map.entry("validacao_gejut",      "PCA_RN_PAUTAR_COMITES"),
            Map.entry("em_comites",           "PCA_RN_AUTORIZAR_COMITES"),
            Map.entry("remessa_dg",           "PCA_RN_REMETER_DG"));

    /** Escopo (cca/demandante/gejut/sgjt) responsável por transitar a partir de um estado (tabela 8.8). */
    private static String escopoDoEstado(String estado) {
        return PAPEL_DO_ESTADO.getOrDefault(estado, "cca");
    }

    /**
     * Camada D — exige que o usuário possua a tag de ação associada ao estado atual
     * na tabela permissoes_acoes, cruzando com sua area_id/unidade_id.
     * Superadmin é bypass (Camada C). Se não há tag mapeada para o estado, a validação é
     * delegada exclusivamente à Camada B (OrcamentoPapelService).
     */
    private void exigirTagAcao(Long userId, String estadoAtual, String finalidade, Long cicloId) {
        String tag = null;
        if ("formacao".equals(finalidade)) {
            tag = TAG_DO_ESTADO_FORMACAO.get(estadoAtual);
        } else if ("revisao".equals(finalidade)) {
            tag = TAG_DO_ESTADO_REVISAO.get(estadoAtual);
        }

        if (tag == null) {
            // Estado sem tag: protegido apenas pela Camada B
            if (cicloId != null) {
                papelService.exigirTransicao(escopoDoEstado(estadoAtual), cicloId);
            }
            return;
        }
        var optUser = br.jus.tjgo.kaizen.auth.AuthContext.getCurrentUser();
        if (optUser.isPresent() && optUser.get().isSuperadmin()) return; // Camada C: bypass
        if (userId == null || !permissoesAcoesService.validarAcesso(userId, tag)) {
            throw new ApiException(403,
                    "Ação não autorizada. Permissão necessária: " + tag);
        }
    }

    private void verificarPermissaoAcaoRevisao(Long userId, String tagExigida) {
        var optUser = br.jus.tjgo.kaizen.auth.AuthContext.getCurrentUser();
        if (optUser.isPresent() && optUser.get().isSuperadmin()) return;
        List<String> userTags = permissoesAcoesService.buscarTagsDoUsuario(userId);
        boolean isEspecial = userTags.contains("PCA_RN_MODIFICACAO_ESPECIAL") || userTags.contains("PCA_RN_MODIFICACAO_CCA");
        if (isEspecial && tagExigida.equals("PCA_RN_MODIFICAR_ITEM")) return;
        if (!userTags.contains(tagExigida)) {
            throw new ApiException(403, "Ação não autorizada. Permissão necessária: " + tagExigida);
        }
    }

    /**
     * Estados da Revisão em que o demandante pode editar/adicionar itens.
     * O usuário pode modificar em todas as etapas (controlado por permissões de ação).
     */
    private static final java.util.Set<String> ESTADOS_REVISAO_EDITAVEL =
            java.util.Set.of("em_consulta_1", "em_consulta_2", "consolidacao_cca",
                    "validacao_gejut", "em_comites", "remessa_dg");

    /** Estados em que é possível adicionar novos itens PCA (apenas Janela de Ajustes). */
    private static final java.util.Set<String> ESTADOS_REVISAO_ADICIONAR =
            java.util.Set.of("em_consulta_1", "em_consulta_2");

    /** Todos os campos do item do PCA-TIC são editáveis durante a Revisão. */
    private static final java.util.Set<String> CAMPOS_REVISAVEIS =
            java.util.Set.of("objeto", "valor_estimado", "status", "data_estimada_contratacao",
                    "description", "justification", "financial_resource_type", "priority",
                    "step", "valor_formalizado", "process", "tipo", "id_diretoria",
                    "id_area_demandante", "area_demandante");

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
        verificarPermissaoAcaoRevisao(userId, "PCA_RN_MODIFICAR_ITEM");
        Map<String, Object> filtrado = new java.util.LinkedHashMap<>();
        for (Map.Entry<String, Object> e : campos.entrySet()) {
            if (CAMPOS_REVISAVEIS.contains(e.getKey())) {
                filtrado.put(e.getKey(), e.getValue());
            }
        }
        if (filtrado.isEmpty()) {
            throw new ApiException(400, "Nenhum campo revisável informado");
        }
        Map<String, Object> atualizado = pcaService.update(itemId, campos, userId);
        // RN-GERAL-07 — editar a demanda (item) derruba as validações da revisão.
        invalidarValidacaoItem(revisao.id(), itemId);
        return atualizado;
    }

    /**
     * Adiciona um novo item PCA durante a Revisão (apenas na Janela de Ajustes: em_consulta_1/em_consulta_2).
     * Herda o ano do ciclo vigente.
     */
    @Transactional
    public Map<String, Object> adicionarItemRevisao(Map<String, Object> campos, Long userId) {
        int anoVigente = LocalDate.now().getYear();
        CicloDto revisao = revisaoEditavelDoAno(anoVigente);
        if (revisao != null) revisao = sincronizarPorData(revisao.id(), userId);
        if (revisao == null || !ESTADOS_REVISAO_ADICIONAR.contains(revisao.estado())) {
            throw new ApiException(409, "Novos itens só podem ser adicionados na Janela de Ajustes");
        }
        papelService.exigirEdicao("demandante", revisao.id());
        verificarPermissaoAcaoRevisao(userId, "PCA_RN_MODIFICAR_ITEM");
        campos.put("ano", anoVigente);
        Map<String, Object> criado = pcaService.create(campos, userId);
        long novoId = ((Number) criado.get("id")).longValue();
        garantirLinhaValidacaoItem(revisao.id(), novoId);
        return criado;
    }

    // ---------- validação por demanda dos itens na Revisão (§8.4) ----------

    private void garantirLinhaValidacaoItem(long cicloId, long itemId) {
        jdbc.update("INSERT INTO revisao_item_validacao (ciclo_id, pca_id) VALUES (?, ?) " +
                "ON CONFLICT (ciclo_id, pca_id) DO NOTHING", cicloId, itemId);
    }

    private void invalidarValidacaoItem(long cicloId, long itemId) {
        garantirLinhaValidacaoItem(cicloId, itemId);
        jdbc.update("UPDATE revisao_item_validacao SET validacao = 'em_edicao', validado_1a_por = NULL, " +
                "validado_1a_em = NULL, validado_2a_por = NULL, validado_2a_em = NULL, updated_at = NOW() " +
                "WHERE ciclo_id = ? AND pca_id = ?", cicloId, itemId);
    }

    private CicloDto revisaoDoItem(long itemId) {
        Map<String, Object> item = pcaService.findById(itemId);
        if (item == null) {
            throw new ApiException(404, "Item PCA não encontrado");
        }
        Integer ano = item.get("ano") == null ? null : ((Number) item.get("ano")).intValue();
        CicloDto rev = ano == null ? null : revisaoEditavelDoAno(ano);
        if (rev != null) rev = sincronizarPorData(rev.id(), null);
        if (rev == null) {
            throw new ApiException(409, "Nenhuma revisão aberta neste exercício");
        }
        return rev;
    }

    /**
     * §8.4 — valida a alteração de um item na Revisão em uma das 2 camadas (1ª = Gestor Demandante,
     * 2ª = Diretor de Área; a 2ª exige a 1ª — RN-GERAL-06). Ato de Autoridade do escopo Demandante.
     */
    @Transactional
    public Map<String, Object> validarItemRevisao(long itemId, int camada, Long userId) {
        CicloDto rev = revisaoDoItem(itemId);
        papelService.exigirTransicao("demandante", rev.id());
        verificarPermissaoAcaoRevisao(userId, camada == 1 ? "PCA_RN_VALIDAR_DEMANDA_1_CAMADA" : "PCA_RN_VALIDAR_DEMANDA_2_CAMADA");
        garantirLinhaValidacaoItem(rev.id(), itemId);
        String atual = jdbc.queryForObject(
                "SELECT validacao FROM revisao_item_validacao WHERE ciclo_id = ? AND pca_id = ?",
                String.class, rev.id(), itemId);
        if (camada == 1) {
            jdbc.update("UPDATE revisao_item_validacao SET validacao = 'validada_1a', validado_1a_por = ?, " +
                    "validado_1a_em = NOW(), updated_at = NOW() WHERE ciclo_id = ? AND pca_id = ?",
                    userId, rev.id(), itemId);
        } else if (camada == 2) {
            if (!"validada_1a".equals(atual)) {
                throw new ApiException(409, "Valide a 1ª camada antes da 2ª (RN-GERAL-06)");
            }
            jdbc.update("UPDATE revisao_item_validacao SET validacao = 'validada_2a', validado_2a_por = ?, " +
                    "validado_2a_em = NOW(), updated_at = NOW() WHERE ciclo_id = ? AND pca_id = ?",
                    userId, rev.id(), itemId);
        } else {
            throw new ApiException(400, "Camada inválida (use 1 ou 2)");
        }
        return jdbc.queryForMap(
                "SELECT pca_id, validacao FROM revisao_item_validacao WHERE ciclo_id = ? AND pca_id = ?",
                rev.id(), itemId);
    }

    /** Devolve a alteração do item à edição (Autoridade Demandante), derrubando as validações. */
    @Transactional
    public Map<String, Object> devolverItemRevisao(long itemId, Long userId) {
        CicloDto rev = revisaoDoItem(itemId);
        papelService.exigirTransicao("demandante", rev.id());
        verificarPermissaoAcaoRevisao(userId, "PCA_RN_MODIFICAR_ITEM");
        invalidarValidacaoItem(rev.id(), itemId);
        return jdbc.queryForMap(
                "SELECT pca_id, validacao FROM revisao_item_validacao WHERE ciclo_id = ? AND pca_id = ?",
                rev.id(), itemId);
    }

    /** Estado de validação dos itens da revisão aberta do exercício (pca_id → validacao). */
    public List<Map<String, Object>> validacoesRevisao(Integer ano) {
        CicloDto rev = ano == null ? null : revisaoEditavelDoAno(ano);
        if (rev == null) {
            return List.of();
        }
        return jdbc.queryForList(
                "SELECT pca_id, validacao FROM revisao_item_validacao WHERE ciclo_id = ?", rev.id());
    }

    private CicloDto revisaoEditavelDoAno(int ano) {
        var rows = jdbc.queryForList(
                "SELECT * FROM ciclo_orcamentario WHERE ano = ? AND finalidade = 'revisao' AND estado <> 'publicado' " +
                        "ORDER BY id DESC LIMIT 1",
                ano);
        return rows.isEmpty() ? null : toDto(rows.get(0));
    }

    @Transactional
    public CicloDto publicar(long id, Long userId, List<br.jus.tjgo.kaizen.dto.ImportacaoPcaDto> importacoes) {
        // RN-GERAL-01/04 — registrar a publicação é ato de Autoridade (Gestor CCA no estado remessa_dg).
        CicloDto cicloAtual = getCiclo(id);
        exigirTagAcao(userId, cicloAtual.estado(), cicloAtual.finalidade(), id);
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
            ifoService.converterNaPublicacao(ciclo.ano(), userId, importacoes);
            // RF-55 — carimba a origem (ciclo/PROAD/finalidade) em TODOS os itens do ano (inclusive os
            // recém-materializados) ANTES do snapshot, para que a versão imutável preserve a rastreabilidade.
            pcaService.stampOrigem(ciclo.ano(), ciclo.id(), ciclo.proad(), ciclo.finalidade(), userId);
            // RF-45/46 — a numeração da versão só avança aqui (publicação), com proveniência do ciclo.
            pcaService.createSnapshot(ciclo.ano(), userId, ciclo.id(), ciclo.finalidade());
        }
        return ciclo;
    }

    /** Mapa de qual campo pertence a qual estado — gating por fase. */
    private static final Map<String, String> CAMPO_LINK_POR_ESTADO = Map.of(
        "proad_gejut",         "validacao_gejut",
        "proad_sgjt",          "apreciacao_sgjt",
        "proad_ata_comites",   "em_comites",
        "proad_produto_final", "em_comites"
    );

    private static final java.util.Set<String> CAMPOS_LINK_VALIDOS = CAMPO_LINK_POR_ESTADO.keySet();

    @Transactional
    public CicloDto salvarLink(long id, String campo, String valor, Long userId) {
        if (!CAMPOS_LINK_VALIDOS.contains(campo)) {
            throw new ApiException(400, "Campo de link inválido: " + campo);
        }
        CicloDto ciclo = getCiclo(id);
        String estadoExigido = CAMPO_LINK_POR_ESTADO.get(campo);
        if (!estadoExigido.equals(ciclo.estado())) {
            throw new ApiException(409,
                "O link '" + campo + "' só pode ser editado na fase '" + estadoExigido + "'.");
        }
        var rows = jdbc.queryForList(
            "UPDATE ciclo_orcamentario SET " + campo + " = ?, updated_at = NOW(), updated_by = ? " +
            "WHERE id = ? RETURNING *",
            valor, userId, id);
        if (rows.isEmpty()) throw new ApiException(404, "Ciclo não encontrado");
        return toDto(rows.get(0));
    }

    @Transactional
    public CicloDto excluirLink(long id, String campo, Long userId) {
        return salvarLink(id, campo, null, userId);
    }

    @Transactional
    public void reiniciarFormacao(int anoFormacao, Long userId) {
        var optUser = br.jus.tjgo.kaizen.auth.AuthContext.getCurrentUser();
        if (optUser.isEmpty() || !optUser.get().isSuperadmin()) {
            throw new ApiException(403, "Acesso Negado: Apenas administradores podem reiniciar a formação do PCA.");
        }

        CicloDto ciclo = findCicloMaisRecente(anoFormacao, "formacao");
        if (ciclo == null) {
            throw new ApiException(404, "Ciclo de formação não encontrado para o ano " + anoFormacao);
        }


        jdbc.update("DELETE FROM atas_comites WHERE ciclo_id = ?", ciclo.id());
        jdbc.update("DELETE FROM revisao_item_validacao WHERE ciclo_id = ?", ciclo.id());
        jdbc.update("DELETE FROM orcamento_editores WHERE ciclo_id = ?", ciclo.id());
        jdbc.update("DELETE FROM ifo WHERE ciclo_id = ?", ciclo.id());
        jdbc.update("DELETE FROM pcas_snapshots WHERE year = ?", String.valueOf(anoFormacao));
        jdbc.update("DELETE FROM pcas_snapshots WHERE ciclo_id = ?", ciclo.id());
        jdbc.update("DELETE FROM ciclo_orcamentario WHERE id = ?", ciclo.id());
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
                str(r.get("publicado_em")),
                str(r.get("proad_gejut")),
                str(r.get("proad_sgjt")),
                str(r.get("proad_ata_comites")),
                str(r.get("proad_produto_final")),
                str(r.get("proad_publicacao")),
                str(r.get("link_dou")));
    }

    private static Long asLong(Object v) {
        return v == null ? null : ((Number) v).longValue();
    }

    public byte[] gerarPdfPropostaDfd(int anoFormacao) {
        CicloDto ciclo = findCicloMaisRecente(anoFormacao, "formacao");
        if (ciclo == null) {
            throw new ApiException(404, "Ciclo de formação não encontrado para o ano " + anoFormacao);
        }

        // Busca todos os IFOs ordenados por bloco e código
        var ifos = jdbc.queryForList("SELECT i.id, i.codigo, i.bloco, i.objeto, i.valor_estimado_cents, ca.sigla as area_demandante " + 
                                     "FROM ifo i LEFT JOIN cadastros_areas ca ON i.cadastros_areas_id = ca.id " +
                                     "WHERE i.ciclo_id = ? AND i.is_deleted = FALSE ORDER BY i.bloco, i.codigo", ciclo.id());

        var contratos = jdbc.queryForList(
            "SELECT ic.ifo_id, c.id, c.notice_number, c.situation, c.expense_nature, c.year_value, c.end_date " +
            "FROM ifo_contratos ic " +
            "JOIN contracts c ON ic.contract_id = c.id " +
            "JOIN ifo i ON ic.ifo_id = i.id " +
            "WHERE i.ciclo_id = ? AND i.is_deleted = FALSE", ciclo.id());
            
        Map<Long, List<Map<String, Object>>> contratosPorIfo = contratos.stream()
                .collect(Collectors.groupingBy(row -> ((Number) row.get("ifo_id")).longValue()));
                
        Map<String, List<Map<String, Object>>> ifosPorBloco = ifos.stream()
                .collect(Collectors.groupingBy(row -> (String) row.get("bloco")));

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            // Documento paisagem, margens com espaço para rodapé
            Document document = new Document(new Rectangle(842, 595), 24, 24, 24, 40);
            PdfWriter writer = PdfWriter.getInstance(document, baos);

            // Rodapé com paginação via page events
            writer.setPageEvent(new com.lowagie.text.pdf.PdfPageEventHelper() {
                @Override
                public void onEndPage(PdfWriter w, Document doc) {
                    try {
                        var cb = w.getDirectContent();
                        Font footerFont = FontFactory.getFont(FontFactory.HELVETICA, 7, new Color(140, 140, 140));
                        float pageW = doc.getPageSize().getWidth();
                        int pageNum = w.getPageNumber();
                        String footerText = "Kaizen · Orçamento de TIC · DFD-TIC " + anoFormacao + " — página " + pageNum;
                        com.lowagie.text.pdf.ColumnText.showTextAligned(
                            cb, Element.ALIGN_CENTER,
                            new com.lowagie.text.Phrase(footerText, footerFont),
                            pageW / 2, 18, 0);
                    } catch (Exception ignored) {}
                }
            });

            document.open();
            
            // ── Paleta de cores ──
            Color bgNavy = new Color(15, 38, 80);
            Color bgBloco = new Color(241, 245, 249);       // slate-100
            Color bgTableHead = new Color(248, 250, 252);    // slate-50
            Color accentBlue = new Color(30, 58, 138);       // blue-900
            Color subtotalBg = new Color(239, 246, 255);     // blue-50
            Color borderSlate = new Color(226, 232, 240);    // slate-200

            // ── Fontes ──
            Font fontHeaderTitle = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, Color.WHITE);
            Font fontHeaderSub = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.WHITE);
            Font fontDocTitle = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13, accentBlue);
            Font fontDocSubtitle = FontFactory.getFont(FontFactory.HELVETICA, 10, new Color(100, 116, 139)); // slate-500
            Font fontMetaLabel = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, new Color(100, 116, 139));
            Font fontMetaValue = FontFactory.getFont(FontFactory.HELVETICA, 9, new Color(30, 41, 59));       // slate-800
            Font fontBlocoTitle = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, accentBlue);
            Font fontBlocoCount = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.DARK_GRAY);
            Font fontIfoTitle = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.BLACK);
            Font fontIfoText = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.DARK_GRAY);
            Font fontIfoValue = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.DARK_GRAY);
            Font fontTableHead = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, Color.GRAY);
            Font fontTableBody = FontFactory.getFont(FontFactory.HELVETICA, 9, new Color(50, 50, 50));
            Font fontLink = FontFactory.getFont(FontFactory.HELVETICA, 9, new Color(59, 130, 246));
            Font fontSubtotal = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, accentBlue);
            Font fontTotalGeral = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, Color.WHITE);

            // ══════════════════════════════════════════
            // 1. CABEÇALHO INSTITUCIONAL
            // ══════════════════════════════════════════
            PdfPTable headerTable = new PdfPTable(1);
            headerTable.setWidthPercentage(100);
            PdfPCell headerCell = new PdfPCell();
            headerCell.setBackgroundColor(bgNavy);
            headerCell.setPadding(15);
            headerCell.setBorder(Rectangle.NO_BORDER);
            headerCell.addElement(new Paragraph("KAIZEN | Plataforma de Governança Judiciária e Tecnológica", fontHeaderTitle));
            headerCell.addElement(new Paragraph("Tribunal de Justiça do Estado de Goiás", fontHeaderSub));
            headerTable.addCell(headerCell);
            document.add(headerTable);

            // ══════════════════════════════════════════
            // 2. TÍTULO DO DOCUMENTO
            // ══════════════════════════════════════════
            String docTitleText = "DOCUMENTO DE FORMALIZAÇÃO DA DEMANDA (DFD)";
            if (!"remessa_dg".equals(ciclo.estado()) && !"publicado".equals(ciclo.estado())) {
                docTitleText = "PROPOSTA DE DOCUMENTO DE FORMALIZAÇÃO DA DEMANDA";
            }
            Paragraph docTitle = new Paragraph(docTitleText, fontDocTitle);
            docTitle.setSpacingBefore(12);
            docTitle.setAlignment(Element.ALIGN_CENTER);
            document.add(docTitle);

            Paragraph docSubtitle = new Paragraph("Plano de Contratações Anuais de TIC — PCA-TIC " + anoFormacao, fontDocSubtitle);
            docSubtitle.setAlignment(Element.ALIGN_CENTER);
            docSubtitle.setSpacingAfter(10);
            document.add(docSubtitle);

            // ══════════════════════════════════════════
            // 3. METADADOS DO CICLO
            // ══════════════════════════════════════════
            PdfPTable metaTable = new PdfPTable(4);
            metaTable.setWidthPercentage(100);
            metaTable.setWidths(new float[]{25f, 25f, 25f, 25f});
            metaTable.setSpacingAfter(14);

            String[][] metaDados = {
                {"PROAD de Instrução", ciclo.proad() != null ? ciclo.proad() : "—"},
                {"Versão", String.valueOf(ciclo.versaoGerada() != null ? ciclo.versaoGerada() : 1)},
                {"Emitido em", LocalDate.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy"))},
                {"Total de IFOs", String.valueOf(ifos.size())}
            };
            for (String[] meta : metaDados) {
                PdfPCell metaCell = new PdfPCell();
                metaCell.setBorder(Rectangle.BOTTOM);
                metaCell.setBorderColor(borderSlate);
                metaCell.setPaddingBottom(6);
                metaCell.setPaddingTop(4);
                metaCell.addElement(new Paragraph(meta[0], fontMetaLabel));
                metaCell.addElement(new Paragraph(meta[1], fontMetaValue));
                metaTable.addCell(metaCell);
            }
            document.add(metaTable);

            // ══════════════════════════════════════════
            // 4. BLOCOS DE IFOs
            // ══════════════════════════════════════════
            List<String> blocosOrder = List.of("encerramento", "renovacao", "plurianual", "nova_contratacao");
            Map<String, String> blocosNomes = Map.of(
                "encerramento", "Bloco 1 — Encerramento",
                "renovacao", "Bloco 2 — Renovação",
                "plurianual", "Bloco 3 — Plurianual",
                "nova_contratacao", "Bloco 4 — Nova Contratação"
            );

            long totalGeral = 0;

            for (String blocoKey : blocosOrder) {
                List<Map<String, Object>> ifosDoBloco = ifosPorBloco.getOrDefault(blocoKey, Collections.emptyList());
                
                // Subtotal do bloco
                long subtotalBloco = ifosDoBloco.stream()
                    .mapToLong(i -> i.get("valor_estimado_cents") != null ? ((Number) i.get("valor_estimado_cents")).longValue() : 0L)
                    .sum();
                totalGeral += subtotalBloco;
                
                // Título do Bloco
                PdfPTable blocoHeader = new PdfPTable(2);
                blocoHeader.setWidthPercentage(100);
                blocoHeader.setWidths(new float[]{70f, 30f});
                blocoHeader.setSpacingBefore(6);
                
                PdfPCell cellTitle = new PdfPCell(new Paragraph(blocosNomes.get(blocoKey), fontBlocoTitle));
                cellTitle.setBackgroundColor(bgBloco);
                cellTitle.setPadding(8);
                cellTitle.setBorder(Rectangle.NO_BORDER);
                blocoHeader.addCell(cellTitle);
                
                String countAndTotal = ifosDoBloco.size() + " IFOs · " + String.format("R$ %,.2f", subtotalBloco / 100.0);
                PdfPCell cellCount = new PdfPCell(new Paragraph(countAndTotal, fontBlocoCount));
                cellCount.setBackgroundColor(bgBloco);
                cellCount.setPadding(8);
                cellCount.setBorder(Rectangle.NO_BORDER);
                cellCount.setHorizontalAlignment(Element.ALIGN_RIGHT);
                blocoHeader.addCell(cellCount);
                
                document.add(blocoHeader);
                document.add(new Paragraph(" ", FontFactory.getFont(FontFactory.HELVETICA, 4)));
                
                if (ifosDoBloco.isEmpty()) {
                    Paragraph empty = new Paragraph("Nenhum IFO cadastrado.", fontIfoText);
                    empty.setAlignment(Element.ALIGN_CENTER);
                    empty.setSpacingAfter(14);
                    document.add(empty);
                    continue;
                }
                
                // Lista de IFOs no bloco
                for (Map<String, Object> ifo : ifosDoBloco) {
                    Long ifoId = ((Number) ifo.get("id")).longValue();
                    String codigo = (String) ifo.get("codigo");
                    String objeto = (String) ifo.get("objeto");
                    String area = (String) ifo.get("area_demandante");
                    Long valCents = ifo.get("valor_estimado_cents") != null ? ((Number)ifo.get("valor_estimado_cents")).longValue() : 0L;
                    String valorFormatado = String.format("R$ %,.2f", valCents / 100.0);
                    
                    // Card do IFO
                    PdfPTable ifoTable = new PdfPTable(2);
                    ifoTable.setWidthPercentage(100);
                    ifoTable.setWidths(new float[]{75f, 25f});
                    ifoTable.setSpacingAfter(10);
                    
                    PdfPCell cellCod = new PdfPCell(new Paragraph(codigo, fontIfoTitle));
                    cellCod.setBorder(Rectangle.NO_BORDER);
                    ifoTable.addCell(cellCod);
                    
                    PdfPCell cellAreaVal = new PdfPCell(new Paragraph((area != null ? area : "—") + "   " + valorFormatado, fontIfoValue));
                    cellAreaVal.setBorder(Rectangle.NO_BORDER);
                    cellAreaVal.setHorizontalAlignment(Element.ALIGN_RIGHT);
                    ifoTable.addCell(cellAreaVal);
                    
                    PdfPCell cellObj = new PdfPCell(new Paragraph(objeto != null ? objeto : "", fontIfoText));
                    cellObj.setColspan(2);
                    cellObj.setBorder(Rectangle.NO_BORDER);
                    cellObj.setPaddingBottom(6);
                    ifoTable.addCell(cellObj);
                    
                    // Contratos Aninhados
                    List<Map<String, Object>> contrList = contratosPorIfo.getOrDefault(ifoId, Collections.emptyList());
                    if (!contrList.isEmpty()) {
                        PdfPTable ctTable = new PdfPTable(5);
                        ctTable.setWidthPercentage(100);
                        ctTable.setWidths(new float[]{20f, 20f, 15f, 25f, 20f});
                        
                        String[] ctHeaders = {"Contrato", "Natureza", "Nat. despesa", "Valor anual", "Vigência"};
                        for (String h : ctHeaders) {
                            PdfPCell cHead = new PdfPCell(new Paragraph(h, fontTableHead));
                            cHead.setBackgroundColor(bgTableHead);
                            cHead.setBorderColor(Color.LIGHT_GRAY);
                            cHead.setPadding(5);
                            ctTable.addCell(cHead);
                        }
                        
                        DateTimeFormatter dtf = DateTimeFormatter.ofPattern("dd/MM/yyyy");
                        for (Map<String, Object> ct : contrList) {
                            String ctNum = ct.get("notice_number") != null ? "CT " + ct.get("notice_number") : "CT —";
                            String ctNat = ct.get("situation") != null ? String.valueOf(ct.get("situation")) : "—";
                            String ctNatDesp = ct.get("expense_nature") != null ? String.valueOf(ct.get("expense_nature")) : "—";
                            
                            Long ctValCents = ct.get("year_value") != null ? ((Number) ct.get("year_value")).longValue() : 0L;
                            String ctVal = String.format("R$ %,.2f", ctValCents / 100.0);
                            
                            String ctVig = "—";
                            if (ct.get("end_date") != null) {
                                LocalDate dt = ((java.sql.Date) ct.get("end_date")).toLocalDate();
                                ctVig = "até " + dt.format(dtf);
                            }
                            
                            PdfPCell[] cells = {
                                new PdfPCell(new Paragraph(ctNum, fontLink)),
                                new PdfPCell(new Paragraph(ctNat, fontTableBody)),
                                new PdfPCell(new Paragraph(ctNatDesp, fontTableBody)),
                                new PdfPCell(new Paragraph(ctVal, fontTableBody)),
                                new PdfPCell(new Paragraph(ctVig, fontTableBody))
                            };
                            
                            for (PdfPCell c : cells) {
                                c.setBorderColor(Color.LIGHT_GRAY);
                                c.setPadding(5);
                                ctTable.addCell(c);
                            }
                        }
                        
                        PdfPCell ctContainer = new PdfPCell(ctTable);
                        ctContainer.setColspan(2);
                        ctContainer.setBorder(Rectangle.NO_BORDER);
                        ifoTable.addCell(ctContainer);
                    }
                    
                    // Separador de IFO
                    PdfPCell separator = new PdfPCell();
                    separator.setColspan(2);
                    separator.setBorder(Rectangle.BOTTOM);
                    separator.setBorderColor(borderSlate);
                    separator.setPaddingTop(6);
                    ifoTable.addCell(separator);

                    document.add(ifoTable);
                }

                // Subtotal por bloco
                if (!ifosDoBloco.isEmpty()) {
                    PdfPTable subtotalTable = new PdfPTable(2);
                    subtotalTable.setWidthPercentage(100);
                    subtotalTable.setWidths(new float[]{75f, 25f});
                    subtotalTable.setSpacingAfter(10);

                    PdfPCell stLabel = new PdfPCell(new Paragraph("Subtotal — " + blocosNomes.get(blocoKey), fontSubtotal));
                    stLabel.setBackgroundColor(subtotalBg);
                    stLabel.setPadding(6);
                    stLabel.setBorder(Rectangle.NO_BORDER);
                    subtotalTable.addCell(stLabel);

                    PdfPCell stValue = new PdfPCell(new Paragraph(String.format("R$ %,.2f", subtotalBloco / 100.0), fontSubtotal));
                    stValue.setBackgroundColor(subtotalBg);
                    stValue.setPadding(6);
                    stValue.setBorder(Rectangle.NO_BORDER);
                    stValue.setHorizontalAlignment(Element.ALIGN_RIGHT);
                    subtotalTable.addCell(stValue);

                    document.add(subtotalTable);
                }
            }

            // ══════════════════════════════════════════
            // 5. TOTAL GERAL
            // ══════════════════════════════════════════
            PdfPTable totalTable = new PdfPTable(2);
            totalTable.setWidthPercentage(100);
            totalTable.setWidths(new float[]{75f, 25f});
            totalTable.setSpacingBefore(8);

            PdfPCell tgLabel = new PdfPCell(new Paragraph("TOTAL GERAL", fontTotalGeral));
            tgLabel.setBackgroundColor(bgNavy);
            tgLabel.setPadding(10);
            tgLabel.setBorder(Rectangle.NO_BORDER);
            totalTable.addCell(tgLabel);

            PdfPCell tgValue = new PdfPCell(new Paragraph(String.format("R$ %,.2f", totalGeral / 100.0), fontTotalGeral));
            tgValue.setBackgroundColor(bgNavy);
            tgValue.setPadding(10);
            tgValue.setBorder(Rectangle.NO_BORDER);
            tgValue.setHorizontalAlignment(Element.ALIGN_RIGHT);
            totalTable.addCell(tgValue);

            document.add(totalTable);

            document.close();
            return baos.toByteArray();
        } catch (Exception e) {
            throw new ApiException(500, "Erro ao gerar PDF da Proposta DFD: " + e.getMessage());
        }
    }


    private static Integer asInt(Object v) {
        return v == null ? null : ((Number) v).intValue();
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }
}
