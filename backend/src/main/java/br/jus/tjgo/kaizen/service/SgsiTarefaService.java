package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Tarefas do plano de trabalho 5W2H de cada instrumento do SGSI. A atualização de status/percentual
 * registra a mudança em sgsi_tarefa_historico (autoria + antes/depois), conforme RN do pacote.
 */
@Service
@RequiredArgsConstructor
public class SgsiTarefaService {

    private final JdbcTemplate jdbc;

    private static final Set<String> STATUS_VALIDOS = Set.of(
            "NAO_INICIADA", "EM_ANDAMENTO", "CONCLUIDA", "ATRASADA", "BLOQUEADA");

    public List<Map<String, Object>> listarPorInstrumento(String instrumentoCodigo) {
        return jdbc.queryForList(
                "SELECT id, instrumento_codigo, numero, fase, tipo, oque, porque, onde, quem, " +
                "       como, custo, dados_levantar, inicio_m, fim_m, status, percentual, " +
                "       responsavel_id, atualizado_por, atualizado_em " +
                "  FROM sgsi_tarefa WHERE instrumento_codigo = ? ORDER BY numero",
                instrumentoCodigo);
    }

    /**
     * Atualiza status e/ou percentual de uma tarefa e grava o histórico. Retorna a tarefa
     * atualizada, ou null se não existir. Lança IllegalArgumentException para valores inválidos.
     */
    @Transactional
    public Map<String, Object> atualizar(long id, String status, BigDecimal percentual,
                                         String observacao, Long userId) {
        List<Map<String, Object>> atuais = jdbc.queryForList(
                "SELECT status, percentual FROM sgsi_tarefa WHERE id = ?", id);
        if (atuais.isEmpty()) {
            return null;
        }
        Map<String, Object> atual = atuais.get(0);
        String statusAnterior = (String) atual.get("status");
        BigDecimal pctAnterior = (BigDecimal) atual.get("percentual");

        String statusNovo = (status == null || status.isBlank()) ? statusAnterior : status.trim();
        if (!STATUS_VALIDOS.contains(statusNovo)) {
            throw new IllegalArgumentException("status inválido");
        }
        BigDecimal pctNovo = percentual != null ? percentual : pctAnterior;
        if (pctNovo.compareTo(BigDecimal.ZERO) < 0 || pctNovo.compareTo(BigDecimal.ONE) > 0) {
            throw new IllegalArgumentException("percentual deve estar entre 0 e 1");
        }
        // Coerência básica: concluída = 100%.
        if ("CONCLUIDA".equals(statusNovo)) {
            pctNovo = BigDecimal.ONE;
        }

        jdbc.update(
                "UPDATE sgsi_tarefa SET status = ?, percentual = ?, atualizado_por = ?, " +
                "       atualizado_em = now() WHERE id = ?",
                statusNovo, pctNovo, userId, id);

        jdbc.update(
                "INSERT INTO sgsi_tarefa_historico (tarefa_id, status_anterior, status_novo, " +
                "       percentual_anterior, percentual_novo, observacao, ator_id) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                id, statusAnterior, statusNovo, pctAnterior, pctNovo,
                (observacao == null || observacao.isBlank()) ? null : observacao.trim(), userId);

        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, instrumento_codigo, numero, fase, tipo, oque, porque, onde, quem, " +
                "       como, custo, dados_levantar, inicio_m, fim_m, status, percentual, " +
                "       responsavel_id, atualizado_por, atualizado_em " +
                "  FROM sgsi_tarefa WHERE id = ?", id);
        return rows.isEmpty() ? null : rows.get(0);
    }
}
