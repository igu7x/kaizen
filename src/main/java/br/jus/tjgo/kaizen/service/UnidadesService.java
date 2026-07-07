package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Porte fiel de UnidadesService (areas.service.ts). */
@Service
@RequiredArgsConstructor
public class UnidadesService {

    private final JdbcTemplate jdbc;

    public List<Map<String, Object>> getAll(String dominio) {
        String sql = "SELECT u.*, a.nome as area_nome, a.sigla as area_sigla FROM cadastros_unidades u " +
                "LEFT JOIN cadastros_areas a ON a.id = u.area_id AND a.ativo = TRUE WHERE u.ativo = TRUE";
        if (dominio != null && !dominio.isBlank()) {
            return jdbc.queryForList(sql + " AND a.dominio = ? ORDER BY a.sigla, u.ordem, u.nome", dominio);
        }
        return jdbc.queryForList(sql + " ORDER BY a.sigla, u.ordem, u.nome");
    }

    public List<Map<String, Object>> getByAreaId(long areaId) {
        return jdbc.queryForList(
                "SELECT u.*, sup.nome as unidade_superior_nome FROM cadastros_unidades u " +
                        "LEFT JOIN cadastros_unidades sup ON sup.id = u.unidade_superior_id AND sup.ativo = TRUE " +
                        "WHERE u.area_id = ? AND u.ativo = TRUE ORDER BY u.ordem, u.nome",
                areaId);
    }

    public Map<String, Object> create(Map<String, Object> dto, Long userId) {
        Object areaId = dto.get("area_id");
        
        Object nomeVal = orNull(dto.get("nome"));
        Object siglaVal = orNull(dto.get("sigla"));
        if (siglaVal == null && nomeVal != null) {
            siglaVal = nomeVal;
        }
        if (siglaVal != null) {
            siglaVal = String.valueOf(siglaVal).trim().toUpperCase();
            if (String.valueOf(siglaVal).length() > 10) {
                siglaVal = String.valueOf(siglaVal).substring(0, 10);
            }
        }
        
        if (nomeVal != null) {
            Integer count = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM cadastros_unidades WHERE LOWER(TRIM(nome)) = LOWER(TRIM(?)) AND ativo = TRUE",
                    Integer.class, nomeVal);
            if (count != null && count > 0) {
                throw new br.jus.tjgo.kaizen.exception.ApiException(400, "Já existe uma unidade com este nome.");
            }
        }
        
