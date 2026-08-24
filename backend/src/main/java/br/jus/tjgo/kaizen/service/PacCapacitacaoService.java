package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * CRUD da Matriz do Plano Anual de Capacitação (tabela pac_capacitacao).
 * Uma linha = um item de capacitação; a coluna `modulo` separa TI ('ti') de
 * Apoio Judiciário ('apoio'). Soft-delete via is_deleted.
 */
@Service
@RequiredArgsConstructor
public class PacCapacitacaoService {

    private final JdbcTemplate jdbc;

    private static final List<String> CAMPOS = List.of(
            "codigo", "area_demandante", "categoria", "tema", "evento_capacitacao",
            "objetivo_justificativa", "publico_alvo", "prioridade", "numero_vagas",
            "competencias", "modalidade", "estimativa_custo", "observacoes");

    public List<Map<String, Object>> list(String modulo) {
        return jdbc.queryForList(
                "SELECT p.*, " +
                        "  (SELECT COUNT(*) FROM pac_capacitacao_certificados c " +
                        "   WHERE c.capacitacao_id = p.id AND c.is_deleted = FALSE) AS certificados_count " +
                        "FROM pac_capacitacao p " +
                        "WHERE p.modulo = ? AND p.is_deleted = FALSE " +
                        "ORDER BY p.codigo NULLS LAST, p.id",
                modulo == null || modulo.isBlank() ? "ti" : modulo);
    }

