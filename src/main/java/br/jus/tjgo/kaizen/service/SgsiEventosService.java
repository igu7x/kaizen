package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Eventos institucionais e SLA (RN-40/41). Registra eventos de RH e incidentes de segurança e deriva o
 * PRAZO DE AÇÃO da norma: desligamento +1h (PSI art. 11 §2º), incidente ALTA/CRÍTICA +2h (PPINC art. 37),
 * demais casos +24h. O SGSI normatiza e audita — a execução pertence aos sistemas da DITI. 17ª fatia.
 */
@Service
@RequiredArgsConstructor
public class SgsiEventosService {

    private final JdbcTemplate jdbc;
    private final AuditService audit;

    private static final Set<String> TIPOS_RH =
            Set.of("DESLIGAMENTO", "MOVIMENTACAO", "AFASTAMENTO", "INGRESSO");
    private static final Set<String> SITUACOES_RH = Set.of("PENDENTE", "EXECUTADO", "FALHA");
    private static final Set<String> SEVERIDADES = Set.of("BAIXA", "MEDIA", "ALTA", "CRITICA");
    private static final Set<String> SITUACOES_INC =
            Set.of("TRIAGEM", "EM_TRATAMENTO", "CONTIDO", "ENCERRADO");

    // ─── Eventos de RH ──────────────────────────────────────────────────────────────────────────

    public List<Map<String, Object>> listarEventosRh(String situacao) {
        if (situacao != null && !situacao.isBlank()) {
            return jdbc.queryForList(
                    "SELECT * FROM sgsi_evento_rh WHERE situacao = ? ORDER BY prazo_acao", situacao.trim());
        }
        return jdbc.queryForList("SELECT * FROM sgsi_evento_rh ORDER BY prazo_acao");
    }

    @Transactional
    public Map<String, Object> criarEventoRh(Map<String, Object> b, Long userId) {
        String tipo = req(b, "tipo", "tipo");
        if (!TIPOS_RH.contains(tipo)) {
            throw new IllegalArgumentException("tipo inválido");
        }
        String matricula = req(b, "matricula", "matrícula");
        String dataEvento = req(b, "data_evento", "data do evento");
        // RN-40: o prazo é derivado da norma no próprio INSERT.
        Long id = jdbc.queryForObject(
                "INSERT INTO sgsi_evento_rh (tipo, matricula, nome, unidade, data_evento, prazo_acao, origem) " +
                "VALUES (?, ?, ?, ?, ?::timestamptz, " +
                "        ?::timestamptz + CASE WHEN ? = 'DESLIGAMENTO' THEN interval '1 hour' " +
                "                              ELSE interval '24 hours' END, ?) RETURNING id",
                Long.class,
                tipo, matricula, str(b.get("nome")), str(b.get("unidade")), dataEvento,
                dataEvento, tipo, str(b.get("origem")));
        audit.log("sgsi_evento_rh", id, "INSERT", userId,
                Map.of("evento", "EVENTO_RH_REGISTRADO", "tipo", tipo, "matricula", matricula), null, null);
        return buscarEventoRh(id);
    }

    @Transactional
    public Map<String, Object> atualizarSituacaoEventoRh(long id, String situacao, Long userId) {
        if (situacao == null || !SITUACOES_RH.contains(situacao.trim())) {
            throw new IllegalArgumentException("situação inválida");
        }
        String s = situacao.trim();
        int n = jdbc.update(
                "UPDATE sgsi_evento_rh SET situacao = ?, " +
                "  executado_em = CASE WHEN ? = 'EXECUTADO' THEN now() ELSE NULL END WHERE id = ?",
                s, s, id);
        if (n == 0) {
            return null;
        }
        audit.log("sgsi_evento_rh", id, "UPDATE", userId,
                Map.of("evento", "EVENTO_RH_SITUACAO", "situacao", s), null, null);
        return buscarEventoRh(id);
    }

    private Map<String, Object> buscarEventoRh(long id) {
        List<Map<String, Object>> r = jdbc.queryForList("SELECT * FROM sgsi_evento_rh WHERE id = ?", id);
        return r.isEmpty() ? null : r.get(0);
    }

    // ─── Incidentes ─────────────────────────────────────────────────────────────────────────────

    public List<Map<String, Object>> listarIncidentes(String situacao) {
        if (situacao != null && !situacao.isBlank()) {
            return jdbc.queryForList(
                    "SELECT * FROM sgsi_incidente WHERE situacao = ? ORDER BY prazo_acionamento", situacao.trim());
        }
        return jdbc.queryForList("SELECT * FROM sgsi_incidente ORDER BY prazo_acionamento");
    }

    @Transactional
    public Map<String, Object> criarIncidente(Map<String, Object> b, Long userId) {
        String severidade = req(b, "severidade", "severidade");
        if (!SEVERIDADES.contains(severidade)) {
            throw new IllegalArgumentException("severidade inválida");
        }
        String titulo = req(b, "titulo", "título");
        String detectadoEm = req(b, "detectado_em", "data de detecção");
        boolean dadosPessoais = toBool(b.get("dados_pessoais"));
        // RN-41: prazo derivado da severidade no próprio INSERT.
        Long id = jdbc.queryForObject(
                "INSERT INTO sgsi_incidente (severidade, titulo, descricao, ativos, dados_pessoais, " +
                "  fornecedor, detectado_em, prazo_acionamento, origem) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?::timestamptz, " +
                "        ?::timestamptz + CASE WHEN ? IN ('ALTA','CRITICA') THEN interval '2 hours' " +
                "                              ELSE interval '24 hours' END, ?) RETURNING id",
                Long.class,
                severidade, titulo, str(b.get("descricao")), str(b.get("ativos")), dadosPessoais,
                str(b.get("fornecedor")), detectadoEm, detectadoEm, severidade, str(b.get("origem")));
        audit.log("sgsi_incidente", id, "INSERT", userId,
                Map.of("evento", "INCIDENTE_REGISTRADO", "severidade", severidade), null, null);
        return buscarIncidente(id);
    }

    @Transactional
    public Map<String, Object> atualizarSituacaoIncidente(long id, String situacao, Long userId) {
        if (situacao == null || !SITUACOES_INC.contains(situacao.trim())) {
            throw new IllegalArgumentException("situação inválida");
        }
        String s = situacao.trim();
        int n = jdbc.update("UPDATE sgsi_incidente SET situacao = ? WHERE id = ?", s, id);
        if (n == 0) {
            return null;
        }
        audit.log("sgsi_incidente", id, "UPDATE", userId,
                Map.of("evento", "INCIDENTE_SITUACAO", "situacao", s), null, null);
        return buscarIncidente(id);
    }

    private Map<String, Object> buscarIncidente(long id) {
        List<Map<String, Object>> r = jdbc.queryForList("SELECT * FROM sgsi_incidente WHERE id = ?", id);
        return r.isEmpty() ? null : r.get(0);
    }

    // ---- helpers ----
    private static String req(Map<String, Object> b, String campo, String rotulo) {
        String v = str(b.get(campo));
        if (v == null) throw new IllegalArgumentException(rotulo + " é obrigatório(a)");
        return v;
    }

    private static String str(Object v) {
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        return s.isEmpty() ? null : s;
    }

    private static boolean toBool(Object v) {
        if (v instanceof Boolean bo) return bo;
        return v != null && ("true".equalsIgnoreCase(String.valueOf(v)) || "1".equals(String.valueOf(v)));
    }
}
