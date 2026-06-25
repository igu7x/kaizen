package br.jus.tjgo.kaizen.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de processosNegocio.service.ts — validação identity-based em 3 camadas.
 * A autorização (autor / diretoria / superadmin) é feita no controller (igual ao Node, que
 * checa no route layer); o service só aplica as transições de status condicionadas.
 * Bump de versão SÓ em validarFinal e só quando ciclos_homologados >= 1 (1ª homologação fica em 1.0).
 * Snapshot em processos_negocio_historico após cada validarFinal (try/catch silencioso).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProcessosNegocioService {

    /** ~6MB — fluxograma (data URL base64). */
    private static final int FLUXOGRAMA_MAX_BYTES = 6_000_000;
    /** ~20MB — soma das bases64 dos documentos anexados. */
    private static final int DOCUMENTOS_TOTAL_MAX_BYTES = 20_000_000;
    /** ~6MB — PDF de aprovação (data URL base64). */
    private static final int APROVACAO_MAX_BYTES = 6_000_000;

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    /**
     * Listagem para o Escritório de Processos. A tela só precisa dos metadados (nome, status,
     * tipos de documentos anexados, se há fluxograma) — NUNCA dos bytes base64. Enviar o
     * fluxograma (~6MB) e os documentos (~20MB) de cada processo travava o carregamento da lista.
     * Por isso enxugamos o payload aqui: zeramos {@code fluxograma_data}, removemos o {@code data}
     * de cada documento (mantendo tipo/nome/mime) e expomos {@code tem_fluxograma}. O detalhe
     * (findById) continua retornando o processo completo para preview/download/PDF.
     */
    public List<Map<String, Object>> findAll(String diretoria) {
        List<Object> params = new ArrayList<>();
        StringBuilder where = new StringBuilder("is_deleted = FALSE");
        if (diretoria != null) {
            params.add(diretoria);
            where.append(" AND diretoria = ?");
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT * FROM processos_negocio WHERE " + where + " ORDER BY updated_at DESC",
                params.toArray());
        for (Map<String, Object> row : rows) {
            stripHeavyFields(row);
        }
        return rows;
    }

    /** Remove os bytes base64 (fluxograma + documentos + aprovação) de uma linha da listagem, in-place. */
    private void stripHeavyFields(Map<String, Object> row) {
        Object fluxograma = row.get("fluxograma_data");
        boolean temFluxograma = fluxograma != null && !str(fluxograma).isBlank();
        row.put("fluxograma_data", null);

        Object aprovacao = row.get("aprovacao_data");
        boolean temAprovacao = aprovacao != null && !str(aprovacao).isBlank();
        row.put("aprovacao_data", null);
        row.put("tem_aprovacao", temAprovacao);

        List<Map<String, Object>> docs = stripDocumentosData(row.get("documentos_anexados"));
        row.put("documentos_anexados", docs);
        if (!temFluxograma) {
            temFluxograma = docs.stream()
                    .anyMatch(d -> "FLUXOGRAMA".equals(String.valueOf(d.get("tipo"))));
        }
        row.put("tem_fluxograma", temFluxograma);
    }

    /** Parseia o jsonb de documentos e descarta o campo {@code data} de cada item (mantém metadados). */
    private List<Map<String, Object>> stripDocumentosData(Object raw) {
        if (raw == null) {
            return new ArrayList<>();
        }
        String json = String.valueOf(raw);
        if (json.isBlank() || "null".equals(json)) {
            return new ArrayList<>();
        }
        try {
            List<Map<String, Object>> docs = objectMapper.readValue(json, new TypeReference<>() {});
            if (docs == null) {
                return new ArrayList<>();
            }
            for (Map<String, Object> d : docs) {
                if (d != null) {
                    d.remove("data");
                }
            }
            return docs;
        } catch (Exception e) {
            log.warn("[processosNegocio] falha ao enxugar documentos_anexados na listagem: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    public Map<String, Object> findById(long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT * FROM processos_negocio WHERE id = ? AND is_deleted = FALSE", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * Anexa/atualiza o PDF de aprovação (restrito a superadmin no controller). É o artefato que,
     * junto com as 3 camadas de validação concluídas (status = validado_final), torna o processo
     * um "Modelo K1". Não mexe no status — o K1 é derivado no front a partir destes dois fatos.
     */
    public Map<String, Object> setAprovacao(long id, String data, String filename, String mime, long userId) {
        if (data == null || data.isBlank()) {
            throw new RuntimeException("APROVACAO_REQUIRED");
        }
        if (data.length() > APROVACAO_MAX_BYTES) {
            throw new RuntimeException("APROVACAO_TOO_LARGE");
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "UPDATE processos_negocio SET aprovacao_data = ?, aprovacao_filename = ?, aprovacao_mime = ?, " +
                        "updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE RETURNING *",
                data, filename, mime, userId, id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** Remove o PDF de aprovação (o processo deixa de ser elegível a Modelo K1). */
    public Map<String, Object> removeAprovacao(long id, long userId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "UPDATE processos_negocio SET aprovacao_data = NULL, aprovacao_filename = NULL, aprovacao_mime = NULL, " +
                        "updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE RETURNING *",
                userId, id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> create(Map<String, Object> data, long userId) {
        String fluxograma = str(data.get("fluxograma_data"));
        if (fluxograma != null && fluxograma.length() > FLUXOGRAMA_MAX_BYTES) {
            throw new RuntimeException("FLUXOGRAMA_TOO_LARGE");
        }
        if (calcDocsTotalBytes(data.get("documentos_anexados")) > DOCUMENTOS_TOTAL_MAX_BYTES) {
            throw new RuntimeException("DOCUMENTOS_TOO_LARGE");
        }
        return jdbc.queryForMap(
                "INSERT INTO processos_negocio ( " +
                        "  macroprocesso, diretoria, periodo, revisao, codigo_versao, nome_processo, " +
                        "  descricao, detalhamento, " +
                        "  proprietarios, atores, areas_responsaveis, " +
                        "  entradas, saidas, " +
                        "  sistemas_ferramentas, normativos_referencias, " +
                        "  fluxograma_data, fluxograma_filename, fluxograma_mime, " +
                        "  documentos_anexados, " +
                        "  periodicidade_revisao, " +
                        "  numero_proad, observacoes_gerais, indicadores, " +
                        "  status, created_by, updated_by " +
                        ") VALUES ( " +
                        "  ?, ?, ?, ?, ?, ?, " +
                        "  ?, ?, " +
                        "  ?::jsonb, ?::jsonb, ?::jsonb, " +
                        "  ?::jsonb, ?::jsonb, " +
                        "  ?::jsonb, ?::jsonb, " +
                        "  ?, ?, ?, " +
                        "  ?::jsonb, " +
                        "  ?, " +
                        "  ?, ?, ?, " +
                        "  'em_elaboracao', ?, ? " +
                        ") RETURNING *",
                str(data.get("macroprocesso")), str(data.get("diretoria")), orNull(data.get("periodo")),
                orNull(data.get("revisao")), orNull(data.get("codigo_versao")), str(data.get("nome_processo")),
                orNull(data.get("descricao")), orNull(data.get("detalhamento")),
                toJsonArray(data.get("proprietarios")), toJsonArray(data.get("atores")), toJsonArray(data.get("areas_responsaveis")),
                toJsonArray(data.get("entradas")), toJsonArray(data.get("saidas")),
                toJsonArray(data.get("sistemas_ferramentas")), toJsonArray(data.get("normativos_referencias")),
                orNull(data.get("fluxograma_data")), orNull(data.get("fluxograma_filename")), orNull(data.get("fluxograma_mime")),
                toJsonArray(data.get("documentos_anexados")),
                orNull(data.get("periodicidade_revisao")),
                orNull(data.get("numero_proad")), orNull(data.get("observacoes_gerais")), orNull(data.get("indicadores")),
                userId, userId);
    }

    public Map<String, Object> update(long id, Map<String, Object> data, long userId) {
        String fluxograma = str(data.get("fluxograma_data"));
        if (fluxograma != null && fluxograma.length() > FLUXOGRAMA_MAX_BYTES) {
            throw new RuntimeException("FLUXOGRAMA_TOO_LARGE");
        }
        if (data.containsKey("documentos_anexados") && calcDocsTotalBytes(data.get("documentos_anexados")) > DOCUMENTOS_TOTAL_MAX_BYTES) {
            throw new RuntimeException("DOCUMENTOS_TOO_LARGE");
        }

        List<String> fields = new ArrayList<>();
        List<Object> values = new ArrayList<>();

        pushScalar(data, fields, values, "macroprocesso");
        pushScalar(data, fields, values, "diretoria");
        pushScalar(data, fields, values, "periodo");
        pushScalar(data, fields, values, "revisao");
        pushScalar(data, fields, values, "codigo_versao");
        pushScalar(data, fields, values, "nome_processo");
        pushScalar(data, fields, values, "descricao");
        pushScalar(data, fields, values, "detalhamento");
        pushScalar(data, fields, values, "indicadores");
        pushJson(data, fields, values, "proprietarios");
        pushJson(data, fields, values, "atores");
        pushJson(data, fields, values, "areas_responsaveis");
        pushJson(data, fields, values, "entradas");
        pushJson(data, fields, values, "saidas");
        pushJson(data, fields, values, "sistemas_ferramentas");
        pushJson(data, fields, values, "normativos_referencias");
        pushScalar(data, fields, values, "fluxograma_data");
        pushScalar(data, fields, values, "fluxograma_filename");
        pushScalar(data, fields, values, "fluxograma_mime");
        pushJson(data, fields, values, "documentos_anexados");
        pushScalar(data, fields, values, "periodicidade_revisao");
        pushScalar(data, fields, values, "numero_proad");
        pushScalar(data, fields, values, "observacoes_gerais");

        if (fields.isEmpty()) {
            return findById(id);
        }
        fields.add("updated_at = CURRENT_TIMESTAMP");
        values.add(userId);
        fields.add("updated_by = ?");
        values.add(id);

        List<Map<String, Object>> rows = jdbc.queryForList(
                "UPDATE processos_negocio SET " + String.join(", ", fields) +
                        " WHERE id = ? AND is_deleted = FALSE RETURNING *",
                values.toArray());
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * Enviar para validação. O fluxo de aprovação tem 2 camadas (Setorial → Estratégica):
     * a camada do responsável é carimbada automaticamente no envio (quem envia é o
     * responsável), e o processo já segue para "validado_autor" (= aguardando a diretoria).
     */
    public Map<String, Object> enviarParaValidacao(long id, long userId, String userName) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "UPDATE processos_negocio " +
                        "SET status = 'validado_autor', updated_at = CURRENT_TIMESTAMP, updated_by = ?, " +
                        "    recusado_em = NULL, recusado_por_user_id = NULL, recusado_por_nome = NULL, " +
                        "    recusado_camada = NULL, recusa_motivo = NULL, " +
                        "    validado_autor_user_id = ?, validado_autor_nome = ?, validado_autor_em = CURRENT_TIMESTAMP, " +
                        "    validado_diretoria_user_id = NULL, validado_diretoria_nome = NULL, validado_diretoria_em = NULL, " +
                        "    validado_final_user_id = NULL, validado_final_nome = NULL, validado_final_em = NULL " +
                        "WHERE id = ? AND is_deleted = FALSE AND status IN ('em_elaboracao', 'recusado', 'validado_final') " +
                        "RETURNING *",
                userId, userId, userName, id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> validarAutor(long id, long userId, String userName) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "UPDATE processos_negocio " +
                        "SET status = 'validado_autor', validado_autor_user_id = ?, validado_autor_nome = ?, " +
                        "    validado_autor_em = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE AND status = 'enviado' " +
                        "RETURNING *",
                userId, userName, userId, id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> validarDiretoria(long id, long userId, String userName) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "UPDATE processos_negocio " +
                        "SET status = 'validado_diretoria', validado_diretoria_user_id = ?, validado_diretoria_nome = ?, " +
                        "    validado_diretoria_em = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE AND status = 'validado_autor' " +
                        "RETURNING *",
                userId, userName, userId, id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    @Transactional
    public Map<String, Object> validarFinal(long id, long userId, String userName) {
        List<Map<String, Object>> current = jdbc.queryForList(
                "SELECT versao, ciclos_homologados FROM processos_negocio " +
                        "WHERE id = ? AND is_deleted = FALSE AND status = 'validado_diretoria'", id);
        if (current.isEmpty()) {
            return null;
        }
        String versaoAtual = current.get(0).get("versao") != null ? str(current.get(0).get("versao")) : "1.0";
        int ciclos = current.get(0).get("ciclos_homologados") != null
                ? ((Number) current.get(0).get("ciclos_homologados")).intValue() : 0;

        String novaVersao = versaoAtual;
        if (ciclos >= 1) {
            String[] partes = versaoAtual.split("\\.");
            int maior = parseIntSafe(partes.length > 0 ? partes[0] : null, 1);
            int menor = parseIntSafe(partes.length > 1 ? partes[1] : null, 0);
            novaVersao = menor >= 9 ? (maior + 1) + ".0" : maior + "." + (menor + 1);
        }

        List<Map<String, Object>> rows = jdbc.queryForList(
                "UPDATE processos_negocio " +
                        "SET status = 'validado_final', validado_final_user_id = ?, validado_final_nome = ?, " +
                        "    validado_final_em = CURRENT_TIMESTAMP, versao = ?, " +
                        "    ciclos_homologados = ciclos_homologados + 1, " +
                        "    updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE AND status = 'validado_diretoria' " +
                        "RETURNING *",
                userId, userName, novaVersao, userId, id);
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> processo = rows.get(0);

        // Snapshot da versão no histórico (falha silenciosa pra não bloquear a homologação)
        try {
            jdbc.update(
                    "INSERT INTO processos_negocio_historico " +
                            "  (processo_id, versao, snapshot, validado_final_em, validado_final_nome, validado_final_user_id) " +
                            "VALUES (?, ?, ?::jsonb, ?, ?, ?)",
                    id, novaVersao, toJson(processo), processo.get("validado_final_em"), userName, userId);
        } catch (Exception err) {
            log.warn("[processosNegocio] falha ao gravar snapshot histórico: {}", err.getMessage());
        }

        return processo;
    }

    public List<Map<String, Object>> listVersoes(long id) {
        return jdbc.queryForList(
                "SELECT id, versao, validado_final_em, validado_final_nome, created_at " +
                        "FROM processos_negocio_historico WHERE processo_id = ? ORDER BY created_at DESC",
                id);
    }

    public Object getVersaoSnapshot(long processoId, long historicoId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT snapshot FROM processos_negocio_historico WHERE id = ? AND processo_id = ?",
                historicoId, processoId);
        if (rows.isEmpty()) {
            return null;
        }
        return rows.get(0).get("snapshot");
    }

    public Map<String, Object> recusar(long id, long userId, String userName, String camada, String motivo) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "UPDATE processos_negocio " +
                        "SET status = 'recusado', recusado_em = CURRENT_TIMESTAMP, recusado_por_user_id = ?, " +
                        "    recusado_por_nome = ?, recusado_camada = ?, recusa_motivo = ?, " +
                        "    updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE " +
                        "RETURNING *",
                userId, userName, camada, motivo, userId, id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public boolean delete(long id, long userId) {
        int rc = jdbc.update(
                "UPDATE processos_negocio " +
                        "SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE",
                userId, id);
        return rc > 0;
    }

    // ============================================================
    // Helpers
    // ============================================================

    private void pushScalar(Map<String, Object> data, List<String> fields, List<Object> values, String col) {
        if (data.containsKey(col)) {
            fields.add(col + " = ?");
            values.add(data.get(col));
        }
    }

    private void pushJson(Map<String, Object> data, List<String> fields, List<Object> values, String col) {
        if (data.containsKey(col)) {
            fields.add(col + " = ?::jsonb");
            values.add(toJson(data.get(col)));
        }
    }

    @SuppressWarnings("unchecked")
    private static long calcDocsTotalBytes(Object docs) {
        if (!(docs instanceof List<?> list) || list.isEmpty()) {
            return 0;
        }
        long sum = 0;
        for (Object o : list) {
            if (o instanceof Map<?, ?> m) {
                Object d = ((Map<String, Object>) m).get("data");
                if (d != null) {
                    sum += String.valueOf(d).length();
                }
            }
        }
        return sum;
    }

    /** Serializa um array de strings; null/ausente vira "[]" (paridade com JSON.stringify(x || [])). */
    private String toJsonArray(Object value) {
        if (value == null) {
            return "[]";
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return "[]";
        }
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return "null";
        }
    }

    private static int parseIntSafe(String s, int fallback) {
        if (s == null) {
            return fallback;
        }
        try {
            return Integer.parseInt(s.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private static Object orNull(Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof String s && s.isEmpty()) {
            return null;
        }
        return v;
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }
}
