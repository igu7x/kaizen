package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.jus.tjgo.kaizen.utils.DateHelper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de planos-programas.service.ts. Rotas públicas.
 * Insere/atualiza em cadastros_instrumentos_planejamento; lê via vw_cadastros_instrumentos_completo.
 * Mantém as checagens de coluna (hasColumn) do Node para colunas opcionais.
 */
@Service
@RequiredArgsConstructor
public class PlanosProgramasService {

    private final JdbcTemplate jdbc;
    private final DomainService domainService;

    private boolean hasColumn(String tableName, String columnName) {
        return !jdbc.queryForList(
                "SELECT 1 FROM information_schema.columns WHERE table_name = ? AND column_name = ? LIMIT 1",
                tableName, columnName).isEmpty();
    }

    // ============================================================
    // INSTRUMENTOS DE PLANEJAMENTO
    // ============================================================

    public List<Map<String, Object>> getAllInstrumentos(String diretoria) {
        var checkColumns = jdbc.queryForList(
                "SELECT column_name FROM information_schema.columns " +
                        "WHERE table_name = 'cadastros_instrumentos_planejamento' " +
                        "AND column_name IN ('ordem_linha', 'ordem_posicao')");
        boolean hasOrdenacao = checkColumns.size() == 2;

        StringBuilder sql = new StringBuilder(
                "SELECT * FROM vw_cadastros_instrumentos_completo WHERE ativo = true");
        List<Object> params = new ArrayList<>();

        if (diretoria != null) {
            var domain = domainService.getDomainForDiretoria(diretoria);
            if (domain.isDomainRoot()) {
                List<Integer> areaIds = jdbc.queryForList(
                        "SELECT id FROM cadastros_areas WHERE sigla = ANY(?::text[]) AND ativo IS NOT FALSE",
                        Integer.class, textArray(domain.diretoriasInDomain()));
                params.add(textArray(domain.diretoriasInDomain()));
                params.add(intArray(areaIds.isEmpty() ? List.of(0) : areaIds));
                sql.append(" AND (diretoria = ANY(?::text[]) OR areas_vinculadas_ids && ?::int[])");
            } else {
                List<Integer> areaRows = jdbc.queryForList(
                        "SELECT id FROM cadastros_areas WHERE sigla = ? AND ativo = TRUE", Integer.class, diretoria);
                if (!areaRows.isEmpty()) {
                    params.add(diretoria);
                    params.add(areaRows.get(0));
                    sql.append(" AND (diretoria = ? OR ? = ANY(COALESCE(areas_vinculadas_ids, '{}')))");
                } else {
                    params.add(diretoria);
                    sql.append(" AND diretoria = ?");
                }
            }
        }

        sql.append(hasOrdenacao
                ? " ORDER BY COALESCE(ordem_linha, 0), COALESCE(ordem_posicao, 0), nome"
                : " ORDER BY nome");

        var rows = jdbc.queryForList(sql.toString(), params.toArray());
        for (Map<String, Object> row : rows) {
            if (row.get("ordem_linha") == null) {
                row.put("ordem_linha", 0);
            }
            if (row.get("ordem_posicao") == null) {
                row.put("ordem_posicao", 0);
            }
        }
        return rows;
    }

    public Map<String, Object> getInstrumentoById(long id) {
        var rows = jdbc.queryForList(
                "SELECT * FROM vw_cadastros_instrumentos_completo WHERE id = ?", id);
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> instrumento = new LinkedHashMap<>(rows.get(0));

        boolean hasAreasVinculadas = hasColumn("contratos_projetos", "areas_vinculadas_ids");
        boolean hasSigla = hasColumn("cadastros_areas", "sigla");
        String colunaExpressao = hasSigla
                ? "ca.sigla"
                : "COALESCE(SUBSTRING(ca.nome FROM '\\(([^)]+)\\)'), ca.nome)";

        String projetosQuery;
        if (hasAreasVinculadas) {
            projetosQuery = "SELECT vp.id, vp.projeto_id, p.codigo AS projeto_codigo, p.nome AS projeto_nome, " +
                    "p.status AS projeto_status, p.gestor_nome AS projeto_gestor_nome, " +
                    "COALESCE((SELECT STRING_AGG(" + colunaExpressao + ", ', ') FROM cadastros_areas ca " +
                    "WHERE ca.id = ANY(cp.areas_vinculadas_ids)), p.diretoria) AS projeto_diretorias " +
                    "FROM cadastros_instrumentos_projetos vp " +
                    "JOIN vw_contratos_projetos_completo p ON p.id = vp.projeto_id " +
                    "JOIN contratos_projetos cp ON cp.id = vp.projeto_id " +
                    "WHERE vp.instrumento_id = ? ORDER BY p.nome";
        } else {
            projetosQuery = "SELECT vp.id, vp.projeto_id, p.codigo AS projeto_codigo, p.nome AS projeto_nome, " +
                    "p.status AS projeto_status, p.gestor_nome AS projeto_gestor_nome, " +
                    "p.diretoria AS projeto_diretorias " +
                    "FROM cadastros_instrumentos_projetos vp " +
                    "JOIN vw_contratos_projetos_completo p ON p.id = vp.projeto_id " +
                    "WHERE vp.instrumento_id = ? ORDER BY p.nome";
        }

        instrumento.put("projetos", jdbc.queryForList(projetosQuery, id));
        instrumento.put("instrumentos_subordinados", jdbc.queryForList(
                "SELECT * FROM vw_cadastros_instrumentos_completo WHERE instrumento_superior_id = ? ORDER BY nome", id));
        return instrumento;
    }

