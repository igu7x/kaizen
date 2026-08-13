package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Obrigações documentais do SGSI (286 registros). Cada documento é exigido por um instrumento e,
 * quando derivado do plano, referencia a tarefa 5W2H de origem. 2ª fatia — leitura + status.
 * O ciclo completo (checkout, tramitação, assinatura, versão) fica para a fatia de workflow.
 */
@Service
@RequiredArgsConstructor
public class SgsiDocumentoService {

    private final JdbcTemplate jdbc;

    private static final Set<String> STATUS_VALIDOS = Set.of(
            "PENDENTE", "EM_ELABORACAO", "EM_REVISAO", "EM_ASSINATURA",
            "ASSINADO", "PUBLICADO", "CANCELADO");

    private static final String SELECT_BASE =
            "SELECT d.id, d.seed_key, d.nome, d.tipo, d.instrumento_codigo, d.tarefa_id, " +
            "       d.atividade, d.referencia, d.responsavel, d.prazo_marco, d.prazo_data, " +
            "       d.status, d.origem, d.numero_emissao, d.atualizado_em, " +
            "       i.sigla_oficial AS instrumento_sigla, i.numeral_romano AS instrumento_numeral, " +
            "       i.ordem AS instrumento_ordem, t.numero AS tarefa_numero " +
            "  FROM sgsi_documento d " +
            "  LEFT JOIN sgsi_instrumento i ON i.codigo = d.instrumento_codigo " +
            "  LEFT JOIN sgsi_tarefa t      ON t.id = d.tarefa_id ";

    public List<Map<String, Object>> listar(String instrumento, String status, String tipo) {
        StringBuilder sql = new StringBuilder(SELECT_BASE).append(" WHERE 1=1 ");
        List<Object> params = new ArrayList<>();
        if (instrumento != null && !instrumento.isBlank()) {
            sql.append(" AND d.instrumento_codigo = ? ");
            params.add(instrumento.trim());
        }
        if (status != null && !status.isBlank()) {
            sql.append(" AND d.status = ? ");
            params.add(status.trim());
        }
        if (tipo != null && !tipo.isBlank()) {
            sql.append(" AND d.tipo = ? ");
            params.add(tipo.trim());
        }
        sql.append(" ORDER BY i.ordem NULLS LAST, d.nome ");
        return jdbc.queryForList(sql.toString(), params.toArray());
    }

    public Map<String, Object> buscar(long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(SELECT_BASE + " WHERE d.id = ?", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** Atualiza apenas o status (fatia atual). Retorna o documento, null se não existir. */
    @Transactional
    public Map<String, Object> atualizarStatus(long id, String status) {
        if (status == null || !STATUS_VALIDOS.contains(status.trim())) {
            throw new IllegalArgumentException("status inválido");
        }
        int n = jdbc.update(
                "UPDATE sgsi_documento SET status = ?, atualizado_em = now() WHERE id = ?",
                status.trim(), id);
        return n > 0 ? buscar(id) : null;
    }
}
