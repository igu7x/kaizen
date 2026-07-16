package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de gestao-estrategica.service.ts. GET público; mutations com authorize(['ADMIN']).
 * userId vem do header X-User-Id (pode ser null).
 *
 * NOTA DE FIDELIDADE: getAllPlanos/getPlanoById leem de cadastros_instrumentos_planejamento,
 * mas create/update/deletePlano gravam em instrumentos_planejamento — divergência herdada do Node,
 * replicada propositalmente.
 */
@Service
@RequiredArgsConstructor
public class GestaoEstrategicaService {

    private final JdbcTemplate jdbc;
    private final DomainService domainService;

    // ============================================================
    // PLANOS/PROGRAMAS
    // ============================================================

    public List<Map<String, Object>> getAllPlanos(Long cadastrosAreasId) {
        StringBuilder sql = new StringBuilder(
                "SELECT ip.id, ip.nome, ip.cadastros_areas_id, ip.tipo, ip.ativo, " +
                        "ip.created_at, ip.updated_at, ip.created_by, ip.updated_by, ip.areas_vinculadas_ids, " +
                        "TRUE as is_instrumento " +
                        "FROM cadastros_instrumentos_planejamento ip WHERE ip.ativo = TRUE");
        List<Object> params = new ArrayList<>();

        if (cadastrosAreasId != null) {
            var domain = domainService.getDomainForArea(cadastrosAreasId);
            if (domain.isDomainRoot()) {
                List<Long> areaIds = domain.areasIdInDomain();
                params.add(intArray(areaIds.isEmpty() ? List.of(0L) : areaIds));
                params.add(intArray(areaIds.isEmpty() ? List.of(0L) : areaIds));
                sql.append(" AND (ip.cadastros_areas_id = ANY(?::int[]) OR ip.areas_vinculadas_ids && ?::int[])");
            } else {
                params.add(cadastrosAreasId);
                params.add(cadastrosAreasId);
                sql.append(" AND (ip.cadastros_areas_id = ? OR ? = ANY(COALESCE(ip.areas_vinculadas_ids, '{}')))");
            }
        }
        sql.append(" ORDER BY ip.nome");
        return jdbc.queryForList(sql.toString(), params.toArray());
    }

