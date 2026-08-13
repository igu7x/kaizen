package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Frameworks de governança (CIS, NIST, ISO 27001/27002, COBIT, LGPD), seus itens e a avaliação
 * de conformidade por item. 5ª fatia. Cada item pode estar vinculado a instrumentos normativos.
 */
@Service
@RequiredArgsConstructor
public class SgsiFrameworkService {

    private final JdbcTemplate jdbc;

    private static final Set<String> STATUS_VALIDOS = Set.of(
            "NAO_AVALIADO", "CONFORME", "PARCIALMENTE_CONFORME", "NAO_CONFORME", "NAO_APLICAVEL");

    /** Frameworks com total de itens, avaliados e conformes. */
    public List<Map<String, Object>> listarFrameworks() {
        return jdbc.queryForList(
                "SELECT f.codigo, f.nome, f.descricao, f.ordem, " +
                "  COUNT(fi.id) AS total_itens, " +
                "  COUNT(av.framework_item_id) FILTER (WHERE av.status <> 'NAO_AVALIADO') AS avaliados, " +
                "  COUNT(av.framework_item_id) FILTER (WHERE av.status = 'CONFORME') AS conformes " +
                "FROM sgsi_framework f " +
                "LEFT JOIN sgsi_framework_item fi ON fi.framework_codigo = f.codigo " +
                "LEFT JOIN sgsi_framework_avaliacao av ON av.framework_item_id = fi.id " +
                "GROUP BY f.codigo ORDER BY f.ordem");
    }

    /** Itens de um framework, com os instrumentos vinculados (siglas separadas por vírgula) e a avaliação. */
    public List<Map<String, Object>> listarItens(String frameworkCodigo) {
        return jdbc.queryForList(
                "SELECT fi.id, fi.framework_codigo, fi.item_id, fi.nome, fi.ordem, " +
                "  COALESCE(av.status, 'NAO_AVALIADO') AS avaliacao_status, " +
                "  av.observacao AS avaliacao_observacao, av.avaliado_em, " +
                "  ( SELECT string_agg(inst.sigla_oficial, ',' ORDER BY inst.ordem) " +
                "      FROM sgsi_framework_item_instrumento fii " +
                "      JOIN sgsi_instrumento inst ON inst.codigo = fii.instrumento_codigo " +
                "     WHERE fii.framework_item_id = fi.id ) AS instrumentos " +
                "FROM sgsi_framework_item fi " +
                "LEFT JOIN sgsi_framework_avaliacao av ON av.framework_item_id = fi.id " +
                "WHERE fi.framework_codigo = ? ORDER BY fi.ordem",
                frameworkCodigo);
    }

    /** Registra/atualiza a avaliação de conformidade de um item. Null se o item não existir. */
    @Transactional
    public Map<String, Object> avaliarItem(long itemId, String status, String observacao, Long userId) {
        if (status == null || !STATUS_VALIDOS.contains(status.trim())) {
            throw new IllegalArgumentException("status inválido");
        }
        Integer existe = jdbc.query("SELECT 1 FROM sgsi_framework_item WHERE id = ?",
                ps -> ps.setLong(1, itemId), rs -> rs.next() ? 1 : null);
        if (existe == null) {
            return null;
        }
        jdbc.update(
                "INSERT INTO sgsi_framework_avaliacao (framework_item_id, status, observacao, avaliado_por, avaliado_em) " +
                "VALUES (?, ?, ?, ?, now()) " +
                "ON CONFLICT (framework_item_id) DO UPDATE " +
                "  SET status = EXCLUDED.status, observacao = EXCLUDED.observacao, " +
                "      avaliado_por = EXCLUDED.avaliado_por, avaliado_em = now()",
                itemId, status.trim(),
                (observacao == null || observacao.isBlank()) ? null : observacao.trim(), userId);

        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT fi.id, fi.framework_codigo, fi.item_id, fi.nome, fi.ordem, " +
                "  av.status AS avaliacao_status, av.observacao AS avaliacao_observacao, av.avaliado_em, " +
                "  ( SELECT string_agg(inst.sigla_oficial, ',' ORDER BY inst.ordem) " +
                "      FROM sgsi_framework_item_instrumento fii " +
                "      JOIN sgsi_instrumento inst ON inst.codigo = fii.instrumento_codigo " +
                "     WHERE fii.framework_item_id = fi.id ) AS instrumentos " +
                "FROM sgsi_framework_item fi " +
                "LEFT JOIN sgsi_framework_avaliacao av ON av.framework_item_id = fi.id " +
                "WHERE fi.id = ?", itemId);
        return rows.isEmpty() ? null : rows.get(0);
    }
}
