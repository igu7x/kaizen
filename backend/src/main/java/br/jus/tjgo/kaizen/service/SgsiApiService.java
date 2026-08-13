package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Integração — credenciais de máquina (API) e webhooks. Do segredo guarda-se apenas o hash SHA-256; o
 * valor em claro é retornado UMA ÚNICA VEZ na criação (RN das credenciais de máquina). O status da chave
 * segue ATIVA→SUSPENSA→REVOGADA (revogação é definitiva). 20ª fatia.
 */
@Service
@RequiredArgsConstructor
public class SgsiApiService {

    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private static final SecureRandom RNG = new SecureRandom();

    private static final Set<String> STATUS = Set.of("ATIVA", "SUSPENSA", "REVOGADA");

    // ─── Escopos ────────────────────────────────────────────────────────────────────────────────

    public List<Map<String, Object>> listarEscopos() {
        return jdbc.queryForList("SELECT codigo, descricao FROM sgsi_api_escopo ORDER BY codigo");
    }

    // ─── Chaves de API ────────────────────────────────────────────────────────────────────────────

    public List<Map<String, Object>> listarChaves() {
        return jdbc.queryForList(
                "SELECT k.id, k.nome, k.unidade, k.exige_mtls, k.limite_por_min, k.expiracao, k.status, " +
                "  k.criada_em, " +
                "  ( SELECT string_agg(escopo_codigo, ',' ORDER BY escopo_codigo) " +
                "      FROM sgsi_api_chave_escopo e WHERE e.api_chave_id = k.id ) AS escopos " +
                "FROM sgsi_api_chave k ORDER BY k.criada_em DESC");
    }

    /** Cria uma chave e retorna o SEGREDO EM CLARO uma única vez (só o hash é persistido). */
    @Transactional
    public Map<String, Object> criarChave(Map<String, Object> b, Long userId) {
        String nome = str(b.get("nome"));
        if (nome == null) {
            throw new IllegalArgumentException("nome é obrigatório");
        }
        String id = "sgsi_" + hex(9);
        String segredo = "sk_" + Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes(24));

        jdbc.update(
                "INSERT INTO sgsi_api_chave (id, nome, unidade, segredo_hash, exige_mtls, limite_por_min, " +
                "  expiracao, criada_por) VALUES (?, ?, ?, ?, ?, ?, ?::date, ?)",
                id, nome, str(b.get("unidade")), sha256(segredo), toBool(b.get("exige_mtls")),
                optInt(b.get("limite_por_min"), 120), str(b.get("expiracao")), userId);

        for (String escopo : escoposDe(b.get("escopos"))) {
            jdbc.update(
                    "INSERT INTO sgsi_api_chave_escopo (api_chave_id, escopo_codigo) VALUES (?, ?) " +
                    "ON CONFLICT DO NOTHING", id, escopo);
        }
        audit.log("sgsi_api_chave", 0L, "INSERT", userId,
                Map.of("evento", "API_CHAVE_CRIADA", "id", id), null, null);

