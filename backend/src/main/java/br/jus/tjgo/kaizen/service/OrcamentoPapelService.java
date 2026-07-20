package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.auth.AuthenticatedUser;
import br.jus.tjgo.kaizen.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * Cap. 8 (Orçamento de TIC) — modelo de perfis Editor × Autoridade e atribuição de Editores.
 *
 * <p>Regra-síntese (RN-GERAL-01): o <b>Editor</b> edita e salva conteúdo no estado corrente, mas
 * <b>nunca</b> transita fase; a <b>Autoridade</b> valida e transita. Nenhuma transição é delegável
 * ao Editor. A atribuição de Editor é feita pela Autoridade do próprio escopo (RN-GERAL-09).</p>
 *
 * <p>O escopo do usuário é derivado da diretoria (best-effort — o gating só atua com usuário
 * identificado). Um usuário é <b>Editor</b> de um escopo quando tem atribuição em
 * {@code orcamento_editores}; é <b>Autoridade</b> quando pertence ao escopo e NÃO é editor.
 * Gestor/superadmin (ADMIN) conduzem o ciclo (override de Autoridade em qualquer escopo).</p>
 */
@Service
@RequiredArgsConstructor
public class OrcamentoPapelService {

    private final JdbcTemplate jdbc;

    public static final List<String> ESCOPOS = List.of("cca", "demandante", "gejut", "sgjt");

    // ---------- resolução de papel ----------

    /** Escopo do usuário a partir da diretoria; sem diretoria específica é "demandante". */
    public String escopoDe(AuthenticatedUser u) {
        String dir = u.diretoria() == null ? "" : u.diretoria().trim().toUpperCase();
        return switch (dir) {
            case "SGJT" -> "sgjt";
            case "GEJUT" -> "gejut";
            case "CCA" -> "cca";
            case "DG" -> "dg";
            default -> "demandante";
        };
    }

    /** Conduz o ciclo em qualquer escopo (Autoridade override): superadmin ou role ADMIN/MANAGER. */
    public boolean isGestorOverride(AuthenticatedUser u) {
        if (u.isSuperadmin()) return true;
        String role = u.role() == null ? "" : u.role().toUpperCase();
        return role.equals("ADMIN") || role.equals("MANAGER");
    }

    /** True se o usuário tem atribuição de Editor no escopo (global ou do ciclo). */
    public boolean isEditor(AuthenticatedUser u, String escopo, Long cicloId) {
        Integer c = jdbc.queryForObject(
                "SELECT COUNT(*) FROM orcamento_editores WHERE user_id = ? AND escopo = ? " +
                        "AND (ciclo_id IS NULL OR ciclo_id = ?)",
                Integer.class, u.id(), escopo, cicloId);
        return c != null && c > 0;
    }

    /**
     * Pode EDITAR conteúdo do escopo (ação compartilhada Autoridade + Editor). True para o gestor
     * override, para quem pertence ao escopo, e para o Editor atribuído.
     */
    public boolean podeEditar(AuthenticatedUser u, String escopo, Long cicloId) {
        if (isGestorOverride(u)) return true;
        if (escopo.equals(escopoDe(u))) return true;
        return isEditor(u, escopo, cicloId);
    }

    /**
     * Pode TRANSITAR (validar / encaminhar / remeter / publicar) — privativo da Autoridade do escopo
     * (RN-GERAL-01). O Editor atribuído do próprio escopo NÃO transita.
     */
    public boolean podeTransitar(AuthenticatedUser u, String escopo, Long cicloId) {
        if (isGestorOverride(u)) return true;
        return escopo.equals(escopoDe(u)) && !isEditor(u, escopo, cicloId);
    }

    // ---------- gating (lança 403; best-effort — não bloqueia sem contexto de auth) ----------

    public void exigirEdicao(String escopo, Long cicloId) {
        var opt = AuthContext.getCurrentUser();
        if (opt.isEmpty()) return;
        if (!podeEditar(opt.get(), escopo, cicloId)) {
            throw new ApiException(403, "Sem permissão de edição no escopo " + escopo.toUpperCase());
        }
    }

    public void exigirTransicao(String escopo, Long cicloId) {
        var opt = AuthContext.getCurrentUser();
        if (opt.isEmpty()) return;
        if (!podeTransitar(opt.get(), escopo, cicloId)) {
            throw new ApiException(403,
                    "Apenas a Autoridade do escopo " + escopo.toUpperCase() + " pode executar esta transição (Editor não transita).");
        }
    }

    // ---------- atribuição de Editores (RN-GERAL-09) ----------

    @Transactional
    public void atribuirEditor(long userId, String escopo, Long cicloId, Long by) {
        String esc = escopo == null ? "" : escopo.trim().toLowerCase();
        if (!ESCOPOS.contains(esc)) {
            throw new ApiException(400, "Escopo inválido: " + escopo);
        }
        // Atribuição é ato de Autoridade do próprio escopo (RN-GERAL-09).
        exigirTransicao(esc, cicloId);
        jdbc.update(
                "INSERT INTO orcamento_editores (user_id, escopo, ciclo_id, created_by) VALUES (?, ?, ?, ?) " +
                        "ON CONFLICT (user_id, escopo, COALESCE(ciclo_id, 0)) DO NOTHING",
                userId, esc, cicloId, by);
    }

    @Transactional
    public void revogarEditor(long userId, String escopo, Long cicloId) {
        String esc = escopo == null ? "" : escopo.trim().toLowerCase();
        exigirTransicao(esc, cicloId);
        if (cicloId == null) {
            jdbc.update("DELETE FROM orcamento_editores WHERE user_id = ? AND escopo = ? AND ciclo_id IS NULL",
                    userId, esc);
        } else {
            jdbc.update("DELETE FROM orcamento_editores WHERE user_id = ? AND escopo = ? AND ciclo_id = ?",
                    userId, esc, cicloId);
        }
    }

    public List<Map<String, Object>> listarEditores(String escopo, Long cicloId) {
        StringBuilder sql = new StringBuilder(
                "SELECT e.id, e.user_id, e.escopo, e.ciclo_id, e.created_at, u.name AS user_name, u.email AS user_email " +
                        "FROM orcamento_editores e LEFT JOIN users u ON u.id = e.user_id WHERE 1=1");
        List<Object> params = new java.util.ArrayList<>();
        if (escopo != null && !escopo.isBlank()) {
            sql.append(" AND e.escopo = ?");
            params.add(escopo.trim().toLowerCase());
        }
        if (cicloId != null) {
            sql.append(" AND (e.ciclo_id IS NULL OR e.ciclo_id = ?)");
            params.add(cicloId);
        }
        sql.append(" ORDER BY e.escopo, u.name");
        return jdbc.queryForList(sql.toString(), params.toArray());
    }
}