        if (siglaVal != null) {
            Integer count = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM cadastros_unidades WHERE LOWER(TRIM(sigla)) = LOWER(TRIM(?)) AND ativo = TRUE",
                    Integer.class, siglaVal);
            if (count != null && count > 0) {
                throw new br.jus.tjgo.kaizen.exception.ApiException(400, "Já existe uma unidade com esta sigla.");
            }
        }
        
        Integer nextOrdem = jdbc.queryForObject(
                "SELECT COALESCE(MAX(ordem), -1) + 1 FROM cadastros_unidades WHERE area_id = ? AND ativo = TRUE",
                Integer.class, areaId);
        Map<String, Object> unidade = jdbc.queryForMap(
                "INSERT INTO cadastros_unidades (area_id, nome, sigla, descricao, responsavel, cargo_responsavel, " +
                        "unidade_superior_id, ordem, codigo_api, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
                areaId, nomeVal, siglaVal, orNull(dto.get("descricao")), orNull(dto.get("responsavel")),
                orNull(dto.get("cargo_responsavel")), orNull(dto.get("unidade_superior_id")),
                nextOrdem == null ? 0 : nextOrdem, orNull(dto.get("codigo_api")), userId, userId);

        Object responsavel = dto.get("responsavel");
        if (responsavel != null && !String.valueOf(responsavel).isBlank()) {
            try {
                jdbc.update(
                        "UPDATE cadastros_unidades SET responsavel_user_id = " +
                                "(SELECT id FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND is_deleted = FALSE LIMIT 1) WHERE id = ?",
                        responsavel, unidade.get("id"));
            } catch (Exception ignored) {
                // coluna pode não existir
            }
        }
        return unidade;
    }

    public Map<String, Object> update(long id, Map<String, Object> dto, Long userId) {
        List<String> updates = new ArrayList<>();
        List<Object> values = new ArrayList<>();
        if (dto.containsKey("nome")) {
            Object nomeVal = dto.get("nome");
            if (nomeVal != null) {
                Integer count = jdbc.queryForObject(
                        "SELECT COUNT(*) FROM cadastros_unidades WHERE LOWER(TRIM(nome)) = LOWER(TRIM(?)) AND id != ? AND ativo = TRUE",
                        Integer.class, nomeVal, id);
                if (count != null && count > 0) {
                    throw new br.jus.tjgo.kaizen.exception.ApiException(400, "Já existe uma unidade com este nome.");
                }
            }
            updates.add("nome = ?");
            values.add(nomeVal);
        }
        if (dto.containsKey("sigla")) {
            Object siglaVal = orNull(dto.get("sigla"));
            if (siglaVal == null) {
                siglaVal = orNull(dto.get("nome"));
            }
            if (siglaVal != null) {
                siglaVal = String.valueOf(siglaVal).trim().toUpperCase();
                if (String.valueOf(siglaVal).length() > 10) {
                    siglaVal = String.valueOf(siglaVal).substring(0, 10);
                }
            }
            
            if (siglaVal != null) {
                Integer count = jdbc.queryForObject(
                        "SELECT COUNT(*) FROM cadastros_unidades WHERE LOWER(TRIM(sigla)) = LOWER(TRIM(?)) AND id != ? AND ativo = TRUE",
                        Integer.class, siglaVal, id);
                if (count != null && count > 0) {
                    throw new br.jus.tjgo.kaizen.exception.ApiException(400, "Já existe uma unidade com esta sigla.");
                }
            }
            
            updates.add("sigla = ?");
            values.add(siglaVal);
        }
        if (dto.containsKey("descricao")) {
            updates.add("descricao = ?");
            values.add(orNull(dto.get("descricao")));
        }
        if (dto.containsKey("responsavel")) {
            updates.add("responsavel = ?");
            values.add(orNull(dto.get("responsavel")));
        }
        if (dto.containsKey("cargo_responsavel")) {
            updates.add("cargo_responsavel = ?");
            values.add(orNull(dto.get("cargo_responsavel")));
        }
        if (dto.containsKey("unidade_superior_id")) {
            updates.add("unidade_superior_id = ?");
            values.add(dto.get("unidade_superior_id"));
        }
        if (dto.containsKey("codigo_api")) {
            updates.add("codigo_api = ?");
            values.add(orNull(dto.get("codigo_api")));
        }
        updates.add("updated_at = CURRENT_TIMESTAMP");
        updates.add("updated_by = ?");
        values.add(userId);
        values.add(id);

        var rows = jdbc.queryForList(
                "UPDATE cadastros_unidades SET " + String.join(", ", updates) +
                        " WHERE id = ? AND ativo = TRUE RETURNING *",
                values.toArray());

        if (dto.containsKey("responsavel")) {
            try {
                Object resp = orNull(dto.get("responsavel"));
                jdbc.update(
                        "UPDATE cadastros_unidades SET responsavel_user_id = CASE " +
                                "WHEN ?::text IS NOT NULL THEN (SELECT id FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND is_deleted = FALSE LIMIT 1) " +
                                "ELSE NULL END WHERE id = ?",
                        resp, resp, id);
            } catch (Exception ignored) {
                // coluna pode não existir
            }
        }
        return rows.isEmpty() ? null : rows.get(0);
    }

    public boolean delete(long id, Long userId) {
        return jdbc.update(
                "UPDATE cadastros_unidades SET ativo = FALSE, updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND ativo = TRUE",
                userId, id) > 0;
    }

    @Transactional
    public void reorder(long areaId, List<Map<String, Object>> ordenacao, Long userId) {
        for (Map<String, Object> item : ordenacao) {
            jdbc.update(
                    "UPDATE cadastros_unidades SET ordem = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                            "WHERE id = ? AND area_id = ? AND ativo = TRUE",
                    item.get("ordem"), userId, item.get("id"), areaId);
        }
    }

    public Map<String, Object> getUsuariosDaUnidade(long unidadeId) {
        var unidadeRows = jdbc.queryForList(
                "SELECT cu.id, cu.nome, cu.descricao, cu.responsavel, cu.cargo_responsavel, cu.responsavel_user_id, " +
                        "u.id as gestor_user_id, u.name as gestor_nome, u.email as gestor_email, u.role as gestor_role " +
                        "FROM cadastros_unidades cu " +
                        "LEFT JOIN users u ON u.id = cu.responsavel_user_id AND u.is_deleted = FALSE " +
                        "WHERE cu.id = ? AND (cu.ativo IS NOT FALSE)",
                unidadeId);
        if (unidadeRows.isEmpty()) {
            return null;
        }
        Map<String, Object> u = unidadeRows.get(0);

        var colaboradores = jdbc.queryForList(
                "SELECT p.id AS pessoa_id, p.nome, p.nome_exibicao, p.cargo_efetivo, p.cc_fc, p.email, " +
                        "p.user_id, u.name as user_name, u.email as user_email, u.role as user_role " +
                        "FROM cadastros_pessoas p LEFT JOIN users u ON u.id = p.user_id AND u.is_deleted = FALSE " +
                        "WHERE p.unidade_id = ? AND COALESCE(p.ativo, TRUE) = TRUE ORDER BY p.nome",
                unidadeId);

        Map<String, Object> unidadeOut = new java.util.LinkedHashMap<>();
        unidadeOut.put("id", u.get("id"));
        unidadeOut.put("nome", u.get("nome"));
        unidadeOut.put("descricao", u.get("descricao"));

        Object gestor = null;
        if (u.get("gestor_user_id") != null) {
            Map<String, Object> g = new java.util.LinkedHashMap<>();
            g.put("user_id", u.get("gestor_user_id"));
            g.put("nome", u.get("gestor_nome") != null ? u.get("gestor_nome") : u.get("responsavel"));
            g.put("email", u.get("gestor_email"));
            g.put("role", u.get("gestor_role"));
            g.put("cargo", u.get("cargo_responsavel"));
            gestor = g;
        } else if (u.get("responsavel") != null) {
            Map<String, Object> g = new java.util.LinkedHashMap<>();
            g.put("user_id", null);
            g.put("nome", u.get("responsavel"));
            g.put("email", null);
            g.put("role", null);
            g.put("cargo", u.get("cargo_responsavel"));
            gestor = g;
        }

        List<Map<String, Object>> colabsOut = new ArrayList<>();
        for (Map<String, Object> c : colaboradores) {
            Map<String, Object> co = new java.util.LinkedHashMap<>();
            co.put("pessoa_id", c.get("pessoa_id"));
            co.put("nome", c.get("nome_exibicao") != null ? c.get("nome_exibicao") : c.get("nome"));
            co.put("cargo", c.get("cc_fc") != null ? c.get("cc_fc") : c.get("cargo_efetivo"));
            co.put("email", c.get("email") != null ? c.get("email") : c.get("user_email"));
            co.put("user_id", c.get("user_id"));
            co.put("user_role", c.get("user_role"));
            colabsOut.add(co);
        }

        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("unidade", unidadeOut);
        out.put("gestor", gestor);
        out.put("colaboradores", colabsOut);
        return out;
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
}
