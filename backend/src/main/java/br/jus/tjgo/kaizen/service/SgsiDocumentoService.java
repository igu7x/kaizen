package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
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
    private final AuditService audit;

    private static final Set<String> STATUS_VALIDOS = Set.of(
            "PENDENTE", "EM_ELABORACAO", "EM_REVISAO", "EM_ASSINATURA",
            "ASSINADO", "PUBLICADO", "CANCELADO");

    /** Status em que o conteúdo fica imutável (RN-14). */
    private static final Set<String> STATUS_TRAVADOS = Set.of("EM_ASSINATURA", "ASSINADO", "PUBLICADO");

    private static final String SELECT_BASE =
            "SELECT d.id, d.seed_key, d.nome, d.tipo, d.instrumento_codigo, d.tarefa_id, " +
            "       d.atividade, d.referencia, d.responsavel, d.prazo_marco, d.prazo_data, " +
            "       d.status, d.origem, d.numero_emissao, d.atualizado_em, " +
            "       d.checkout_id, d.checkout_em, cu.name AS checkout_nome, " +
            "       d.titular_id, tu.name AS titular_nome, " +
            "       ( SELECT MAX(v.numero) FROM sgsi_documento_versao v WHERE v.documento_id = d.id ) AS versao_atual, " +
            "       ( SELECT COUNT(*) FROM sgsi_documento_assinatura a WHERE a.documento_id = d.id ) AS assinaturas, " +
            "       i.sigla_oficial AS instrumento_sigla, i.numeral_romano AS instrumento_numeral, " +
            "       i.ordem AS instrumento_ordem, t.numero AS tarefa_numero " +
            "  FROM sgsi_documento d " +
            "  LEFT JOIN sgsi_instrumento i ON i.codigo = d.instrumento_codigo " +
            "  LEFT JOIN sgsi_tarefa t      ON t.id = d.tarefa_id " +
            "  LEFT JOIN users cu           ON cu.id = d.checkout_id " +
            "  LEFT JOIN users tu           ON tu.id = d.titular_id ";

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
    public Map<String, Object> atualizarStatus(long id, String status, Long userId) {
        if (status == null || !STATUS_VALIDOS.contains(status.trim())) {
            throw new IllegalArgumentException("status inválido");
        }
        int n = jdbc.update(
                "UPDATE sgsi_documento SET status = ?, atualizado_em = now() WHERE id = ?",
                status.trim(), id);
        if (n == 0) {
            return null;
        }
        audit.log("sgsi_documento", id, "UPDATE", userId,
                Map.of("evento", "STATUS_ALTERADO", "status", status.trim()), null, null);
        return buscar(id);
    }

    // ─── Workflow: checkout, versionamento e assinatura (RN-14..RN-18) ──────────────────────────

    /** Assume a edição exclusiva (checkout). 409 se travado ou preso por terceiro. */
    @Transactional
    public Map<String, Object> assumirEdicao(long id, Long userId) {
        Map<String, Object> d = estado(id);
        if (d == null) return null;
        exigirNaoTravado(d);
        Long dono = asLong(d.get("checkout_id"));
        if (dono != null && !dono.equals(userId)) {
            throw new IllegalStateException("Documento em edição por outro usuário.");
        }
        jdbc.update("UPDATE sgsi_documento SET checkout_id = ?, checkout_em = now() WHERE id = ?", userId, id);
        audit.log("sgsi_documento", id, "UPDATE", userId, Map.of("evento", "CHECKOUT"), null, null);
        return buscar(id);
    }

    /** Libera o checkout. Só o dono libera, salvo {@code forcar} (documento:aprovar / superadmin). */
    @Transactional
    public Map<String, Object> liberarEdicao(long id, Long userId, boolean forcar) {
        Map<String, Object> d = estado(id);
        if (d == null) return null;
        Long dono = asLong(d.get("checkout_id"));
        if (dono == null) return buscar(id);
        if (!dono.equals(userId) && !forcar) {
            throw new IllegalStateException("Checkout pertence a outro usuário.");
        }
        jdbc.update("UPDATE sgsi_documento SET checkout_id = NULL, checkout_em = NULL WHERE id = ?", id);
        audit.log("sgsi_documento", id, "UPDATE", userId,
                Map.of("evento", "CHECKOUT_LIBERADO", "forcado", String.valueOf(forcar)), null, null);
        return buscar(id);
    }

    /** Grava uma nova versão do conteúdo (RN-16). Exige checkout próprio e documento não travado (RN-15). */
    @Transactional
    public Map<String, Object> gravarVersao(long id, String conteudo, Long userId) {
        if (conteudo == null || conteudo.isBlank()) {
            throw new IllegalArgumentException("conteúdo é obrigatório");
        }
        Map<String, Object> d = estado(id);
        if (d == null) return null;
        exigirNaoTravado(d);
        Long dono = asLong(d.get("checkout_id"));
        if (dono == null) {
            throw new IllegalStateException("Assuma a edição do documento antes de gravar.");
        }
        if (!dono.equals(userId)) {
            throw new IllegalStateException("Documento em edição por outro usuário.");
        }
        int numero = 1 + jdbc.queryForObject(
                "SELECT COALESCE(MAX(numero), 0) FROM sgsi_documento_versao WHERE documento_id = ?",
                Integer.class, id);
        jdbc.update(
                "INSERT INTO sgsi_documento_versao (documento_id, numero, conteudo, caracteres, autor_id) " +
                "VALUES (?, ?, ?, ?, ?)",
                id, numero, conteudo, conteudo.length(), userId);
        if ("PENDENTE".equals(d.get("status"))) {
            jdbc.update("UPDATE sgsi_documento SET status = 'EM_ELABORACAO', atualizado_em = now() WHERE id = ?", id);
        }
        audit.log("sgsi_documento", id, "UPDATE", userId,
                Map.of("evento", "DOC_CONTEUDO_GRAVADO", "versao", String.valueOf(numero)), null, null);
        return buscar(id);
    }

    public List<Map<String, Object>> listarVersoes(long id) {
        return jdbc.queryForList(
                "SELECT v.numero, v.caracteres, v.criado_em, u.name AS autor_nome " +
                "FROM sgsi_documento_versao v LEFT JOIN users u ON u.id = v.autor_id " +
                "WHERE v.documento_id = ? ORDER BY v.numero DESC", id);
    }

    /** Conteúdo de uma versão; se {@code numero} for null, a vigente (maior número). Null se não houver. */
    public Map<String, Object> buscarVersao(long id, Integer numero) {
        String base =
                "SELECT v.numero, v.conteudo, v.caracteres, v.criado_em, u.name AS autor_nome " +
                "FROM sgsi_documento_versao v LEFT JOIN users u ON u.id = v.autor_id WHERE v.documento_id = ? ";
        List<Map<String, Object>> rows = numero == null
                ? jdbc.queryForList(base + "ORDER BY v.numero DESC LIMIT 1", id)
                : jdbc.queryForList(base + "AND v.numero = ?", id, numero);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public List<Map<String, Object>> listarAssinaturas(long id) {
        return jdbc.queryForList(
                "SELECT nome, login, versao_numero, hash_sha256, criado_em " +
                "FROM sgsi_documento_assinatura WHERE documento_id = ? ORDER BY criado_em", id);
    }

    /** Assina a versão vigente (RN-18): hash do conteúdo; 1ª assinatura leva a EM_ASSINATURA. */
    @Transactional
    public Map<String, Object> assinar(long id, Long userId) {
        Map<String, Object> d = estado(id);
        if (d == null) return null;
        String status = (String) d.get("status");
        if (STATUS_TRAVADOS.contains(status) && !"EM_ASSINATURA".equals(status)) {
            throw new IllegalStateException("Documento já assinado/publicado — não aceita novas assinaturas.");
        }
        Map<String, Object> versao = buscarVersao(id, null);
        if (versao == null) {
            throw new IllegalArgumentException("documento sem conteúdo para assinar");
        }
        int numero = ((Number) versao.get("numero")).intValue();
        String conteudo = (String) versao.get("conteudo");

        List<Map<String, Object>> us = jdbc.queryForList(
                "SELECT name, email FROM users WHERE id = ?", userId);
        String nome = us.isEmpty() ? "—" : String.valueOf(us.get(0).get("name"));
        String login = us.isEmpty() || us.get(0).get("email") == null
                ? String.valueOf(userId) : String.valueOf(us.get(0).get("email"));

        String hash = sha256(id + "|" + numero + "|" + conteudo + "|" + login + "|" + Instant.now());
        try {
            jdbc.update(
                    "INSERT INTO sgsi_documento_assinatura (documento_id, usuario_id, nome, login, versao_numero, hash_sha256) " +
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    id, userId, nome, login, numero, hash);
        } catch (DuplicateKeyException e) {
            throw new IllegalStateException("Você já assinou esta versão do documento.");
        }
        Integer total = jdbc.queryForObject(
                "SELECT COUNT(*) FROM sgsi_documento_assinatura WHERE documento_id = ?", Integer.class, id);
        if (total != null && total == 1) {
            jdbc.update("UPDATE sgsi_documento SET status = 'EM_ASSINATURA', atualizado_em = now() WHERE id = ?", id);
        }
        audit.log("sgsi_documento", id, "UPDATE", userId,
                Map.of("evento", "DOC_ASSINADO", "versao", String.valueOf(numero)), null, null);
        return buscar(id);
    }

    /** Reabre um documento travado (RN-14): invalida (apaga) todas as assinaturas e volta a EM_ELABORACAO. */
    @Transactional
    public Map<String, Object> reabrir(long id, String motivo, Long userId) {
        if (motivo == null || motivo.isBlank()) {
            throw new IllegalArgumentException("motivo é obrigatório");
        }
        Map<String, Object> d = estado(id);
        if (d == null) return null;
        String status = (String) d.get("status");
        if ("PUBLICADO".equals(status)) {
            throw new IllegalStateException("Documento publicado não é reabrível — cancele a emissão e emita novo.");
        }
        if (!STATUS_TRAVADOS.contains(status)) {
            throw new IllegalStateException("Só documentos travados (em assinatura/assinados) podem ser reabertos.");
        }
        String nomes = jdbc.queryForObject(
                "SELECT COALESCE(string_agg(nome, ', '), '') FROM sgsi_documento_assinatura WHERE documento_id = ?",
                String.class, id);
        int invalidadas = jdbc.update("DELETE FROM sgsi_documento_assinatura WHERE documento_id = ?", id);
        jdbc.update("UPDATE sgsi_documento SET status = 'EM_ELABORACAO', atualizado_em = now() WHERE id = ?", id);
        audit.log("sgsi_documento", id, "UPDATE", userId,
                Map.of("evento", "DOC_REABERTO", "motivo", motivo.trim(),
                        "assinaturas_invalidadas", String.valueOf(invalidadas),
                        "signatarios", nomes == null ? "" : nomes), null, null);
        return buscar(id);
    }

    // ─── Tramitação e colaboradores (RN-17) ────────────────────────────────────────────────────

    public List<Map<String, Object>> listarColaboradores(long id) {
        return jdbc.queryForList(
                "SELECT c.usuario_id, u.name AS nome, u.email, c.incluido_em " +
                "FROM sgsi_documento_colaborador c JOIN users u ON u.id = c.usuario_id " +
                "WHERE c.documento_id = ? ORDER BY u.name", id);
    }

    @Transactional
    public Map<String, Object> adicionarColaborador(long id, Long usuarioId, Long incluidoPor) {
        if (usuarioId == null) {
            throw new IllegalArgumentException("usuario_id é obrigatório");
        }
        if (estado(id) == null) {
            return null;
        }
        jdbc.update(
                "INSERT INTO sgsi_documento_colaborador (documento_id, usuario_id, incluido_por) " +
                "VALUES (?, ?, ?) ON CONFLICT (documento_id, usuario_id) DO NOTHING",
                id, usuarioId, incluidoPor);
        audit.log("sgsi_documento", id, "UPDATE", incluidoPor,
                Map.of("evento", "COLABORADOR_INCLUIDO", "usuario", String.valueOf(usuarioId)), null, null);
        return buscar(id);
    }

    @Transactional
    public boolean removerColaborador(long id, long usuarioId, Long userId) {
        boolean ok = jdbc.update(
                "DELETE FROM sgsi_documento_colaborador WHERE documento_id = ? AND usuario_id = ?",
                id, usuarioId) > 0;
        if (ok) {
            audit.log("sgsi_documento", id, "UPDATE", userId,
                    Map.of("evento", "COLABORADOR_REMOVIDO", "usuario", String.valueOf(usuarioId)), null, null);
        }
        return ok;
    }

    public List<Map<String, Object>> listarTramitacoes(long id) {
        return jdbc.queryForList(
                "SELECT tr.id, tr.de_usuario_id, du.name AS de_nome, tr.para_usuario_id, pu.name AS para_nome, " +
                "  tr.despacho, tr.criado_em " +
                "FROM sgsi_documento_tramitacao tr " +
                "LEFT JOIN users du ON du.id = tr.de_usuario_id " +
                "LEFT JOIN users pu ON pu.id = tr.para_usuario_id " +
                "WHERE tr.documento_id = ? ORDER BY tr.criado_em DESC", id);
    }

    /** Tramita o documento: grava o despacho, transfere o titular e libera o checkout (RN-17). */
    @Transactional
    public Map<String, Object> tramitar(long id, Long paraUsuarioId, String despacho, Long deUsuarioId) {
        if (paraUsuarioId == null) {
            throw new IllegalArgumentException("destinatário é obrigatório");
        }
        Map<String, Object> d = estado(id);
        if (d == null) {
            return null;
        }
        exigirNaoTravado(d);
        jdbc.update(
                "INSERT INTO sgsi_documento_tramitacao (documento_id, de_usuario_id, para_usuario_id, despacho) " +
                "VALUES (?, ?, ?, ?)",
                id, deUsuarioId, paraUsuarioId,
                (despacho == null || despacho.isBlank()) ? null : despacho.trim());
        jdbc.update(
                "UPDATE sgsi_documento SET titular_id = ?, checkout_id = NULL, checkout_em = NULL, " +
                "  atualizado_em = now() WHERE id = ?", paraUsuarioId, id);
        audit.log("sgsi_documento", id, "UPDATE", deUsuarioId,
                Map.of("evento", "DOC_TRAMITADO", "para", String.valueOf(paraUsuarioId)), null, null);
        return buscar(id);
    }

    // ---- helpers de workflow ----
    private Map<String, Object> estado(long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT status, checkout_id FROM sgsi_documento WHERE id = ?", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private void exigirNaoTravado(Map<String, Object> d) {
        if (STATUS_TRAVADOS.contains(d.get("status"))) {
            throw new IllegalStateException("Documento travado (em assinatura/assinado/publicado) — conteúdo imutável.");
        }
    }

    private static Long asLong(Object v) {
        return v == null ? null : ((Number) v).longValue();
    }

    private static String sha256(String s) {
        try {
            byte[] dg = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(dg.length * 2);
            for (byte b : dg) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
