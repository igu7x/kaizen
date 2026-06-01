package br.jus.tjgo.kaizen.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.postgresql.util.PGobject;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de competenciasTecnicasAdmin.service.ts — administração de competências técnicas
 * por unidade após a validação final. publish() reseta a matriz e marca propagação pendente;
 * propagarParaInventario() dispara o cascade sequencial auto → gestor → integrada (NOT EXISTS).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CompetenciasTecnicasAdminService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public List<Map<String, Object>> findUnidadesGerenciaveis(long userId) {
        try {
            return jdbc.queryForList(
                    "SELECT cu.id AS unidade_id, cu.nome AS unidade_nome, cgf.id AS formulario_id, cgf.tipo, cgf.status, " +
                            "       cgf.tecnicas_versao, cgf.tecnicas_publicado_em, ca.sigla AS diretoria_sigla " +
                            "FROM cadastros_unidades cu " +
                            "JOIN competencias_gestor_formularios cgf ON cgf.unidade_id = cu.id AND cgf.is_deleted = FALSE " +
                            "LEFT JOIN cadastros_areas ca ON ca.id = cu.area_id " +
                            "WHERE (cu.ativo IS NOT FALSE) " +
                            "  AND ( " +
                            "    (cgf.tipo = 'equipe' AND cu.responsavel_user_id = ?) " +
                            "    OR (cgf.tipo = 'gestor' AND (ca.gestor_user_id = ? OR ca.subdiretor_user_id = ?)) " +
                            "  ) " +
                            "ORDER BY cu.nome, cgf.tipo",
                    userId, userId, userId);
        } catch (Exception e) {
            return jdbc.queryForList(
                    "SELECT cu.id AS unidade_id, cu.nome AS unidade_nome, cgf.id AS formulario_id, cgf.tipo, cgf.status, " +
                            "       cgf.tecnicas_versao, cgf.tecnicas_publicado_em, ca.sigla AS diretoria_sigla " +
                            "FROM cadastros_unidades cu " +
                            "JOIN competencias_gestor_formularios cgf ON cgf.unidade_id = cu.id AND cgf.is_deleted = FALSE " +
                            "LEFT JOIN cadastros_areas ca ON ca.id = cu.area_id " +
                            "WHERE (cu.ativo IS NOT FALSE) " +
                            "  AND ( " +
                            "    (cgf.tipo = 'equipe' AND cu.responsavel_user_id = ?) " +
                            "    OR (cgf.tipo = 'gestor' AND ca.gestor_user_id = ?) " +
                            "  ) " +
                            "ORDER BY cu.nome, cgf.tipo",
                    userId, userId);
        }
    }

    public boolean canManage(long formularioId, long userId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT cgf.tipo, cu.responsavel_user_id, ca.gestor_user_id, ca.subdiretor_user_id " +
                        "FROM competencias_gestor_formularios cgf " +
                        "LEFT JOIN cadastros_unidades cu ON cu.id = cgf.unidade_id " +
                        "LEFT JOIN cadastros_areas ca ON ca.id = cu.area_id " +
                        "WHERE cgf.id = ? AND cgf.is_deleted = FALSE",
                formularioId);
        if (rows.isEmpty()) {
            return false;
        }
        Map<String, Object> row = rows.get(0);
        String tipo = (String) row.get("tipo");
        if ("equipe".equals(tipo)) {
            return equalsId(row.get("responsavel_user_id"), userId);
        }
        if ("gestor".equals(tipo)) {
            return equalsId(row.get("gestor_user_id"), userId) || equalsId(row.get("subdiretor_user_id"), userId);
        }
        return false;
    }

    public List<Map<String, Object>> findItens(long formularioId) {
        return jdbc.queryForList(
                "SELECT * FROM competencias_gestor_itens WHERE formulario_id = ? ORDER BY ordem, id", formularioId);
    }

    public Map<String, Object> createItem(long formularioId, Map<String, Object> data, long userId) {
        Integer ordem = jdbc.queryForObject(
                "SELECT COALESCE(MAX(ordem), 0) + 1 AS next_ordem FROM competencias_gestor_itens WHERE formulario_id = ?",
                Integer.class, formularioId);
        return jdbc.queryForMap(
                "INSERT INTO competencias_gestor_itens (formulario_id, ordem, nome, descricao, peso, aplicabilidade, quantidade_pessoas) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *",
                formularioId, ordem, str(data.get("nome")), str(data.get("descricao")), data.get("peso"),
                str(data.get("aplicabilidade")), data.get("quantidade_pessoas"));
    }

    public Map<String, Object> updateItem(long itemId, Map<String, Object> data, long userId) {
        List<String> sets = new ArrayList<>();
        List<Object> values = new ArrayList<>();

        if (data.containsKey("nome") && data.get("nome") != null) {
            sets.add("nome = ?");
            values.add(str(data.get("nome")));
        }
        if (data.containsKey("descricao") && data.get("descricao") != null) {
            sets.add("descricao = ?");
            values.add(str(data.get("descricao")));
        }
        if (data.get("peso") != null) {
            sets.add("peso = ?");
            values.add(data.get("peso"));
        }
        if (data.containsKey("aplicabilidade") && data.get("aplicabilidade") != null) {
            sets.add("aplicabilidade = ?");
            values.add(str(data.get("aplicabilidade")));
        }
        if (data.get("quantidade_pessoas") != null) {
            sets.add("quantidade_pessoas = ?");
            values.add(data.get("quantidade_pessoas"));
        }

        sets.add("updated_at = NOW()");
        values.add(itemId);

        return jdbc.queryForMap(
                "UPDATE competencias_gestor_itens SET " + String.join(", ", sets) + " WHERE id = ? RETURNING *",
                values.toArray());
    }

    public void deleteItem(long itemId, long userId) {
        jdbc.update("DELETE FROM competencias_gestor_itens WHERE id = ?", itemId);
    }

    public Map<String, Object> findFormularioCompleto(long formularioId) {
        List<Map<String, Object>> formRows = jdbc.queryForList(
                "SELECT * FROM competencias_gestor_formularios WHERE id = ? AND is_deleted = FALSE", formularioId);
        if (formRows.isEmpty()) {
            return null;
        }
        Map<String, Object> out = new LinkedHashMap<>(formRows.get(0));
        out.put("itens", findItens(formularioId));
        return out;
    }

    public boolean hasPendingChanges(long formularioId) {
        Map<String, Object> form = findFormularioCompleto(formularioId);
        if (form == null) {
            return false;
        }
        List<Map<String, Object>> snapshot = parseJsonArray(form.get("tecnicas_snapshot_publicado"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> itens = (List<Map<String, Object>>) form.get("itens");

        if (snapshot.size() != itens.size()) {
            return true;
        }
        Map<Long, Map<String, Object>> snapMap = new LinkedHashMap<>();
        for (Map<String, Object> s : snapshot) {
            snapMap.put(asLong(s.get("id")), s);
        }
        for (Map<String, Object> c : itens) {
            Map<String, Object> s = snapMap.get(asLong(c.get("id")));
            if (s == null) {
                return true;
            }
            if (!java.util.Objects.equals(str(s.get("nome")), str(c.get("nome")))
                    || !java.util.Objects.equals(str(s.get("descricao")), str(c.get("descricao")))
                    || !java.util.Objects.equals(asLong(s.get("peso")), asLong(c.get("peso")))
                    || !java.util.Objects.equals(str(s.get("aplicabilidade")), str(c.get("aplicabilidade")))
                    || !java.util.Objects.equals(asLong(s.get("quantidade_pessoas")), asLong(c.get("quantidade_pessoas")))) {
                return true;
            }
        }
        return false;
    }

    @Transactional
    public Map<String, Object> publish(long formularioId, long userId) {
        Map<String, Object> form = findFormularioCompleto(formularioId);
        if (form == null) {
            throw new br.jus.tjgo.kaizen.exception.ApiException(500, "Formulário não encontrado");
        }

        List<Map<String, Object>> snapshot = parseJsonArray(form.get("tecnicas_snapshot_publicado"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> current = (List<Map<String, Object>>) form.get("itens");

        Map<String, Map<String, Object>> snapByName = byName(snapshot);
        Map<String, Map<String, Object>> currByName = byName(current);

        List<Map<String, Object>> adicionadas = new ArrayList<>();
        for (Map<String, Object> c : current) {
            if (!snapByName.containsKey(str(c.get("nome")))) {
                adicionadas.add(c);
            }
        }
        List<Map<String, Object>> removidas = new ArrayList<>();
        for (Map<String, Object> s : snapshot) {
            if (!currByName.containsKey(str(s.get("nome")))) {
                removidas.add(s);
            }
        }
        List<Map<String, Object>> alteradas = new ArrayList<>();
        for (Map<String, Object> c : current) {
            Map<String, Object> s = snapByName.get(str(c.get("nome")));
            if (s == null) {
                continue;
            }
            if (!java.util.Objects.equals(str(s.get("descricao")), str(c.get("descricao")))
                    || !java.util.Objects.equals(asLong(s.get("peso")), asLong(c.get("peso")))
                    || !java.util.Objects.equals(str(s.get("aplicabilidade")), str(c.get("aplicabilidade")))
                    || !java.util.Objects.equals(asLong(s.get("quantidade_pessoas")), asLong(c.get("quantidade_pessoas")))) {
                alteradas.add(c);
            }
        }

        boolean temMudanca = !adicionadas.isEmpty() || !removidas.isEmpty() || !alteradas.isEmpty();
        if (!temMudanca) {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("versao", form.get("tecnicas_versao") != null ? ((Number) form.get("tecnicas_versao")).intValue() : 1);
            out.put("tiposMudancas", null);
            out.put("formulariosAfetados", 0);
            return out;
        }

        int novaVersao = (form.get("tecnicas_versao") != null ? ((Number) form.get("tecnicas_versao")).intValue() : 1) + 1;

        List<Map<String, Object>> novoSnapshot = new ArrayList<>();
        for (Map<String, Object> c : current) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", c.get("id"));
            m.put("nome", c.get("nome"));
            m.put("descricao", c.get("descricao"));
            m.put("peso", c.get("peso"));
            m.put("aplicabilidade", c.get("aplicabilidade"));
            m.put("quantidade_pessoas", c.get("quantidade_pessoas"));
            m.put("ordem", c.get("ordem"));
            novoSnapshot.add(m);
        }

        jdbc.update(
                "UPDATE competencias_gestor_formularios " +
                        "SET tecnicas_snapshot_publicado = ?::jsonb, " +
                        "    tecnicas_versao = ?, " +
                        "    tecnicas_publicado_em = NOW(), " +
                        "    tecnicas_publicado_por = ?, " +
                        "    tecnicas_propagacao_pendente = TRUE, " +
                        "    status = 'enviado', " +
                        "    validado_por_autor_id = NULL, " +
                        "    validado_por_autor_em = NULL, " +
                        "    validado_por_diretoria_id = NULL, " +
                        "    validado_por_diretoria_em = NULL, " +
                        "    recusado_por_id = NULL, " +
                        "    recusado_por_nome = NULL, " +
                        "    recusado_em = NULL, " +
                        "    recusado_comentario = NULL, " +
                        "    recusado_camada = NULL, " +
                        "    updated_at = NOW(), " +
                        "    updated_by = ? " +
                        "WHERE id = ?",
                toJson(novoSnapshot), novaVersao, userId, userId, formularioId);

        boolean isFirstPublish = snapshot.isEmpty();
        List<Long> idsAlterados = new ArrayList<>();
        if (!isFirstPublish) {
            for (Map<String, Object> a : adicionadas) {
                Long aid = asLong(a.get("id"));
                if (aid != null) {
                    idsAlterados.add(aid);
                }
            }
            for (Map<String, Object> a : alteradas) {
                Long aid = asLong(a.get("id"));
                if (aid != null) {
                    idsAlterados.add(aid);
                }
            }
        }
        jdbc.update("UPDATE competencias_gestor_itens SET alterada = FALSE WHERE formulario_id = ?", formularioId);
        if (!idsAlterados.isEmpty()) {
            jdbc.update(
                    "UPDATE competencias_gestor_itens SET alterada = TRUE WHERE formulario_id = ? AND id = ANY(?::int[])",
                    formularioId, intArray(idsAlterados));
        }

        Map<String, Object> tiposMudancas = new LinkedHashMap<>();
        tiposMudancas.put("adicionadas", idNome(adicionadas));
        tiposMudancas.put("removidas", idNome(removidas));
        tiposMudancas.put("alteradas", idNome(alteradas));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("versao", novaVersao);
        out.put("tiposMudancas", tiposMudancas);
        out.put("formulariosAfetados", 0);
        out.put("matrizResetada", true);
        return out;
    }

    @Transactional
    public Map<String, Object> propagarParaInventario(long formularioId) {
        Map<String, Object> form = findFormularioCompleto(formularioId);
        if (form == null || !Boolean.TRUE.equals(form.get("tecnicas_propagacao_pendente"))) {
            return Map.of("formulariosAfetados", 0);
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> itens = (List<Map<String, Object>>) form.get("itens");
        Long unidadeId = asLong(form.get("unidade_id"));
        String tipo = (String) form.get("tipo");

        // Ressincronizar catálogo denormalizado (competencias_por_unidade) para tipo='equipe'
        if ("equipe".equals(tipo) && unidadeId != null) {
            jdbc.update("DELETE FROM competencias_por_unidade WHERE origem_formulario_id = ?", formularioId);
            for (Map<String, Object> item : itens) {
                jdbc.update(
                        "INSERT INTO competencias_por_unidade (unidade_id, nome, descricao, peso, aplicabilidade, quantidade_pessoas, origem_formulario_id) " +
                                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                        unidadeId, str(item.get("nome")), str(item.get("descricao")), item.get("peso"),
                        orNull(item.get("aplicabilidade")), orNull(item.get("quantidade_pessoas")), formularioId);
            }
        }

        int formulariosAfetados = 0;
        Integer novaVersao = form.get("tecnicas_versao") != null ? ((Number) form.get("tecnicas_versao")).intValue() : null;

        if (unidadeId != null) {
            // 1) Autoavaliação do colaborador é marcada primeiro.
            formulariosAfetados += jdbc.update(
                    "UPDATE autoavaliacao_formularios f " +
                            "SET status = 'atualizacao_requisitada', updated_at = NOW() " +
                            "WHERE f.is_deleted = FALSE " +
                            "  AND f.unidade_id = ? " +
                            "  AND f.status IN ('enviado', 'validado') " +
                            "  AND COALESCE(f.tecnicas_versao, 1) < ?",
                    unidadeId, novaVersao);

            // 2) Avaliação do gestor — só marca se NÃO houver autoavaliação vinculada que ainda precisa atualizar.
            formulariosAfetados += jdbc.update(
                    "UPDATE avaliacao_gestor_formularios g " +
                            "SET status = 'atualizacao_requisitada', updated_at = NOW() " +
                            "WHERE g.is_deleted = FALSE " +
                            "  AND g.unidade_id = ? " +
                            "  AND g.status IN ('enviado', 'validado') " +
                            "  AND COALESCE(g.tecnicas_versao, 1) < ? " +
                            "  AND NOT EXISTS ( " +
                            "    SELECT 1 FROM autoavaliacao_formularios a " +
                            "    WHERE a.id = g.pessoa_id " +
                            "      AND a.is_deleted = FALSE " +
                            "      AND COALESCE(a.tecnicas_versao, 1) < ? " +
                            "  )",
                    unidadeId, novaVersao, novaVersao);

            // 3) Avaliação integrada — só marca se NÃO houver avaliação_gestor vinculada que ainda precisa atualizar.
            formulariosAfetados += jdbc.update(
                    "UPDATE avaliacao_integrada_formularios i " +
                            "SET status = 'atualizacao_requisitada', updated_at = NOW() " +
                            "WHERE i.is_deleted = FALSE " +
                            "  AND i.unidade_id = ? " +
                            "  AND i.status <> 'atualizacao_requisitada' " +
                            "  AND COALESCE(i.tecnicas_versao, 1) < ? " +
                            "  AND NOT EXISTS ( " +
                            "    SELECT 1 FROM avaliacao_gestor_formularios g " +
                            "    WHERE g.id = i.avaliacao_gestor_id " +
                            "      AND g.is_deleted = FALSE " +
                            "      AND COALESCE(g.tecnicas_versao, 1) < ? " +
                            "  )",
                    unidadeId, novaVersao, novaVersao);
        }

        jdbc.update(
                "UPDATE competencias_gestor_formularios SET tecnicas_propagacao_pendente = FALSE WHERE id = ?",
                formularioId);

        return Map.of("formulariosAfetados", formulariosAfetados);
    }

    // ============================================================
    // Helpers
    // ============================================================

    private static Map<String, Map<String, Object>> byName(List<Map<String, Object>> items) {
        Map<String, Map<String, Object>> m = new LinkedHashMap<>();
        for (Map<String, Object> i : items) {
            m.put(str(i.get("nome")), i);
        }
        return m;
    }

    private static List<Map<String, Object>> idNome(List<Map<String, Object>> items) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> i : items) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", i.get("id"));
            m.put("nome", i.get("nome"));
            out.add(m);
        }
        return out;
    }

    private List<Map<String, Object>> parseJsonArray(Object value) {
        String json = jsonString(value);
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<Map<String, Object>> parsed = objectMapper.readValue(json, new TypeReference<List<Map<String, Object>>>() {
            });
            return parsed != null ? parsed : new ArrayList<>();
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private static String jsonString(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof PGobject pg) {
            return pg.getValue();
        }
        return value.toString();
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return "null";
        }
    }

    private static boolean equalsId(Object a, long b) {
        return a instanceof Number n && n.longValue() == b;
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

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    private static String intArray(List<Long> ids) {
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
