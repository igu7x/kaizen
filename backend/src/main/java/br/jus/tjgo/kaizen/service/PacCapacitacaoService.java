package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
                "SELECT * FROM pac_capacitacao " +
                        "WHERE modulo = ? AND is_deleted = FALSE " +
                        "ORDER BY codigo NULLS LAST, id",
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
