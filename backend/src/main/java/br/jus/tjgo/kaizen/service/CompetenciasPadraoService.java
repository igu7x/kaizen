package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.exception.ApiException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.postgresql.util.PGobject;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de competenciasPadrao.service.ts — catálogo base de competências padrão
 * (comportamental/estratégica/gerencial). publish() dispara o cascade sequencial
 * auto → gestor → integrada com NOT EXISTS para evitar dupla marcação.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CompetenciasPadraoService {

    private static final List<String> TIPOS = List.of("comportamental", "estrategica", "gerencial");

    private final JdbcTemplate jdbc;
    private final br.jus.tjgo.kaizen.service.notificacao.AvaliacoesNotificacoes avaliacoesNotificacoes;
    private final ObjectMapper objectMapper;

    /** Buscar todas as competências padrão ativas, agrupadas por tipo. */
    public Map<String, Object> findAllActive() {
        List<Map<String, Object>> all = jdbc.queryForList(
                "SELECT * FROM competencias_padrao WHERE ativo = TRUE ORDER BY tipo, ordem, id");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("comportamental", filterByTipo(all, "comportamental"));
        out.put("estrategica", filterByTipo(all, "estrategica"));
        out.put("gerencial", filterByTipo(all, "gerencial"));
        return out;
    }

    /** Buscar todas (incluindo inativas) — para admin. */
    public List<Map<String, Object>> findAll() {
        return jdbc.queryForList("SELECT * FROM competencias_padrao ORDER BY tipo, ordem, id");
    }

    /** Buscar versão atual. */
    public int getCurrentVersion() {
        Integer v = jdbc.queryForObject(
                "SELECT COALESCE(MAX(versao), 0) as versao FROM competencias_padrao_versoes", Integer.class);
        return v == null ? 0 : v;
    }

    /** Buscar histórico de versões. */
    public List<Map<String, Object>> getVersionHistory() {
        return jdbc.queryForList(
                "SELECT v.*, u.name as publicado_por_nome " +
                        "FROM competencias_padrao_versoes v " +
                        "LEFT JOIN users u ON u.id = v.publicado_por " +
                        "ORDER BY v.versao DESC, v.tipo");
    }

    /** Criar competência. */
    public Map<String, Object> create(String tipo, String nome, String descricao, Integer ordem, long userId) {
        Integer finalOrdem = ordem;
        if (finalOrdem == null) {
            finalOrdem = jdbc.queryForObject(
                    "SELECT COALESCE(MAX(ordem), 0) + 1 as next_ordem FROM competencias_padrao WHERE tipo = ? AND ativo = TRUE",
                    Integer.class, tipo);
        }
        Map<String, Object> created = jdbc.queryForMap(
                "INSERT INTO competencias_padrao (tipo, nome, descricao, ordem, created_by, updated_by) " +
                        "VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
                tipo, nome, descricao, finalOrdem, userId, userId);
        return created;
    }

    /** Atualizar competência. */
    public Map<String, Object> update(long id, String nome, String descricao, Integer ordem, long userId) {
        List<String> sets = new ArrayList<>();
        List<Object> values = new ArrayList<>();

        if (nome != null) {
            sets.add("nome = ?");
            values.add(nome);
        }
        if (descricao != null) {
            sets.add("descricao = ?");
            values.add(descricao);
        }
        if (ordem != null) {
            sets.add("ordem = ?");
            values.add(ordem);
        }
        sets.add("updated_by = ?");
        values.add(userId);
        sets.add("updated_at = NOW()");

        values.add(id);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "UPDATE competencias_padrao SET " + String.join(", ", sets) + " WHERE id = ? RETURNING *",
                values.toArray());

        if (rows.isEmpty()) {
            throw new ApiException(500, "Competência não encontrada");
        }
        return rows.get(0);
    }

    /** Soft-delete (desativar). */
    public void softDelete(long id, long userId) {
        jdbc.update("UPDATE competencias_padrao SET ativo = FALSE, updated_by = ?, updated_at = NOW() WHERE id = ?",
                userId, id);
    }

    /** Reativar competência. */
    public void reactivate(long id, long userId) {
        jdbc.update("UPDATE competencias_padrao SET ativo = TRUE, updated_by = ?, updated_at = NOW() WHERE id = ?",
                userId, id);
    }

    /**
     * Publicar alterações: cria nova versão, computa diff, e marca formulários afetados.
     * Cascade sequencial colaborador → gestor → integrada com NOT EXISTS.
     */
    public Map<String, Object> publish(long userId) {
        int currentVersion = getCurrentVersion();
        int newVersion = currentVersion + 1;

        List<Map<String, Object>> active = jdbc.queryForList(
                "SELECT id, tipo, nome, descricao, ordem FROM competencias_padrao WHERE ativo = TRUE ORDER BY tipo, ordem");

        // Snapshot da versão anterior por tipo
        List<Map<String, Object>> prevSnapRows = jdbc.queryForList(
                "SELECT tipo, snapshot FROM competencias_padrao_versoes WHERE versao = ?", currentVersion);
        Map<String, List<Map<String, Object>>> prevSnapMap = new LinkedHashMap<>();
        for (Map<String, Object> row : prevSnapRows) {
            prevSnapMap.put((String) row.get("tipo"), parseJsonArray(row.get("snapshot")));
        }

        // Agrupar ativas por tipo
        Map<String, List<Map<String, Object>>> activeByTipo = new LinkedHashMap<>();
        for (Map<String, Object> c : active) {
            String tipo = (String) c.get("tipo");
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", c.get("id"));
            item.put("nome", c.get("nome"));
            item.put("descricao", c.get("descricao"));
            item.put("ordem", c.get("ordem"));
            activeByTipo.computeIfAbsent(tipo, k -> new ArrayList<>()).add(item);
        }
        for (String tipo : TIPOS) {
            activeByTipo.computeIfAbsent(tipo, k -> new ArrayList<>());
        }

        List<String> tiposAfetados = new ArrayList<>();

        for (Map.Entry<String, List<Map<String, Object>>> entry : activeByTipo.entrySet()) {
            String tipo = entry.getKey();
            List<Map<String, Object>> currentItems = entry.getValue();
            List<Map<String, Object>> prevItems = prevSnapMap.getOrDefault(tipo, new ArrayList<>());

            java.util.Set<Long> prevIds = new java.util.HashSet<>();
            for (Map<String, Object> p : prevItems) {
                prevIds.add(asLong(p.get("id")));
            }
            java.util.Set<Long> currIds = new java.util.HashSet<>();
            for (Map<String, Object> c : currentItems) {
                currIds.add(asLong(c.get("id")));
            }
            Map<Long, Map<String, Object>> prevMap = new LinkedHashMap<>();
            for (Map<String, Object> p : prevItems) {
                prevMap.put(asLong(p.get("id")), p);
            }

            List<Map<String, Object>> adicionadas = new ArrayList<>();
            for (Map<String, Object> c : currentItems) {
                if (!prevIds.contains(asLong(c.get("id")))) {
                    adicionadas.add(c);
                }
            }
            List<Map<String, Object>> removidas = new ArrayList<>();
            for (Map<String, Object> p : prevItems) {
                if (!currIds.contains(asLong(p.get("id")))) {
                    removidas.add(p);
                }
            }
            List<Map<String, Object>> alteradas = new ArrayList<>();
            for (Map<String, Object> c : currentItems) {
                Map<String, Object> prev = prevMap.get(asLong(c.get("id")));
                if (prev == null) {
                    continue;
                }
                if (!java.util.Objects.equals(str(prev.get("nome")), str(c.get("nome")))
                        || !java.util.Objects.equals(str(prev.get("descricao")), str(c.get("descricao")))) {
                    alteradas.add(c);
                }
            }

            boolean temMudanca = !adicionadas.isEmpty() || !removidas.isEmpty() || !alteradas.isEmpty();
            if (temMudanca) {
                tiposAfetados.add(tipo);
            }

            Map<String, Object> mudancas = new LinkedHashMap<>();
            mudancas.put("adicionadas", idNome(adicionadas));
            mudancas.put("removidas", idNome(removidas));
            mudancas.put("alteradas", idNome(alteradas));

            jdbc.update(
                    "INSERT INTO competencias_padrao_versoes (versao, tipo, snapshot, mudancas, publicado_por) " +
                            "VALUES (?, ?, ?::jsonb, ?::jsonb, ?)",
                    newVersion, tipo, toJson(currentItems), toJson(mudancas), userId);
        }

        int formulariosAfetados = 0;

        if (!tiposAfetados.isEmpty()) {
            boolean afetaEquipe = tiposAfetados.contains("comportamental");
            boolean afetaGestor = tiposAfetados.stream().anyMatch(TIPOS::contains);

            List<String> tiposMatriz = new ArrayList<>();
            if (afetaEquipe) {
                tiposMatriz.add("equipe");
            }
            if (afetaGestor) {
                tiposMatriz.add("gestor");
            }

            if (!tiposMatriz.isEmpty()) {
                jdbc.update(
                        "UPDATE competencias_gestor_formularios " +
                                "SET padroes_propagacao_pendente = TRUE, " +
                                "    padroes_tipos_afetados = ?::jsonb, " +
                                "    status = 'enviado', " +
                                "    validado_por_autor_id = NULL, " +
                                "    validado_por_autor_em = NULL, " +
                                "    validado_por_diretoria_id = NULL, " +
                                "    validado_por_diretoria_em = NULL, " +
                                "    updated_at = NOW(), " +
                                "    updated_by = ? " +
                                "WHERE is_deleted = FALSE " +
                                "  AND COALESCE(tipo, 'equipe') = ANY(?::text[]) " +
                                "  AND validado_final_em IS NOT NULL",
                        toJson(tiposAfetados), userId, textArray(tiposMatriz));
            }
        }

        if (!tiposAfetados.isEmpty()) {
            String tiposArr = textArray(tiposAfetados);

            // 1) Autoavaliação do colaborador é marcada primeiro. RETURNING para notificar cada dono.
            List<Map<String, Object>> auto = jdbc.queryForList(
                    "UPDATE autoavaliacao_formularios f " +
                            "SET status = 'atualizacao_requisitada', updated_at = NOW() " +
                            "WHERE f.is_deleted = FALSE " +
                            "  AND f.status IN ('enviado', 'validado') " +
                            "  AND COALESCE(f.competencias_versao, 1) < ? " +
                            "  AND EXISTS ( " +
                            "    SELECT 1 FROM autoavaliacao_respostas r " +
                            "    WHERE r.formulario_id = f.id AND r.tipo = ANY(?::text[]) " +
                            "  ) " +
                            "RETURNING f.id, f.user_id, f.updated_at",
                    newVersion, tiposArr);

            // 2) Avaliação do gestor — só marca se NÃO houver autoavaliação vinculada que ainda precisa atualizar.
            List<Map<String, Object>> gestor = jdbc.queryForList(
                    "UPDATE avaliacao_gestor_formularios g " +
                            "SET status = 'atualizacao_requisitada', updated_at = NOW() " +
                            "WHERE g.is_deleted = FALSE " +
                            "  AND g.status IN ('enviado', 'validado') " +
                            "  AND COALESCE(g.competencias_versao, 1) < ? " +
                            "  AND EXISTS ( " +
                            "    SELECT 1 FROM avaliacao_gestor_respostas r " +
                            "    WHERE r.formulario_id = g.id AND r.tipo = ANY(?::text[]) " +
                            "  ) " +
                            "  AND NOT EXISTS ( " +
                            "    SELECT 1 FROM autoavaliacao_formularios a " +
                            "    WHERE a.id = g.pessoa_id " +
                            "      AND a.is_deleted = FALSE " +
                            "      AND COALESCE(a.competencias_versao, 1) < ? " +
                            "  ) " +
                            "RETURNING g.id, g.avaliador_user_id, g.updated_at",
                    newVersion, tiposArr, newVersion);

            // 3) Avaliação integrada — só marca se NÃO houver avaliação_gestor vinculada que ainda precisa atualizar.
            List<Map<String, Object>> integrada = jdbc.queryForList(
                    "UPDATE avaliacao_integrada_formularios i " +
                            "SET status = 'atualizacao_requisitada', updated_at = NOW() " +
                            "WHERE i.is_deleted = FALSE " +
                            "  AND i.status <> 'atualizacao_requisitada' " +
                            "  AND COALESCE(i.competencias_versao, 1) < ? " +
                            "  AND EXISTS ( " +
                            "    SELECT 1 FROM avaliacao_integrada_respostas r " +
                            "    WHERE r.formulario_id = i.id AND r.tipo = ANY(?::text[]) " +
                            "  ) " +
                            "  AND NOT EXISTS ( " +
                            "    SELECT 1 FROM avaliacao_gestor_formularios g " +
                            "    WHERE g.id = i.avaliacao_gestor_id " +
                            "      AND g.is_deleted = FALSE " +
                            "      AND COALESCE(g.competencias_versao, 1) < ? " +
                            "  ) " +
                            "RETURNING i.id, i.avaliador_user_id, i.tipo_inventario, i.updated_at",
                    newVersion, tiposArr, newVersion);

            formulariosAfetados += auto.size() + gestor.size() + integrada.size();
            auto.forEach(avaliacoesNotificacoes::atualizacaoAutoavaliacao);
            gestor.forEach(avaliacoesNotificacoes::atualizacaoAvaliacaoGestor);
            integrada.forEach(avaliacoesNotificacoes::atualizacaoIntegrada);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("versao", newVersion);
        out.put("tiposAfetados", tiposAfetados);
        out.put("formulariosAfetados", formulariosAfetados);
        return out;
    }

    /** Buscar diff desde uma versão específica até a atual. */
    public Map<String, Object> getDiffSinceVersion(int fromVersion) {
        int currentVersion = getCurrentVersion();
        if (fromVersion >= currentVersion) {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("versaoAtual", currentVersion);
            out.put("mudancas", new ArrayList<>());
            return out;
        }

        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT tipo, mudancas FROM competencias_padrao_versoes WHERE versao > ? ORDER BY versao",
                fromVersion);

        Map<String, Map<String, List<Object>>> acumulado = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> mud = parseJsonObject(row.get("mudancas"));
            if (mud == null) {
                continue;
            }
            String key = (String) row.get("tipo");
            Map<String, List<Object>> acc = acumulado.computeIfAbsent(key, k -> {
                Map<String, List<Object>> m = new LinkedHashMap<>();
                m.put("adicionadas", new ArrayList<>());
                m.put("removidas", new ArrayList<>());
                m.put("alteradas", new ArrayList<>());
                return m;
            });
            addAll(acc.get("adicionadas"), mud.get("adicionadas"));
            addAll(acc.get("removidas"), mud.get("removidas"));
            addAll(acc.get("alteradas"), mud.get("alteradas"));
        }

        List<Map<String, Object>> mudancas = new ArrayList<>();
        for (Map.Entry<String, Map<String, List<Object>>> e : acumulado.entrySet()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("tipo", e.getKey());
            m.put("adicionadas", e.getValue().get("adicionadas"));
            m.put("removidas", e.getValue().get("removidas"));
            m.put("alteradas", e.getValue().get("alteradas"));
            mudancas.add(m);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("versaoAtual", currentVersion);
        out.put("mudancas", mudancas);
        return out;
    }

    /** Verificar se há mudanças pendentes (não publicadas). */
    public boolean hasPendingChanges() {
        int currentVersion = getCurrentVersion();
        if (currentVersion == 0) {
            return false;
        }

        List<Map<String, Object>> active = jdbc.queryForList(
                "SELECT id, tipo, nome, descricao, ordem FROM competencias_padrao WHERE ativo = TRUE ORDER BY tipo, ordem");
        List<Map<String, Object>> prevSnapRows = jdbc.queryForList(
                "SELECT tipo, snapshot FROM competencias_padrao_versoes WHERE versao = ?", currentVersion);

        Map<String, List<Map<String, Object>>> prevSnapMap = new LinkedHashMap<>();
        for (Map<String, Object> row : prevSnapRows) {
            prevSnapMap.put((String) row.get("tipo"), parseJsonArray(row.get("snapshot")));
        }

        Map<String, List<Map<String, Object>>> activeByTipo = new LinkedHashMap<>();
        for (Map<String, Object> c : active) {
            String tipo = (String) c.get("tipo");
            activeByTipo.computeIfAbsent(tipo, k -> new ArrayList<>()).add(c);
        }

        for (String tipo : TIPOS) {
            List<Map<String, Object>> current = activeByTipo.getOrDefault(tipo, new ArrayList<>());
            List<Map<String, Object>> prev = prevSnapMap.getOrDefault(tipo, new ArrayList<>());
            if (current.size() != prev.size()) {
                return true;
            }
            Map<Long, Map<String, Object>> prevMap = new LinkedHashMap<>();
            for (Map<String, Object> p : prev) {
                prevMap.put(asLong(p.get("id")), p);
            }
            for (Map<String, Object> c : current) {
                Map<String, Object> p = prevMap.get(asLong(c.get("id")));
                if (p == null
                        || !java.util.Objects.equals(str(p.get("nome")), str(c.get("nome")))
                        || !java.util.Objects.equals(str(p.get("descricao")), str(c.get("descricao")))
                        || !java.util.Objects.equals(asLong(p.get("ordem")), asLong(c.get("ordem")))) {
                    return true;
                }
            }
        }

        return false;
    }

    // ============================================================
    // Helpers
    // ============================================================

    private static List<Map<String, Object>> filterByTipo(List<Map<String, Object>> all, String tipo) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> c : all) {
            if (tipo.equals(c.get("tipo"))) {
                out.add(c);
            }
        }
        return out;
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

    @SuppressWarnings("unchecked")
    private static void addAll(List<Object> target, Object src) {
        if (src instanceof List<?> list) {
            target.addAll((List<Object>) list);
        }
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

    private Map<String, Object> parseJsonObject(Object value) {
        String json = jsonString(value);
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {
            });
        } catch (Exception e) {
            return null;
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

    private static Long asLong(Object v) {
        return v == null ? null : ((Number) v).longValue();
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    private static String textArray(List<String> values) {
        return "{" + String.join(",", values) + "}";
    }
}