    @Transactional
    public Map<String, Object> createInstrumento(Map<String, Object> data) {
        boolean hasAreasVinculadas = hasColumn("cadastros_instrumentos_planejamento", "areas_vinculadas_ids");

        List<String> cols = new ArrayList<>(List.of(
                "nome", "tipo", "objetivo", "periodo_vigencia_inicio", "periodo_vigencia_fim",
                "ambito_institucional", "responsavel_institucional", "instrumento_superior_id",
                "documento_formalizacao", "versao", "historico_alteracoes", "observacoes_gerais", "diretoria"));
        List<String> placeholders = new ArrayList<>(List.of("?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?"));
        List<Object> values = new ArrayList<>();
        values.add(data.get("nome"));
        values.add(falsy(data.get("tipo"), "plano"));
        values.add(falsyToNull(data.get("objetivo")));
        values.add(DateHelper.toSqlDate(data.get("periodo_vigencia_inicio")));
        values.add(DateHelper.toSqlDate(data.get("periodo_vigencia_fim")));
        values.add(falsyToNull(data.get("ambito_institucional")));
        values.add(falsyToNull(data.get("responsavel_institucional")));
        values.add(falsyToNull(data.get("instrumento_superior_id")));
        values.add(falsyToNull(data.get("documento_formalizacao")));
        values.add(falsy(data.get("versao"), "v1.0"));
        values.add(falsyToNull(data.get("historico_alteracoes")));
        values.add(falsyToNull(data.get("observacoes_gerais")));
        values.add(falsy(data.get("diretoria"), "SGJT"));

        if (hasAreasVinculadas) {
            cols.add("areas_vinculadas_ids");
            placeholders.add("?::int[]");
            values.add(intArray(asIdList(data.get("areas_vinculadas_ids"))));
        }

        Map<String, Object> inserted = jdbc.queryForMap(
                "INSERT INTO cadastros_instrumentos_planejamento (" + String.join(", ", cols) + ") " +
                        "VALUES (" + String.join(", ", placeholders) + ") RETURNING id",
                values.toArray());
        long newId = ((Number) inserted.get("id")).longValue();

        List<Object> projetosIds = asIdList(data.get("projetos_ids"));
        for (Object projetoId : projetosIds) {
            jdbc.update(
                    "INSERT INTO cadastros_instrumentos_projetos (instrumento_id, projeto_id) " +
                            "VALUES (?, ?) ON CONFLICT DO NOTHING", newId, projetoId);
        }

        return getInstrumentoById(newId);
    }

    @Transactional
    public Map<String, Object> updateInstrumento(long id, Map<String, Object> data) {
        boolean hasAreasVinculadas = hasColumn("cadastros_instrumentos_planejamento", "areas_vinculadas_ids");

        List<String> sets = new ArrayList<>(List.of(
                "nome = COALESCE(?, nome)",
                "tipo = COALESCE(?, tipo)",
                "objetivo = ?",
                "periodo_vigencia_inicio = ?",
                "periodo_vigencia_fim = ?",
                "ambito_institucional = ?",
                "responsavel_institucional = ?",
                "instrumento_superior_id = ?",
                "documento_formalizacao = ?",
                "versao = COALESCE(?, versao)",
                "historico_alteracoes = ?",
                "observacoes_gerais = ?",
                "diretoria = COALESCE(?, diretoria)"));
        List<Object> values = new ArrayList<>();
        values.add(data.get("nome"));
        values.add(data.get("tipo"));
        values.add(falsyToNull(data.get("objetivo")));
        values.add(DateHelper.toSqlDate(data.get("periodo_vigencia_inicio")));
        values.add(DateHelper.toSqlDate(data.get("periodo_vigencia_fim")));
        values.add(falsyToNull(data.get("ambito_institucional")));
        values.add(falsyToNull(data.get("responsavel_institucional")));
        values.add(falsyToNull(data.get("instrumento_superior_id")));
        values.add(falsyToNull(data.get("documento_formalizacao")));
        values.add(data.get("versao"));
        values.add(falsyToNull(data.get("historico_alteracoes")));
        values.add(falsyToNull(data.get("observacoes_gerais")));
        values.add(data.get("diretoria"));

        if (hasAreasVinculadas) {
            sets.add("areas_vinculadas_ids = COALESCE(?::int[], areas_vinculadas_ids)");
            values.add(data.containsKey("areas_vinculadas_ids") && data.get("areas_vinculadas_ids") != null
                    ? intArray(asIdList(data.get("areas_vinculadas_ids"))) : null);
        }

        values.add(id);
        jdbc.update(
                "UPDATE cadastros_instrumentos_planejamento SET " + String.join(", ", sets) +
                        " WHERE id = ?", values.toArray());

        if (data.containsKey("projetos_ids")) {
            jdbc.update("DELETE FROM cadastros_instrumentos_projetos WHERE instrumento_id = ?", id);
            for (Object projetoId : asIdList(data.get("projetos_ids"))) {
                jdbc.update(
                        "INSERT INTO cadastros_instrumentos_projetos (instrumento_id, projeto_id) " +
                                "VALUES (?, ?) ON CONFLICT DO NOTHING", id, projetoId);
            }
        }

        return getInstrumentoById(id);
    }

