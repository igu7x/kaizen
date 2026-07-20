package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * CRUD dos POPs (Procedimento Operacional Padrão) criados no Kaizen (tabela pops_criados).
 * Todos os campos são texto (listas com um item por linha). Soft-delete via is_deleted.
 */
@Service
@RequiredArgsConstructor
public class PopsCriadosService {

    private final JdbcTemplate jdbc;

    private static final List<String> CAMPOS = List.of(
            "codigo", "nome_processo", "macroprocesso", "diretoria_orgao", "unidade_orgao",
            "area", "data_versao", "revisao", "servico", "objetivo", "unidade_responsavel",
            "siglas", "normativa", "descricao_procedimento", "gestor_processo",
            "sistemas_utilizados", "anexos", "fluxograma_nome", "fluxograma_data",
            "proposto_por", "analisado_por", "aprovado_por");

    private static final List<String> CAMPOS_LISTA = CAMPOS.stream()
            .filter(c -> !c.equals("fluxograma_data"))
            .toList();

    /**
     * A listagem omite fluxograma_data (imagem em base64, potencialmente grande): a tabela só
     * precisa saber se há anexo, pelo nome. O conteúdo vem no getById, usado para gerar o PDF.
     */
    public List<Map<String, Object>> list() {
        return jdbc.queryForList(
                "SELECT id, " + String.join(", ", CAMPOS_LISTA) + ", created_at, updated_at " +
                        "FROM pops_criados WHERE is_deleted = FALSE ORDER BY created_at DESC, id DESC");
    }

    public Map<String, Object> getById(long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT * FROM pops_criados WHERE id = ? AND is_deleted = FALSE", id);
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
                "INSERT INTO pops_criados (" + cols + ") VALUES (" + ph + ") RETURNING id",
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
        jdbc.update("UPDATE pops_criados SET " + set + " WHERE id = ? AND is_deleted = FALSE",
                params.toArray());
        return getById(id);
    }

    @Transactional
    public boolean delete(long id) {
        int n = jdbc.update(
                "UPDATE pops_criados SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP " +
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