    public Map<String, Object> getPlanoById(long id) {
        var rows = jdbc.queryForList(
                "SELECT id, nome, cadastros_areas_id, tipo, ativo, " +
                        "created_at, updated_at, created_by, updated_by, TRUE as is_instrumento " +
                        "FROM cadastros_instrumentos_planejamento WHERE id = ? AND ativo = TRUE", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> getPlanoComProjetos(long planoId) {
        Map<String, Object> plano = getPlanoById(planoId);
        if (plano == null) {
            return null;
        }
        var projetosRows = jdbc.queryForList(
                "SELECT id, nome, plano_id, instrumento_id, ativo, created_at, updated_at, created_by, updated_by " +
                        "FROM gestao_krs_projetos WHERE instrumento_id = ? AND ativo = TRUE ORDER BY nome", planoId);

        List<Map<String, Object>> projetos = new ArrayList<>();
        for (Map<String, Object> projeto : projetosRows) {
            var tarefas = jdbc.queryForList(
                    "SELECT id, nome, projeto_id, status, progresso, ativo, ordem, created_at, updated_at, created_by, updated_by " +
                            "FROM gestao_tarefas WHERE projeto_id = ? AND ativo = TRUE ORDER BY COALESCE(ordem, 0), id",
                    projeto.get("id"));

            int total = tarefas.size();
            int backlog = (int) tarefas.stream().filter(t -> {
                String s = (String) t.get("status");
                return "sprint_atual".equals(s) || "fora_sprint".equals(s) || "concluida".equals(s);
            }).count();
            int concluido = (int) tarefas.stream().filter(t -> "concluida".equals(t.get("status"))).count();
            int aFazer = (int) tarefas.stream().filter(t -> "a_fazer".equals(t.get("progresso"))).count();
            int fazendo = (int) tarefas.stream().filter(t -> "fazendo".equals(t.get("progresso"))).count();
            int progressoConcluido = (int) tarefas.stream().filter(t -> "feito".equals(t.get("progresso"))).count();
            int percentual = total > 0 ? (int) Math.round((double) progressoConcluido / total * 100) : 0;

            Map<String, Object> estatisticas = new LinkedHashMap<>();
            estatisticas.put("total", total);
            estatisticas.put("backlog", backlog);
            estatisticas.put("concluido", concluido);
            estatisticas.put("a_fazer", aFazer);
            estatisticas.put("fazendo", fazendo);
            estatisticas.put("progresso_concluido", progressoConcluido);
            estatisticas.put("percentual_concluido", percentual);

            Map<String, Object> p = new LinkedHashMap<>(projeto);
            p.put("tarefas", tarefas);
            p.put("estatisticas", estatisticas);
            projetos.add(p);
        }

        Map<String, Object> out = new LinkedHashMap<>(plano);
        out.put("projetos", projetos);
        return out;
    }

    public Map<String, Object> createPlano(String nome, Long cadastrosAreasId, Long userId) {
        Map<String, Object> row = jdbc.queryForMap(
                "INSERT INTO instrumentos_planejamento (nome, tipo, cadastros_areas_id, created_by, updated_by) " +
                        "VALUES (?, 'plano', ?, ?, ?) " +
                        "RETURNING id, nome, cadastros_areas_id, tipo, ativo, created_at, updated_at, created_by, updated_by",
                nome, cadastrosAreasId, userId, userId);
        Map<String, Object> out = new LinkedHashMap<>(row);
        out.put("is_instrumento", true);
        return out;
    }

    public Map<String, Object> updatePlano(long id, String nome, Long userId) {
        // Apenas nome é atualizável (diretoria não é coluna em instrumentos_planejamento — Node ignora).
        if (nome == null) {
            return null;
        }
        var rows = jdbc.queryForList(
                "UPDATE instrumentos_planejamento SET nome = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND ativo = TRUE " +
                        "RETURNING id, nome, cadastros_areas_id, tipo, ativo, created_at, updated_at, created_by, updated_by",
                nome, userId, id);
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> out = new LinkedHashMap<>(rows.get(0));
        out.put("is_instrumento", true);
        return out;
    }

    public boolean deletePlano(long id, Long userId) {
        return jdbc.update(
                "UPDATE instrumentos_planejamento SET ativo = FALSE, updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND ativo = TRUE", userId, id) > 0;
    }

    // ============================================================
    // KRs/PROJETOS
    // ============================================================

    public List<Map<String, Object>> getAllProjetos(Integer planoId) {
        String sql = "SELECT p.id, p.nome, p.plano_id, p.instrumento_id, ip.nome as instrumento_nome, p.ativo, " +
                "p.created_at, p.updated_at, p.created_by, p.updated_by " +
                "FROM gestao_krs_projetos p " +
                "LEFT JOIN instrumentos_planejamento ip ON ip.id = p.instrumento_id " +
                "WHERE p.ativo = TRUE";
        if (planoId != null) {
            return jdbc.queryForList(sql + " AND p.instrumento_id = ? ORDER BY ip.nome, p.nome", planoId);
        }
        return jdbc.queryForList(sql + " ORDER BY ip.nome, p.nome");
    }

    public Map<String, Object> getProjetoById(long id) {
        var rows = jdbc.queryForList(
                "SELECT p.id, p.nome, p.plano_id, p.instrumento_id, ip.nome as instrumento_nome, p.ativo, " +
                        "p.created_at, p.updated_at, p.created_by, p.updated_by " +
                        "FROM gestao_krs_projetos p " +
                        "LEFT JOIN instrumentos_planejamento ip ON ip.id = p.instrumento_id " +
                        "WHERE p.id = ? AND p.ativo = TRUE", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> createProjeto(String nome, Object planoId, Object instrumentoId, Long userId) {
        Map<String, Object> row = jdbc.queryForMap(
                "INSERT INTO gestao_krs_projetos (nome, plano_id, instrumento_id, created_by, updated_by) " +
                        "VALUES (?, ?, ?, ?, ?) " +
                        "RETURNING id, nome, plano_id, instrumento_id, ativo, created_at, updated_at, created_by, updated_by",
                nome, planoId, instrumentoId, userId, userId);
        Object instrumentoNome = null;
        if (instrumentoId != null) {
            instrumentoNome = lookupNome("instrumentos_planejamento", instrumentoId);
        }
        Map<String, Object> out = new LinkedHashMap<>(row);
        out.put("instrumento_nome", instrumentoNome);
        return out;
    }

    public Map<String, Object> updateProjeto(long id, String nome, Long userId) {
        if (nome == null) {
            return null;
        }
        var rows = jdbc.queryForList(
                "UPDATE gestao_krs_projetos SET nome = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND ativo = TRUE " +
                        "RETURNING id, nome, plano_id, instrumento_id, ativo, created_at, updated_at, created_by, updated_by",
                nome, userId, id);
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> row = rows.get(0);
        Object instrumentoNome = null;
        if (row.get("instrumento_id") != null) {
            instrumentoNome = lookupNome("instrumentos_planejamento", row.get("instrumento_id"));
        }
        Map<String, Object> out = new LinkedHashMap<>(row);
        out.put("instrumento_nome", instrumentoNome);
        return out;
    }

    public boolean deleteProjeto(long id, Long userId) {
        return jdbc.update(
                "UPDATE gestao_krs_projetos SET ativo = FALSE, updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND ativo = TRUE", userId, id) > 0;
    }

    // ============================================================
    // TAREFAS
    // ============================================================

    public List<Map<String, Object>> getAllTarefas(Integer projetoId) {
        String sql = "SELECT t.id, t.nome, t.projeto_id, p.nome as projeto_nome, t.status, t.progresso, t.ativo, " +
                "t.created_at, t.updated_at, t.created_by, t.updated_by " +
                "FROM gestao_tarefas t INNER JOIN gestao_krs_projetos p ON p.id = t.projeto_id " +
                "WHERE t.ativo = TRUE AND p.ativo = TRUE";
        if (projetoId != null) {
            return jdbc.queryForList(sql + " AND t.projeto_id = ? ORDER BY t.id", projetoId);
        }
        return jdbc.queryForList(sql + " ORDER BY t.id");
    }

    public Map<String, Object> getTarefaById(long id) {
        var rows = jdbc.queryForList(
                "SELECT t.id, t.nome, t.projeto_id, p.nome as projeto_nome, t.status, t.progresso, t.ativo, " +
                        "t.created_at, t.updated_at, t.created_by, t.updated_by " +
                        "FROM gestao_tarefas t INNER JOIN gestao_krs_projetos p ON p.id = t.projeto_id " +
                        "WHERE t.id = ? AND t.ativo = TRUE", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> createTarefa(String nome, Object projetoId, Long userId) {
        Map<String, Object> row = jdbc.queryForMap(
                "INSERT INTO gestao_tarefas (nome, projeto_id, status, progresso, created_by, updated_by) " +
                        "VALUES (?, ?, 'fora_sprint', 'a_fazer', ?, ?) " +
                        "RETURNING id, nome, projeto_id, status, progresso, ativo, created_at, updated_at, created_by, updated_by",
                nome, projetoId, userId, userId);
        Object projetoNome = lookupNome("gestao_krs_projetos", projetoId);
        Map<String, Object> out = new LinkedHashMap<>(row);
        out.put("projeto_nome", projetoNome);
        return out;
    }

    public Map<String, Object> updateTarefa(long id, String nome, String status, String progresso, Long userId) {
        List<String> sets = new ArrayList<>();
        List<Object> values = new ArrayList<>();
        if (nome != null) {
            sets.add("nome = ?");
            values.add(nome);
        }
        if (status != null) {
            sets.add("status = ?");
            values.add(status);
        }
        if (progresso != null) {
            sets.add("progresso = ?");
            values.add(progresso);
        }
        if (sets.isEmpty()) {
            return null;
        }
        sets.add("updated_at = CURRENT_TIMESTAMP");
        sets.add("updated_by = ?");
        values.add(userId);
        values.add(id);

        var rows = jdbc.queryForList(
                "UPDATE gestao_tarefas SET " + String.join(", ", sets) +
                        " WHERE id = ? AND ativo = TRUE " +
                        "RETURNING id, nome, projeto_id, status, progresso, ativo, created_at, updated_at, created_by, updated_by",
                values.toArray());
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> row = rows.get(0);
        Object projetoNome = lookupNome("gestao_krs_projetos", row.get("projeto_id"));
        Map<String, Object> out = new LinkedHashMap<>(row);
        out.put("projeto_nome", projetoNome);
        return out;
    }

    public boolean deleteTarefa(long id, Long userId) {
        return jdbc.update(
                "UPDATE gestao_tarefas SET ativo = FALSE, updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND ativo = TRUE", userId, id) > 0;
    }

    public void updateOrdenacaoTarefas(List<Map<String, Object>> ordenacao, Long userId) {
        for (Map<String, Object> item : ordenacao) {
            jdbc.update(
                    "UPDATE gestao_tarefas SET ordem = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                            "WHERE id = ? AND ativo = TRUE",
                    item.get("ordem"), userId, item.get("id"));
        }
    }

    // ============================================================
    // ESTATÍSTICAS
    // ============================================================

    public Map<String, Object> getEstatisticasPorDiretoria(Long cadastrosAreasId) {
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT COUNT(DISTINCT p.id) AS total_planos, COUNT(DISTINCT pr.id) AS total_projetos, " +
                        "COUNT(t.id) AS total_tarefas, " +
                        "COUNT(t.id) FILTER (WHERE t.status = 'backlog') AS backlog, " +
                        "COUNT(t.id) FILTER (WHERE t.status = 'concluido') AS status_concluido, " +
                        "COUNT(t.id) FILTER (WHERE t.progresso = 'a_fazer') AS a_fazer, " +
                        "COUNT(t.id) FILTER (WHERE t.progresso = 'fazendo') AS fazendo, " +
                        "COUNT(t.id) FILTER (WHERE t.progresso = 'concluido') AS progresso_concluido " +
                        "FROM gestao_planos_programas p " +
                        "LEFT JOIN gestao_krs_projetos pr ON pr.plano_id = p.id AND pr.ativo = TRUE " +
                        "LEFT JOIN gestao_tarefas t ON t.projeto_id = pr.id AND t.ativo = TRUE " +
                        "WHERE p.ativo = TRUE AND (p.cadastros_areas_id = ? OR ? IS NULL)", cadastrosAreasId, cadastrosAreasId);

        Map<String, Object> tarefasPorStatus = new LinkedHashMap<>();
        tarefasPorStatus.put("backlog", toInt(row.get("backlog")));
        tarefasPorStatus.put("concluido", toInt(row.get("status_concluido")));

        Map<String, Object> tarefasPorProgresso = new LinkedHashMap<>();
        tarefasPorProgresso.put("a_fazer", toInt(row.get("a_fazer")));
        tarefasPorProgresso.put("fazendo", toInt(row.get("fazendo")));
        tarefasPorProgresso.put("concluido", toInt(row.get("progresso_concluido")));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total_planos", toInt(row.get("total_planos")));
        out.put("total_projetos", toInt(row.get("total_projetos")));
        out.put("total_tarefas", toInt(row.get("total_tarefas")));
        out.put("tarefas_por_status", tarefasPorStatus);
        out.put("tarefas_por_progresso", tarefasPorProgresso);
        return out;
    }

    // ============================================================
    // HELPERS
    // ============================================================

    private Object lookupNome(String table, Object id) {
        var rows = jdbc.queryForList("SELECT nome FROM " + table + " WHERE id = ?", id);
        return rows.isEmpty() ? null : rows.get(0).get("nome");
    }

    private static int toInt(Object v) {
        return v == null ? 0 : ((Number) v).intValue();
    }

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
}
