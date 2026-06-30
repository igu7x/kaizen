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
                    "SELECT id, name as colaborador, '' as unidade_lotacao, situacao_funcional, nome_cc_fc, classe_cc_fc, " +
                    "cargo_efetivo, classe_efetivo, diretoria, created_at, updated_at " +
                    "FROM users WHERE is_deleted = FALSE AND diretoria = ? ORDER BY " + safeOrder,
                    diretoria);
        } else if (domainDiretorias != null && !domainDiretorias.isEmpty()) {
            rows = jdbc.queryForList(
                    "SELECT id, name as colaborador, '' as unidade_lotacao, situacao_funcional, nome_cc_fc, classe_cc_fc, " +
                    "cargo_efetivo, classe_efetivo, diretoria, created_at, updated_at " +
                    "FROM users WHERE is_deleted = FALSE AND diretoria = ANY(?::text[]) ORDER BY " + safeOrder,
                    diretoriasArray(domainDiretorias));
        } else {
            rows = jdbc.queryForList(
                    "SELECT id, name as colaborador, '' as unidade_lotacao, situacao_funcional, nome_cc_fc, classe_cc_fc, " +
                    "cargo_efetivo, classe_efetivo, diretoria, created_at, updated_at " +
                    "FROM users WHERE is_deleted = FALSE ORDER BY " + safeOrder);
        }
        List<Map<String, Object>> out = new ArrayList<>(rows.size());
        for (Map<String, Object> r : rows) {
            out.add(toResponseDto(r));
        }
        return out;
    }

    public Map<String, Object> findColaboradorById(long id) {
        var rows = jdbc.queryForList(
                "SELECT id, name as colaborador, '' as unidade_lotacao, situacao_funcional, nome_cc_fc, classe_cc_fc, " +
                "cargo_efetivo, classe_efetivo, diretoria, created_at, updated_at " +
                "FROM users WHERE id = ? AND is_deleted = FALSE", id);
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
        String emailFake = "colaborador_" + System.currentTimeMillis() + "@tjgo.jus.br";
        Map<String, Object> created = jdbc.queryForMap(
                "INSERT INTO users (name, situacao_funcional, " +
                        "nome_cc_fc, classe_cc_fc, cargo_efetivo, classe_efetivo, diretoria, email, password_hash, role, status) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, md5(random()::text), 'VIEWER', 'INACTIVE') RETURNING id, name as colaborador, '' as unidade_lotacao, situacao_funcional, nome_cc_fc, classe_cc_fc, cargo_efetivo, classe_efetivo, diretoria, created_at, updated_at",
                str(data.get("colaborador")), situacao,
                orNull(data.get("nome_cc_fc")), orNull(data.get("classe_cc_fc")),
                orNull(data.get("cargo_efetivo")), orNull(data.get("classe_efetivo")), diretoria, emailFake);
        return toResponseDto(created);
    }

    public Map<String, Object> updateColaborador(long id, Map<String, Object> data, Long userId) {
        var existingRows = jdbc.queryForList(
                "SELECT id, name as colaborador FROM users WHERE id = ? AND is_deleted = FALSE", id);
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
        if (data.containsKey("colaborador")) {
            updates.add("name = ?");
            values.add(data.get("colaborador"));
        }
        // addCol(data, "unidade_lotacao", updates, values, false); // Ignorado
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
                "UPDATE users SET " + String.join(", ", updates) +
                        " WHERE id = ? AND is_deleted = FALSE RETURNING id, name as colaborador, '' as unidade_lotacao, situacao_funcional, nome_cc_fc, classe_cc_fc, cargo_efetivo, classe_efetivo, diretoria, created_at, updated_at",
                values.toArray());
        return rows.isEmpty() ? null : toResponseDto(rows.get(0));
    }

    public boolean deleteColaborador(long id, Long userId) {
        return jdbc.update(
                "UPDATE users SET is_deleted = TRUE, status = 'INACTIVE' " +
                        "WHERE id = ? AND is_deleted = FALSE",
                id) > 0;
    }

    public List<String> getUnidadesLotacao() {
        return jdbc.queryForList(
                "SELECT cu.nome as unidade_lotacao FROM cadastros_unidades cu WHERE cu.status = 'ACTIVE' ORDER BY cu.nome",
                String.class);
    }

    // ---------- estatísticas (view pessoas_estatisticas) ----------

    private static final String STATS_AGG =
            "SELECT COUNT(u.id)::INTEGER AS total_colaboradores, " +
                    "COUNT(CASE WHEN u.situacao_funcional = 'ESTATUTÁRIO' THEN 1 END)::INTEGER AS total_estatutarios, " +
                    "COUNT(CASE WHEN u.situacao_funcional = 'CEDIDO' THEN 1 END)::INTEGER AS total_cedidos, " +
                    "COUNT(CASE WHEN u.situacao_funcional = 'NOMEADO EM COMISSÃO - INSS' THEN 1 END)::INTEGER AS total_comissionados, " +
                    "COUNT(CASE WHEN u.situacao_funcional = 'TERCEIRIZADO' THEN 1 END)::INTEGER AS total_terceirizados, " +
                    "COUNT(CASE WHEN u.situacao_funcional = 'RESIDENTE' THEN 1 END)::INTEGER AS total_residentes, " +
                    "COUNT(CASE WHEN u.situacao_funcional = 'ESTAGIÁRIO' THEN 1 END)::INTEGER AS total_estagiarios, " +
                    "ROUND((COUNT(CASE WHEN u.situacao_funcional = 'ESTATUTÁRIO' THEN 1 END)::DECIMAL / NULLIF(COUNT(u.id), 0)) * 100, 0) AS percentual_estatutarios, " +
                    "ROUND((COUNT(CASE WHEN u.situacao_funcional = 'CEDIDO' THEN 1 END)::DECIMAL / NULLIF(COUNT(u.id), 0)) * 100, 0) AS percentual_cedidos, " +
                    "ROUND((COUNT(CASE WHEN u.situacao_funcional = 'NOMEADO EM COMISSÃO - INSS' THEN 1 END)::DECIMAL / NULLIF(COUNT(u.id), 0)) * 100, 0) AS percentual_comissionados, " +
                    "ROUND((COUNT(CASE WHEN u.situacao_funcional = 'TERCEIRIZADO' THEN 1 END)::DECIMAL / NULLIF(COUNT(u.id), 0)) * 100, 0) AS percentual_terceirizados, " +
                    "ROUND((COUNT(CASE WHEN u.situacao_funcional = 'RESIDENTE' THEN 1 END)::DECIMAL / NULLIF(COUNT(u.id), 0)) * 100, 0) AS percentual_residentes, " +
                    "ROUND((COUNT(CASE WHEN u.situacao_funcional = 'ESTAGIÁRIO' THEN 1 END)::DECIMAL / NULLIF(COUNT(u.id), 0)) * 100, 0) AS percentual_estagiarios " +
                    "FROM cadastros_pessoas cp JOIN users u ON cp.user_id = u.id " +
                    "JOIN cadastros_areas a ON cp.area_id = a.id " +
                    "WHERE cp.ativo = TRUE AND u.is_deleted = FALSE";

    public Map<String, Object> getEstatisticas(String diretoria, List<String> domainDiretorias) {
        List<Map<String, Object>> rows;
        if (diretoria != null && !diretoria.isBlank()) {
            rows = jdbc.queryForList(STATS_AGG + " AND a.sigla = ?", diretoria);
        } else if (domainDiretorias != null && !domainDiretorias.isEmpty()) {
            rows = jdbc.queryForList(STATS_AGG + " AND a.sigla = ANY(?::text[])", diretoriasArray(domainDiretorias));
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
        String cte = "WITH RECURSIVE hierarquia AS ( " +
                "SELECT o.id, o.nome_area, " + (has ? "o.nome_exibicao," : "NULL as nome_exibicao,") +
                " o.gestor_user_id, COALESCE(u.name, o.nome_gestor) as nome_gestor, o.nome_cargo, " +
                "COALESCE(u.foto_perfil, o.foto_gestor) as foto_gestor, o.linha_organograma, o.subordinacao_id, " +
                "o.cor_barra, o.diretoria, o.ordem_exibicao, ARRAY[o.id] as caminho, o.nome_area::text as caminho_texto, 1 as profundidade " +
                "FROM pessoas_organograma_gestores o " +
                "LEFT JOIN users u ON o.gestor_user_id = u.id " +
                "WHERE o.subordinacao_id IS NULL AND o.ativo = TRUE " +
                "UNION ALL " +
                "SELECT o.id, o.nome_area, " + (has ? "o.nome_exibicao," : "NULL as nome_exibicao,") +
                " o.gestor_user_id, COALESCE(u.name, o.nome_gestor) as nome_gestor, o.nome_cargo, " +
                "COALESCE(u.foto_perfil, o.foto_gestor) as foto_gestor, o.linha_organograma, o.subordinacao_id, " +
                "o.cor_barra, o.diretoria, o.ordem_exibicao, h.caminho || o.id, h.caminho_texto || ' > ' || o.nome_area::text, h.profundidade + 1 " +
                "FROM pessoas_organograma_gestores o " +
                "LEFT JOIN users u ON o.gestor_user_id = u.id " +
                "INNER JOIN hierarquia h ON o.subordinacao_id = h.id " +
                "WHERE o.ativo = TRUE) ";
        String sql = cte + "SELECT * FROM hierarquia";
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
                "SELECT o.id, o.nome_area, o.gestor_user_id, COALESCE(u.name, o.nome_gestor) as nome_gestor, o.nome_cargo, " +
                        "COALESCE(u.foto_perfil, o.foto_gestor) as foto_gestor, o.linha_organograma, o.subordinacao_id, " +
                        "o.cor_barra, o.ordem_exibicao FROM pessoas_organograma_gestores o " +
                        "LEFT JOIN users u ON o.gestor_user_id = u.id " +
                        "WHERE o.subordinacao_id = ? AND o.ativo = TRUE ORDER BY o.ordem_exibicao",
                gestorId);
    }

    public List<Map<String, Object>> getGestoresPorLinha(int linha, String diretoria, List<String> domainDiretorias) {
        String sql = "SELECT o.id, o.nome_area, COALESCE(u.name, o.nome_gestor) as nome_gestor, o.nome_cargo, " +
                "COALESCE(u.foto_perfil, o.foto_gestor) as foto_gestor, o.linha_organograma, o.subordinacao_id, " +
                "o.cor_barra, o.ordem_exibicao FROM pessoas_organograma_gestores o " +
                "LEFT JOIN users u ON o.gestor_user_id = u.id " +
                "WHERE o.linha_organograma = ? AND o.ativo = TRUE";
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
        String sql = "SELECT o.id, o.nome_area, COALESCE(u.name, o.nome_gestor) as nome_gestor, o.nome_cargo, o.diretoria, o.linha_organograma " +
                "FROM pessoas_organograma_gestores o " +
                "LEFT JOIN users u ON o.gestor_user_id = u.id " +
                "WHERE o.linha_organograma < ? AND o.ativo = TRUE";
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
                "SELECT o.id, o.nome_area, " + (has ? "o.nome_exibicao," : "NULL as nome_exibicao,") +
                        " o.gestor_user_id, COALESCE(u.name, o.nome_gestor) as nome_gestor, o.nome_cargo, " +
                        "COALESCE(u.foto_perfil, o.foto_gestor) as foto_gestor, o.linha_organograma, o.subordinacao_id, o.cor_barra, " +
                        "o.diretoria, o.ordem_exibicao FROM pessoas_organograma_gestores o " +
                        "LEFT JOIN users u ON o.gestor_user_id = u.id " +
                        "WHERE o.id = ? AND o.ativo = TRUE",
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
                    "INSERT INTO pessoas_organograma_gestores (nome_area, nome_exibicao, gestor_user_id, nome_cargo, " +
                            "foto_gestor, linha_organograma, subordinacao_id, cor_barra, diretoria, ordem_exibicao, " +
                            "created_by, updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *",
                    orNull(data.get("nome_area")), orNull(data.get("nome_exibicao")), data.get("gestor_user_id"),
                    orNull(data.get("nome_cargo")), orNull(data.get("foto_gestor")), linha,
                    orNull(subordinacaoId), orNull(data.get("cor_barra")), diretoriaFinal,
                    orNull(data.get("ordem_exibicao")), userId, userId);
        }
        return jdbc.queryForMap(
                "INSERT INTO pessoas_organograma_gestores (nome_area, gestor_user_id, nome_cargo, foto_gestor, " +
                        "linha_organograma, subordinacao_id, cor_barra, diretoria, ordem_exibicao, created_by, updated_by) " +
                        "VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING *",
                orNull(data.get("nome_area")), data.get("gestor_user_id"), orNull(data.get("nome_cargo")),
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
                            "gestor_user_id = COALESCE(?, gestor_user_id), nome_cargo = COALESCE(?, nome_cargo), foto_gestor = ?, " +
                            "linha_organograma = COALESCE(?, linha_organograma), subordinacao_id = COALESCE(?, subordinacao_id), " +
                            "cor_barra = COALESCE(?, cor_barra), diretoria = COALESCE(?, diretoria), " +
                            "ordem_exibicao = COALESCE(?, ordem_exibicao), updated_at = NOW(), updated_by = ? " +
                            "WHERE id = ? AND ativo = TRUE RETURNING *",
                    orNull(data.get("nome_area")), orNull(data.get("nome_exibicao")), data.get("gestor_user_id"),
                    orNull(data.get("nome_cargo")), fotoFinal, linha, data.get("subordinacao_id"),
                    data.get("cor_barra"), data.get("diretoria"), data.get("ordem_exibicao"), userId, id);
        } else {
            rows = jdbc.queryForList(
                    "UPDATE pessoas_organograma_gestores SET nome_area = COALESCE(?, nome_area), " +
                            "gestor_user_id = COALESCE(?, gestor_user_id), nome_cargo = COALESCE(?, nome_cargo), foto_gestor = ?, " +
                            "linha_organograma = COALESCE(?, linha_organograma), subordinacao_id = COALESCE(?, subordinacao_id), " +
                            "cor_barra = COALESCE(?, cor_barra), diretoria = COALESCE(?, diretoria), " +
                            "ordem_exibicao = COALESCE(?, ordem_exibicao), updated_at = NOW(), updated_by = ? " +
                            "WHERE id = ? AND ativo = TRUE RETURNING *",
                    orNull(data.get("nome_area")), data.get("gestor_user_id"), orNull(data.get("nome_cargo")),
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

    private void addCol(Map<String, Object> data, String jsonKey, List<String> updates, List<Object> values, boolean blankToNull) {
        if (data.containsKey(jsonKey)) {
            updates.add(jsonKey + " = ?");
            values.add(blankToNull ? orNull(data.get(jsonKey)) : data.get(jsonKey));
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
