package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de colaboradores.service.ts (estende BaseService('pessoas_colaboradores')).
 * Inclui CRUD de colaboradores, estatísticas (view pessoas_estatisticas) e organograma
 * (pessoas_organograma_gestores / view pessoas_organograma_hierarquia).
 */
@Service
@RequiredArgsConstructor
public class ColaboradoresService {

    private final JdbcTemplate jdbc;
    private final DomainService domainService;

    public static final List<String> SITUACOES_FUNCIONAIS = List.of(
            "ESTATUTÁRIO", "NOMEADO EM COMISSÃO - INSS", "CEDIDO", "TERCEIRIZADO", "RESIDENTE", "ESTAGIÁRIO");

    // ---------- toResponseDto ----------

    private Map<String, Object> toResponseDto(Map<String, Object> e) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", e.get("id"));
        dto.put("colaborador", e.get("colaborador"));
        dto.put("unidade_lotacao", e.get("unidade_lotacao"));
        dto.put("situacao_funcional", e.get("situacao_funcional"));
        dto.put("nome_cc_fc", e.get("nome_cc_fc"));
        dto.put("classe_cc_fc", e.get("classe_cc_fc"));
        dto.put("cargo_efetivo", e.get("cargo_efetivo"));
        dto.put("classe_efetivo", e.get("classe_efetivo"));
        dto.put("diretoria", e.get("diretoria"));
        dto.put("created_at", e.get("created_at"));
        dto.put("updated_at", e.get("updated_at"));
        return dto;
    }

    // ---------- colaboradores CRUD ----------

    public List<Map<String, Object>> findAllColaboradores(String diretoria, String orderBy, List<String> domainDiretorias) {
        String safeOrder = "colaborador".equals(orderBy) ? "colaborador" : "colaborador";
        List<Map<String, Object>> rows;
        if (diretoria != null && !diretoria.isBlank()) {
            rows = jdbc.queryForList(
                    "SELECT * FROM pessoas_colaboradores WHERE is_deleted = FALSE AND diretoria = ? ORDER BY " + safeOrder,
                    diretoria);
        } else if (domainDiretorias != null && !domainDiretorias.isEmpty()) {
            rows = jdbc.queryForList(
                    "SELECT * FROM pessoas_colaboradores WHERE is_deleted = FALSE AND diretoria = ANY(?::text[]) ORDER BY " + safeOrder,
                    diretoriasArray(domainDiretorias));
        } else {
            rows = jdbc.queryForList(
                    "SELECT * FROM pessoas_colaboradores WHERE is_deleted = FALSE ORDER BY " + safeOrder);
        }
        List<Map<String, Object>> out = new ArrayList<>(rows.size());
        for (Map<String, Object> r : rows) {
            out.add(toResponseDto(r));
        }
        return out;
    }

    public Map<String, Object> findColaboradorById(long id) {
        var rows = jdbc.queryForList("SELECT * FROM pessoas_colaboradores WHERE id = ? AND is_deleted = FALSE", id);
        return rows.isEmpty() ? null : toResponseDto(rows.get(0));
    }

    public Map<String, Object> createColaborador(Map<String, Object> data, Long userId) {
        String situacao = str(data.get("situacao_funcional"));
        if (!SITUACOES_FUNCIONAIS.contains(situacao)) {
            throw new ApiException(-1, "SITUACAO_FUNCIONAL_INVALIDA");
        }
        String diretoria = str(data.get("diretoria"));
        if (!domainService.isValidDiretoria(diretoria)) {
            throw new ApiException(-1, "DIRETORIA_INVALIDA");
        }
        Map<String, Object> created = jdbc.queryForMap(
                "INSERT INTO pessoas_colaboradores (colaborador, unidade_lotacao, situacao_funcional, " +
                        "nome_cc_fc, classe_cc_fc, cargo_efetivo, classe_efetivo, diretoria) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
                str(data.get("colaborador")), str(data.get("unidade_lotacao")), situacao,
                orNull(data.get("nome_cc_fc")), orNull(data.get("classe_cc_fc")),
                orNull(data.get("cargo_efetivo")), orNull(data.get("classe_efetivo")), diretoria);
        return toResponseDto(created);
    }

    public Map<String, Object> updateColaborador(long id, Map<String, Object> data, Long userId) {
        var existingRows = jdbc.queryForList("SELECT * FROM pessoas_colaboradores WHERE id = ? AND is_deleted = FALSE", id);
        if (existingRows.isEmpty()) {
            return null;
        }
        if (data.get("situacao_funcional") != null && !SITUACOES_FUNCIONAIS.contains(str(data.get("situacao_funcional")))) {
            throw new ApiException(-1, "SITUACAO_FUNCIONAL_INVALIDA");
        }
        if (data.get("diretoria") != null && !domainService.isValidDiretoria(str(data.get("diretoria")))) {
            throw new ApiException(-1, "DIRETORIA_INVALIDA");
        }
        List<String> updates = new ArrayList<>();
        List<Object> values = new ArrayList<>();
        addCol(data, "colaborador", updates, values, false);
        addCol(data, "unidade_lotacao", updates, values, false);
        addCol(data, "situacao_funcional", updates, values, false);
        addCol(data, "nome_cc_fc", updates, values, true);
        addCol(data, "classe_cc_fc", updates, values, true);
        addCol(data, "cargo_efetivo", updates, values, true);
        addCol(data, "classe_efetivo", updates, values, true);
        addCol(data, "diretoria", updates, values, false);
        if (updates.isEmpty()) {
            return toResponseDto(existingRows.get(0));
        }
        updates.add("updated_at = NOW()");
        values.add(id);
        var rows = jdbc.queryForList(
                "UPDATE pessoas_colaboradores SET " + String.join(", ", updates) +
                        " WHERE id = ? AND is_deleted = FALSE RETURNING *",
                values.toArray());
        return rows.isEmpty() ? null : toResponseDto(rows.get(0));
    }

    public boolean deleteColaborador(long id, Long userId) {
        return jdbc.update(
                "UPDATE pessoas_colaboradores SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE",
                userId, id) > 0;
    }

    public List<String> getUnidadesLotacao() {
        return jdbc.queryForList(
                "SELECT DISTINCT unidade_lotacao FROM pessoas_colaboradores WHERE is_deleted = FALSE ORDER BY unidade_lotacao",
                String.class);
    }

    // ---------- estatísticas (view pessoas_estatisticas) ----------

    private static final String STATS_AGG =
            "SELECT SUM(total_colaboradores)::INTEGER AS total_colaboradores, " +
                    "SUM(total_estatutarios)::INTEGER AS total_estatutarios, " +
                    "SUM(total_cedidos)::INTEGER AS total_cedidos, " +
                    "SUM(total_comissionados)::INTEGER AS total_comissionados, " +
                    "SUM(total_terceirizados)::INTEGER AS total_terceirizados, " +
                    "SUM(total_residentes)::INTEGER AS total_residentes, " +
                    "SUM(total_estagiarios)::INTEGER AS total_estagiarios, " +
                    "ROUND((SUM(total_estatutarios)::DECIMAL / NULLIF(SUM(total_colaboradores), 0)) * 100, 0) AS percentual_estatutarios, " +
                    "ROUND((SUM(total_cedidos)::DECIMAL / NULLIF(SUM(total_colaboradores), 0)) * 100, 0) AS percentual_cedidos, " +
                    "ROUND((SUM(total_comissionados)::DECIMAL / NULLIF(SUM(total_colaboradores), 0)) * 100, 0) AS percentual_comissionados, " +
                    "ROUND((SUM(total_terceirizados)::DECIMAL / NULLIF(SUM(total_colaboradores), 0)) * 100, 0) AS percentual_terceirizados, " +
                    "ROUND((SUM(total_residentes)::DECIMAL / NULLIF(SUM(total_colaboradores), 0)) * 100, 0) AS percentual_residentes, " +
                    "ROUND((SUM(total_estagiarios)::DECIMAL / NULLIF(SUM(total_colaboradores), 0)) * 100, 0) AS percentual_estagiarios " +
                    "FROM pessoas_estatisticas";

    public Map<String, Object> getEstatisticas(String diretoria, List<String> domainDiretorias) {
        List<Map<String, Object>> rows;
        if (diretoria != null && !diretoria.isBlank()) {
            rows = jdbc.queryForList("SELECT * FROM pessoas_estatisticas WHERE diretoria = ?", diretoria);
        } else if (domainDiretorias != null && !domainDiretorias.isEmpty()) {
            rows = jdbc.queryForList(STATS_AGG + " WHERE diretoria = ANY(?::text[])", diretoriasArray(domainDiretorias));
        } else {
            rows = jdbc.queryForList(STATS_AGG);
        }
        String[] keys = {"total_colaboradores", "total_estatutarios", "total_cedidos", "total_comissionados",
                "total_terceirizados", "total_residentes", "total_estagiarios", "percentual_estatutarios",
                "percentual_cedidos", "percentual_comissionados", "percentual_terceirizados",
                "percentual_residentes", "percentual_estagiarios"};
        Map<String, Object> out = new LinkedHashMap<>();
        Map<String, Object> row = rows.isEmpty() ? Map.of() : rows.get(0);
        for (String k : keys) {
            out.put(k, toInt(row.get(k)));
        }
        return out;
    }

    // ---------- organograma ----------

    /** Espelha hasNomeExibicaoColumn(): exige a coluna na TABELA base E na VIEW. */
    private boolean hasNomeExibicaoColumn() {
        try {
            boolean inTable = !jdbc.queryForList(
                    "SELECT column_name FROM information_schema.columns " +
                            "WHERE table_name = 'pessoas_organograma_gestores' AND column_name = 'nome_exibicao'").isEmpty();
            boolean inView = !jdbc.queryForList(
                    "SELECT column_name FROM information_schema.columns " +
                            "WHERE table_name = 'pessoas_organograma_hierarquia' AND column_name = 'nome_exibicao'").isEmpty();
            return inTable && inView;
        } catch (Exception e) {
            return false;
        }
    }

    public List<Map<String, Object>> getOrganograma(String diretoria, List<String> domainDiretorias) {
        boolean has = hasNomeExibicaoColumn();
        String sql = "SELECT id, nome_area, " + (has ? "nome_exibicao," : "NULL as nome_exibicao,") +
                " nome_gestor, nome_cargo, foto_gestor, linha_organograma, subordinacao_id, cor_barra, diretoria, " +
                "ordem_exibicao, caminho, caminho_texto, profundidade FROM pessoas_organograma_hierarquia";
        if (diretoria != null && !diretoria.isBlank() && !"Todas".equals(diretoria)) {
            return jdbc.queryForList(sql + " WHERE diretoria = ? ORDER BY caminho, ordem_exibicao", diretoria);
        } else if (domainDiretorias != null && !domainDiretorias.isEmpty()) {
            return jdbc.queryForList(sql + " WHERE diretoria = ANY(?::text[]) ORDER BY caminho, ordem_exibicao",
                    diretoriasArray(domainDiretorias));
        }
        return jdbc.queryForList(sql + " ORDER BY caminho, ordem_exibicao");
    }

    public List<Map<String, Object>> getSubordinados(long gestorId) {
        return jdbc.queryForList(
                "SELECT id, nome_area, nome_gestor, nome_cargo, foto_gestor, linha_organograma, subordinacao_id, " +
                        "cor_barra, ordem_exibicao FROM pessoas_organograma_gestores " +
                        "WHERE subordinacao_id = ? AND ativo = TRUE ORDER BY ordem_exibicao",
                gestorId);
    }

    public List<Map<String, Object>> getGestoresPorLinha(int linha, String diretoria, List<String> domainDiretorias) {
        String sql = "SELECT id, nome_area, nome_gestor, nome_cargo, foto_gestor, linha_organograma, subordinacao_id, " +
                "cor_barra, ordem_exibicao FROM pessoas_organograma_gestores WHERE linha_organograma = ? AND ativo = TRUE";
        if (diretoria != null && !diretoria.isBlank() && !"Todas".equals(diretoria)) {
            return jdbc.queryForList(sql + " AND diretoria = ? ORDER BY ordem_exibicao", linha, diretoria);
        } else if (domainDiretorias != null && !domainDiretorias.isEmpty()) {
            return jdbc.queryForList(sql + " AND diretoria = ANY(?::text[]) ORDER BY ordem_exibicao",
                    linha, diretoriasArray(domainDiretorias));
        }
        return jdbc.queryForList(sql + " ORDER BY ordem_exibicao", linha);
    }

    public List<Map<String, Object>> getPossiveisPais(int linha, String diretoria, List<String> domainDiretorias) {
        if (linha <= 1) {
            return List.of();
        }
        String sql = "SELECT id, nome_area, nome_gestor, nome_cargo, diretoria, linha_organograma " +
                "FROM pessoas_organograma_gestores WHERE linha_organograma < ? AND ativo = TRUE";
        if (diretoria != null && !diretoria.isBlank() && !"Todas".equals(diretoria)) {
            return jdbc.queryForList(sql + " AND diretoria = ? ORDER BY linha_organograma, diretoria, ordem_exibicao",
                    linha, diretoria);
        } else if (domainDiretorias != null && !domainDiretorias.isEmpty()) {
            return jdbc.queryForList(sql + " AND diretoria = ANY(?::text[]) ORDER BY linha_organograma, diretoria, ordem_exibicao",
                    linha, diretoriasArray(domainDiretorias));
        }
        return jdbc.queryForList(sql + " ORDER BY linha_organograma, diretoria, ordem_exibicao", linha);
    }

    public Map<String, Object> getGestorById(long id) {
        boolean has = hasNomeExibicaoColumn();
        var rows = jdbc.queryForList(
                "SELECT id, nome_area, " + (has ? "nome_exibicao," : "NULL as nome_exibicao,") +
                        " nome_gestor, nome_cargo, foto_gestor, linha_organograma, subordinacao_id, cor_barra, " +
                        "diretoria, ordem_exibicao FROM pessoas_organograma_gestores WHERE id = ? AND ativo = TRUE",
                id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> createGestor(Map<String, Object> data, Long userId) {
        Integer linha = toInt(data.get("linha_organograma"));
        Object subordinacaoId = data.get("subordinacao_id");
        if (linha == null || linha < 1 || linha > 10) {
            throw new ApiException(-1, "LINHA_INVALIDA");
        }
        if (linha == 1 && subordinacaoId != null) {
            throw new ApiException(-1, "LINHA_1_SEM_SUBORDINACAO");
        }
        if (linha > 1 && subordinacaoId == null) {
            throw new ApiException(-1, "SUBORDINACAO_OBRIGATORIA");
        }
        Object diretoriaFinal = data.get("diretoria");
        if (linha > 1 && subordinacaoId != null && diretoriaFinal == null) {
            var parent = jdbc.queryForList(
                    "SELECT diretoria FROM pessoas_organograma_gestores WHERE id = ?", subordinacaoId);
            if (!parent.isEmpty()) {
                diretoriaFinal = parent.get(0).get("diretoria");
            }
        }
        boolean has = hasNomeExibicaoColumn();
        if (has) {
            return jdbc.queryForMap(
                    "INSERT INTO pessoas_organograma_gestores (nome_area, nome_exibicao, nome_gestor, nome_cargo, " +
                            "foto_gestor, linha_organograma, subordinacao_id, cor_barra, diretoria, ordem_exibicao, " +
                            "created_by, updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *",
                    orNull(data.get("nome_area")), orNull(data.get("nome_exibicao")), orNull(data.get("nome_gestor")),
                    orNull(data.get("nome_cargo")), orNull(data.get("foto_gestor")), linha,
                    orNull(subordinacaoId), orNull(data.get("cor_barra")), diretoriaFinal,
                    orNull(data.get("ordem_exibicao")), userId, userId);
        }
        return jdbc.queryForMap(
                "INSERT INTO pessoas_organograma_gestores (nome_area, nome_gestor, nome_cargo, foto_gestor, " +
                        "linha_organograma, subordinacao_id, cor_barra, diretoria, ordem_exibicao, created_by, updated_by) " +
                        "VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING *",
                orNull(data.get("nome_area")), orNull(data.get("nome_gestor")), orNull(data.get("nome_cargo")),
                orNull(data.get("foto_gestor")), linha, orNull(subordinacaoId), orNull(data.get("cor_barra")),
                diretoriaFinal, orNull(data.get("ordem_exibicao")), userId);
    }

    public Map<String, Object> updateGestor(long id, Map<String, Object> data, Long userId) {
        var existing = jdbc.queryForList(
                "SELECT * FROM pessoas_organograma_gestores WHERE id = ? AND ativo = TRUE", id);
        if (existing.isEmpty()) {
            return null;
        }
        Integer linha = toInt(data.get("linha_organograma"));
        if (linha != null && (linha < 1 || linha > 10)) {
            throw new ApiException(-1, "LINHA_INVALIDA");
        }
        Object fotoFinal = data.containsKey("foto_gestor") ? data.get("foto_gestor") : existing.get(0).get("foto_gestor");
        boolean has = hasNomeExibicaoColumn();
        List<Map<String, Object>> rows;
        if (has) {
            rows = jdbc.queryForList(
                    "UPDATE pessoas_organograma_gestores SET nome_area = COALESCE(?, nome_area), nome_exibicao = ?, " +
                            "nome_gestor = COALESCE(?, nome_gestor), nome_cargo = COALESCE(?, nome_cargo), foto_gestor = ?, " +
                            "linha_organograma = COALESCE(?, linha_organograma), subordinacao_id = COALESCE(?, subordinacao_id), " +
                            "cor_barra = COALESCE(?, cor_barra), diretoria = COALESCE(?, diretoria), " +
                            "ordem_exibicao = COALESCE(?, ordem_exibicao), updated_at = NOW(), updated_by = ? " +
                            "WHERE id = ? AND ativo = TRUE RETURNING *",
                    orNull(data.get("nome_area")), orNull(data.get("nome_exibicao")), orNull(data.get("nome_gestor")),
                    orNull(data.get("nome_cargo")), fotoFinal, linha, data.get("subordinacao_id"),
                    data.get("cor_barra"), data.get("diretoria"), data.get("ordem_exibicao"), userId, id);
        } else {
            rows = jdbc.queryForList(
                    "UPDATE pessoas_organograma_gestores SET nome_area = COALESCE(?, nome_area), " +
                            "nome_gestor = COALESCE(?, nome_gestor), nome_cargo = COALESCE(?, nome_cargo), foto_gestor = ?, " +
                            "linha_organograma = COALESCE(?, linha_organograma), subordinacao_id = COALESCE(?, subordinacao_id), " +
                            "cor_barra = COALESCE(?, cor_barra), diretoria = COALESCE(?, diretoria), " +
                            "ordem_exibicao = COALESCE(?, ordem_exibicao), updated_at = NOW(), updated_by = ? " +
                            "WHERE id = ? AND ativo = TRUE RETURNING *",
                    orNull(data.get("nome_area")), orNull(data.get("nome_gestor")), orNull(data.get("nome_cargo")),
                    fotoFinal, linha, data.get("subordinacao_id"), data.get("cor_barra"), data.get("diretoria"),
                    data.get("ordem_exibicao"), userId, id);
        }
        return rows.isEmpty() ? null : rows.get(0);
    }

    public boolean deleteGestor(long id, Long userId) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM pessoas_organograma_gestores WHERE subordinacao_id = ? AND ativo = TRUE",
                Integer.class, id);
        if (count != null && count > 0) {
            throw new ApiException(-1, "TEM_SUBORDINADOS");
        }
        return jdbc.update(
                "UPDATE pessoas_organograma_gestores SET ativo = FALSE, updated_at = NOW(), updated_by = ? " +
                        "WHERE id = ? AND ativo = TRUE",
                userId, id) > 0;
    }

    public void reordenarGestores(int linha, List<Map<String, Object>> novaOrdem, Long userId) {
        Object[] ids = novaOrdem.stream().map(item -> item.get("id")).toArray();
        var verificacao = jdbc.queryForList(
                "SELECT id, linha_organograma FROM pessoas_organograma_gestores WHERE id = ANY(?::int[]) AND ativo = TRUE",
                intArray(ids));
        if (verificacao.size() != ids.length) {
            throw new ApiException(-1, "IDS_INVALIDOS");
        }
        java.util.Set<Object> linhas = new java.util.HashSet<>();
        for (Map<String, Object> r : verificacao) {
            linhas.add(toInt(r.get("linha_organograma")));
        }
        if (linhas.size() > 1 || !linhas.contains(linha)) {
            throw new ApiException(-1, "LINHAS_DIFERENTES");
        }
        for (Map<String, Object> item : novaOrdem) {
            jdbc.update(
                    "UPDATE pessoas_organograma_gestores SET ordem_exibicao = ?, updated_at = NOW(), updated_by = ? " +
                            "WHERE id = ? AND ativo = TRUE",
                    item.get("ordem"), userId, item.get("id"));
        }
    }

    public List<String> getAllDiretorias() {
        return domainService.getAllDiretorias();
    }

    // ---------- helpers ----------

    private String diretoriasArray(List<String> dirs) {
        return "{" + String.join(",", dirs) + "}";
    }

    private String intArray(Object[] ids) {
        StringBuilder sb = new StringBuilder("{");
        for (int i = 0; i < ids.length; i++) {
            if (i > 0) {
                sb.append(",");
            }
            sb.append(ids[i]);
        }
        return sb.append("}").toString();
    }

    private void addCol(Map<String, Object> data, String key, List<String> updates, List<Object> values, boolean blankToNull) {
        if (data.containsKey(key)) {
            updates.add(key + " = ?");
            values.add(blankToNull ? orNull(data.get(key)) : data.get(key));
        }
    }

    private static Integer toInt(Object v) {
        if (v == null) {
            return 0;
        }
        if (v instanceof Number n) {
            return n.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(v));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static Object orNull(Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof String s) {
            return s.isEmpty() ? null : s;
        }
        return v;
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }
}
