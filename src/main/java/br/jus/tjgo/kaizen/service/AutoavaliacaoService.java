package br.jus.tjgo.kaizen.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de autoavaliacao.service.ts.
 * create() faz UPSERT preservando o formulario_id (UPDATE in-place + DELETE/reinsert das respostas)
 * quando há formulário reutilizável (não-validado OU em atualizacao_requisitada) — é o que faz o
 * histórico de versões (_versoes) acumular no mesmo ID.
 * validar() dispara o cascade: marca a avaliacao_gestor vinculada (pessoa_id = autoavaliacao.id)
 * como atualizacao_requisitada quando a versão está desatualizada.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AutoavaliacaoService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    /** Buscar todos os formulários filtrados por domínio (múltiplas diretorias). */
    public List<Map<String, Object>> findAllByDomain(List<String> diretorias, String tipoInventario) {
        StringBuilder where = new StringBuilder("f.is_deleted = FALSE AND f.diretoria = ANY(?::text[])");
        List<Object> params = new ArrayList<>();
        params.add(textArray(diretorias));
        if (tipoInventario != null) {
            params.add(tipoInventario);
            where.append(" AND COALESCE(f.tipo_inventario, 'equipe') = ?");
        }
        return jdbc.queryForList(listSql(where.toString()), params.toArray());
    }

    public List<Map<String, Object>> findByUnidade(long unidadeId, String tipoInventario) {
        return jdbc.queryForList(
                "SELECT DISTINCT ON (f.user_id) f.id, f.nome_completo, f.cargo_funcao, f.email_institucional, f.unidade_id " +
                        "FROM autoavaliacao_formularios f " +
                        "WHERE f.unidade_id = ? AND f.is_deleted = FALSE " +
                        "  AND COALESCE(f.tipo_inventario, 'equipe') = ? " +
                        "  AND NOT EXISTS ( " +
                        "    SELECT 1 FROM avaliacao_gestor_formularios ag " +
                        "    WHERE ag.pessoa_id = f.id " +
                        "      AND ag.is_deleted = FALSE " +
                        "      AND COALESCE(ag.tipo_inventario, 'equipe') = ? " +
                        "  ) " +
                        "ORDER BY f.user_id, f.created_at DESC",
                unidadeId, tipoInventario, tipoInventario);
    }

    public List<Map<String, Object>> findAll(String diretoria, String tipoInventario) {
        StringBuilder where = new StringBuilder("f.is_deleted = FALSE");
        List<Object> params = new ArrayList<>();
        if (diretoria != null) {
            params.add(diretoria);
            where.append(" AND f.diretoria = ?");
        }
        if (tipoInventario != null) {
            params.add(tipoInventario);
            where.append(" AND COALESCE(f.tipo_inventario, 'equipe') = ?");
        }
        return jdbc.queryForList(listSql(where.toString()), params.toArray());
    }

    private static String listSql(String whereClauses) {
        return "SELECT f.*, " +
                "       u.name as user_name, " +
                "       cu.nome as unidade_nome, " +
                "       (SELECT COUNT(*) FROM autoavaliacao_respostas r WHERE r.formulario_id = f.id) as total_respostas " +
                "FROM autoavaliacao_formularios f " +
                "LEFT JOIN users u ON u.id = f.user_id " +
                "LEFT JOIN cadastros_unidades cu ON cu.id = f.unidade_id " +
                "WHERE " + whereClauses + " " +
                "  AND f.id = ( " +
                "    SELECT f2.id FROM autoavaliacao_formularios f2 " +
                "    WHERE f2.user_id = f.user_id " +
                "      AND f2.is_deleted = FALSE " +
                "      AND COALESCE(f2.tipo_inventario, 'equipe') = COALESCE(f.tipo_inventario, 'equipe') " +
                "    ORDER BY f2.created_at DESC " +
                "    LIMIT 1 " +
                "  ) " +
                "ORDER BY f.created_at DESC";
    }

    public Map<String, Object> findById(long id) {
        List<Map<String, Object>> formRows = jdbc.queryForList(
                "SELECT f.*, u.name as user_name, cu.nome as unidade_nome " +
                        "FROM autoavaliacao_formularios f " +
                        "LEFT JOIN users u ON u.id = f.user_id " +
                        "LEFT JOIN cadastros_unidades cu ON cu.id = f.unidade_id " +
                        "WHERE f.id = ? AND f.is_deleted = FALSE",
                id);
        if (formRows.isEmpty()) {
            return null;
        }
        List<Map<String, Object>> respostas = jdbc.queryForList(
                "SELECT * FROM autoavaliacao_respostas WHERE formulario_id = ? ORDER BY ordem", id);
        Map<String, Object> out = new LinkedHashMap<>(formRows.get(0));
        out.put("respostas", respostas);
        return out;
    }

    public Map<String, Object> findByUserId(long userId, String tipoInventario) {
        List<Map<String, Object>> formRows = jdbc.queryForList(
                "SELECT f.*, cu.nome as unidade_nome " +
                        "FROM autoavaliacao_formularios f " +
                        "LEFT JOIN cadastros_unidades cu ON cu.id = f.unidade_id " +
                        "WHERE f.user_id = ? AND f.is_deleted = FALSE " +
                        "  AND COALESCE(f.tipo_inventario, 'equipe') = ? " +
                        "ORDER BY f.created_at DESC LIMIT 1",
                userId, tipoInventario);
        if (formRows.isEmpty()) {
            return null;
        }
        Map<String, Object> form = formRows.get(0);
        List<Map<String, Object>> respostas = jdbc.queryForList(
                "SELECT * FROM autoavaliacao_respostas WHERE formulario_id = ? ORDER BY ordem", form.get("id"));
        Map<String, Object> out = new LinkedHashMap<>(form);
        out.put("respostas", respostas);
        return out;
    }

    @Transactional
    public Map<String, Object> create(Map<String, Object> data, long userId) {
        String tipoInv = data.get("tipo_inventario") != null ? str(data.get("tipo_inventario")) : "equipe";

        // Formulário existente reutilizável (não-validado ou em atualização requisitada).
        List<Map<String, Object>> existing = jdbc.queryForList(
                "SELECT id FROM autoavaliacao_formularios " +
                        "WHERE user_id = ? AND COALESCE(tipo_inventario, 'equipe') = ? " +
                        "  AND is_deleted = FALSE " +
                        "  AND (validado_em IS NULL OR status = 'atualizacao_requisitada') " +
                        "ORDER BY id DESC LIMIT 1",
                userId, tipoInv);

        // Versão atual das técnicas para a unidade (só quando propagação concluída)
        int tecnicasVersao = 1;
        Long unidadeId = asLong(data.get("unidade_id"));
        if (unidadeId != null) {
            List<Map<String, Object>> versaoRows = jdbc.queryForList(
                    "SELECT tecnicas_versao FROM competencias_gestor_formularios " +
                            "WHERE unidade_id = ? AND COALESCE(tipo, 'equipe') = ? " +
                            "  AND is_deleted = FALSE AND validado_final_em IS NOT NULL " +
                            "  AND COALESCE(tecnicas_propagacao_pendente, FALSE) = FALSE " +
                            "ORDER BY tecnicas_versao DESC LIMIT 1",
                    unidadeId, tipoInv);
            if (!versaoRows.isEmpty() && versaoRows.get(0).get("tecnicas_versao") != null) {
                tecnicasVersao = ((Number) versaoRows.get(0).get("tecnicas_versao")).intValue();
            }
        }

        String updateKeysJson = data.get("update_keys") != null ? toJson(data.get("update_keys")) : null;
        Integer competenciasVersao = asInt(data.get("competencias_versao"));
        Integer versaoAnterior = asInt(data.get("versao_anterior"));
        Long pessoaId = asLong(data.get("pessoa_id"));

        long formularioId;
        if (!existing.isEmpty()) {
            formularioId = ((Number) existing.get(0).get("id")).longValue();
            jdbc.update(
                    "UPDATE autoavaliacao_formularios SET " +
                            "  nome_completo = ?, matricula = ?, cargo_funcao = ?, email_institucional = ?, " +
                            "  diretoria = ?, unidade_id = ?, pessoa_id = ?, tipo_inventario = ?, " +
                            "  status = 'enviado', " +
                            "  competencias_versao = ?, versao_anterior = ?, update_keys = ?::jsonb, " +
                            "  tecnicas_versao = ?, " +
                            "  validado_em = NULL, validado_por_id = NULL, validado_por_nome = NULL, " +
                            "  updated_at = NOW(), updated_by = ? " +
                            "WHERE id = ?",
                    str(data.get("nome_completo")), str(data.get("matricula")), str(data.get("cargo_funcao")),
                    str(data.get("email_institucional")), str(data.get("diretoria")), unidadeId, pessoaId, tipoInv,
                    competenciasVersao, versaoAnterior, updateKeysJson, tecnicasVersao, userId, formularioId);
            jdbc.update("DELETE FROM autoavaliacao_respostas WHERE formulario_id = ?", formularioId);
        } else {
            Map<String, Object> ins = jdbc.queryForMap(
                    "INSERT INTO autoavaliacao_formularios " +
                            "  (user_id, nome_completo, matricula, cargo_funcao, email_institucional, diretoria, unidade_id, pessoa_id, tipo_inventario, status, competencias_versao, versao_anterior, update_keys, tecnicas_versao, created_by, updated_by) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'enviado', ?, ?, ?::jsonb, ?, ?, ?) " +
                            "RETURNING id",
                    userId, str(data.get("nome_completo")), str(data.get("matricula")), str(data.get("cargo_funcao")),
                    str(data.get("email_institucional")), str(data.get("diretoria")), unidadeId, pessoaId, tipoInv,
                    competenciasVersao, versaoAnterior, updateKeysJson, tecnicasVersao, userId, userId);
            formularioId = ((Number) ins.get("id")).longValue();
        }

        List<Map<String, Object>> respostas = asList(data.get("respostas"));
        for (int i = 0; i < respostas.size(); i++) {
            Map<String, Object> r = respostas.get(i);
            jdbc.update(
                    "INSERT INTO autoavaliacao_respostas (formulario_id, competencia_unidade_id, competencia_nome, competencia_descricao, nota, comentario, ordem, tipo) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    formularioId, asLong(r.get("competencia_unidade_id")), str(r.get("competencia_nome")),
                    orNull(r.get("competencia_descricao")), r.get("nota"), orNull(r.get("comentario")),
                    i + 1, r.get("tipo") != null ? str(r.get("tipo")) : "tecnica");
        }

        return findById(formularioId);
    }

    @Transactional
    public Map<String, Object> validar(long id, long userId, String userName) {
        List<Map<String, Object>> formRows = jdbc.queryForList(
                "SELECT * FROM autoavaliacao_formularios WHERE id = ? AND is_deleted = FALSE", id);
        if (formRows.isEmpty()) {
            return error("Formulário não encontrado");
        }
        Map<String, Object> formulario = formRows.get(0);
        if (formulario.get("validado_em") != null) {
            return error("Formulário já foi validado");
        }
        if (!asLong(formulario.get("user_id")).equals(userId)) {
            return error("Apenas o colaborador que preencheu pode validar");
        }

        jdbc.update(
                "UPDATE autoavaliacao_formularios " +
                        "SET status = 'validado', validado_por_id = ?, validado_por_nome = ?, validado_em = NOW(), " +
                        "    versao_formulario = COALESCE(versao_formulario, 0) + 1, updated_by = ? " +
                        "WHERE id = ?",
                userId, userName, userId, id);

        // Snapshot da versão recém-validada
        Map<String, Object> formularioCompleto = findById(id);
        if (formularioCompleto != null) {
            try {
                int novaVersao = formularioCompleto.get("versao_formulario") != null
                        ? ((Number) formularioCompleto.get("versao_formulario")).intValue() : 1;
                jdbc.update(
                        "INSERT INTO autoavaliacao_versoes (formulario_id, versao, dados, validado_em, validado_nome) " +
                                "VALUES (?, ?, ?::jsonb, ?, ?) " +
                                "ON CONFLICT (formulario_id, versao) DO UPDATE SET dados = EXCLUDED.dados",
                        id, novaVersao, toJson(formularioCompleto),
                        formularioCompleto.get("validado_em"), formularioCompleto.get("validado_por_nome"));
            } catch (Exception err) {
                log.error("[validar] Erro ao salvar snapshot de versão: {}", err.getMessage());
            }
        }

        // Cascade: marca a avaliacao_gestor vinculada (pessoa_id = autoavaliacao.id) como atualizacao_requisitada.
        try {
            int tecV = numOr1(formulario.get("tecnicas_versao"));
            int padV = numOr1(formulario.get("competencias_versao"));
            jdbc.update(
                    "UPDATE avaliacao_gestor_formularios " +
                            "SET status = 'atualizacao_requisitada', updated_at = NOW() " +
                            "WHERE is_deleted = FALSE " +
                            "  AND pessoa_id = ? " +
                            "  AND status IN ('enviado', 'validado') " +
                            "  AND ( " +
                            "        COALESCE(tecnicas_versao, 1) < ? " +
                            "     OR COALESCE(competencias_versao, 1) < ? " +
                            "  )",
                    id, tecV, padV);
        } catch (Exception err) {
            log.error("[validar] Erro ao cascatear atualização para avaliação do gestor: {}", err.getMessage());
        }

        return formularioCompleto;
    }

    public List<Map<String, Object>> findVersoes(long formularioId) {
        return jdbc.queryForList(
                "SELECT id, formulario_id, versao, validado_em, validado_nome, created_at " +
                        "FROM autoavaliacao_versoes WHERE formulario_id = ? ORDER BY versao DESC",
                formularioId);
    }

    public Object findVersaoDados(long formularioId, int versao) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT dados FROM autoavaliacao_versoes WHERE formulario_id = ? AND versao = ?",
                formularioId, versao);
        if (rows.isEmpty()) {
            return null;
        }
        return rows.get(0).get("dados");
    }

    public void delete(long id, long userId) {
        jdbc.update(
                "UPDATE autoavaliacao_formularios SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ? WHERE id = ?",
                userId, id);
    }

    // ============================================================
    // Helpers
    // ============================================================

    private static Map<String, Object> error(String message) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("error", message);
        return m;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> asList(Object v) {
        if (v instanceof List<?> list) {
            return (List<Map<String, Object>>) list;
        }
        return new ArrayList<>();
    }

    private static int numOr1(Object v) {
        return v == null ? 1 : ((Number) v).intValue();
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

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return "null";
        }
    }

    private static Long asLong(Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof Number n) {
            return n.longValue();
        }
        try {
            return Long.parseLong(String.valueOf(v));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Integer asInt(Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof Number n) {
            return n.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(v));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    private static String textArray(List<String> values) {
        return "{" + String.join(",", values) + "}";
    }
}
