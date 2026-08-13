package br.jus.tjgo.kaizen.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Relatórios do SGSI. O {@link #listarCatalogo()} expõe os modelos que a instituição deve produzir
 * (9ª fatia). A EMISSÃO EFETIVA (13ª fatia) consome um número da série REL — reusando a numeração
 * atômica de {@link SgsiEmissaoService} — e grava um RETRATO IMUTÁVEL dos indicadores no instante da
 * emissão (RN-37): reabrir depois mostra sempre os números de então, nunca recalcula.
 */
@Service
@RequiredArgsConstructor
public class SgsiRelatorioService {

    private final JdbcTemplate jdbc;
    private final SgsiEmissaoService emissoes;
    private static final ObjectMapper JSON = new ObjectMapper();

    private static final String SERIE_RELATORIO = "REL";

    public List<Map<String, Object>> listarCatalogo() {
        return jdbc.queryForList(
                "SELECT c.codigo, c.nome, c.obrigatorio, c.periodicidade, c.destinatario, " +
                "  c.base_normativa, c.instrumento_codigo, i.sigla_oficial AS instrumento_sigla, c.ordem " +
                "FROM sgsi_relatorio_catalogo c " +
                "LEFT JOIN sgsi_instrumento i ON i.codigo = c.instrumento_codigo " +
                "ORDER BY c.ordem");
    }

    /** Relatórios já emitidos (metadados; o snapshot vem em {@link #buscar}). */
    public List<Map<String, Object>> listarEmitidos() {
        return jdbc.queryForList(
                "SELECT r.id, r.numero, r.catalogo_codigo, c.nome AS catalogo_nome, c.obrigatorio, " +
                "  r.titulo, r.periodo, r.destinatario, r.observacoes, r.hash_sha256, r.data_emissao, " +
                "  e.status AS emissao_status " +
                "FROM sgsi_relatorio r " +
                "JOIN sgsi_relatorio_catalogo c ON c.codigo = r.catalogo_codigo " +
                "LEFT JOIN sgsi_emissao e ON e.numero = r.numero " +
                "ORDER BY r.data_emissao DESC, r.id DESC");
    }

    public Map<String, Object> buscar(long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT r.id, r.numero, r.catalogo_codigo, c.nome AS catalogo_nome, r.titulo, r.periodo, " +
                "  r.destinatario, r.observacoes, r.hash_sha256, r.data_emissao, r.conteudo::text AS conteudo, " +
                "  e.status AS emissao_status " +
                "FROM sgsi_relatorio r " +
                "JOIN sgsi_relatorio_catalogo c ON c.codigo = r.catalogo_codigo " +
                "LEFT JOIN sgsi_emissao e ON e.numero = r.numero " +
                "WHERE r.id = ?", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * Pendência anual (RN-36): modelos obrigatórios (R01–R17) sem nenhum relatório emitido no ano corrente.
     * A periodicidade declarada é informativa no V4.4 — a verificação é sempre anual.
     */
    public List<Map<String, Object>> pendencias() {
        int ano = LocalDate.now().getYear();
        return jdbc.queryForList(
                "SELECT c.codigo, c.nome, c.periodicidade, c.destinatario, c.instrumento_codigo, " +
                "  i.sigla_oficial AS instrumento_sigla " +
                "FROM sgsi_relatorio_catalogo c " +
                "LEFT JOIN sgsi_instrumento i ON i.codigo = c.instrumento_codigo " +
                "WHERE c.obrigatorio = true " +
                "  AND NOT EXISTS (SELECT 1 FROM sgsi_relatorio r " +
                "                  WHERE r.catalogo_codigo = c.codigo " +
                "                    AND EXTRACT(YEAR FROM r.data_emissao) = ?) " +
                "ORDER BY c.ordem", ano);
    }

    /**
     * Emite um relatório: aloca número na série REL (cria a emissão correspondente), congela o retrato
     * dos indicadores e grava com hash de custódia. Participa da mesma transação da emissão — atômico.
     */
    @Transactional
    public Map<String, Object> emitir(Map<String, Object> b, Long userId) {
        String catalogoCodigo = str(b.get("catalogo_codigo"));
        if (catalogoCodigo == null) {
            throw new IllegalArgumentException("catalogo_codigo é obrigatório");
        }
        List<Map<String, Object>> cats = jdbc.queryForList(
                "SELECT codigo, nome, destinatario, instrumento_codigo FROM sgsi_relatorio_catalogo WHERE codigo = ?",
                catalogoCodigo);
        if (cats.isEmpty()) {
            throw new IllegalArgumentException("modelo de relatório inexistente");
        }
        Map<String, Object> cat = cats.get(0);

        String periodo = str(b.get("periodo"));
        String titulo = str(b.get("titulo"));
        if (titulo == null) {
            titulo = (String) cat.get("nome") + (periodo != null ? " — " + periodo : "");
        }
        String destinatario = str(b.get("destinatario"));
        if (destinatario == null) destinatario = (String) cat.get("destinatario");
        String autoridade = str(b.get("autoridade"));
        if (autoridade == null) {
            throw new IllegalArgumentException("autoridade é obrigatória");
        }

        // Retrato imutável dos indicadores (RN-37), congelado agora.
        String conteudoJson = snapshotIndicadores();

        // Aloca número da série REL criando a emissão correspondente (mesma trilha das Emissões, RN-20/22).
        java.util.Map<String, Object> emissaoBody = new java.util.HashMap<>();
        emissaoBody.put("serie_codigo", SERIE_RELATORIO);
        emissaoBody.put("titulo", titulo);
        emissaoBody.put("autoridade", autoridade);
        emissaoBody.put("tipo", "RELATORIO");
        emissaoBody.put("instrumento_codigo", cat.get("instrumento_codigo"));
        emissaoBody.put("referencia", catalogoCodigo);
        emissaoBody.put("classificacao", str(b.get("classificacao")));
        emissaoBody.put("data_emissao", str(b.get("data_emissao")));
        Map<String, Object> emissao = emissoes.emitir(emissaoBody, userId);
        String numero = (String) emissao.get("numero");

        String hash = sha256(String.join("|",
                nvl(numero), nvl(catalogoCodigo), nvl(periodo), nvl(conteudoJson)));

        Long id = jdbc.queryForObject(
                "INSERT INTO sgsi_relatorio (numero, catalogo_codigo, titulo, periodo, destinatario, " +
                "  conteudo, observacoes, hash_sha256, emitido_por) " +
                "VALUES (?,?,?,?,?,?::jsonb,?,?,?) RETURNING id",
                Long.class,
                numero, catalogoCodigo, titulo, periodo, destinatario,
                conteudoJson, str(b.get("observacoes")), hash, userId);
        return buscar(id);
    }

    /** Congela o estado atual dos indicadores (código/nome/meta/última medição) como JSON. */
    private String snapshotIndicadores() {
        List<Map<String, Object>> indicadores = jdbc.queryForList(
                "SELECT ind.id, ind.nome, ind.unidade, ind.meta, ind.tolerancia, ind.direcao, " +
                "  ind.frequencia, i.sigla_oficial AS instrumento_sigla, " +
                "  m.competencia, m.valor " +
                "FROM sgsi_indicador ind " +
                "LEFT JOIN sgsi_instrumento i ON i.codigo = ind.instrumento_codigo " +
                "LEFT JOIN LATERAL (SELECT competencia, valor FROM sgsi_medicao " +
                "                   WHERE indicador_id = ind.id ORDER BY competencia DESC LIMIT 1) m ON true " +
                "WHERE ind.ativo = true " +
                "ORDER BY i.sigla_oficial NULLS LAST, ind.nome");
        try {
            return JSON.writeValueAsString(Map.of(
                    "gerado_em", LocalDate.now().toString(),
                    "indicadores", indicadores));
        } catch (Exception e) {
            throw new RuntimeException("falha ao serializar o retrato dos indicadores", e);
        }
    }

    // ---- helpers ----
    private static String str(Object v) {
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        return s.isEmpty() ? null : s;
    }

    private static String nvl(String s) {
        return s == null ? "" : s;
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
