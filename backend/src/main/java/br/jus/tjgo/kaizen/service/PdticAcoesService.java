package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * CRUD das Ações do PDTIC (tabela pdtic_acoes). Cadastro simples que alimenta a tela do PDTIC
 * no módulo Estratégia. Soft-delete via is_deleted.
 */
@Service
@RequiredArgsConstructor
public class PdticAcoesService {

    private final JdbcTemplate jdbc;

    private static final List<String> CAMPOS = List.of(
            "nome", "id_pdtic", "diretoria", "area_responsavel", "conclusao");

    public List<Map<String, Object>> list() {
        return jdbc.queryForList(
                "SELECT id, " + String.join(", ", CAMPOS) + ", created_at, updated_at " +
                        "FROM pdtic_acoes WHERE is_deleted = FALSE ORDER BY id_pdtic NULLS LAST, id");
    }

    public Map<String, Object> getById(long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT * FROM pdtic_acoes WHERE id = ? AND is_deleted = FALSE", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    @Transactional
    public Map<String, Object> create(Map<String, Object> body) {
        StringBuilder cols = new StringBuilder();
        StringBuilder ph = new StringBuilder();
        List<Object> params = new ArrayList<>();
        for (String campo : CAMPOS) {
            if (cols.length() > 0) {
                cols.append(", ");
                ph.append(", ");
            }
            cols.append(campo);
            ph.append("?");
            params.add(blankToNull(str(body.get(campo))));
        }
        Long id = jdbc.queryForObject(
                "INSERT INTO pdtic_acoes (" + cols + ") VALUES (" + ph + ") RETURNING id",
                Long.class, params.toArray());
        return getById(id);
    }

    @Transactional
    public Map<String, Object> update(long id, Map<String, Object> body) {
        StringBuilder set = new StringBuilder();
        List<Object> params = new ArrayList<>();
        for (String campo : CAMPOS) {
            if (!body.containsKey(campo)) continue;
            if (set.length() > 0) set.append(", ");
            set.append(campo).append(" = ?");
            params.add(blankToNull(str(body.get(campo))));
        }
        if (set.length() == 0) return getById(id);
        set.append(", updated_at = CURRENT_TIMESTAMP");
        params.add(id);
        jdbc.update("UPDATE pdtic_acoes SET " + set + " WHERE id = ? AND is_deleted = FALSE",
                params.toArray());
        return getById(id);
    }

    @Transactional
    public boolean delete(long id) {
        int n = jdbc.update(
                "UPDATE pdtic_acoes SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP " +
                        "WHERE id = ? AND is_deleted = FALSE", id);
        return n > 0;
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }
}
