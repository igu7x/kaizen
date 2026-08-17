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
    private final StorageService storageService;
    private final ParametrosCicloService parametrosCicloService;

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

    /** Fallback hardcoded — usado apenas se a tabela parametros_ciclo_revisao estiver vazia. */
    private static final List<Janela> JANELAS_FALLBACK = List.of(
            new Janela(1, 2, null, MonthDay.of(1, 31)),
            new Janela(2, 3, MonthDay.of(4, 1), MonthDay.of(4, 30)),
            new Janela(3, 4, MonthDay.of(7, 1), MonthDay.of(7, 31)));

    /** RF-31 — corte da Formação: fallback se a tabela parametros_ciclo_geral estiver vazia. */
    private static final MonthDay CORTE_FORMACAO_FALLBACK = MonthDay.of(3, 1);

    /** Lê janelas do banco (parametros_ciclo_revisao) com fallback para valores padrão. */
    private List<Janela> getJanelas() {
        try {
            var params = parametrosCicloService.getJanelasRevisaoParam();
            if (params.isEmpty()) return JANELAS_FALLBACK;
            return params.stream()
                    .map(p -> new Janela(p.ordem(), p.versao(), p.inicio(), p.fim()))
                    .toList();
        } catch (Exception e) {
            return JANELAS_FALLBACK;
        }
    }

    /** Lê corte de formação do banco com fallback. */
    private MonthDay getCorteFormacao() {
        try {
            return parametrosCicloService.getCorteFormacao();
        } catch (Exception e) {
            return CORTE_FORMACAO_FALLBACK;
        }
    }

    private Janela janelaAtiva(LocalDate hoje) {
        MonthDay hm = MonthDay.of(hoje.getMonthValue(), hoje.getDayOfMonth());
        for (Janela j : getJanelas()) {
            if (j.inicio() == null) continue;
            if (!hm.isBefore(j.inicio()) && !hm.isAfter(j.fim())) {
                return j;
            }
        }
        return null;
    }

    private Janela janelaDaVersao(Integer versao) {
        if (versao == null) return null;
        for (Janela j : getJanelas()) {
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
    private String estadoDerivadoPorData(CicloDto ciclo, LocalDate hoje) {
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
            return publicar(id, userId, null, null);
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
    public CicloDto publicar(long id, Long userId, List<br.jus.tjgo.kaizen.dto.ImportacaoPcaDto> importacoes, org.springframework.web.multipart.MultipartFile arquivoPca) {
        // RN-GERAL-01/04 — registrar a publicação é ato de Autoridade (Gestor CCA no estado remessa_dg).
        CicloDto cicloAtual = getCiclo(id);
        exigirTagAcao(userId, cicloAtual.estado(), cicloAtual.finalidade(), id);
        
        String fileKey = null;
        if (arquivoPca != null && !arquivoPca.isEmpty()) {
            storageService.validarArquivo(arquivoPca.getOriginalFilename(), arquivoPca.getSize());
            try {
                fileKey = storageService.uploadPca(id, arquivoPca.getOriginalFilename(), arquivoPca.getContentType(), arquivoPca.getSize(), arquivoPca.getInputStream());
            } catch (java.io.IOException e) {
                throw new ApiException(500, "Erro ao ler arquivo do PCA");
            }
        }

        String sqlUpdate = "UPDATE ciclo_orcamentario SET estado = 'publicado', publicado_em = NOW(), updated_at = NOW(), updated_by = ?";
        if (fileKey != null) {
            sqlUpdate += ", arquivo_pca_key = ?";
        }
        sqlUpdate += " WHERE id = ? AND estado <> 'publicado' RETURNING *";

        List<Map<String, Object>> rows;
        if (fileKey != null) {
            rows = jdbc.queryForList(sqlUpdate, userId, fileKey, id);
        } else {
            rows = jdbc.queryForList(sqlUpdate, userId, id);
        }
        
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
                str(r.get("link_dou")),
                str(r.get("arquivo_pca_key")));
    }

    private static Long asLong(Object v) {
        return v == null ? null : ((Number) v).longValue();
    }


    private List<Map<String, Object>> getDadosParaRelatorios(long cicloId) {
        return jdbc.queryForList("SELECT i.id, i.codigo, i.bloco, i.objeto as description, i.justification, i.quantity, i.valor_estimado_cents, " +
                                 "i.priority, i.estimated_date, i.process, i.natureza, i.financial_resource_type, i.is_sustainable, " +
                                 "i.strategic_objective, i.is_shared_acquisition, " +
                                 "cu.nome as unidade_requisitante " +
                                 "FROM ifo i " +
                                 "LEFT JOIN cadastros_unidades cu ON i.cadastros_unidades_id = cu.id " +
                                 "WHERE i.ciclo_id = ? AND i.is_deleted = FALSE " +
                                 "ORDER BY cu.nome, i.codigo", cicloId);
    }

    private List<Map<String, Object>> getContratosParaRelatorios(long cicloId) {
        return jdbc.queryForList(
            "SELECT ic.ifo_id, c.expense_nature, c.start_date, c.end_date " +
            "FROM ifo_contratos ic " +
            "JOIN contracts c ON ic.contract_id = c.id " +
            "JOIN ifo i ON ic.ifo_id = i.id " +
            "WHERE i.ciclo_id = ? AND i.is_deleted = FALSE", cicloId);
    }

    private String calcularVigenciaMeses(List<Map<String, Object>> contratosIfo) {
        if (contratosIfo == null || contratosIfo.isEmpty()) return "";
        for (Map<String, Object> c : contratosIfo) {
            if (c.get("start_date") != null && c.get("end_date") != null) {
                LocalDate start = ((java.sql.Date) c.get("start_date")).toLocalDate();
                LocalDate end = ((java.sql.Date) c.get("end_date")).toLocalDate();
                long meses = java.time.temporal.ChronoUnit.MONTHS.between(start, end);
                return String.valueOf(meses);
            }
        }
        return "";
    }

    private String obterNaturezaDespesa(List<Map<String, Object>> contratosIfo) {
        if (contratosIfo == null || contratosIfo.isEmpty()) return "";
        for (Map<String, Object> c : contratosIfo) {
            if (c.get("expense_nature") != null) {
                return str(c.get("expense_nature"));
            }
        }
        return "";
    }

    private String mapearBlocoParaMatriz(String bloco) {
        if (bloco == null) return "";
        return switch (bloco) {
            case "renovacao" -> "Renovação";
            case "encerramento" -> "Encerramento";
            case "plurianual" -> "Contrato Plurianual";
            case "nova_contratacao" -> "Nova Contratação";
            default -> bloco;
        };
    }

    public byte[] gerarPdfPropostaDfd(int anoFormacao) {
        CicloDto ciclo = findCicloMaisRecente(anoFormacao, "formacao");
        if (ciclo == null) throw new ApiException(404, "Ciclo de formação não encontrado para o ano " + anoFormacao);

        var ifos = getDadosParaRelatorios(ciclo.id());
        var contratos = getContratosParaRelatorios(ciclo.id());
        Map<Long, List<Map<String, Object>>> contratosPorIfo = contratos.stream()
                .collect(Collectors.groupingBy(row -> asLong(row.get("ifo_id"))));

        Map<String, List<Map<String, Object>>> ifosPorUnidade = ifos.stream()
                .collect(Collectors.groupingBy(row -> str(row.get("unidade_requisitante")) == null ? "Sem Unidade" : str(row.get("unidade_requisitante"))));

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            Document document = new Document(new com.lowagie.text.Rectangle(1400, 700), 10, 10, 10, 20); // Custom Landscape
            PdfWriter writer = PdfWriter.getInstance(document, baos);

            writer.setPageEvent(new com.lowagie.text.pdf.PdfPageEventHelper() {
                @Override
                public void onEndPage(PdfWriter w, Document doc) {
                    try {
                        var cb = w.getDirectContent();
                        Font footerFont = FontFactory.getFont(FontFactory.HELVETICA, 7, new Color(140, 140, 140));
                        float pageW = doc.getPageSize().getWidth();
                        int pageNum = w.getPageNumber();
                        String footerText = "DFD-TIC " + anoFormacao + " — página " + pageNum;
                        com.lowagie.text.pdf.ColumnText.showTextAligned(
                            cb, Element.ALIGN_CENTER,
                            new com.lowagie.text.Phrase(footerText, footerFont),
                            pageW / 2, 10, 0);
                    } catch (Exception ignored) {}
                }
            });

            document.open();

            try {
                com.lowagie.text.Image logo = com.lowagie.text.Image.getInstance(new java.net.URL("https://www.tjgo.jus.br/images/brasao_poder_Judiciario_Horizontal.png"));
                logo.setAlignment(Element.ALIGN_CENTER);
                logo.scaleToFit(200, 100);
                document.add(logo);
            } catch (Exception e) {
                // Ignore e prossegue sem logo se der erro
            }

            Font fontAnexo = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, Color.BLACK);
            Paragraph anexoTitle = new Paragraph("Anexo I", fontAnexo);
            anexoTitle.setAlignment(Element.ALIGN_CENTER);
            anexoTitle.setSpacingBefore(10);
            anexoTitle.setSpacingAfter(5);
            document.add(anexoTitle);

            Font fontDocTitle = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, Color.BLACK);
            Paragraph docTitle = new Paragraph("DOCUMENTO DE FORMALIZAÇÃO DE DEMANDAS - DFD", fontDocTitle);
            docTitle.setAlignment(Element.ALIGN_CENTER);
            docTitle.setSpacingAfter(10);
            document.add(docTitle);

            Font fontTableHead = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 6, Color.BLACK);
            Font fontTableBody = FontFactory.getFont(FontFactory.HELVETICA, 6, Color.BLACK);
            Font fontUnidade = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, Color.BLACK);

            String[] headers = {
                "Código", "Descrição Sucinta do objeto", "Justificativa da necessidade", "Quantidade", 
                "Estimativa Preliminar Do Valor Global (R$)", "Vigência (em meses)", "Nova Licitação ou demanda à Própria ARP?", 
                "Grau de prioridade", "Renovação, Nova contratação, Encerramento de contrato no exercício ou Contrato plurianual?", 
                "Data Estimada da Nova Contratação ou Renovação", "Proad Renovação", "Natureza continuada (sim ou não?)", 
                "Investimento ou custeio?", "A demanda está alinhada às diretrizes de sustentabilidade e às metas do PLS do TJGO (sim ou não)", 
                "Indicação do objetivo estratégico TJGO", "Identificação da natureza da despesa", 
                "A demanda é indicada para eventual compra compartilhada com outros órgãos da adm. pública (sim ou não). Qual(is)"
            };

            for (Map.Entry<String, List<Map<String, Object>>> entry : ifosPorUnidade.entrySet()) {
                String unidade = entry.getKey();
                List<Map<String, Object>> ifosUnidade = entry.getValue();

                Paragraph pUnidade = new Paragraph("UNIDADE REQUISITANTE: " + unidade, fontUnidade);
                pUnidade.setSpacingBefore(10);
                pUnidade.setSpacingAfter(5);
                document.add(pUnidade);

                PdfPTable table = new PdfPTable(17);
                table.setWidthPercentage(100);
                table.setWidths(new float[]{4, 10, 10, 4, 6, 4, 5, 4, 6, 6, 5, 4, 5, 5, 5, 5, 5});

                for (String h : headers) {
                    PdfPCell cell = new PdfPCell(new Paragraph(h, fontTableHead));
                    cell.setHorizontalAlignment(Element.ALIGN_CENTER);
                    cell.setVerticalAlignment(Element.ALIGN_MIDDLE);
                    cell.setPadding(3);
                    table.addCell(cell);
                }

                for (Map<String, Object> ifo : ifosUnidade) {
                    Long ifoId = asLong(ifo.get("id"));
                    List<Map<String, Object>> ctrs = contratosPorIfo.getOrDefault(ifoId, Collections.emptyList());
                    
                    String codigo = str(ifo.get("codigo"));
                    String obj = str(ifo.get("description"));
                    String just = str(ifo.get("justification"));
                    String qt = str(ifo.get("quantity"));
                    
                    Long valCents = ifo.get("valor_estimado_cents") != null ? ((Number)ifo.get("valor_estimado_cents")).longValue() : 0L;
                    String valFormatado = String.format("R$ %,.2f", valCents / 100.0);
                    
                    String vigencia = calcularVigenciaMeses(ctrs);
                    String novaLicit = "Nova Licitação";
                    
                    String prioridade = str(ifo.get("priority"));
                    String bloco = mapearBlocoParaMatriz(str(ifo.get("bloco")));
                    
                    String dtEst = "";
                    if (ifo.get("estimated_date") != null) {
                        LocalDate dt = ((java.sql.Date) ifo.get("estimated_date")).toLocalDate();
                        dtEst = dt.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
                    }
                    
                    String proad = str(ifo.get("process"));
                    String continuada = "continuada".equals(ifo.get("natureza")) ? "Sim" : "Não";
                    String finance = str(ifo.get("financial_resource_type"));
                    
                    String sustentavel = Boolean.TRUE.equals(ifo.get("is_sustainable")) ? "Sim" : "Não";
                    String objEstrat = str(ifo.get("strategic_objective"));
                    String natDesp = obterNaturezaDespesa(ctrs);
                    String comp = Boolean.TRUE.equals(ifo.get("is_shared_acquisition")) ? "Sim" : "Não";

                    String[] row = {
                        codigo == null ? "" : codigo,
                        obj == null ? "" : obj,
                        just == null ? "" : just,
                        qt == null ? "" : qt,
                        valFormatado,
                        vigencia,
                        novaLicit,
                        prioridade == null ? "" : prioridade,
                        bloco,
                        dtEst,
                        proad == null ? "" : proad,
                        continuada,
                        finance == null ? "" : finance,
                        sustentavel,
                        objEstrat == null ? "" : objEstrat,
                        natDesp,
                        comp
                    };

                    for (String text : row) {
                        PdfPCell cell = new PdfPCell(new Paragraph(text, fontTableBody));
                        cell.setPadding(2);
                        cell.setHorizontalAlignment(Element.ALIGN_CENTER);
                        cell.setVerticalAlignment(Element.ALIGN_MIDDLE);
                        table.addCell(cell);
                    }
                }
                document.add(table);
            }

            document.close();
            return baos.toByteArray();
        } catch (Exception e) {
            throw new ApiException(500, "Erro ao gerar PDF da Proposta DFD: " + e.getMessage());
        }
    }

    public byte[] gerarXlsxPropostaDfd(int anoFormacao) {
        CicloDto ciclo = findCicloMaisRecente(anoFormacao, "formacao");
        if (ciclo == null) throw new ApiException(404, "Ciclo de formação não encontrado para o ano " + anoFormacao);

        var ifos = getDadosParaRelatorios(ciclo.id());
        var contratos = getContratosParaRelatorios(ciclo.id());
        Map<Long, List<Map<String, Object>>> contratosPorIfo = contratos.stream()
                .collect(Collectors.groupingBy(row -> asLong(row.get("ifo_id"))));

        Map<String, List<Map<String, Object>>> ifosPorUnidade = ifos.stream()
                .collect(Collectors.groupingBy(row -> str(row.get("unidade_requisitante")) == null ? "Sem Unidade" : str(row.get("unidade_requisitante"))));

        try (org.apache.poi.xssf.usermodel.XSSFWorkbook workbook = new org.apache.poi.xssf.usermodel.XSSFWorkbook();
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {

            org.apache.poi.ss.usermodel.Sheet sheet = workbook.createSheet("DFD-TIC " + anoFormacao);
            sheet.setDisplayGridlines(false);
            sheet.setPrintGridlines(false);

            // ── Larguras de coluna proporcionais ao PDF (em 1/256 de caractere) ──
            int[] colWidths = {3000, 9000, 9000, 3000, 5000, 3000, 4500, 3000, 5500, 5000, 4500, 3500, 4500, 4500, 4500, 4500, 4500};
            for (int i = 0; i < colWidths.length; i++) sheet.setColumnWidth(i, colWidths[i]);

            // ── Bordas finas helper ──
            org.apache.poi.ss.usermodel.BorderStyle thin = org.apache.poi.ss.usermodel.BorderStyle.THIN;
            short borderColor = org.apache.poi.ss.usermodel.IndexedColors.GREY_50_PERCENT.getIndex();

            // ── Fontes ──
            org.apache.poi.ss.usermodel.Font fontAnexo = workbook.createFont();
            fontAnexo.setBold(true);
            fontAnexo.setFontHeightInPoints((short) 14);

            org.apache.poi.ss.usermodel.Font fontTitle = workbook.createFont();
            fontTitle.setBold(true);
            fontTitle.setFontHeightInPoints((short) 12);

            org.apache.poi.ss.usermodel.Font fontHeader = workbook.createFont();
            fontHeader.setBold(true);
            fontHeader.setFontHeightInPoints((short) 8);

            org.apache.poi.ss.usermodel.Font fontBody = workbook.createFont();
            fontBody.setFontHeightInPoints((short) 8);

            org.apache.poi.ss.usermodel.Font fontUnidade = workbook.createFont();
            fontUnidade.setBold(true);
            fontUnidade.setFontHeightInPoints((short) 9);

            // ── Estilos ──
            // Anexo I
            org.apache.poi.ss.usermodel.CellStyle styleAnexo = workbook.createCellStyle();
            styleAnexo.setFont(fontAnexo);
            styleAnexo.setAlignment(org.apache.poi.ss.usermodel.HorizontalAlignment.CENTER);
            styleAnexo.setVerticalAlignment(org.apache.poi.ss.usermodel.VerticalAlignment.CENTER);

            // Titulo DFD
            org.apache.poi.ss.usermodel.CellStyle styleTitle = workbook.createCellStyle();
            styleTitle.setFont(fontTitle);
            styleTitle.setAlignment(org.apache.poi.ss.usermodel.HorizontalAlignment.CENTER);
            styleTitle.setVerticalAlignment(org.apache.poi.ss.usermodel.VerticalAlignment.CENTER);

            // Cabeçalho de coluna (bordas, negrito, wrap — sem fundo)
            org.apache.poi.ss.usermodel.CellStyle styleColHeader = workbook.createCellStyle();
            styleColHeader.setFont(fontHeader);
            styleColHeader.setAlignment(org.apache.poi.ss.usermodel.HorizontalAlignment.CENTER);
            styleColHeader.setVerticalAlignment(org.apache.poi.ss.usermodel.VerticalAlignment.CENTER);
            styleColHeader.setWrapText(true);
            styleColHeader.setBorderTop(thin);
            styleColHeader.setBorderBottom(thin);
            styleColHeader.setBorderLeft(thin);
            styleColHeader.setBorderRight(thin);
            styleColHeader.setTopBorderColor(borderColor);
            styleColHeader.setBottomBorderColor(borderColor);
            styleColHeader.setLeftBorderColor(borderColor);
            styleColHeader.setRightBorderColor(borderColor);

            // Unidade requisitante (fundo cinza escuro, negrito)
            org.apache.poi.ss.usermodel.CellStyle styleUnidade = workbook.createCellStyle();
            styleUnidade.setFont(fontUnidade);
            styleUnidade.setAlignment(org.apache.poi.ss.usermodel.HorizontalAlignment.LEFT);
            styleUnidade.setVerticalAlignment(org.apache.poi.ss.usermodel.VerticalAlignment.CENTER);
            styleUnidade.setFillForegroundColor(org.apache.poi.ss.usermodel.IndexedColors.GREY_40_PERCENT.getIndex());
            styleUnidade.setFillPattern(org.apache.poi.ss.usermodel.FillPatternType.SOLID_FOREGROUND);
            styleUnidade.setBorderTop(thin);
            styleUnidade.setBorderBottom(thin);
            styleUnidade.setBorderLeft(thin);
            styleUnidade.setBorderRight(thin);

            // Célula de dados (bordas, centralizado, wrap)
            org.apache.poi.ss.usermodel.CellStyle styleData = workbook.createCellStyle();
            styleData.setFont(fontBody);
            styleData.setAlignment(org.apache.poi.ss.usermodel.HorizontalAlignment.CENTER);
            styleData.setVerticalAlignment(org.apache.poi.ss.usermodel.VerticalAlignment.CENTER);
            styleData.setWrapText(true);
            styleData.setBorderTop(thin);
            styleData.setBorderBottom(thin);
            styleData.setBorderLeft(thin);
            styleData.setBorderRight(thin);
            styleData.setTopBorderColor(borderColor);
            styleData.setBottomBorderColor(borderColor);
            styleData.setLeftBorderColor(borderColor);
            styleData.setRightBorderColor(borderColor);

            // Célula de dados alinhada à esquerda (descrição, justificativa)
            org.apache.poi.ss.usermodel.CellStyle styleDataLeft = workbook.createCellStyle();
            styleDataLeft.setFont(fontBody);
            styleDataLeft.setAlignment(org.apache.poi.ss.usermodel.HorizontalAlignment.LEFT);
            styleDataLeft.setVerticalAlignment(org.apache.poi.ss.usermodel.VerticalAlignment.CENTER);
            styleDataLeft.setWrapText(true);
            styleDataLeft.setBorderTop(thin);
            styleDataLeft.setBorderBottom(thin);
            styleDataLeft.setBorderLeft(thin);
            styleDataLeft.setBorderRight(thin);
            styleDataLeft.setTopBorderColor(borderColor);
            styleDataLeft.setBottomBorderColor(borderColor);
            styleDataLeft.setLeftBorderColor(borderColor);
            styleDataLeft.setRightBorderColor(borderColor);

            String[] headers = {
                "Código", "Descrição Sucinta do objeto", "Justificativa da necessidade", "Quantidade", 
                "Estimativa Preliminar Do Valor Global (R$)", "Vigência (em meses)", "Nova Licitação ou demanda à Própria ARP?", 
                "Grau de prioridade", "Renovação, Nova contratação, Encerramento de contrato no exercício ou Contrato plurianual?", 
                "Data Estimada da Nova Contratação ou Renovação", "Proad Renovação", "Natureza continuada (sim ou não?)", 
                "Investimento ou custeio?", "A demanda está alinhada às diretrizes de sustentabilidade e às metas do PLS do TJGO (sim ou não)", 
                "Indicação do objetivo estratégico TJGO", "Identificação da natureza da despesa", 
                "A demanda é indicada para eventual compra compartilhada com outros órgãos da adm. pública (sim ou não). Qual(is)"
            };

            // Colunas que ficam alinhadas à esquerda (descrição e justificativa)
            java.util.Set<Integer> leftAlignedCols = java.util.Set.of(1, 2);

            int rowNum = 0;

            // ── Logo ──
            try {
                java.net.URL url = new java.net.URL("https://www.tjgo.jus.br/images/brasao_poder_Judiciario_Horizontal.png");
                byte[] imageBytes;
                try (java.io.InputStream is = url.openStream()) {
                    imageBytes = is.readAllBytes();
                }
                // Criar linhas placeholder para a imagem
                for (int r = rowNum; r < rowNum + 4; r++) {
                    sheet.createRow(r).setHeightInPoints(20);
                }
                int pictureIdx = workbook.addPicture(imageBytes, org.apache.poi.ss.usermodel.Workbook.PICTURE_TYPE_PNG);
                org.apache.poi.ss.usermodel.CreationHelper helper = workbook.getCreationHelper();
                org.apache.poi.ss.usermodel.Drawing<?> drawing = sheet.createDrawingPatriarch();
                org.apache.poi.ss.usermodel.ClientAnchor anchor = helper.createClientAnchor();
                anchor.setCol1(6);
                anchor.setRow1(rowNum);
                anchor.setAnchorType(org.apache.poi.ss.usermodel.ClientAnchor.AnchorType.MOVE_DONT_RESIZE);
                org.apache.poi.ss.usermodel.Picture pic = drawing.createPicture(anchor, pictureIdx);
                pic.resize(0.4);
                rowNum += 4;
            } catch (Exception e) {
                // Ignore
            }

            // ── Anexo I ──
            org.apache.poi.ss.usermodel.Row anexoRow = sheet.createRow(rowNum);
            anexoRow.setHeightInPoints(22);
            org.apache.poi.ss.usermodel.Cell anexoCell = anexoRow.createCell(0);
            anexoCell.setCellValue("Anexo I");
            anexoCell.setCellStyle(styleAnexo);
            sheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(rowNum, rowNum, 0, headers.length - 1));
            rowNum++;

            // ── Título DFD ──
            org.apache.poi.ss.usermodel.Row titleRow = sheet.createRow(rowNum);
            titleRow.setHeightInPoints(20);
            org.apache.poi.ss.usermodel.Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("DOCUMENTO DE FORMALIZAÇÃO DE DEMANDAS - DFD");
            titleCell.setCellStyle(styleTitle);
            sheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(rowNum, rowNum, 0, headers.length - 1));
            rowNum++;
            rowNum++; // linha em branco

            // ── Blocos por unidade ──
            for (Map.Entry<String, List<Map<String, Object>>> entry : ifosPorUnidade.entrySet()) {
                String unidade = entry.getKey();
                List<Map<String, Object>> ifosUnidade = entry.getValue();

                // Linha da unidade
                org.apache.poi.ss.usermodel.Row rowUnid = sheet.createRow(rowNum);
                rowUnid.setHeightInPoints(18);
                org.apache.poi.ss.usermodel.Cell cellUnid = rowUnid.createCell(0);
                cellUnid.setCellValue("UNIDADE REQUISITANTE: " + unidade);
                cellUnid.setCellStyle(styleUnidade);
                // Preencher células mescladas com o mesmo estilo para bordas contínuas
                for (int i = 1; i < headers.length; i++) {
                    rowUnid.createCell(i).setCellStyle(styleUnidade);
                }
                sheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(rowNum, rowNum, 0, headers.length - 1));
                rowNum++;

                // Cabeçalho de colunas
                org.apache.poi.ss.usermodel.Row headerRow = sheet.createRow(rowNum);
                headerRow.setHeightInPoints(45);
                for (int i = 0; i < headers.length; i++) {
                    org.apache.poi.ss.usermodel.Cell c = headerRow.createCell(i);
                    c.setCellValue(headers[i]);
                    c.setCellStyle(styleColHeader);
                }
                rowNum++;

                // Linhas de dados
                for (Map<String, Object> ifo : ifosUnidade) {
                    Long ifoId = asLong(ifo.get("id"));
                    List<Map<String, Object>> ctrs = contratosPorIfo.getOrDefault(ifoId, Collections.emptyList());

                    String codigo = str(ifo.get("codigo"));
                    String obj = str(ifo.get("description"));
                    String just = str(ifo.get("justification"));
                    String qt = str(ifo.get("quantity"));

                    Long valCents = ifo.get("valor_estimado_cents") != null ? ((Number) ifo.get("valor_estimado_cents")).longValue() : 0L;
                    String valFormatado = String.format("R$ %,.2f", valCents / 100.0);

                    String vigencia = calcularVigenciaMeses(ctrs);
                    String novaLicit = "Nova Licitação";

                    String prioridade = str(ifo.get("priority"));
                    String bloco = mapearBlocoParaMatriz(str(ifo.get("bloco")));

                    String dtEst = "";
                    if (ifo.get("estimated_date") != null) {
                        LocalDate dt = ((java.sql.Date) ifo.get("estimated_date")).toLocalDate();
                        dtEst = dt.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
                    }

                    String proad = str(ifo.get("process"));
                    String continuada = "continuada".equals(ifo.get("natureza")) ? "Sim" : "Não";
                    String finance = str(ifo.get("financial_resource_type"));

                    String sustentavel = Boolean.TRUE.equals(ifo.get("is_sustainable")) ? "Sim" : "Não";
                    String objEstrat = str(ifo.get("strategic_objective"));
                    String natDesp = obterNaturezaDespesa(ctrs);
                    String comp = Boolean.TRUE.equals(ifo.get("is_shared_acquisition")) ? "Sim" : "Não";

                    String[] rowData = {
                        codigo == null ? "" : codigo,
                        obj == null ? "" : obj,
                        just == null ? "" : just,
                        qt == null ? "" : qt,
                        valFormatado,
                        vigencia,
                        novaLicit,
                        prioridade == null ? "" : prioridade,
                        bloco,
                        dtEst,
                        proad == null ? "" : proad,
                        continuada,
                        finance == null ? "" : finance,
                        sustentavel,
                        objEstrat == null ? "" : objEstrat,
                        natDesp,
                        comp
                    };

                    org.apache.poi.ss.usermodel.Row dataRow = sheet.createRow(rowNum++);
                    for (int i = 0; i < rowData.length; i++) {
                        org.apache.poi.ss.usermodel.Cell c = dataRow.createCell(i);
                        c.setCellValue(rowData[i]);
                        c.setCellStyle(leftAlignedCols.contains(i) ? styleDataLeft : styleData);
                    }
                }
                rowNum++; // espaço entre unidades
            }

            // ── Configurar impressão paisagem ──
            sheet.getPrintSetup().setLandscape(true);
            sheet.getPrintSetup().setPaperSize(org.apache.poi.ss.usermodel.PrintSetup.A3_PAPERSIZE);
            sheet.setFitToPage(true);
            sheet.getPrintSetup().setFitWidth((short) 1);
            sheet.getPrintSetup().setFitHeight((short) 0);

            workbook.write(baos);
            return baos.toByteArray();
        } catch (Exception e) {
            throw new ApiException(500, "Erro ao gerar XLSX da Proposta DFD: " + e.getMessage());
        }
    }
    private static Integer asInt(Object v) {
        return v == null ? null : ((Number) v).intValue();
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }
}
