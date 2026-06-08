package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de sprints.service.ts. Todas as rotas públicas.
 *
 * Bug #4 (JAVA_BUGS_TO_AVOID): comparações com colunas date usam cast ?::date
 * (o placeholder JDBC chega como text e o Postgres rejeita "date < text").
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SprintsService {

    private final JdbcTemplate jdbc;
    private final DomainService domainService;

    // ============================================================
    // LISTAGENS
    // ============================================================

    public List<Map<String, Object>> listarTodosSprints() {
        var rows = jdbc.queryForList(
                "SELECT id, numero, nome, data_inicio, data_fim, status, ativo " +
                        "FROM sprints WHERE ativo = TRUE ORDER BY numero");
        List<Map<String, Object>> out = new ArrayList<>(rows.size());
        for (Map<String, Object> row : rows) {
            Map<String, Object> m = new LinkedHashMap<>(row);
            m.put("tarefas_planejadas", 0);
            m.put("tarefas_concluidas", 0);
            m.put("tarefas_remanejadas", 0);
            m.put("progresso", 0);
            out.add(m);
        }
        return out;
    }

    public List<Map<String, Object>> getSprintsComTarefas(Integer projetoId, Integer entregaId, String diretoria) {
        List<String> tCond = new ArrayList<>(List.of("t.ativo = TRUE", "t.sprint_id IS NOT NULL"));
        List<String> rCond = new ArrayList<>(List.of("t.ativo = TRUE", "t.remanejada_de_sprint_id IS NOT NULL"));
        List<Object> filterParams = new ArrayList<>();

        if (entregaId != null) {
            tCond.add("t.entrega_id = ?");
            rCond.add("t.entrega_id = ?");
            filterParams.add(entregaId);
        } else if (projetoId != null) {
            tCond.add("e.projeto_id = ?");
            rCond.add("e.projeto_id = ?");
            filterParams.add(projetoId);
        }

        if (diretoria != null) {
            var domain = domainService.getDomainForDiretoria(diretoria);
            if (domain.isDomainRoot()) {
                tCond.add("p.diretoria = ANY(?::text[])");
                rCond.add("p.diretoria = ANY(?::text[])");
                filterParams.add(textArray(domain.diretoriasInDomain()));
            } else {
                tCond.add("p.diretoria = ?");
                rCond.add("p.diretoria = ?");
                filterParams.add(diretoria);
            }
        }

        String sql = "SELECT s.id, s.numero, s.nome, s.data_inicio, s.data_fim, s.status, s.ativo, " +
                "(COALESCE(tarefas.total, 0) + COALESCE(remanejadas.total, 0))::integer as tarefas_planejadas, " +
                "COALESCE(tarefas.concluidas, 0)::integer as tarefas_concluidas, " +
                "COALESCE(remanejadas.total, 0)::integer as tarefas_remanejadas, " +
                "CASE WHEN (COALESCE(tarefas.total, 0) + COALESCE(remanejadas.total, 0)) = 0 THEN 0 " +
                "ELSE ROUND((COALESCE(tarefas.concluidas, 0)::numeric / (COALESCE(tarefas.total, 0) + COALESCE(remanejadas.total, 0))::numeric) * 100)::integer END as progresso " +
                "FROM sprints s " +
                "LEFT JOIN ( " +
                "  SELECT t.sprint_id, COUNT(DISTINCT t.id)::integer as total, " +
                "  COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'feito')::integer as concluidas " +
                "  FROM cadastros_projetos_entregas_tarefas t " +
                "  INNER JOIN cadastros_projetos_entregas e ON t.entrega_id = e.id " +
                "  INNER JOIN cadastros_projetos p ON e.projeto_id = p.id " +
                "  WHERE " + String.join(" AND ", tCond) +
                "  GROUP BY t.sprint_id " +
                ") tarefas ON tarefas.sprint_id = s.id " +
                "LEFT JOIN ( " +
                "  SELECT t.remanejada_de_sprint_id, COUNT(DISTINCT t.id)::integer as total " +
                "  FROM cadastros_projetos_entregas_tarefas t " +
                "  INNER JOIN cadastros_projetos_entregas e ON t.entrega_id = e.id " +
                "  INNER JOIN cadastros_projetos p ON e.projeto_id = p.id " +
                "  WHERE " + String.join(" AND ", rCond) +
                "  GROUP BY t.remanejada_de_sprint_id " +
                ") remanejadas ON remanejadas.remanejada_de_sprint_id = s.id " +
                "WHERE s.ativo = TRUE ORDER BY s.numero";

        List<Object> params = new ArrayList<>(filterParams.size() * 2);
        params.addAll(filterParams); // subquery tarefas
        params.addAll(filterParams); // subquery remanejadas
        return jdbc.queryForList(sql, params.toArray());
    }

    public Map<String, Object> getSprintById(long id, Integer projetoId, Integer entregaId) {
        var sprintRows = jdbc.queryForList(
                "SELECT id, numero, nome, data_inicio, data_fim, status, ativo " +
                        "FROM sprints WHERE id = ? AND ativo = TRUE", id);
        if (sprintRows.isEmpty()) {
            return null;
        }
        Map<String, Object> sprint = sprintRows.get(0);

        List<String> conds = new ArrayList<>(List.of("t.ativo = TRUE", "t.sprint_id = ?"));
        List<Object> params = new ArrayList<>();
        params.add(id);
        if (entregaId != null) {
            conds.add("t.entrega_id = ?");
            params.add(entregaId);
        } else if (projetoId != null) {
            conds.add("e.projeto_id = ?");
            params.add(projetoId);
        }

        var tarefas = jdbc.queryForList(
                "SELECT t.id, t.nome, t.responsavel, t.status, t.entrega_id, e.nome as entrega_nome, " +
                        "p.id as projeto_id, p.nome as projeto_nome " +
                        "FROM cadastros_projetos_entregas_tarefas t " +
                        "INNER JOIN cadastros_projetos_entregas e ON t.entrega_id = e.id " +
                        "INNER JOIN cadastros_projetos p ON e.projeto_id = p.id " +
                        "WHERE " + String.join(" AND ", conds) + " ORDER BY t.ordem, t.id",
                params.toArray());

        int planejadas = tarefas.size();
        int concluidas = (int) tarefas.stream().filter(t -> "feito".equals(t.get("status"))).count();
        int progresso = planejadas > 0 ? (int) Math.round((double) concluidas / planejadas * 100) : 0;

        Map<String, Object> out = new LinkedHashMap<>(sprint);
        out.put("tarefas_planejadas", planejadas);
        out.put("tarefas_concluidas", concluidas);
        out.put("progresso", progresso);
        out.put("tarefas", tarefas);
        return out;
    }

    // ============================================================
    // ATUALIZAÇÃO AUTOMÁTICA DE STATUS
    // ============================================================

    public Map<String, Object> atualizarStatusSprints() {
        String hoje = LocalDate.now().toString(); // yyyy-MM-dd
        List<String> detalhes = new ArrayList<>();
        int totalAtualizados = 0;

        // 1. Sprints que passaram da data fim e não estão concluídas → encerrada (+ remanejamento)
        var paraEncerrar = jdbc.queryForList(
                "SELECT id, numero, nome FROM sprints " +
                        "WHERE ativo = TRUE AND status NOT IN ('encerrada', 'encerrado', 'concluida') " +
                        "AND data_fim < ?::date ORDER BY numero",
                hoje);

        for (Map<String, Object> sprintEncerrada : paraEncerrar) {
            Object encId = sprintEncerrada.get("id");
            Number numero = (Number) sprintEncerrada.get("numero");
            String encNome = (String) sprintEncerrada.get("nome");

            var proximaRows = jdbc.queryForList(
                    "SELECT id, nome FROM sprints WHERE ativo = TRUE AND numero = ?", numero.intValue() + 1);

            if (!proximaRows.isEmpty()) {
                Map<String, Object> proxima = proximaRows.get(0);
                var remanejadas = jdbc.queryForList(
                        "UPDATE cadastros_projetos_entregas_tarefas " +
                                "SET sprint_id = ?, remanejada_de_sprint_id = ?, " +
                                "nome = CASE WHEN nome NOT LIKE '%(remanejada)%' THEN nome || ' (remanejada)' ELSE nome END, " +
                                "updated_at = NOW() " +
                                "WHERE ativo = TRUE AND sprint_id = ? AND status != 'feito' " +
                                "RETURNING id, nome",
                        proxima.get("id"), encId, encId);
                if (!remanejadas.isEmpty()) {
                    detalhes.add(remanejadas.size() + " tarefa(s) remanejada(s) de \"" + encNome +
                            "\" para \"" + proxima.get("nome") + "\"");
                }
            } else {
                log.warn("[SprintsService] Não encontrou próxima sprint (numero={}) para remanejar tarefas",
                        numero.intValue() + 1);
            }

            jdbc.update("UPDATE sprints SET status = 'encerrada', updated_at = NOW() WHERE id = ?", encId);
            totalAtualizados++;
            detalhes.add("Sprint \"" + encNome + "\" encerrada (passou da data limite)");
        }

        // 2. Iniciar sprints cuja data de início chegou
        var iniciadas = jdbc.queryForList(
                "UPDATE sprints SET status = 'em_andamento', updated_at = NOW() " +
                        "WHERE ativo = TRUE AND status = 'nao_iniciado' " +
                        "AND data_inicio <= ?::date AND data_fim >= ?::date RETURNING id, nome",
                hoje, hoje);
        for (Map<String, Object> row : iniciadas) {
            totalAtualizados++;
            detalhes.add("Sprint \"" + row.get("nome") + "\" iniciada (data de início atingida)");
        }

        // 3. Verificar sprints em_andamento/concluida → concluir ou reabrir baseado nas tarefas
        var paraVerificar = jdbc.queryForList(
                "SELECT s.id, s.nome, s.status FROM sprints s " +
                        "WHERE s.ativo = TRUE AND s.status IN ('em_andamento', 'concluida')");
        for (Map<String, Object> sprint : paraVerificar) {
            Object sid = sprint.get("id");
            String status = (String) sprint.get("status");
            Map<String, Object> contagem = jdbc.queryForMap(
                    "SELECT COUNT(t.id)::integer as total, " +
                            "COUNT(t.id) FILTER (WHERE t.status = 'feito')::integer as concluidas " +
                            "FROM cadastros_projetos_entregas_tarefas t " +
                            "WHERE t.ativo = TRUE AND t.sprint_id = ?", sid);
            int total = ((Number) contagem.get("total")).intValue();
            int concluidas = ((Number) contagem.get("concluidas")).intValue();

            if (total > 0 && total == concluidas && !"concluida".equals(status)) {
                jdbc.update("UPDATE sprints SET status = 'concluida', updated_at = NOW() WHERE id = ?", sid);
                totalAtualizados++;
                detalhes.add("Sprint \"" + sprint.get("nome") + "\" concluída (todas " + total + " tarefas finalizadas)");
            } else if ("concluida".equals(status) && (total == 0 || total != concluidas)) {
                jdbc.update("UPDATE sprints SET status = 'em_andamento', updated_at = NOW() WHERE id = ?", sid);
                totalAtualizados++;
                detalhes.add("Sprint \"" + sprint.get("nome") + "\" voltou para Em Andamento (" +
                        concluidas + "/" + total + " tarefas concluídas)");
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("atualizados", totalAtualizados);
        out.put("detalhes", detalhes);
        return out;
    }

    // ============================================================
    // ESTATÍSTICAS
    // ============================================================

    public Map<String, Object> getEstatisticas(Integer projetoId, Integer entregaId, String diretoria) {
        var sprints = getSprintsComTarefas(projetoId, entregaId, diretoria);
        int totalSprints = sprints.size();
        int sprintsComTarefas = 0;
        int totalTarefas = 0;
        int tarefasConcluidas = 0;
        for (Map<String, Object> s : sprints) {
            int planejadas = ((Number) s.get("tarefas_planejadas")).intValue();
            int concluidas = ((Number) s.get("tarefas_concluidas")).intValue();
            if (planejadas > 0) {
                sprintsComTarefas++;
            }
            totalTarefas += planejadas;
            tarefasConcluidas += concluidas;
        }
        int progressoGeral = totalTarefas > 0 ? (int) Math.round((double) tarefasConcluidas / totalTarefas * 100) : 0;

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total_sprints", totalSprints);
        out.put("sprints_com_tarefas", sprintsComTarefas);
        out.put("total_tarefas", totalTarefas);
        out.put("tarefas_concluidas", tarefasConcluidas);
        out.put("progresso_geral", progressoGeral);
        return out;
    }

    // ============================================================
    // DIAGNÓSTICO / DEBUG (counts ::text → string, paridade pg bigint)
    // ============================================================

    public Map<String, Object> getDiagnostico(Integer sprintId, Integer tarefaId) {
        Map<String, Object> diagnostico = new LinkedHashMap<>();
        diagnostico.put("timestamp", Instant.now());
        diagnostico.put("resumo", jdbc.queryForMap(
                "SELECT " +
                        "(SELECT COUNT(*)::text FROM sprints WHERE ativo = TRUE) as total_sprints, " +
                        "(SELECT COUNT(*)::text FROM cadastros_projetos_entregas_tarefas WHERE ativo = TRUE) as total_tarefas, " +
                        "(SELECT COUNT(*)::text FROM cadastros_projetos_entregas_tarefas WHERE ativo = TRUE AND sprint_id IS NOT NULL) as tarefas_com_sprint, " +
                        "(SELECT COUNT(*)::text FROM cadastros_projetos_entregas_tarefas WHERE ativo = TRUE AND sprint_id IS NULL) as tarefas_sem_sprint"));

        diagnostico.put("sprints_com_tarefas", jdbc.queryForList(
                "SELECT s.id as sprint_id, s.numero, s.nome, s.status, " +
                        "COUNT(t.id)::text as total_tarefas, " +
                        "COUNT(t.id) FILTER (WHERE t.status = 'feito')::text as tarefas_concluidas " +
                        "FROM sprints s " +
                        "LEFT JOIN cadastros_projetos_entregas_tarefas t ON t.sprint_id = s.id AND t.ativo = TRUE " +
                        "WHERE s.ativo = TRUE GROUP BY s.id, s.numero, s.nome, s.status " +
                        "HAVING COUNT(t.id) > 0 ORDER BY s.numero LIMIT 20"));

        if (sprintId != null) {
            diagnostico.put("tarefas_do_sprint", jdbc.queryForList(
                    "SELECT t.id, t.nome, t.status, t.sprint_id, t.entrega_id, t.ativo, t.created_at, t.updated_at, " +
                            "e.nome as entrega_nome, e.ativo as entrega_ativa, " +
                            "p.id as projeto_id, p.nome as projeto_nome, p.ativo as projeto_ativo " +
                            "FROM cadastros_projetos_entregas_tarefas t " +
                            "LEFT JOIN cadastros_projetos_entregas e ON t.entrega_id = e.id " +
                            "LEFT JOIN cadastros_projetos p ON e.projeto_id = p.id " +
                            "WHERE t.sprint_id = ? ORDER BY t.created_at DESC LIMIT 50", sprintId));
        }

        if (tarefaId != null) {
            var rows = jdbc.queryForList(
                    "SELECT t.*, e.nome as entrega_nome, e.ativo as entrega_ativa, " +
                            "p.id as projeto_id, p.nome as projeto_nome, p.ativo as projeto_ativo, " +
                            "s.nome as sprint_nome, s.numero as sprint_numero, s.status as sprint_status " +
                            "FROM cadastros_projetos_entregas_tarefas t " +
                            "LEFT JOIN cadastros_projetos_entregas e ON t.entrega_id = e.id " +
                            "LEFT JOIN cadastros_projetos p ON e.projeto_id = p.id " +
                            "LEFT JOIN sprints s ON t.sprint_id = s.id WHERE t.id = ?", tarefaId);
            diagnostico.put("tarefa_detalhes", rows.isEmpty() ? null : rows.get(0));
        }

        diagnostico.put("ultimas_tarefas_modificadas", jdbc.queryForList(
                "SELECT t.id, t.nome, t.status, t.sprint_id, t.ativo, t.created_at, t.updated_at, s.nome as sprint_nome " +
                        "FROM cadastros_projetos_entregas_tarefas t " +
                        "LEFT JOIN sprints s ON t.sprint_id = s.id " +
                        "ORDER BY GREATEST(t.created_at, t.updated_at) DESC LIMIT 10"));

        return diagnostico;
    }

    public Map<String, Object> getDebug() {
        String totalSprints = jdbc.queryForObject(
                "SELECT COUNT(*)::text FROM sprints WHERE ativo = TRUE", String.class);
        String totalTarefasComSprint = jdbc.queryForObject(
                "SELECT COUNT(*)::text FROM cadastros_projetos_entregas_tarefas WHERE sprint_id IS NOT NULL AND ativo = TRUE",
                String.class);
        var tarefasPorSprint = jdbc.queryForList(
                "SELECT sprint_id, COUNT(*)::text as count FROM cadastros_projetos_entregas_tarefas " +
                        "WHERE sprint_id IS NOT NULL AND ativo = TRUE GROUP BY sprint_id ORDER BY sprint_id");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total_sprints", totalSprints);
        out.put("total_tarefas_com_sprint", totalTarefasComSprint);
        out.put("tarefas_por_sprint", tarefasPorSprint);
        return out;
    }

    private static String textArray(List<String> dirs) {
        return "{" + String.join(",", dirs) + "}";
    }
}
