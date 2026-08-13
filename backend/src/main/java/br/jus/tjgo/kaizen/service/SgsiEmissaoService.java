package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Livro de Emissões do SGSI — numeração sequencial atômica por série/ano (RN-20), hash de custódia
 * dos metadados + digitalização (RN-22) e a digitalização (PDF) em base64. Número não retorna à
 * sequência: cancelamento é irreversível e exige motivo.
 */
@Service
@RequiredArgsConstructor
public class SgsiEmissaoService {

    private final JdbcTemplate jdbc;

    private static final Set<String> CLASSIFICACOES = Set.of(
            "PUBLICA", "INTERNA", "RESTRITA", "SIGILOSA_CLASSIFICADA");
    private static final long MAX_BYTES = 8L * 1024 * 1024;

    private static final String SELECT_EMISSAO =
            "SELECT e.id, e.numero, e.serie_codigo, s.nome AS serie_nome, e.sequencial, e.ano, " +
            "  e.documento_id, e.titulo, e.tipo, e.instrumento_codigo, " +
            "  i.sigla_oficial AS instrumento_sigla, e.referencia, e.data_emissao, e.autoridade, " +
            "  e.proad, e.classificacao, e.observacoes, e.hash_sha256, e.status, e.cancel_motivo, " +
            "  e.cancel_em, e.emitido_em, (a.emissao_id IS NOT NULL) AS digitalizado, " +
            "  a.nome AS arquivo_nome, a.hash_sha256 AS arquivo_hash " +
            "FROM sgsi_emissao e " +
            "LEFT JOIN sgsi_serie s        ON s.codigo = e.serie_codigo " +
            "LEFT JOIN sgsi_instrumento i  ON i.codigo = e.instrumento_codigo " +
            "LEFT JOIN sgsi_emissao_arquivo a ON a.emissao_id = e.id ";

    public List<Map<String, Object>> listarSeries() {
        return jdbc.queryForList(
                "SELECT codigo, nome, prefixo, mascara, digitos, reinicia, orgao, ativa " +
                "FROM sgsi_serie ORDER BY nome");
    }

    public List<Map<String, Object>> listarEmissoes() {
        return jdbc.queryForList(SELECT_EMISSAO + " ORDER BY e.emitido_em DESC");
    }

