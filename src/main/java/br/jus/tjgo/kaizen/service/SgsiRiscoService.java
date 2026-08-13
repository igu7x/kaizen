package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Registro de Riscos do SGSI. O IRS (Índice de Risco de Segurança, RN-30) é calculado na consulta
 * como probabilidade × severidade × relevância (inerente) e usando os residuais quando informados.
 * Plano de ação 1:1 opcional, gravado junto no create/update quando há descrição.
 */
@Service
@RequiredArgsConstructor
public class SgsiRiscoService {

    private final JdbcTemplate jdbc;
    private final AuditService audit;

    private static final Set<String> STATUS = Set.of(
            "IDENTIFICADO", "EM_ANALISE", "EM_TRATAMENTO", "MITIGADO", "ACEITO");
    private static final Set<String> PLANO_STATUS = Set.of(
            "NAO_INICIADO", "EM_ANDAMENTO", "CONCLUIDO");

    private static final String SELECT_BASE =
            "SELECT r.id, r.instrumento_codigo, i.sigla_oficial AS instrumento_sigla, r.titulo, " +
            "  r.ativo_informacao, r.ameaca, r.vulnerabilidade, r.dono, " +
            "  r.probabilidade, r.severidade, r.relevancia, r.probabilidade_residual, r.severidade_residual, " +
            "  r.controles, r.status, r.criado_em, r.atualizado_em, " +
            "  (r.probabilidade * r.severidade * r.relevancia) AS irs_inerente, " +
            "  (COALESCE(r.probabilidade_residual, r.probabilidade) * " +
            "   COALESCE(r.severidade_residual, r.severidade) * r.relevancia) AS irs_residual, " +
            "  pa.descricao AS plano_descricao, pa.responsavel AS plano_responsavel, " +
            "  pa.prazo AS plano_prazo, pa.status AS plano_status " +
            "FROM sgsi_risco r " +
            "LEFT JOIN sgsi_instrumento i ON i.codigo = r.instrumento_codigo " +
            "LEFT JOIN sgsi_risco_plano_acao pa ON pa.risco_id = r.id ";

    public List<Map<String, Object>> listar() {
        return jdbc.queryForList(SELECT_BASE + " ORDER BY irs_residual DESC, r.criado_em DESC");
    }

    public Map<String, Object> buscar(long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(SELECT_BASE + " WHERE r.id = ?", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    @Transactional
    public Map<String, Object> criar(Map<String, Object> b, Long userId) {
        String titulo = str(b.get("titulo"));
        if (titulo == null) {
            throw new IllegalArgumentException("título é obrigatório");
        }
        int prob = reqEscala(b, "probabilidade");
        int sev = reqEscala(b, "severidade");
        int rel = reqEscala(b, "relevancia");
        String status = statusOu(b, "IDENTIFICADO");

        Long id = jdbc.queryForObject(
                "INSERT INTO sgsi_risco (instrumento_codigo, titulo, ativo_informacao, ameaca, " +
                "  vulnerabilidade, dono, probabilidade, severidade, relevancia, " +
                "  probabilidade_residual, severidade_residual, controles, status, criado_por) " +
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id",
                Long.class,
                str(b.get("instrumento_codigo")), titulo, str(b.get("ativo_informacao")),
                str(b.get("ameaca")), str(b.get("vulnerabilidade")), str(b.get("dono")),
                prob, sev, rel, optEscala(b, "probabilidade_residual"), optEscala(b, "severidade_residual"),
                str(b.get("controles")), status, userId);
        salvarPlano(id, b);
        audit.log("sgsi_risco", id, "INSERT", userId, Map.of("evento", "CRIADO"), null, null);
        return buscar(id);
    }

    @Transactional
    public Map<String, Object> atualizar(long id, Map<String, Object> b, Long userId) {
        if (buscar(id) == null) {
            return null;
        }
        String titulo = str(b.get("titulo"));
        if (titulo == null) {
            throw new IllegalArgumentException("título é obrigatório");
        }
        jdbc.update(
                "UPDATE sgsi_risco SET instrumento_codigo=?, titulo=?, ativo_informacao=?, ameaca=?, " +
                "  vulnerabilidade=?, dono=?, probabilidade=?, severidade=?, relevancia=?, " +
                "  probabilidade_residual=?, severidade_residual=?, controles=?, status=?, atualizado_em=now() " +
                "WHERE id=?",
                str(b.get("instrumento_codigo")), titulo, str(b.get("ativo_informacao")),
                str(b.get("ameaca")), str(b.get("vulnerabilidade")), str(b.get("dono")),
                reqEscala(b, "probabilidade"), reqEscala(b, "severidade"), reqEscala(b, "relevancia"),
                optEscala(b, "probabilidade_residual"), optEscala(b, "severidade_residual"),
                str(b.get("controles")), statusOu(b, "IDENTIFICADO"), id);
        salvarPlano(id, b);
        audit.log("sgsi_risco", id, "UPDATE", userId, Map.of("evento", "ATUALIZADO"), null, null);
        return buscar(id);
    }

    @Transactional
    public boolean deletar(long id, Long userId) {
        boolean ok = jdbc.update("DELETE FROM sgsi_risco WHERE id = ?", id) > 0;
        if (ok) {
            audit.log("sgsi_risco", id, "DELETE", userId, Map.of("evento", "EXCLUIDO"), null, null);
        }
        return ok;
    }

    /** Upsert do plano de ação 1:1 quando há descrição; caso contrário não mexe. */
    private void salvarPlano(long riscoId, Map<String, Object> b) {
        String desc = str(b.get("plano_descricao"));
        if (desc == null) {
            return;
        }
        String status = str(b.get("plano_status"));
        if (status == null || !PLANO_STATUS.contains(status)) {
            status = "NAO_INICIADO";
        }
        jdbc.update(
                "INSERT INTO sgsi_risco_plano_acao (risco_id, descricao, responsavel, prazo, status, atualizado_em) " +
                "VALUES (?, ?, ?, ?::date, ?, now()) " +
                "ON CONFLICT (risco_id) DO UPDATE SET descricao=EXCLUDED.descricao, " +
                "  responsavel=EXCLUDED.responsavel, prazo=EXCLUDED.prazo, status=EXCLUDED.status, atualizado_em=now()",
                riscoId, desc, str(b.get("plano_responsavel")), str(b.get("plano_prazo")), status);
    }

    // ---- helpers ----
    private static String str(Object v) {
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        return s.isEmpty() ? null : s;
    }

    private int reqEscala(Map<String, Object> b, String campo) {
        Integer v = optEscala(b, campo);
        if (v == null) {
            throw new IllegalArgumentException(campo + " é obrigatório (1 a 5)");
        }
        return v;
    }

    private Integer optEscala(Map<String, Object> b, String campo) {
        Object v = b.get(campo);
        if (v == null || String.valueOf(v).isBlank()) return null;
        int n;
        try {
            n = Integer.parseInt(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(campo + " deve ser um número de 1 a 5");
        }
        if (n < 1 || n > 5) {
            throw new IllegalArgumentException(campo + " deve estar entre 1 e 5");
        }
        return n;
    }

    private String statusOu(Map<String, Object> b, String padrao) {
        String s = str(b.get("status"));
        if (s == null) return padrao;
        if (!STATUS.contains(s)) {
            throw new IllegalArgumentException("status inválido");
        }
        return s;
    }
}
