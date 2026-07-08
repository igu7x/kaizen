package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.exception.ApiException;
import br.jus.tjgo.kaizen.utils.OrgCodigos;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.time.LocalDate;
import br.jus.tjgo.kaizen.utils.DateHelper;
import br.jus.tjgo.kaizen.utils.SqlValue;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Service do módulo Cadastros — gerencia Projetos (e seus aninhados: Entregas, Tarefas,
 * Riscos, Entraves, Áreas de execução) + TAP em 3 camadas identity-based.
 *
 * Nome histórico do tipo era ContratosProjetosService (espelhando contratos-projetos.service.ts
 * do backend Node); renomeado em jun/2026 para refletir o módulo correto (Cadastros).
 * As tabelas continuam com prefixo cadastros_projetos_* por compatibilidade com o Node
 * durante o período de cutover — nome interno legado, não confundir com o módulo PCA
 * (Contratações de TI) que é um módulo distinto.
 *
 * Status do projeto: valores brutos preservados (planejado, em_execucao, suspenso, concluido,
 * cancelado). Status manuais (concluido/cancelado/suspenso) são preservados por calcularProgresso.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CadastrosProjetosService {

    private final JdbcTemplate jdbc;
    private final DomainService domainService;
    private final ObjectMapper objectMapper;

    private static final Set<String> STATUS_MANUAIS = Set.of("concluido", "cancelado", "suspenso");

    /**
     * Colunas nao-texto de cadastros_projetos (integer / bigint / numeric) no UPDATE.
     * O Jackson serializa numeric (BigDecimal) e bigint (Long) como STRING, por paridade com o
     * driver pg do Node; o front devolve essas strings no PUT. O pgjdbc binda String como VARCHAR
     * e o Postgres recusa a atribuicao. Precisam passar por numOrNull(), como ja faz o INSERT.
     */
    private static final Set<String> COLUNAS_NUMERICAS = Set.of(
            "patrocinador_id", "gestor_id", "valor_estimado_contratacao", "pca_item_id");

    // Códigos de diretoria/macro área centralizados em OrgCodigos (compartilhado com processos).

    private static final List<String> TAP_CRITICAL_FIELDS = List.of(
            "nome", "objetivo", "contexto_justificativa", "patrocinador_id", "gestor_id",
            "escopo_sintetico", "fora_do_escopo", "data_prevista_inicio", "data_prevista_conclusao",
            "prioridade", "complexidade", "abrangencia", "tap_vinculado");

    private boolean hasColumn(String tableName, String columnName) {
        return !jdbc.queryForList(
                "SELECT 1 FROM information_schema.columns WHERE table_name = ? AND column_name = ?",
                tableName, columnName).isEmpty();
    }

    // ============================================================
    // DEBUG / DIAGNÓSTICO (counts ::text → string, paridade pg bigint)
    // ============================================================

    public Map<String, Object> getDebugTarefas(Integer projetoId, Integer entregaId) {
        Map<String, Object> diagnostico = new LinkedHashMap<>();
        diagnostico.put("timestamp", java.time.Instant.now());
        diagnostico.put("resumo", new LinkedHashMap<>());

        boolean tabelaExiste = Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS (SELECT FROM information_schema.tables " +
                        "WHERE table_name = 'cadastros_projetos_entregas_tarefas') as exists", Boolean.class));
        diagnostico.put("tabela_existe", tabelaExiste);
        if (!tabelaExiste) {
            diagnostico.put("erro", "Tabela cadastros_projetos_entregas_tarefas não existe no banco");
            return diagnostico;
        }

        diagnostico.put("resumo", jdbc.queryForMap(
                "SELECT COUNT(*)::text as total, COUNT(*) FILTER (WHERE ativo = TRUE)::text as ativas, " +
                        "COUNT(*) FILTER (WHERE ativo = FALSE)::text as inativas " +
                        "FROM cadastros_projetos_entregas_tarefas"));

        if (projetoId != null) {
            diagnostico.put("entregas_do_projeto", jdbc.queryForList(
                    "SELECT e.id, e.nome, e.status, e.ativo, " +
                            "(SELECT COUNT(*)::text FROM cadastros_projetos_entregas_tarefas t WHERE t.entrega_id = e.id AND t.ativo = TRUE) as tarefas_ativas, " +
                            "(SELECT COUNT(*)::text FROM cadastros_projetos_entregas_tarefas t WHERE t.entrega_id = e.id) as tarefas_total " +
                            "FROM cadastros_projetos_entregas e WHERE e.projeto_id = ? ORDER BY e.ordem, e.id", projetoId));
        }
        if (entregaId != null) {
            diagnostico.put("tarefas_da_entrega", jdbc.queryForList(
                    "SELECT id, nome, status, sprint_id, responsavel, ativo, created_at, updated_at " +
                            "FROM cadastros_projetos_entregas_tarefas WHERE entrega_id = ? ORDER BY ativo DESC, ordem, id", entregaId));
        }
        diagnostico.put("ultimas_tarefas_criadas", jdbc.queryForList(
                "SELECT t.id, t.nome, t.status, t.ativo, t.entrega_id, e.nome as entrega_nome, t.created_at " +
                        "FROM cadastros_projetos_entregas_tarefas t " +
                        "JOIN cadastros_projetos_entregas e ON e.id = t.entrega_id " +
                        "ORDER BY t.created_at DESC LIMIT 10"));
        return diagnostico;
    }

    // ============================================================
    // PROJETOS
    // ============================================================

    public List<Map<String, Object>> getAllProjetos(String diretoria) {
        // `diretorias_nomes` (siglas das diretorias vinculadas) não existe na view; é montado aqui,
        // igual em getProjetosByInstrumentoId, para o front filtrar o portfólio por diretoria.
        boolean hasSigla = hasColumn("cadastros_areas", "sigla");
        String colunaExpressao = hasSigla
                ? "ca.sigla"
                : "COALESCE(SUBSTRING(ca.nome FROM '\\(([^)]+)\\)'), ca.nome)";
        StringBuilder sql = new StringBuilder(
                "SELECT p.*, COALESCE((SELECT STRING_AGG(" + colunaExpressao + ", ', ') FROM cadastros_areas ca " +
                        "WHERE ca.id = ANY(p.areas_vinculadas_ids)), p.diretoria) AS diretorias_nomes " +
                        "FROM vw_cadastros_projetos_completo p WHERE 1=1");
        List<Object> params = new ArrayList<>();
        if (diretoria != null) {
            var domain = domainService.getDomainForDiretoria(diretoria);
            if (domain.isDomainRoot()) {
                params.add(domain.dominio());
                sql.append(" AND (p.areas_vinculadas_ids IS NULL OR array_length(p.areas_vinculadas_ids, 1) IS NULL " +
                        "OR EXISTS (SELECT 1 FROM cadastros_areas ca WHERE ca.id = ANY(p.areas_vinculadas_ids) " +
                        "AND (ca.dominio = ? OR ca.dominio IS NULL)))");
            } else {
                params.add(diretoria);
                sql.append(" AND EXISTS (SELECT 1 FROM cadastros_areas ca WHERE ca.id = ANY(p.areas_vinculadas_ids) " +
                        "AND ca.sigla = ?)");
            }
        }
        sql.append(" ORDER BY p.codigo DESC");
        var projetos = jdbc.queryForList(sql.toString(), params.toArray());
        for (Map<String, Object> projeto : projetos) {
            projeto.put("areasExecucao", getAreasExecucao(((Number) projeto.get("id")).longValue()));
        }
        return projetos;
    }

    public Map<String, Object> getProjetoById(long id) {
        var rows = jdbc.queryForList("SELECT * FROM vw_cadastros_projetos_completo WHERE id = ?", id);
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> projeto = rows.get(0);
        // A view vw_cadastros_projetos_completo (herdada, pré-cutover) pode não expor colunas
        // adicionadas depois. Lê direto da tabela (+ join no PCA) e injeta no retorno: o "Cargo"
        // da Governança e o item do PCA vinculado à contratação (id + rótulo para o TAP).
        var extra = jdbc.queryForList(
                "SELECT p.patrocinador_cargo, p.gestor_cargo, p.pca_item_id, " +
                        "pca.code AS pca_item_code, COALESCE(pca.description, pca.object_name) AS pca_item_objeto " +
                        "FROM cadastros_projetos p LEFT JOIN pcas pca ON pca.id = p.pca_item_id " +
                        "WHERE p.id = ?", id);
        if (!extra.isEmpty()) {
            Map<String, Object> e = extra.get(0);
            projeto.put("patrocinador_cargo", e.get("patrocinador_cargo"));
            projeto.put("gestor_cargo", e.get("gestor_cargo"));
            projeto.put("pca_item_id", e.get("pca_item_id"));
            Object code = e.get("pca_item_code");
            if (code != null) {
                String codeStr = String.valueOf(code).replaceFirst("^0+", "");
                if (codeStr.isEmpty()) {
                    codeStr = String.valueOf(code);
                }
                Object objeto = e.get("pca_item_objeto");
                projeto.put("pca_item_label",
                        "PCA " + codeStr + (objeto != null ? " — " + objeto : ""));
            } else {
                projeto.put("pca_item_label", null);
            }
        }
        projeto.put("instrumentos", jdbc.queryForList(
                "SELECT ip.id, ip.instrumento_id, i.nome AS instrumento_nome, i.tipo AS instrumento_tipo " +
                        "FROM cadastros_instrumentos_projetos ip " +
                        "JOIN cadastros_instrumentos_planejamento i ON i.id = ip.instrumento_id " +
                        "WHERE ip.projeto_id = ? ORDER BY i.nome", id));
        return projeto;
    }

    public List<Map<String, Object>> getProjetosByInstrumentoId(long instrumentoId, String diretoria) {
        boolean hasAreasVinculadas = hasColumn("cadastros_projetos", "areas_vinculadas_ids");
        boolean hasSigla = hasColumn("cadastros_areas", "sigla");
        String colunaExpressao = hasSigla
                ? "ca.sigla"
                : "COALESCE(SUBSTRING(ca.nome FROM '\\(([^)]+)\\)'), ca.nome)";

        List<Object> params = new ArrayList<>();
        params.add(instrumentoId);
        String diretoriaFilter = "";
        if (diretoria != null) {
            var domain = domainService.getDomainForDiretoria(diretoria);
            if (domain.isDomainRoot()) {
                params.add(textArray(domain.diretoriasInDomain()));
                diretoriaFilter = " AND EXISTS (SELECT 1 FROM cadastros_areas caf WHERE caf.id = ANY(cp.areas_vinculadas_ids) " +
                        "AND caf.sigla = ANY(?::text[]))";
            } else {
                params.add(diretoria);
                diretoriaFilter = " AND EXISTS (SELECT 1 FROM cadastros_areas caf WHERE caf.id = ANY(cp.areas_vinculadas_ids) " +
                        "AND caf.sigla = ?)";
            }
        }

        String sql;
        if (hasAreasVinculadas) {
            sql = "SELECT p.*, COALESCE((SELECT STRING_AGG(" + colunaExpressao + ", ', ') FROM cadastros_areas ca " +
                    "WHERE ca.id = ANY(cp.areas_vinculadas_ids)), p.diretoria) AS diretorias_nomes " +
                    "FROM vw_cadastros_projetos_completo p " +
                    "INNER JOIN cadastros_instrumentos_projetos ip ON ip.projeto_id = p.id " +
                    "JOIN cadastros_projetos cp ON cp.id = p.id " +
                    "WHERE ip.instrumento_id = ?" + diretoriaFilter + " ORDER BY p.codigo DESC";
        } else {
            sql = "SELECT p.*, p.diretoria AS diretorias_nomes FROM vw_cadastros_projetos_completo p " +
                    "INNER JOIN cadastros_instrumentos_projetos ip ON ip.projeto_id = p.id " +
                    (diretoria != null ? "JOIN cadastros_projetos cp ON cp.id = p.id " : "") +
                    "WHERE ip.instrumento_id = ?" + diretoriaFilter + " ORDER BY p.codigo DESC";
        }

        var projetos = jdbc.queryForList(sql, params.toArray());
        for (Map<String, Object> projeto : projetos) {
            projeto.put("areasExecucao", getAreasExecucao(((Number) projeto.get("id")).longValue()));
        }
        return projetos;
    }

    @Transactional
    public Map<String, Object> createProjeto(Map<String, Object> data, Long userId) {
        Map<String, Object> projeto = jdbc.queryForMap(
                "INSERT INTO cadastros_projetos (" +
                        "codigo, nome, descricao_sintetica, objetivo, contexto_justificativa, " +
                        "patrocinador_id, gestor_id, patrocinador_cargo, gestor_cargo, " +
                        "ancoragem_estrategica_plano_gestao, ancoragem_estrategica_pep, ancoragem_estrategica_programa_x, " +
                        "escopo_sintetico, fora_do_escopo, data_prevista_inicio, data_prevista_conclusao, " +
                        "status, prioridade, complexidade, abrangencia, " +
                        "havera_contratacao, valor_estimado_contratacao, pca_item_id, " +
                        "saude, saude_justificativa, saude_ultima_revisao, " +
                        "tap_vinculado, observacoes_gerais, diretoria, areas_vinculadas_ids, " +
                        "created_by, updated_by) VALUES (" +
                        "NULLIF(?, ''), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE, " +
                        "?, ?, ?, ?::int[], ?, ?) RETURNING *",
                str(data.get("codigo")) != null ? str(data.get("codigo")) : "",
                data.get("nome"),
                emptyToNull(str(data.get("descricao_sintetica"))),
                emptyToNull(str(data.get("objetivo"))),
                emptyToNull(str(data.get("contexto_justificativa"))),
                numOrNull(data.get("patrocinador_id")),
                numOrNull(data.get("gestor_id")),
                emptyToNull(str(data.get("patrocinador_cargo"))),
                emptyToNull(str(data.get("gestor_cargo"))),
                boolOrFalse(data.get("ancoragem_estrategica_plano_gestao")),
                boolOrFalse(data.get("ancoragem_estrategica_pep")),
                boolOrFalse(data.get("ancoragem_estrategica_programa_x")),
                emptyToNull(str(data.get("escopo_sintetico"))),
                emptyToNull(str(data.get("fora_do_escopo"))),
                DateHelper.toSqlDate(data.get("data_prevista_inicio")),
                DateHelper.toSqlDate(data.get("data_prevista_conclusao")),
                "planejado",
                orDefault(str(data.get("prioridade")), "media"),
                orDefault(str(data.get("complexidade")), "media"),
                orDefault(str(data.get("abrangencia")), "uma_unidade"),
                boolOrFalse(data.get("havera_contratacao")),
                numOrNull(data.get("valor_estimado_contratacao")),
                numOrNull(data.get("pca_item_id")),
                orDefault(str(data.get("saude")), "verde"),
                emptyToNull(str(data.get("saude_justificativa"))),
                emptyToNull(str(data.get("tap_vinculado"))),
                emptyToNull(str(data.get("observacoes_gerais"))),
                orDefault(str(data.get("diretoria")), "SGJT"),
                intArray(asIdList(data.get("areas_vinculadas_ids"))),
                userId, userId);

        long projetoId = ((Number) projeto.get("id")).longValue();

        for (Object areaId : asIdList(data.get("areas_execucao"))) {
            addAreaExecucao(projetoId, areaId);
        }
        for (Object instrumentoId : asIdList(data.get("instrumentos_ids"))) {
            jdbc.update("INSERT INTO cadastros_instrumentos_projetos (instrumento_id, projeto_id) " +
                    "VALUES (?, ?) ON CONFLICT (instrumento_id, projeto_id) DO NOTHING", instrumentoId, projetoId);
        }
        for (Map<String, Object> entrega : asMapList(data.get("entregas"))) {
            createEntrega(projetoId, entrega, userId);
        }
        for (Map<String, Object> risco : asMapList(data.get("riscos"))) {
            createRisco(projetoId, risco, userId);
        }
        for (Map<String, Object> entrave : asMapList(data.get("entraves"))) {
            createEntrave(projetoId, entrave, userId);
        }

        calcularProgresso(projetoId);
        return getProjetoById(projetoId);
    }

    @Transactional
    public Map<String, Object> updateProjeto(long id, Map<String, Object> data, Long userId) {
        if (data.containsKey("nome") && isBlank(data.get("nome"))) {
            throw new RuntimeException("O nome do projeto é obrigatório e não pode ser removido");
        }
        if (data.containsKey("diretoria") && isBlank(data.get("diretoria"))) {
            throw new RuntimeException("A diretoria é obrigatória e não pode ser removida");
        }

        boolean hasTapCriticalChange = TAP_CRITICAL_FIELDS.stream().anyMatch(data::containsKey);
        if (hasTapCriticalChange) {
            var existing = jdbc.queryForList(
                    "SELECT tap_validado_patrocinador_em, tap_id, tap_versao FROM cadastros_projetos WHERE id = ?", id);
            if (!existing.isEmpty() && existing.get(0).get("tap_validado_patrocinador_em") != null) {
                jdbc.update(
                        "UPDATE cadastros_projetos SET " +
                                "tap_validado_gestor_em = NULL, tap_validado_gestor_por = NULL, " +
                                "tap_validado_diretor_em = NULL, tap_validado_diretor_por = NULL, " +
                                "tap_validado_patrocinador_em = NULL, tap_validado_patrocinador_por = NULL, " +
                                "tap_versao = COALESCE(tap_versao, 0) + 1, tap_gerado_em = NOW() WHERE id = ?", id);
            }
        }

        // Mapa ordenado coluna→key (mesmas chaves do fieldMap do Node)
        List<String> keys = List.of("nome", "descricao_sintetica", "objetivo", "contexto_justificativa",
                "patrocinador_id", "gestor_id", "patrocinador_cargo", "gestor_cargo",
                "ancoragem_estrategica_plano_gestao", "ancoragem_estrategica_pep",
                "ancoragem_estrategica_programa_x", "escopo_sintetico", "fora_do_escopo", "data_prevista_inicio",
                "data_prevista_conclusao", "status", "prioridade", "complexidade", "abrangencia",
                "havera_contratacao", "valor_estimado_contratacao", "pca_item_id", "saude", "saude_justificativa",
                "tap_vinculado", "observacoes_gerais", "diretoria", "areas_vinculadas_ids");

        List<String> fields = new ArrayList<>();
        List<Object> values = new ArrayList<>();
        for (String key : keys) {
            if (data.containsKey(key)) {
                Object value = data.get(key);
                if (("data_prevista_inicio".equals(key) || "data_prevista_conclusao".equals(key))
                        && value instanceof String s && s.trim().isEmpty()) {
                    value = null;
                }
                if ("areas_vinculadas_ids".equals(key)) {
                    fields.add(key + " = ?::int[]");
                    values.add(intArray(asIdList(value)));
                } else if ("data_prevista_inicio".equals(key) || "data_prevista_conclusao".equals(key)) {
                    fields.add(key + " = ?");
                    values.add(DateHelper.toSqlDate(value));
                } else if (COLUNAS_NUMERICAS.contains(key)) {
                    fields.add(key + " = ?");
                    values.add(SqlValue.numeroOuNull(value));
                } else {
                    fields.add(key + " = ?");
                    values.add(value);
                }
            }
        }
        if (data.containsKey("saude")) {
            fields.add("saude_ultima_revisao = CURRENT_DATE");
        }

        if (fields.isEmpty() && !data.containsKey("areas_execucao") && !data.containsKey("instrumentos_ids")) {
            return getProjetoById(id);
        }

        if (!fields.isEmpty()) {
            fields.add("updated_at = NOW()");
            fields.add("updated_by = ?");
            values.add(userId);
            values.add(id);
            var result = jdbc.queryForList(
                    "UPDATE cadastros_projetos SET " + String.join(", ", fields) +
                            " WHERE id = ? AND ativo = TRUE RETURNING *", values.toArray());
            if (result.isEmpty()) {
                return null;
            }
        }

        if (data.containsKey("areas_execucao")) {
            updateAreasExecucao(id, asIdList(data.get("areas_execucao")));
        }
        if (data.containsKey("instrumentos_ids")) {
            jdbc.update("DELETE FROM cadastros_instrumentos_projetos WHERE projeto_id = ?", id);
            for (Object instrumentoId : asIdList(data.get("instrumentos_ids"))) {
                jdbc.update("INSERT INTO cadastros_instrumentos_projetos (instrumento_id, projeto_id) " +
                        "VALUES (?, ?) ON CONFLICT (instrumento_id, projeto_id) DO NOTHING", instrumentoId, id);
            }
        }
        if (data.containsKey("entregas")) {
            jdbc.update("UPDATE cadastros_projetos_entregas SET ativo = FALSE WHERE projeto_id = ?", id);
            for (Map<String, Object> entrega : asMapList(data.get("entregas"))) {
                createEntrega(id, entrega, userId);
            }
        }
        if (data.containsKey("riscos")) {
            jdbc.update("UPDATE cadastros_projetos_riscos SET ativo = FALSE WHERE projeto_id = ?", id);
            for (Map<String, Object> risco : asMapList(data.get("riscos"))) {
                createRisco(id, risco, userId);
            }
        }
        if (data.containsKey("entraves")) {
            jdbc.update("UPDATE cadastros_projetos_entraves SET ativo = FALSE WHERE projeto_id = ?", id);
            for (Map<String, Object> entrave : asMapList(data.get("entraves"))) {
                createEntrave(id, entrave, userId);
            }
        }

        calcularProgresso(id);
        return getProjetoById(id);
    }

    public boolean deleteProjeto(long id, Long userId) {
        // Node: soft-delete apenas do projeto (NÃO cascateia para entregas/tarefas).
        return jdbc.update(
                "UPDATE cadastros_projetos SET ativo = FALSE, updated_at = NOW(), updated_by = ? " +
                        "WHERE id = ? AND ativo = TRUE", userId, id) > 0;
    }

    public int calcularProgresso(long projetoId) {
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT COUNT(*) FILTER (WHERE status = 'concluida') AS concluidas, " +
                        "COUNT(*) FILTER (WHERE status = 'em_andamento') AS em_andamento, " +
                        "COUNT(*) FILTER (WHERE status = 'nao_iniciada') AS nao_iniciadas, " +
                        "COUNT(*) AS total FROM cadastros_projetos_entregas WHERE projeto_id = ? AND ativo = TRUE",
                projetoId);
        int concluidas = toInt(row.get("concluidas"));
        int naoIniciadas = toInt(row.get("nao_iniciadas"));
        int total = toInt(row.get("total"));

        var ctx = jdbc.queryForList("SELECT status FROM cadastros_projetos WHERE id = ?", projetoId);
        String currentStatus = ctx.isEmpty() ? null : (String) ctx.get(0).get("status");

        if (total == 0) {
            if (STATUS_MANUAIS.contains(currentStatus)) {
                jdbc.update("UPDATE cadastros_projetos SET progresso_percentual = 0, updated_at = NOW() WHERE id = ?", projetoId);
            } else {
                jdbc.update("UPDATE cadastros_projetos SET progresso_percentual = 0, status = 'planejado', updated_at = NOW() WHERE id = ?", projetoId);
            }
            return 0;
        }

        int progresso = (int) Math.round((double) concluidas / total * 100);

        if (STATUS_MANUAIS.contains(currentStatus)) {
            jdbc.update("UPDATE cadastros_projetos SET progresso_percentual = ?, updated_at = NOW() WHERE id = ?", progresso, projetoId);
            return progresso;
        }

        String novoStatus = naoIniciadas == total ? "planejado" : "em_execucao";
        jdbc.update("UPDATE cadastros_projetos SET progresso_percentual = ?, status = ?, updated_at = NOW() WHERE id = ?",
                progresso, novoStatus, projetoId);
        return progresso;
    }

    // ============================================================
    // GERAR / REGENERAR TAP ID
    // ============================================================

    public Map<String, Object> gerarTapId(long projetoId) {
        var rows = jdbc.queryForList(
                "SELECT id, diretoria, data_prevista_inicio, tap_id FROM cadastros_projetos WHERE id = ?", projetoId);
        if (rows.isEmpty()) {
            throw new RuntimeException("Projeto não encontrado");
        }
        Map<String, Object> projeto = rows.get(0);
        if (projeto.get("tap_id") != null) {
            return getProjetoById(projetoId);
        }
        String codDiretoria = OrgCodigos.diretoria((String) projeto.get("diretoria"));
        int ano;
        Object dpi = projeto.get("data_prevista_inicio");
        if (dpi instanceof Date d) {
            ano = d.toLocalDate().getYear();
        } else if (dpi != null) {
            ano = LocalDate.parse(dpi.toString().substring(0, 10)).getYear();
        } else {
            ano = LocalDate.now().getYear();
        }
        String prefix = "PRJ_" + OrgCodigos.MACRO_AREA + "_" + codDiretoria + "_" + ano + "_";
        Integer nextSeqRaw = jdbc.queryForObject(
                "SELECT COALESCE(MAX(CAST(SUBSTRING(tap_id FROM ? || '(\\d+)$') AS INTEGER)), 1) + 1 AS next_seq " +
                        "FROM cadastros_projetos WHERE tap_id LIKE ?",
                Integer.class, prefix, prefix + "%");
        int nextSeq = Math.max(nextSeqRaw == null ? 2 : nextSeqRaw, 2);
        String tapId = prefix + String.format("%03d", nextSeq);
        jdbc.update("UPDATE cadastros_projetos SET tap_id = ?, tap_versao = 1, tap_gerado_em = NOW(), updated_at = NOW() WHERE id = ?",
                tapId, projetoId);
        return getProjetoById(projetoId);
    }

    public Map<String, Object> regenerarTap(long projetoId) {
        var rows = jdbc.queryForList("SELECT id, tap_id, tap_versao FROM cadastros_projetos WHERE id = ?", projetoId);
        if (rows.isEmpty()) {
            throw new RuntimeException("Projeto não encontrado");
        }
        Map<String, Object> projeto = rows.get(0);
        if (projeto.get("tap_id") == null) {
            throw new RuntimeException("Projeto não possui TAP gerado");
        }
        int novaVersao = (projeto.get("tap_versao") != null ? ((Number) projeto.get("tap_versao")).intValue() : 1) + 1;
        jdbc.update("UPDATE cadastros_projetos SET tap_versao = ?, tap_gerado_em = NOW() WHERE id = ?", novaVersao, projetoId);
        return getProjetoById(projetoId);
    }

    // ============================================================
    // ÁREAS DE EXECUÇÃO
    // ============================================================

    public List<Map<String, Object>> getAreasExecucao(long projetoId) {
        return jdbc.queryForList(
                "SELECT ae.*, u.nome AS area_nome, a.sigla AS diretoria " +
                        "FROM cadastros_projetos_areas_execucao ae " +
                        "JOIN cadastros_unidades u ON u.id = ae.area_id " +
                        "JOIN cadastros_areas a ON a.id = u.area_id WHERE ae.projeto_id = ?", projetoId);
    }

    public void addAreaExecucao(long projetoId, Object areaId) {
        jdbc.update("INSERT INTO cadastros_projetos_areas_execucao (projeto_id, area_id) " +
                "VALUES (?, ?) ON CONFLICT (projeto_id, area_id) DO NOTHING", projetoId, areaId);
    }

    public void updateAreasExecucao(long projetoId, List<Object> areaIds) {
        jdbc.update("DELETE FROM cadastros_projetos_areas_execucao WHERE projeto_id = ?", projetoId);
        for (Object areaId : areaIds) {
            addAreaExecucao(projetoId, areaId);
        }
    }

    // ============================================================
    // ENTREGAS
    // ============================================================

    public List<Map<String, Object>> getEntregas(long projetoId) {
        List<Map<String, Object>> rows;
        if (hasColumn("cadastros_projetos_entregas", "area_responsavel_id")) {
            rows = jdbc.queryForList(
                    "SELECT e.*, u.nome AS area_responsavel_nome FROM cadastros_projetos_entregas e " +
                            "LEFT JOIN cadastros_unidades u ON u.id = e.area_responsavel_id " +
                            "WHERE e.projeto_id = ? AND e.ativo = TRUE ORDER BY e.ordem, e.id", projetoId);
        } else {
            rows = jdbc.queryForList(
                    "SELECT e.* FROM cadastros_projetos_entregas e WHERE e.projeto_id = ? AND e.ativo = TRUE " +
                            "ORDER BY e.ordem, e.id", projetoId);
        }
        // Não trafega os bytes do PDF de evidência nas listagens (só via download-evidencia).
        rows.forEach(r -> r.remove("evidencia_data"));
        return rows;
    }

    public Map<String, Object> getEntregaById(long id) {
        var rows = jdbc.queryForList("SELECT * FROM cadastros_projetos_entregas WHERE id = ? AND ativo = TRUE", id);
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> entrega = rows.get(0);
        entrega.remove("evidencia_data"); // bytes do PDF só são lidos no download
        return entrega;
    }

    /** Lê os bytes do PDF de evidência (para o endpoint de download). Null se não houver. */
    public Map<String, Object> getEntregaEvidenciaData(long id) {
        var rows = jdbc.queryForList(
                "SELECT evidencia_data, evidencia_filename FROM cadastros_projetos_entregas " +
                        "WHERE id = ? AND ativo = TRUE", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> createEntrega(long projetoId, Map<String, Object> data, Long userId) {
        boolean hasAreaColumn = hasColumn("cadastros_projetos_entregas", "area_responsavel_id");
        Map<String, Object> entrega;
        if (hasAreaColumn) {
            entrega = jdbc.queryForMap(
                    "INSERT INTO cadastros_projetos_entregas (projeto_id, nome, descricao, status, quantidade_sprints, " +
                            "ordem, area_responsavel_id, prazo_estimado, ativo, created_by, updated_by) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?) RETURNING *",
                    projetoId, data.get("nome"), emptyToNull(str(data.get("descricao"))),
                    orDefault(str(data.get("status")), "nao_iniciada"),
                    data.get("quantidade_sprints") != null ? data.get("quantidade_sprints") : 1,
                    data.get("ordem") != null ? data.get("ordem") : 0,
                    numOrNull(data.get("area_responsavel_id")),
                    DateHelper.toSqlDate(data.get("prazo_estimado")), userId, userId);
        } else {
            entrega = jdbc.queryForMap(
                    "INSERT INTO cadastros_projetos_entregas (projeto_id, nome, descricao, status, quantidade_sprints, " +
                            "ordem, prazo_estimado, ativo, created_by, updated_by) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?) RETURNING *",
                    projetoId, data.get("nome"), emptyToNull(str(data.get("descricao"))),
                    orDefault(str(data.get("status")), "nao_iniciada"),
                    data.get("quantidade_sprints") != null ? data.get("quantidade_sprints") : 1,
                    data.get("ordem") != null ? data.get("ordem") : 0,
                    DateHelper.toSqlDate(data.get("prazo_estimado")), userId, userId);
        }
        long entregaId = ((Number) entrega.get("id")).longValue();
        for (Object areaId : asIdList(data.get("areas_responsaveis"))) {
            jdbc.update("INSERT INTO cadastros_projetos_entregas_responsaveis (entrega_id, area_id) " +
                    "VALUES (?, ?) ON CONFLICT DO NOTHING", entregaId, areaId);
        }
        calcularProgresso(projetoId);
        return entrega;
    }

    public Map<String, Object> updateEntrega(long id, Map<String, Object> data, Long userId) {
        Map<String, Object> entrega = getEntregaById(id);
        if (entrega == null) {
            return null;
        }
        List<String> fields = new ArrayList<>();
        List<Object> values = new ArrayList<>();
        if (data.containsKey("nome")) {
            fields.add("nome = ?");
            values.add(data.get("nome"));
        }
        if (data.containsKey("descricao")) {
            fields.add("descricao = ?");
            values.add(data.get("descricao"));
        }
        // Status manual: entregas SEM tarefas têm o status definido diretamente (dropdown). Entregas
        // COM tarefas têm o status derivado das tarefas no frontend, que também envia por aqui.
        if (data.containsKey("status")) {
            fields.add("status = ?");
            values.add(data.get("status"));
            // Data de Conclusão: carimba ao concluir; limpa ao voltar para outro status.
            if ("concluida".equals(String.valueOf(data.get("status")))) {
                fields.add("data_conclusao = COALESCE(data_conclusao, CURRENT_DATE)");
            } else {
                fields.add("data_conclusao = NULL");
            }
        }
        if (data.containsKey("quantidade_sprints")) {
            fields.add("quantidade_sprints = ?");
            values.add(data.get("quantidade_sprints"));
        }
        if (data.containsKey("ordem")) {
            fields.add("ordem = ?");
            values.add(data.get("ordem"));
        }
        if (data.containsKey("area_responsavel_id") && hasColumn("cadastros_projetos_entregas", "area_responsavel_id")) {
            fields.add("area_responsavel_id = ?");
            values.add(data.get("area_responsavel_id"));
        }
        if (data.containsKey("prazo_estimado")) {
            fields.add("prazo_estimado = ?");
            values.add(DateHelper.toSqlDate(data.get("prazo_estimado")));
        }
        if (fields.isEmpty()) {
            return entrega;
        }
        fields.add("updated_at = NOW()");
        fields.add("updated_by = ?");
        values.add(userId);
        values.add(id);
        var result = jdbc.queryForList(
                "UPDATE cadastros_projetos_entregas SET " + String.join(", ", fields) +
                        " WHERE id = ? AND ativo = TRUE RETURNING *", values.toArray());
        calcularProgresso(((Number) entrega.get("projeto_id")).longValue());
        return result.isEmpty() ? null : result.get(0);
    }

    /** Persiste o PDF de evidência NO BANCO (bytea). filepath fica NULL (armazenamento legado em disco). */
    public void updateEntregaEvidencia(long id, String filename, byte[] data, Long filesize) {
        jdbc.update("UPDATE cadastros_projetos_entregas SET evidencia_filename = ?, evidencia_data = ?, " +
                "evidencia_filepath = NULL, evidencia_filesize = ?, updated_at = NOW() " +
                "WHERE id = ? AND ativo = TRUE",
                filename, data, filesize, id);
    }

    /** Define a Data de Conclusão informada manualmente (sobrepõe o CURRENT_DATE do updateEntregaStatus). */
    public void setEntregaDataConclusao(long id, Object data) {
        jdbc.update("UPDATE cadastros_projetos_entregas SET data_conclusao = ?, updated_at = NOW() " +
                "WHERE id = ? AND ativo = TRUE", DateHelper.toSqlDate(data), id);
    }

    public void updateEntregaStatus(long id, String status) {
        jdbc.update("UPDATE cadastros_projetos_entregas SET status = ?, " +
                "data_conclusao = CASE WHEN ? = 'concluida' THEN COALESCE(data_conclusao, CURRENT_DATE) ELSE NULL END, " +
                "updated_at = NOW() WHERE id = ? AND ativo = TRUE",
                status, status, id);
    }

    public boolean deleteEntrega(long id, Long userId) {
        Map<String, Object> entrega = getEntregaById(id);
        if (entrega == null) {
            return false;
        }
        int affected = jdbc.update(
                "UPDATE cadastros_projetos_entregas SET ativo = FALSE, updated_at = NOW(), updated_by = ? " +
                        "WHERE id = ? AND ativo = TRUE", userId, id);
        calcularProgresso(((Number) entrega.get("projeto_id")).longValue());
        return affected > 0;
    }

    // ============================================================
    // RISCOS
    // ============================================================

    public List<Map<String, Object>> getRiscos(long projetoId) {
        return jdbc.queryForList(
                "SELECT r.*, CASE " +
                        "WHEN r.probabilidade = 'provavel' AND r.impacto = 'alto' THEN 9 " +
                        "WHEN r.probabilidade = 'provavel' AND r.impacto = 'medio' THEN 6 " +
                        "WHEN r.probabilidade = 'provavel' AND r.impacto = 'baixo' THEN 3 " +
                        "WHEN r.probabilidade = 'possivel' AND r.impacto = 'alto' THEN 6 " +
                        "WHEN r.probabilidade = 'possivel' AND r.impacto = 'medio' THEN 4 " +
                        "WHEN r.probabilidade = 'possivel' AND r.impacto = 'baixo' THEN 2 " +
                        "WHEN r.probabilidade = 'remota' AND r.impacto = 'alto' THEN 3 " +
                        "WHEN r.probabilidade = 'remota' AND r.impacto = 'medio' THEN 2 " +
                        "ELSE 1 END AS criticidade " +
                        "FROM cadastros_projetos_riscos r WHERE r.projeto_id = ? AND r.ativo = TRUE " +
                        "ORDER BY criticidade DESC, r.id", projetoId);
    }

    public Map<String, Object> createRisco(long projetoId, Map<String, Object> data, Long userId) {
        return jdbc.queryForMap(
                "INSERT INTO cadastros_projetos_riscos (projeto_id, descricao, probabilidade, impacto, tratamento, " +
                        "observacoes, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
                projetoId, data.get("descricao"),
                orDefault(str(data.get("probabilidade")), "possivel"),
                orDefault(str(data.get("impacto")), "medio"),
                emptyToNull(str(data.get("tratamento"))),
                emptyToNull(str(data.get("observacoes"))), userId, userId);
    }

    public Map<String, Object> updateRisco(long id, Map<String, Object> data, Long userId) {
        List<String> fields = new ArrayList<>();
        List<Object> values = new ArrayList<>();
        for (String key : List.of("descricao", "probabilidade", "impacto", "tratamento", "observacoes")) {
            if (data.containsKey(key)) {
                fields.add(key + " = ?");
                values.add(data.get(key));
            }
        }
        if (fields.isEmpty()) {
            return null;
        }
        fields.add("updated_at = NOW()");
        fields.add("updated_by = ?");
        values.add(userId);
        values.add(id);
        var result = jdbc.queryForList(
                "UPDATE cadastros_projetos_riscos SET " + String.join(", ", fields) +
                        " WHERE id = ? AND ativo = TRUE RETURNING *", values.toArray());
        return result.isEmpty() ? null : result.get(0);
    }

    public boolean deleteRisco(long id, Long userId) {
        return jdbc.update("UPDATE cadastros_projetos_riscos SET ativo = FALSE, updated_at = NOW(), updated_by = ? " +
                "WHERE id = ? AND ativo = TRUE", userId, id) > 0;
    }

    // ============================================================
    // ENTRAVES
    // ============================================================

    public List<Map<String, Object>> getEntraves(long projetoId) {
        return jdbc.queryForList(
                "SELECT * FROM cadastros_projetos_entraves WHERE projeto_id = ? AND ativo = TRUE " +
                        "ORDER BY resolvido, data_identificacao DESC", projetoId);
    }

    public Map<String, Object> createEntrave(long projetoId, Map<String, Object> data, Long userId) {
        return jdbc.queryForMap(
                "INSERT INTO cadastros_projetos_entraves (projeto_id, descricao, data_identificacao, observacoes, " +
                        "created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
                projetoId, data.get("descricao"),
                DateHelper.toSqlDate(data.get("data_identificacao")),
                emptyToNull(str(data.get("observacoes"))), userId, userId);
    }

    public Map<String, Object> updateEntrave(long id, Map<String, Object> data, Long userId) {
        List<String> fields = new ArrayList<>();
        List<Object> values = new ArrayList<>();
        if (data.containsKey("descricao")) {
            fields.add("descricao = ?");
            values.add(data.get("descricao"));
        }
        if (data.containsKey("observacoes")) {
            fields.add("observacoes = ?");
            values.add(data.get("observacoes"));
        }
        if (data.containsKey("resolvido")) {
            fields.add("resolvido = ?");
            values.add(data.get("resolvido"));
            if (Boolean.TRUE.equals(data.get("resolvido"))) {
                fields.add("data_resolucao = CURRENT_DATE");
            }
        }
        if (fields.isEmpty()) {
            return null;
        }
        fields.add("updated_at = NOW()");
        fields.add("updated_by = ?");
        values.add(userId);
        values.add(id);
        var result = jdbc.queryForList(
                "UPDATE cadastros_projetos_entraves SET " + String.join(", ", fields) +
                        " WHERE id = ? AND ativo = TRUE RETURNING *", values.toArray());
        return result.isEmpty() ? null : result.get(0);
    }

    public boolean deleteEntrave(long id, Long userId) {
        return jdbc.update("UPDATE cadastros_projetos_entraves SET ativo = FALSE, updated_at = NOW(), updated_by = ? " +
                "WHERE id = ? AND ativo = TRUE", userId, id) > 0;
    }

    // ============================================================
    // TAREFAS DE ENTREGAS
    // ============================================================

    public List<Map<String, Object>> getTarefasByEntregaId(long entregaId) {
        return jdbc.queryForList(
                "SELECT * FROM cadastros_projetos_entregas_tarefas WHERE entrega_id = ? AND ativo = TRUE " +
                        "ORDER BY ordem, id", entregaId);
    }

    public Map<String, Object> getTarefaById(long id) {
        var rows = jdbc.queryForList("SELECT * FROM cadastros_projetos_entregas_tarefas WHERE id = ? AND ativo = TRUE", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> createTarefaEntrega(long entregaId, Map<String, Object> data, Long userId) {
        Object ordemFinal = data.get("ordem");
        if (ordemFinal == null) {
            Integer next = jdbc.queryForObject(
                    "SELECT COALESCE(MAX(ordem), -1) + 1 as next_ordem FROM cadastros_projetos_entregas_tarefas " +
                            "WHERE entrega_id = ? AND ativo = TRUE", Integer.class, entregaId);
            ordemFinal = next == null ? 0 : next;
        }
        Map<String, Object> tarefa = jdbc.queryForMap(
                "INSERT INTO cadastros_projetos_entregas_tarefas (entrega_id, nome, descricao, sprint, sprint_id, " +
                        "responsavel, responsavel_id, status, ordem, data_inicio, data_conclusao, ativo, created_by, updated_by) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?) RETURNING *",
                entregaId, data.get("nome"), emptyToNull(str(data.get("descricao"))),
                emptyToNull(str(data.get("sprint"))), numOrNull(data.get("sprint_id")),
                emptyToNull(str(data.get("responsavel"))), numOrNull(data.get("responsavel_id")),
                orDefault(str(data.get("status")), "a_fazer"), ordemFinal,
                DateHelper.toSqlDate(data.get("data_inicio")), DateHelper.toSqlDate(data.get("data_conclusao")),
                userId, userId);
        recalcularStatusEntrega(entregaId);
        return tarefa;
    }

    public Map<String, Object> updateTarefaEntrega(long id, Map<String, Object> data, Long userId) {
        Map<String, Object> tarefa = getTarefaById(id);
        if (tarefa == null) {
            return null;
        }
        List<String> fields = new ArrayList<>();
        List<Object> values = new ArrayList<>();
        for (String key : List.of("nome", "descricao", "sprint", "sprint_id", "responsavel", "responsavel_id",
                "status", "ordem", "data_inicio", "data_conclusao")) {
            if (data.containsKey(key)) {
                fields.add(key + " = ?");
                if ("data_inicio".equals(key) || "data_conclusao".equals(key)) {
                    values.add(DateHelper.toSqlDate(data.get(key)));
                } else {
                    values.add(data.get(key));
                }
            }
        }
        if (fields.isEmpty()) {
            return tarefa;
        }
        fields.add("updated_at = NOW()");
        fields.add("updated_by = ?");
        values.add(userId);
        values.add(id);
        var result = jdbc.queryForList(
                "UPDATE cadastros_projetos_entregas_tarefas SET " + String.join(", ", fields) +
                        " WHERE id = ? AND ativo = TRUE RETURNING *", values.toArray());
        if (!result.isEmpty()) {
            recalcularStatusEntrega(((Number) tarefa.get("entrega_id")).longValue());
        }
        return result.isEmpty() ? null : result.get(0);
    }

    public boolean deleteTarefaEntrega(long id, Long userId) {
        Map<String, Object> tarefa = getTarefaById(id);
        if (tarefa == null) {
            return false;
        }
        int affected = jdbc.update(
                "UPDATE cadastros_projetos_entregas_tarefas SET ativo = FALSE, updated_at = NOW(), updated_by = ? " +
                        "WHERE id = ? AND ativo = TRUE", userId, id);
        recalcularStatusEntrega(((Number) tarefa.get("entrega_id")).longValue());
        return affected > 0;
    }

    public void recalcularStatusEntrega(long entregaId) {
        var tarefas = getTarefasByEntregaId(entregaId);
        if (tarefas.isEmpty()) {
            jdbc.update("UPDATE cadastros_projetos_entregas SET status = 'nao_iniciada', data_conclusao = NULL, updated_at = NOW() WHERE id = ?", entregaId);
            return;
        }
        boolean todasAFazer = tarefas.stream().allMatch(t -> "a_fazer".equals(t.get("status")));
        boolean todasFeitas = tarefas.stream().allMatch(t -> "feito".equals(t.get("status")));
        String novoStatus = "em_andamento";
        if (todasAFazer) {
            novoStatus = "nao_iniciada";
        } else if (todasFeitas) {
            novoStatus = "concluida";
        }
        jdbc.update("UPDATE cadastros_projetos_entregas SET status = ?, " +
                "data_conclusao = CASE WHEN ? = 'concluida' THEN COALESCE(data_conclusao, CURRENT_DATE) ELSE NULL END, " +
                "updated_at = NOW() WHERE id = ?", novoStatus, novoStatus, entregaId);
        Map<String, Object> entrega = getEntregaById(entregaId);
        if (entrega != null) {
            calcularProgresso(((Number) entrega.get("projeto_id")).longValue());
        }
    }

    // ============================================================
    // COLABORADORES E ÁREAS (selects)
    // ============================================================

    public List<Map<String, Object>> getColaboradores(String diretoria) {
        String sql = "SELECT p.id, p.nome, COALESCE(p.nome_exibicao, p.nome) as nome_exibicao, " +
                "p.cc_fc as unidade_lotacao, a.sigla as diretoria, p.area_id " +
                "FROM cadastros_pessoas p JOIN cadastros_areas a ON a.id = p.area_id " +
                "WHERE p.ativo = TRUE AND a.ativo = TRUE";
        if (diretoria != null) {
            return jdbc.queryForList(sql + " AND a.dominio = (SELECT dominio FROM cadastros_areas " +
                    "WHERE sigla = ? AND COALESCE(ativo, TRUE) = TRUE LIMIT 1) ORDER BY p.nome", diretoria);
        }
        return jdbc.queryForList(sql + " ORDER BY p.nome");
    }

    public List<Map<String, Object>> getAreas(String diretoria) {
        String sql = "SELECT u.id, u.nome as nome_area, a.sigla as diretoria, u.descricao " +
                "FROM cadastros_unidades u JOIN cadastros_areas a ON a.id = u.area_id " +
                "WHERE u.ativo = TRUE AND a.ativo = TRUE";
        if (diretoria != null) {
            return jdbc.queryForList(sql + " AND a.dominio = (SELECT dominio FROM cadastros_areas " +
                    "WHERE sigla = ? AND COALESCE(ativo, TRUE) = TRUE LIMIT 1) ORDER BY a.sigla, u.nome", diretoria);
        }
        return jdbc.queryForList(sql + " ORDER BY a.sigla, u.nome");
    }

    // ============================================================
    // TAP — VALIDAÇÃO 3 CAMADAS (identity-based)
    // ============================================================

    public Map<String, Object> validarTAP(long projetoId, int camada, Long userId) {
        Map<String, Object> projeto = findProjetoComResponsaveis(projetoId);
        if (projeto == null) {
            throw new ApiException(400, "Projeto não encontrado");
        }
        if (camada == 1) {
            if (!eq(projeto.get("gestor_user_id"), userId)) {
                throw new ApiException(400, "Apenas o gestor do projeto pode validar a camada 1");
            }
        } else if (camada == 2) {
            if (projeto.get("tap_validado_gestor_em") == null) {
                throw new ApiException(400, "A camada 1 (Gestor) precisa ser validada primeiro");
            }
            if (!eq(projeto.get("diretor_user_id"), userId)) {
                throw new ApiException(400, "Apenas o diretor da área pode validar a camada 2");
            }
        } else if (camada == 3) {
            if (projeto.get("tap_validado_diretor_em") == null) {
                throw new ApiException(400, "A camada 2 (Diretor) precisa ser validada primeiro");
            }
            if (!eq(projeto.get("patrocinador_user_id"), userId)) {
                throw new ApiException(400, "Apenas o patrocinador do projeto pode validar a camada 3");
            }
        }

        String colEm = camada == 1 ? "tap_validado_gestor_em" : camada == 2 ? "tap_validado_diretor_em" : "tap_validado_patrocinador_em";
        String colPor = camada == 1 ? "tap_validado_gestor_por" : camada == 2 ? "tap_validado_diretor_por" : "tap_validado_patrocinador_por";

        if (camada == 1) {
            jdbc.update("UPDATE cadastros_projetos SET " + colEm + " = NOW(), " + colPor + " = ?, " +
                    "tap_recusado_em = NULL, tap_recusado_por = NULL, tap_recusado_por_nome = NULL, " +
                    "tap_recusado_comentario = NULL, tap_recusado_camada = NULL, updated_at = NOW() WHERE id = ?",
                    userId, projetoId);
        } else {
            jdbc.update("UPDATE cadastros_projetos SET " + colEm + " = NOW(), " + colPor + " = ?, updated_at = NOW() WHERE id = ?",
                    userId, projetoId);
        }

        if (camada == 3) {
            gerarTapId(projetoId);
            try {
                Map<String, Object> projetoCompleto = getProjetoById(projetoId);
                if (projetoCompleto != null) {
                    int versao = projetoCompleto.get("tap_versao") != null
                            ? ((Number) projetoCompleto.get("tap_versao")).intValue() : 1;
                    String userName = lookupUserName(userId);
                    jdbc.update(
                            "INSERT INTO tap_versoes (projeto_id, versao, dados, validado_em, validado_por, validado_por_nome) " +
                                    "VALUES (?, ?, ?::jsonb, NOW(), ?, ?) " +
                                    "ON CONFLICT (projeto_id, versao) DO UPDATE SET dados = EXCLUDED.dados, " +
                                    "validado_em = EXCLUDED.validado_em, validado_por = EXCLUDED.validado_por, " +
                                    "validado_por_nome = EXCLUDED.validado_por_nome",
                            projetoId, versao, objectMapper.writeValueAsString(projetoCompleto), userId, userName);
                }
            } catch (Exception e) {
                log.error("[validarTAP] Erro ao gravar snapshot da versão: {}", e.getMessage());
            }
        }

        return Map.of("success", true, "camada", camada, "projetoId", projetoId);
    }

    public List<Map<String, Object>> findTapVersoes(long projetoId) {
        return jdbc.queryForList(
                "SELECT id, projeto_id, versao, validado_em, validado_por, validado_por_nome, created_at " +
                        "FROM tap_versoes WHERE projeto_id = ? ORDER BY versao DESC", projetoId);
    }

    public Object findTapVersaoDados(long projetoId, int versao) {
        var rows = jdbc.queryForList("SELECT dados FROM tap_versoes WHERE projeto_id = ? AND versao = ?", projetoId, versao);
        return rows.isEmpty() ? null : rows.get(0).get("dados");
    }

    public Map<String, Object> recusarTAP(long projetoId, int camada, Long userId, String comentario) {
        if (camada != 2 && camada != 3) {
            throw new ApiException(400, "Apenas as camadas 2 (Diretor) e 3 (Patrocinador) podem recusar");
        }
        Map<String, Object> projeto = findProjetoComResponsaveis(projetoId);
        if (projeto == null) {
            throw new ApiException(400, "Projeto não encontrado");
        }
        if (camada == 2) {
            if (projeto.get("tap_validado_gestor_em") == null) {
                throw new ApiException(400, "A camada 1 (Gestor) precisa ter sido validada antes de recusar nesta etapa");
            }
            if (!eq(projeto.get("diretor_user_id"), userId)) {
                throw new ApiException(400, "Apenas o diretor da área pode recusar nesta etapa");
            }
        } else {
            if (projeto.get("tap_validado_diretor_em") == null) {
                throw new ApiException(400, "A camada 2 (Diretor) precisa ter sido validada antes de recusar nesta etapa");
            }
            if (!eq(projeto.get("patrocinador_user_id"), userId)) {
                throw new ApiException(400, "Apenas o patrocinador pode recusar nesta etapa");
            }
        }
        String userName = lookupUserName(userId);
        String camadaLabel = camada == 2 ? "diretor" : "patrocinador";
        jdbc.update("UPDATE cadastros_projetos SET " +
                "tap_validado_gestor_em = NULL, tap_validado_gestor_por = NULL, " +
                "tap_validado_diretor_em = NULL, tap_validado_diretor_por = NULL, " +
                "tap_validado_patrocinador_em = NULL, tap_validado_patrocinador_por = NULL, " +
                "tap_recusado_em = NOW(), tap_recusado_por = ?, tap_recusado_por_nome = ?, " +
                "tap_recusado_comentario = ?, tap_recusado_camada = ?, updated_at = NOW() WHERE id = ?",
                userId, userName, comentario, camadaLabel, projetoId);
        return Map.of("success", true, "camada", camada, "projetoId", projetoId);
    }

    public Map<String, Object> revogarValidacaoTAP(long projetoId, int camada, Long userId) {
        List<String> updates = new ArrayList<>();
        if (camada <= 1) {
            updates.add("tap_validado_gestor_em = NULL");
            updates.add("tap_validado_gestor_por = NULL");
        }
        if (camada <= 2) {
            updates.add("tap_validado_diretor_em = NULL");
            updates.add("tap_validado_diretor_por = NULL");
        }
        if (camada <= 3) {
            updates.add("tap_validado_patrocinador_em = NULL");
            updates.add("tap_validado_patrocinador_por = NULL");
        }
        jdbc.update("UPDATE cadastros_projetos SET " + String.join(", ", updates) + ", updated_at = NOW() WHERE id = ?", projetoId);
        return Map.of("success", true, "camada", camada, "projetoId", projetoId);
    }

    // ============================================================
    // HELPERS
    // ============================================================

    private Map<String, Object> findProjetoComResponsaveis(long projetoId) {
        // Camada 2 = diretor da diretoria indicada na Governança do projeto (1ª de
        // areas_vinculadas_ids). Fallback para p.diretoria quando não há diretoria vinculada.
        var rows = jdbc.queryForList(
                "SELECT p.*, ges.user_id AS gestor_user_id, pat.user_id AS patrocinador_user_id, " +
                        "area.gestor_user_id AS diretor_user_id, area.sigla AS diretor_diretoria_sigla " +
                        "FROM cadastros_projetos p " +
                        "LEFT JOIN cadastros_pessoas ges ON ges.id = p.gestor_id " +
                        "LEFT JOIN cadastros_pessoas pat ON pat.id = p.patrocinador_id " +
                        "LEFT JOIN cadastros_areas area ON area.ativo = TRUE AND (" +
                        "  (array_length(p.areas_vinculadas_ids, 1) >= 1 AND area.id = p.areas_vinculadas_ids[1]) " +
                        "  OR ((p.areas_vinculadas_ids IS NULL OR array_length(p.areas_vinculadas_ids, 1) IS NULL) " +
                        "      AND area.sigla = p.diretoria)" +
                        ") " +
                        "WHERE p.id = ? AND p.ativo = TRUE", projetoId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** ADMIN ou gestor do projeto (ges.user_id == userId). */
    public boolean isGestorOrAdmin(long projetoId, Long userId, String role) {
        if (userId == null) {
            return false;
        }
        // ADMIN e o perfil Gestor (role MANAGER) podem gerenciar entregas/evidências de qualquer
        // projeto; senão, precisa ser o gestor específico cadastrado no projeto.
        if ("ADMIN".equals(role) || "MANAGER".equals(role)) {
            return true;
        }
        var rows = jdbc.queryForList(
                "SELECT ges.user_id AS gestor_user_id FROM cadastros_projetos p " +
                        "LEFT JOIN cadastros_pessoas ges ON ges.id = p.gestor_id WHERE p.id = ?", projetoId);
        if (rows.isEmpty()) {
            return false;
        }
        return eq(rows.get(0).get("gestor_user_id"), userId);
    }

    public Long projetoIdDaEntrega(long entregaId) {
        var rows = jdbc.queryForList("SELECT projeto_id FROM cadastros_projetos_entregas WHERE id = ?", entregaId);
        return rows.isEmpty() ? null : ((Number) rows.get(0).get("projeto_id")).longValue();
    }

    public boolean isSuperadmin(Long userId) {
        if (userId == null) {
            return false;
        }
        var rows = jdbc.queryForList("SELECT is_superadmin FROM users WHERE id = ?", userId);
        return !rows.isEmpty() && Boolean.TRUE.equals(rows.get(0).get("is_superadmin"));
    }

    public String lookupUserName(Long userId) {
        if (userId == null) {
            return null;
        }
        var rows = jdbc.queryForList("SELECT name FROM users WHERE id = ?", userId);
        return rows.isEmpty() ? null : (String) rows.get(0).get("name");
    }

    /** SELECT diretoria FROM users WHERE id = ? (derivação multi-tenant da listagem de projetos). */
    public String lookupUserDiretoriaForProjetos(long userId) {
        var rows = jdbc.queryForList("SELECT diretoria FROM users WHERE id = ?", userId);
        return rows.isEmpty() ? null : (String) rows.get(0).get("diretoria");
    }

    private static boolean eq(Object col, Long userId) {
        if (col == null || userId == null) {
            return false;
        }
        return ((Number) col).longValue() == userId.longValue();
    }

    private static int toInt(Object v) {
        return v == null ? 0 : ((Number) v).intValue();
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    private static String emptyToNull(String s) {
        return (s == null || s.isEmpty()) ? null : s;
    }

    private static String orDefault(String v, String def) {
        return (v == null || v.isEmpty()) ? def : v;
    }

    private static boolean isBlank(Object v) {
        return v == null || String.valueOf(v).trim().isEmpty();
    }

    private static boolean boolOrFalse(Object v) {
        return Boolean.TRUE.equals(v);
    }

    /** Number(x) com x truthy && !NaN, senão null (0 → null, paridade JS). */
    private static Object numOrNull(Object v) {
        if (v == null) {
            return null;
        }
        double d;
        if (v instanceof Number n) {
            d = n.doubleValue();
        } else {
            try {
                d = Double.parseDouble(String.valueOf(v));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        if (d == 0) {
            return null;
        }
        return (d == Math.floor(d) && !Double.isInfinite(d)) ? (Object) (long) d : (Object) d;
    }

    @SuppressWarnings("unchecked")
    private static List<Object> asIdList(Object v) {
        if (v instanceof List) {
            return new ArrayList<>((List<Object>) v);
        }
        return new ArrayList<>();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> asMapList(Object v) {
        if (v instanceof List<?> list) {
            List<Map<String, Object>> out = new ArrayList<>();
            for (Object o : list) {
                if (o instanceof Map) {
                    out.add((Map<String, Object>) o);
                }
            }
            return out;
        }
        return new ArrayList<>();
    }

    private static String textArray(List<String> dirs) {
        return "{" + String.join(",", dirs) + "}";
    }

    private static String intArray(List<?> ids) {
        StringBuilder sb = new StringBuilder("{");
        for (int i = 0; i < ids.size(); i++) {
            if (i > 0) {
                sb.append(",");
            }
            sb.append(ids.get(i));
        }
        return sb.append("}").toString();
    }
}