    public void deleteInstrumento(long id) {
        jdbc.update("UPDATE cadastros_instrumentos_planejamento SET ativo = FALSE WHERE id = ?", id);
    }

    public List<Map<String, Object>> getInstrumentosParaAncoragem(String diretoria) {
        StringBuilder sql = new StringBuilder(
                "SELECT id, nome, tipo FROM cadastros_instrumentos_planejamento WHERE ativo = TRUE");
        List<Object> params = new ArrayList<>();

        if (diretoria != null) {
            var domain = domainService.getDomainForDiretoria(diretoria);
            if (domain.isDomainRoot()) {
                List<Integer> areaIds = jdbc.queryForList(
                        "SELECT id FROM cadastros_areas WHERE sigla = ANY(?::text[]) AND ativo IS NOT FALSE",
                        Integer.class, textArray(domain.diretoriasInDomain()));
                params.add(textArray(domain.diretoriasInDomain()));
                params.add(intArray(areaIds.isEmpty() ? List.of(0) : areaIds));
                sql.append(" AND (diretoria = ANY(?::text[]) OR areas_vinculadas_ids && ?::int[])");
            } else {
                List<Integer> areaRows = jdbc.queryForList(
                        "SELECT id FROM cadastros_areas WHERE sigla = ? AND ativo = TRUE", Integer.class, diretoria);
                if (!areaRows.isEmpty()) {
                    params.add(diretoria);
                    params.add(areaRows.get(0));
                    sql.append(" AND (diretoria = ? OR ? = ANY(COALESCE(areas_vinculadas_ids, '{}')))");
                } else {
                    params.add(diretoria);
                    sql.append(" AND diretoria = ?");
                }
            }
        }

        sql.append(" ORDER BY nome");
        return jdbc.queryForList(sql.toString(), params.toArray());
    }

    @Transactional
    public void atualizarOrdenacao(List<Map<String, Object>> ordenacao) {
        var checkColumns = jdbc.queryForList(
                "SELECT column_name FROM information_schema.columns " +
                        "WHERE table_name = 'cadastros_instrumentos_planejamento' " +
                        "AND column_name IN ('ordem_linha', 'ordem_posicao')");
        if (checkColumns.size() < 2) {
            return; // falha silenciosa (paridade Node)
        }
        for (Map<String, Object> item : ordenacao) {
            jdbc.update(
                    "UPDATE cadastros_instrumentos_planejamento " +
                            "SET ordem_linha = ?, ordem_posicao = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    item.get("linha"), item.get("posicao"), item.get("id"));
        }
    }

    // ============================================================
    // HELPERS
    // ============================================================

    private static String textArray(List<String> dirs) {
        return "{" + String.join(",", dirs) + "}";
    }

    private static String intArray(List<?> ids) {
        StringBuilder sb = new StringBuilder("{");
        for (int i = 0; i < ids.size(); i++) {
            if (i > 0) {
                sb.append(",");
            }
            sb.append(ids.get(i));
        }
        return sb.append("}").toString();
    }

    @SuppressWarnings("unchecked")
    private static List<Object> asIdList(Object v) {
        if (v instanceof List) {
            return new ArrayList<>((List<Object>) v);
        }
        return new ArrayList<>();
    }

    /** JS `data.x || fallback` — converte null/''/0 no fallback. */
    private static Object falsy(Object v, Object fallback) {
        Object r = falsyToNull(v);
        return r == null ? fallback : r;
    }

    /** JS `data.x || null` — null/''/0/false → null. */
    private static Object falsyToNull(Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof String s) {
            return s.isEmpty() ? null : s;
        }
        if (v instanceof Number n) {
            return n.doubleValue() == 0 ? null : v;
        }
        if (v instanceof Boolean b) {
            return b ? v : null;
        }
        return v;
    }
}
