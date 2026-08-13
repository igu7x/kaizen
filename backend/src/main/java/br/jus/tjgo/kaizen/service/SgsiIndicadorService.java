package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Indicadores do SGSI (31) e suas medições por competência. 3ª fatia. Os 26 sem meta aguardam
 * deliberação do CGSI (decisão D-08 do pacote) — sem meta não há semáforo, e a UI trata isso.
 */
@Service
@RequiredArgsConstructor
public class SgsiIndicadorService {

    private final JdbcTemplate jdbc;

    private static final Pattern COMPETENCIA = Pattern.compile("^\\d{4}-\\d{2}$");

    /** Indicadores com a sigla do instrumento e a última medição registrada (para o semáforo). */
    public List<Map<String, Object>> listar() {
        return jdbc.queryForList(
                "SELECT i.id, i.seed_key, i.instrumento_codigo, i.tarefa_id, i.nome, i.referencia, " +
                "       i.responsavel, i.formula, i.unidade, i.meta, i.tolerancia, i.direcao, " +
                "       i.frequencia, i.ativo, " +
                "       inst.sigla_oficial AS instrumento_sigla, inst.ordem AS instrumento_ordem, " +
                "       m.valor AS ultimo_valor, m.competencia AS ultima_competencia, " +
                "       m.data_referencia AS ultima_data " +
                "  FROM sgsi_indicador i " +
                "  LEFT JOIN sgsi_instrumento inst ON inst.codigo = i.instrumento_codigo " +
                "  LEFT JOIN LATERAL ( " +
                "     SELECT valor, competencia, data_referencia FROM sgsi_medicao " +
                "      WHERE indicador_id = i.id ORDER BY competencia DESC LIMIT 1 " +
                "  ) m ON true " +
                " ORDER BY inst.ordem NULLS LAST, i.nome");
    }

    public List<Map<String, Object>> listarMedicoes(long indicadorId) {
        return jdbc.queryForList(
                "SELECT id, indicador_id, competencia, data_referencia, valor, observacao, criado_em " +
                "  FROM sgsi_medicao WHERE indicador_id = ? ORDER BY competencia DESC",
                indicadorId);
    }

    /** Registra (ou atualiza) a medição de uma competência. Retorna null se o indicador não existir. */
    @Transactional
    public Map<String, Object> registrarMedicao(long indicadorId, String competencia,
                                                BigDecimal valor, String observacao, Long userId) {
        if (competencia == null || !COMPETENCIA.matcher(competencia.trim()).matches()) {
            throw new IllegalArgumentException("competência deve estar no formato AAAA-MM");
        }
        if (valor == null) {
            throw new IllegalArgumentException("valor é obrigatório");
        }
        Integer existe = jdbc.query("SELECT 1 FROM sgsi_indicador WHERE id = ?",
                ps -> ps.setLong(1, indicadorId), rs -> rs.next() ? 1 : null);
        if (existe == null) {
            return null;
        }
        String comp = competencia.trim();
        jdbc.update(
                "INSERT INTO sgsi_medicao (indicador_id, competencia, data_referencia, valor, observacao, registrado_por) " +
                "VALUES (?, ?, (?::date), ?, ?, ?) " +
                "ON CONFLICT (indicador_id, competencia) DO UPDATE " +
                "  SET valor = EXCLUDED.valor, observacao = EXCLUDED.observacao, " +
                "      data_referencia = EXCLUDED.data_referencia, registrado_por = EXCLUDED.registrado_por",
                indicadorId, comp, comp + "-01", valor,
                (observacao == null || observacao.isBlank()) ? null : observacao.trim(), userId);

        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, indicador_id, competencia, data_referencia, valor, observacao, criado_em " +
                "  FROM sgsi_medicao WHERE indicador_id = ? AND competencia = ?",
                indicadorId, comp);
        return rows.isEmpty() ? null : rows.get(0);
    }
}