        Map<String, Object> out = new HashMap<>(buscarChave(id));
        out.put("segredo", segredo); // exibido uma única vez
        return out;
    }

    @Transactional
    public Map<String, Object> alterarStatusChave(String id, String status, Long userId) {
        if (status == null || !STATUS.contains(status.trim())) {
            throw new IllegalArgumentException("status inválido");
        }
        int n = jdbc.update("UPDATE sgsi_api_chave SET status = ? WHERE id = ?", status.trim(), id);
        if (n == 0) {
            return null;
        }
        audit.log("sgsi_api_chave", 0L, "UPDATE", userId,
                Map.of("evento", "REVOGADA".equals(status.trim()) ? "API_CHAVE_REVOGADA" : "API_CHAVE_STATUS",
                        "id", id, "status", status.trim()), null, null);
        return buscarChave(id);
    }

    private Map<String, Object> buscarChave(String id) {
        List<Map<String, Object>> r = jdbc.queryForList(
                "SELECT k.id, k.nome, k.unidade, k.exige_mtls, k.limite_por_min, k.expiracao, k.status, " +
                "  k.criada_em, " +
                "  ( SELECT string_agg(escopo_codigo, ',' ORDER BY escopo_codigo) " +
                "      FROM sgsi_api_chave_escopo e WHERE e.api_chave_id = k.id ) AS escopos " +
                "FROM sgsi_api_chave k WHERE k.id = ?", id);
        return r.isEmpty() ? null : r.get(0);
    }

    // ─── Webhooks ─────────────────────────────────────────────────────────────────────────────────

    public List<Map<String, Object>> listarWebhooks() {
        return jdbc.queryForList(
                "SELECT id, nome, url, array_to_string(eventos, ',') AS eventos, ativo, criado_em " +
                "FROM sgsi_webhook ORDER BY criado_em DESC");
    }

    /** Cria um webhook (URL https) e retorna o segredo em claro uma única vez. */
    @Transactional
    public Map<String, Object> criarWebhook(Map<String, Object> b, Long userId) {
        String nome = str(b.get("nome"));
        String url = str(b.get("url"));
        if (nome == null || url == null) {
            throw new IllegalArgumentException("nome e url são obrigatórios");
        }
        if (!url.startsWith("https://")) {
            throw new IllegalArgumentException("a URL do webhook deve ser https");
        }
        List<String> eventos = new java.util.ArrayList<>(escoposDe(b.get("eventos")));
        if (eventos.isEmpty()) {
            throw new IllegalArgumentException("selecione ao menos um evento");
        }
        for (String ev : eventos) {
            if (!ev.matches("^[A-Z0-9_:.]+$")) {
                throw new IllegalArgumentException("evento inválido: " + ev);
            }
        }
        String eventosLiteral = "{" + String.join(",", eventos) + "}";
        String segredo = "whsec_" + Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes(24));

        Long id = jdbc.queryForObject(
                "INSERT INTO sgsi_webhook (nome, url, segredo_hash, eventos, criado_por) " +
                "VALUES (?, ?, ?, ?::text[], ?) RETURNING id",
                Long.class, nome, url, sha256(segredo), eventosLiteral, userId);
        audit.log("sgsi_webhook", id, "INSERT", userId,
                Map.of("evento", "WEBHOOK_CRIADO", "url", url), null, null);

        Map<String, Object> out = new HashMap<>(buscarWebhook(id));
        out.put("segredo", segredo);
        return out;
    }

    @Transactional
    public Map<String, Object> alternarWebhook(long id, boolean ativo, Long userId) {
        int n = jdbc.update("UPDATE sgsi_webhook SET ativo = ? WHERE id = ?", ativo, id);
        if (n == 0) {
            return null;
        }
        audit.log("sgsi_webhook", id, "UPDATE", userId,
                Map.of("evento", ativo ? "WEBHOOK_ATIVADO" : "WEBHOOK_DESATIVADO"), null, null);
        return buscarWebhook(id);
    }

    @Transactional
    public boolean deletarWebhook(long id, Long userId) {
        boolean ok = jdbc.update("DELETE FROM sgsi_webhook WHERE id = ?", id) > 0;
        if (ok) {
            audit.log("sgsi_webhook", id, "DELETE", userId, Map.of("evento", "WEBHOOK_EXCLUIDO"), null, null);
        }
        return ok;
    }

    private Map<String, Object> buscarWebhook(long id) {
        List<Map<String, Object>> r = jdbc.queryForList(
                "SELECT id, nome, url, array_to_string(eventos, ',') AS eventos, ativo, criado_em " +
                "FROM sgsi_webhook WHERE id = ?", id);
        return r.isEmpty() ? null : r.get(0);
    }

    // ---- helpers ----
    private static Set<String> escoposDe(Object raw) {
        LinkedHashSet<String> out = new LinkedHashSet<>();
        if (raw instanceof List<?> list) {
            for (Object o : list) {
                String s = str(o);
                if (s != null) out.add(s);
            }
        }
        return out;
    }

    private static String str(Object v) {
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        return s.isEmpty() ? null : s;
    }

    private static boolean toBool(Object v) {
        if (v instanceof Boolean bo) return bo;
        return v != null && "true".equalsIgnoreCase(String.valueOf(v));
    }

    private static int optInt(Object v, int def) {
        if (v == null) return def;
        try {
            return Integer.parseInt(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return def;
        }
    }

    private static byte[] randomBytes(int n) {
        byte[] b = new byte[n];
        RNG.nextBytes(b);
        return b;
    }

    private static String hex(int nBytes) {
        byte[] b = randomBytes(nBytes);
        StringBuilder sb = new StringBuilder(b.length * 2);
        for (byte x : b) sb.append(String.format("%02x", x));
        return sb.toString();
    }

    private static String sha256(String s) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(d.length * 2);
            for (byte x : d) sb.append(String.format("%02x", x));
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