    public Map<String, Object> getById(long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT * FROM pac_capacitacao WHERE id = ? AND is_deleted = FALSE", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    @Transactional
    public Map<String, Object> create(Map<String, Object> body) {
        String modulo = str(body.get("modulo"));
        if (modulo == null || modulo.isBlank()) modulo = "ti";

        StringBuilder cols = new StringBuilder("modulo");
        StringBuilder ph = new StringBuilder("?");
        java.util.List<Object> params = new java.util.ArrayList<>();
        params.add(modulo);
        for (String campo : CAMPOS) {
            cols.append(", ").append(campo);
            ph.append(", ?");
            params.add(valorCampo(campo, body.get(campo)));
        }

        Long id = jdbc.queryForObject(
                "INSERT INTO pac_capacitacao (" + cols + ") VALUES (" + ph + ") RETURNING id",
                Long.class, params.toArray());
        return getById(id);
    }

    @Transactional
    public Map<String, Object> update(long id, Map<String, Object> body) {
        StringBuilder set = new StringBuilder();
        java.util.List<Object> params = new java.util.ArrayList<>();
        for (String campo : CAMPOS) {
            if (!body.containsKey(campo)) continue;
            if (set.length() > 0) set.append(", ");
            set.append(campo).append(" = ?");
            params.add(valorCampo(campo, body.get(campo)));
        }
        if (set.length() == 0) return getById(id);
        set.append(", updated_at = CURRENT_TIMESTAMP");
        params.add(id);
        jdbc.update("UPDATE pac_capacitacao SET " + set + " WHERE id = ? AND is_deleted = FALSE",
                params.toArray());
        return getById(id);
    }

    @Transactional
    public boolean delete(long id) {
        int n = jdbc.update(
                "UPDATE pac_capacitacao SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP " +
                        "WHERE id = ? AND is_deleted = FALSE", id);
        return n > 0;
    }

    // ============================================================
    // CERTIFICADOS DOS PARTICIPANTES
    // ============================================================

    /** Lista os certificados de um item (sem o base64 do arquivo, só metadados). */
    public List<Map<String, Object>> listCertificados(long capacitacaoId) {
        return jdbc.queryForList(
                "SELECT id, capacitacao_id, colaborador_id, nome_servidor, diretoria, " +
                        "       arquivo_nome, (arquivo_data IS NOT NULL) AS tem_arquivo, created_at " +
                        "FROM pac_capacitacao_certificados " +
                        "WHERE capacitacao_id = ? AND is_deleted = FALSE " +
                        "ORDER BY created_at, id",
                capacitacaoId);
    }

    @Transactional
    public Map<String, Object> addCertificado(long capacitacaoId, Map<String, Object> body) {
        Long id = jdbc.queryForObject(
                "INSERT INTO pac_capacitacao_certificados " +
                        "(capacitacao_id, colaborador_id, nome_servidor, diretoria, arquivo_nome, arquivo_data) " +
                        "VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
                Long.class,
                capacitacaoId,
                body.get("colaborador_id") == null ? null : Long.valueOf(String.valueOf(body.get("colaborador_id"))),
                str(body.get("nome_servidor")),
                blankToNull(str(body.get("diretoria"))),
                blankToNull(str(body.get("arquivo_nome"))),
                blankToNull(str(body.get("arquivo_data"))));
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, capacitacao_id, colaborador_id, nome_servidor, diretoria, " +
                        "       arquivo_nome, (arquivo_data IS NOT NULL) AS tem_arquivo, created_at " +
                        "FROM pac_capacitacao_certificados WHERE id = ?",
                id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** Retorna o arquivo (data URL base64) de um certificado, para download. */
    public Map<String, Object> getCertificadoArquivo(long certId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT arquivo_nome, arquivo_data FROM pac_capacitacao_certificados " +
                        "WHERE id = ? AND is_deleted = FALSE",
                certId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    @Transactional
    public boolean deleteCertificado(long certId) {
        int n = jdbc.update(
                "UPDATE pac_capacitacao_certificados SET is_deleted = TRUE " +
                        "WHERE id = ? AND is_deleted = FALSE", certId);
        return n > 0;
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    // ============================================================
    // PARÂMETROS DAS METAS
    // ============================================================

    /**
     * Números da Meta 2 do módulo: o total de servidores (informado pelo gestor e travado para o
     * ciclo) e quantos já participaram de ao menos uma ação.
     *
     * <p>Meta 1 e o gráfico de status NÃO saem daqui: derivam de certificados x vagas de cada item,
     * que a tela já tem em mãos. Calcular de novo no backend abriria espaço para o card divergir
     * da própria tabela logo abaixo dele.
     */
    public Map<String, Object> getParametros(String modulo) {
        String mod = modulo == null || modulo.isBlank() ? "ti" : modulo.trim();
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT total_servidores, updated_at FROM pac_parametros WHERE modulo = ?", mod);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("modulo", mod);
        out.put("total_servidores", rows.isEmpty() ? 0 : rows.get(0).get("total_servidores"));
        out.put("atualizado_em", rows.isEmpty() ? null : rows.get(0).get("updated_at"));
        out.put("servidores_capacitados", contarServidoresCapacitados(mod));
        return out;
    }

    /**
     * Servidores distintos com ao menos um certificado no módulo. Casa por
     * {@code colaborador_id} e, quando ele é nulo (certificado lançado só com o nome), pelo nome
     * normalizado — senão a mesma pessoa contaria mais de uma vez e a meta inflaria.
     */
    private int contarServidoresCapacitados(String modulo) {
        Integer total = jdbc.queryForObject(
                "SELECT COUNT(DISTINCT COALESCE(c.colaborador_id::text, LOWER(BTRIM(c.nome_servidor))))::int " +
                        "FROM pac_capacitacao_certificados c " +
                        "JOIN pac_capacitacao p ON p.id = c.capacitacao_id " +
                        "WHERE p.modulo = ? AND COALESCE(p.is_deleted, FALSE) = FALSE " +
                        "  AND COALESCE(c.is_deleted, FALSE) = FALSE " +
                        "  AND COALESCE(BTRIM(c.nome_servidor), '') <> ''",
                Integer.class, modulo);
        return total == null ? 0 : total;
    }

    /** Grava o total de servidores do módulo (upsert por módulo). */
    public Map<String, Object> salvarParametros(String modulo, Integer totalServidores, Long userId) {
        String mod = modulo == null || modulo.isBlank() ? "ti" : modulo.trim();
        int total = totalServidores == null || totalServidores < 0 ? 0 : totalServidores;
        jdbc.update(
                "INSERT INTO pac_parametros (modulo, total_servidores, updated_at, updated_by) " +
                        "VALUES (?, ?, NOW(), ?) " +
                        "ON CONFLICT (modulo) DO UPDATE " +
                        "SET total_servidores = EXCLUDED.total_servidores, " +
                        "    updated_at = NOW(), updated_by = EXCLUDED.updated_by",
                mod, total, userId);
        return getParametros(mod);
    }

    /** numero_vagas é INTEGER; os demais são texto. Strings vazias viram NULL. */
    private Object valorCampo(String campo, Object v) {
        if ("numero_vagas".equals(campo)) {
            if (v == null) return null;
            String s = String.valueOf(v).trim();
            if (s.isEmpty() || "-".equals(s)) return null;
            try {
                return Integer.parseInt(s);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        String s = str(v);
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }
}
