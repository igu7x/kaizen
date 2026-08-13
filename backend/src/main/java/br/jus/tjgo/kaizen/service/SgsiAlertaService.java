package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * Alertas do SGSI (RN-06/07/08/09). Os DERIVADOS são calculados a partir dos prazos de documentos e
 * tarefas (janela em {@code alerta.janela_dias}, padrão 15) e não são persistidos — o prazo muda com a
 * âncora e um alerta gravado mentiria. A dispensa é por usuário e a chave inclui a data-limite: mudou o
 * prazo, o alerta reaparece. Os REGISTRADOS são criados por usuário/API e guardados com flag {@code lido}.
 */
@Service
@RequiredArgsConstructor
public class SgsiAlertaService {

    private final JdbcTemplate jdbc;
    private final AuditService audit;

    private static final String DERIVADOS_SQL =
            "WITH janela AS (" +
            "  SELECT COALESCE((SELECT (valor #>> '{}')::int FROM sgsi_configuracao " +
            "                   WHERE chave = 'alerta.janela_dias'), 15) AS dias) " +
            "SELECT x.chave, x.tipo, x.ref_id, x.titulo, x.instrumento, x.data_limite, x.dias, " +
            "       CASE WHEN x.dias < 0 THEN 'VENCIDO' ELSE 'PROXIMO' END AS gravidade " +
            "FROM ( " +
            "  SELECT 'D:' || d.id || ':' || to_char(p.prazo, 'YYYY-MM-DD') AS chave, 'DOCUMENTO' AS tipo, " +
            "         d.id AS ref_id, d.nome AS titulo, i.sigla_oficial AS instrumento, " +
            "         p.prazo AS data_limite, (p.prazo - CURRENT_DATE) AS dias " +
            "  FROM sgsi_documento d " +
            "  LEFT JOIN sgsi_instrumento i ON i.codigo = d.instrumento_codigo " +
            "  CROSS JOIN LATERAL (SELECT COALESCE(d.prazo_data, " +
            "         (i.ancora + make_interval(months => d.prazo_marco)))::date AS prazo) p " +
            "  WHERE d.status NOT IN ('PUBLICADO','CANCELADO') AND p.prazo IS NOT NULL " +
            "  UNION ALL " +
            "  SELECT 'T:' || t.instrumento_codigo || ':' || t.id || ':' || to_char(p.prazo, 'YYYY-MM-DD'), " +
            "         'TAREFA', t.id, t.oque, i.sigla_oficial, p.prazo, (p.prazo - CURRENT_DATE) " +
            "  FROM sgsi_tarefa t " +
            "  JOIN sgsi_instrumento i ON i.codigo = t.instrumento_codigo " +
            "  CROSS JOIN LATERAL (SELECT (i.ancora + make_interval(months => t.fim_m))::date AS prazo) p " +
            "  WHERE t.status <> 'CONCLUIDA' AND t.fim_m IS NOT NULL AND i.ancora IS NOT NULL " +
            "        AND p.prazo IS NOT NULL " +
            ") x, janela " +
            "WHERE (x.dias < 0 OR x.dias <= janela.dias) " +
            "  AND NOT EXISTS (SELECT 1 FROM sgsi_alerta_dispensa disp " +
            "                   WHERE disp.chave = x.chave AND disp.usuario_id = ?) " +
            "ORDER BY x.dias";

    public List<Map<String, Object>> derivados(Long userId) {
        return jdbc.queryForList(DERIVADOS_SQL, userId);
    }

    public List<Map<String, Object>> registrados() {
        return jdbc.queryForList(
                "SELECT a.id, a.titulo, a.descricao, a.data_referencia, a.instrumento_codigo, " +
                "  i.sigla_oficial AS instrumento_sigla, a.tarefa_id, a.documento_id, a.indicador_id, " +
                "  a.origem, a.lido, a.criado_em " +
                "FROM sgsi_alerta a LEFT JOIN sgsi_instrumento i ON i.codigo = a.instrumento_codigo " +
                "ORDER BY a.lido, a.criado_em DESC");
    }

    /** Painel consolidado: derivados, registrados e o contador do badge (RN-09). */
    public Map<String, Object> painel(Long userId) {
        List<Map<String, Object>> deriv = derivados(userId);
        List<Map<String, Object>> reg = registrados();
        long naoLidos = reg.stream().filter(a -> Boolean.FALSE.equals(a.get("lido"))).count();
        return Map.of(
                "derivados", deriv,
                "registrados", reg,
                "contador", deriv.size() + naoLidos);
    }

    @Transactional
    public Map<String, Object> criar(Map<String, Object> b, Long userId) {
        String titulo = str(b.get("titulo"));
        if (titulo == null) {
            throw new IllegalArgumentException("título é obrigatório");
        }
        Long id = jdbc.queryForObject(
                "INSERT INTO sgsi_alerta (titulo, descricao, data_referencia, instrumento_codigo, criado_por) " +
                "VALUES (?, ?, ?::date, ?, ?) RETURNING id",
                Long.class,
                titulo, str(b.get("descricao")), str(b.get("data_referencia")),
                str(b.get("instrumento_codigo")), userId);
        audit.log("sgsi_alerta", id, "INSERT", userId,
                Map.of("evento", "ALERTA_REGISTRADO"), null, null);
        return buscar(id);
    }

    @Transactional
    public Map<String, Object> marcarLido(long id, boolean lido, Long userId) {
        int n = jdbc.update("UPDATE sgsi_alerta SET lido = ? WHERE id = ?", lido, id);
        if (n == 0) {
            return null;
        }
        audit.log("sgsi_alerta", id, "UPDATE", userId,
                Map.of("evento", lido ? "ALERTA_LIDO" : "ALERTA_NAO_LIDO"), null, null);
        return buscar(id);
    }

    @Transactional
    public boolean deletar(long id, Long userId) {
        boolean ok = jdbc.update("DELETE FROM sgsi_alerta WHERE id = ?", id) > 0;
        if (ok) {
            audit.log("sgsi_alerta", id, "DELETE", userId, Map.of("evento", "ALERTA_EXCLUIDO"), null, null);
        }
        return ok;
    }

    /** Silencia um alerta derivado para o usuário. Reaparece se a data-limite (parte da chave) mudar. */
    @Transactional
    public void dispensar(String chave, Long userId) {
        if (chave == null || chave.isBlank()) {
            throw new IllegalArgumentException("chave é obrigatória");
        }
        jdbc.update(
                "INSERT INTO sgsi_alerta_dispensa (chave, usuario_id) VALUES (?, ?) " +
                "ON CONFLICT (chave, usuario_id) DO NOTHING", chave.trim(), userId);
    }

    @Transactional
    public void reativar(String chave, Long userId) {
        if (chave == null || chave.isBlank()) {
            throw new IllegalArgumentException("chave é obrigatória");
        }
        jdbc.update("DELETE FROM sgsi_alerta_dispensa WHERE chave = ? AND usuario_id = ?", chave.trim(), userId);
    }

    private Map<String, Object> buscar(long id) {
        List<Map<String, Object>> r = jdbc.queryForList(
                "SELECT a.id, a.titulo, a.descricao, a.data_referencia, a.instrumento_codigo, " +
                "  i.sigla_oficial AS instrumento_sigla, a.origem, a.lido, a.criado_em " +
                "FROM sgsi_alerta a LEFT JOIN sgsi_instrumento i ON i.codigo = a.instrumento_codigo " +
                "WHERE a.id = ?", id);
        return r.isEmpty() ? null : r.get(0);
    }

    private static String str(Object v) {
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        return s.isEmpty() ? null : s;
    }
}
