package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Trilha de auditoria GLOBAL — leitura de {@code audit_log} sem restrição de módulo (todo o Kaizen).
 * O registro é feito pelos services de escrita via {@link AuditService}; aqui só consultamos, com o
 * ator resolvido a partir de {@code users}. Acesso restrito a superadmin (ver AuditoriaController).
 */
@Service
@RequiredArgsConstructor
public class AuditoriaService {

    private final JdbcTemplate jdbc;

    private static final int LIMITE_PADRAO = 300;
    private static final int LIMITE_MAX = 1000;

    /** Ações e tabelas distintas já registradas — alimenta os filtros da tela. */
    public Map<String, Object> facetas() {
        List<String> acoes = jdbc.queryForList(
                "SELECT DISTINCT action FROM audit_log ORDER BY action", String.class);
        List<String> tabelas = jdbc.queryForList(
                "SELECT DISTINCT table_name FROM audit_log ORDER BY table_name", String.class);
        return Map.of("acoes", acoes, "tabelas", tabelas);
    }

    public List<Map<String, Object>> listar(String acao, String tabela, String busca, Integer limite) {
        StringBuilder sql = new StringBuilder(
                "SELECT a.id, a.created_at, a.action, a.table_name, a.record_id, a.user_id, " +
                "  u.name AS user_name, u.email AS user_email, a.changed_fields::text AS changed_fields " +
                "FROM audit_log a " +
                "LEFT JOIN users u ON u.id = a.user_id " +
                "WHERE 1 = 1 ");
        List<Object> args = new ArrayList<>();
        if (acao != null && !acao.isBlank()) {
            sql.append("AND a.action = ? ");
            args.add(acao.trim());
        }
        if (tabela != null && !tabela.isBlank()) {
            sql.append("AND a.table_name = ? ");
            args.add(tabela.trim());
        }
        if (busca != null && !busca.isBlank()) {
            sql.append("AND (a.action ILIKE ? OR a.table_name ILIKE ? OR u.name ILIKE ? OR u.email ILIKE ?) ");
            String like = "%" + busca.trim() + "%";
            args.add(like);
            args.add(like);
            args.add(like);
            args.add(like);
        }
        int lim = (limite == null || limite <= 0) ? LIMITE_PADRAO : Math.min(limite, LIMITE_MAX);
        sql.append("ORDER BY a.created_at DESC, a.id DESC LIMIT ").append(lim);
        return jdbc.queryForList(sql.toString(), args.toArray());
    }
}