    public Map<String, Object> buscar(long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(SELECT_EMISSAO + " WHERE e.id = ?", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    @Transactional
    public Map<String, Object> emitir(Map<String, Object> b, Long userId) {
        String serieCodigo = req(b, "serie_codigo", "série");
        String titulo = req(b, "titulo", "título");
        String autoridade = req(b, "autoridade", "autoridade");
        String classificacao = str(b.get("classificacao"));
        if (classificacao == null) classificacao = "INTERNA";
        if (!CLASSIFICACOES.contains(classificacao)) {
            throw new IllegalArgumentException("classificação inválida");
        }

        // Trava a série para serializar a numeração (RN-20).
        List<Map<String, Object>> series = jdbc.queryForList(
                "SELECT prefixo, mascara, digitos, reinicia FROM sgsi_serie WHERE codigo = ? FOR UPDATE",
                serieCodigo);
        if (series.isEmpty()) {
            throw new IllegalArgumentException("série inválida");
        }
        Map<String, Object> serie = series.get(0);

        LocalDate dataEmissao = parseData(str(b.get("data_emissao")));
        int ano = dataEmissao.getYear();
        boolean porAno = "ANO".equals(serie.get("reinicia"));
        Integer maxSeq = porAno
                ? jdbc.queryForObject("SELECT COALESCE(MAX(sequencial),0) FROM sgsi_emissao WHERE serie_codigo=? AND ano=?",
                        Integer.class, serieCodigo, ano)
                : jdbc.queryForObject("SELECT COALESCE(MAX(sequencial),0) FROM sgsi_emissao WHERE serie_codigo=?",
                        Integer.class, serieCodigo);
        int seq = (maxSeq == null ? 0 : maxSeq) + 1;
        int digitos = ((Number) serie.get("digitos")).intValue();
        String numero = formatarNumero((String) serie.get("mascara"), (String) serie.get("prefixo"), seq, digitos, ano);

        String hash = sha256(canonico(numero, serieCodigo, seq, ano, titulo, dataEmissao.toString(),
                autoridade, classificacao, str(b.get("proad")), str(b.get("referencia")), null));

        Long id = jdbc.queryForObject(
                "INSERT INTO sgsi_emissao (numero, serie_codigo, sequencial, ano, documento_id, titulo, " +
                "  tipo, instrumento_codigo, referencia, data_emissao, autoridade, proad, classificacao, " +
                "  observacoes, hash_sha256, emitido_por) " +
                "VALUES (?,?,?,?,?,?,?,?,?,?::date,?,?,?,?,?,?) RETURNING id",
                Long.class,
                numero, serieCodigo, seq, ano, optLong(b.get("documento_id")), titulo,
                str(b.get("tipo")), str(b.get("instrumento_codigo")), str(b.get("referencia")),
                dataEmissao.toString(), autoridade, str(b.get("proad")), classificacao,
                str(b.get("observacoes")), hash, userId);
        return buscar(id);
    }

    /** Anexa/atualiza a digitalização (PDF base64). Recalcula o hash de custódia com o hash do arquivo. */
    @Transactional
    public Map<String, Object> anexarDigitalizacao(long emissaoId, String nome, String mime,
                                                   String conteudoBase64, Long userId) {
        List<Map<String, Object>> ems = jdbc.queryForList(
                "SELECT numero, serie_codigo, sequencial, ano, titulo, data_emissao, autoridade, " +
                "  classificacao, proad, referencia, status FROM sgsi_emissao WHERE id = ?", emissaoId);
        if (ems.isEmpty()) {
            return null;
        }
        Map<String, Object> e = ems.get(0);
        if ("CANCELADO".equals(e.get("status"))) {
            throw new IllegalArgumentException("emissão cancelada não pode receber digitalização");
        }
        if (conteudoBase64 == null || conteudoBase64.isBlank()) {
            throw new IllegalArgumentException("arquivo é obrigatório");
        }
        byte[] bytes = decodeBase64(conteudoBase64);
        if (bytes.length == 0 || bytes.length > MAX_BYTES) {
            throw new IllegalArgumentException("arquivo deve ter entre 1 byte e 8 MB");
        }
        String fileHash = sha256(bytes);

        jdbc.update(
                "INSERT INTO sgsi_emissao_arquivo (emissao_id, nome, mime, tamanho_bytes, hash_sha256, conteudo_base64, anexado_por) " +
                "VALUES (?,?,?,?,?,?,?) " +
                "ON CONFLICT (emissao_id) DO UPDATE SET nome=EXCLUDED.nome, mime=EXCLUDED.mime, " +
                "  tamanho_bytes=EXCLUDED.tamanho_bytes, hash_sha256=EXCLUDED.hash_sha256, " +
                "  conteudo_base64=EXCLUDED.conteudo_base64, anexado_por=EXCLUDED.anexado_por, anexado_em=now()",
                emissaoId, nome == null ? "documento.pdf" : nome, mime == null ? "application/pdf" : mime,
                (long) bytes.length, fileHash, conteudoBase64, userId);

        String novoHash = sha256(canonico(
                (String) e.get("numero"), (String) e.get("serie_codigo"),
                ((Number) e.get("sequencial")).intValue(), ((Number) e.get("ano")).intValue(),
                (String) e.get("titulo"), String.valueOf(e.get("data_emissao")),
                (String) e.get("autoridade"), (String) e.get("classificacao"),
                (String) e.get("proad"), (String) e.get("referencia"), fileHash));
        jdbc.update("UPDATE sgsi_emissao SET hash_sha256 = ? WHERE id = ?", novoHash, emissaoId);
        return buscar(emissaoId);
    }

    public Map<String, Object> getDigitalizacao(long emissaoId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT nome, mime, conteudo_base64 FROM sgsi_emissao_arquivo WHERE emissao_id = ?", emissaoId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    @Transactional
    public Map<String, Object> cancelar(long emissaoId, String motivo, Long userId) {
        if (motivo == null || motivo.isBlank()) {
            throw new IllegalArgumentException("motivo do cancelamento é obrigatório");
        }
        int n = jdbc.update(
                "UPDATE sgsi_emissao SET status='CANCELADO', cancel_motivo=?, cancel_por=?, cancel_em=now() " +
                "WHERE id=? AND status='EMITIDO'",
                motivo.trim(), userId, emissaoId);
        if (n == 0) {
            // ou não existe, ou já estava cancelada
            return buscar(emissaoId);
        }
        return buscar(emissaoId);
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

    private static Long optLong(Object v) {
        if (v == null || String.valueOf(v).isBlank()) return null;
        try {
            return Long.parseLong(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static LocalDate parseData(String s) {
        if (s == null) return LocalDate.now();
        try {
            return LocalDate.parse(s.substring(0, 10));
        } catch (RuntimeException e) {
            return LocalDate.now();
        }
    }

    private static String formatarNumero(String mascara, String prefixo, int seq, int digitos, int ano) {
        String seqStr = String.format("%0" + digitos + "d", seq);
        return mascara.replace("{PFX}", prefixo)
                .replace("{SEQ}", seqStr)
                .replace("{ANO}", String.valueOf(ano));
    }

    private static String canonico(String numero, String serie, int seq, int ano, String titulo,
                                   String data, String autoridade, String classificacao,
                                   String proad, String referencia, String fileHash) {
        return String.join("|", numero, serie, String.valueOf(seq), String.valueOf(ano),
                nvl(titulo), nvl(data), nvl(autoridade), nvl(classificacao),
                nvl(proad), nvl(referencia), nvl(fileHash));
    }

    private static String nvl(String s) {
        return s == null ? "" : s;
    }

    private static byte[] decodeBase64(String conteudo) {
        String base64 = conteudo;
        int i = base64.indexOf("base64,");
        if (i >= 0) base64 = base64.substring(i + 7);
        try {
            return Base64.getDecoder().decode(base64.replaceAll("\\s", ""));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("arquivo base64 inválido");
        }
    }

    private static String sha256(byte[] b) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(b);
            StringBuilder sb = new StringBuilder(d.length * 2);
            for (byte x : d) sb.append(String.format("%02x", x));
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static String sha256(String s) {
        return sha256(s.getBytes(StandardCharsets.UTF_8));
    }
}
