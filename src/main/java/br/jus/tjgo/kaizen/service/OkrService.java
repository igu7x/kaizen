package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Porte fiel de okr.service.ts (objectives, key-results, initiatives, programs,
 * program-initiatives, execution-controls) + directorates de okr.ts.
 *
 * Respostas mapeadas em camelCase (igual ao Node). created_at/updated_at vêm como
 * java.sql.Timestamp e são serializados em ISO pelo JacksonConfig.
 */
@Service
@RequiredArgsConstructor
public class OkrService {

    private final JdbcTemplate jdbc;
    private final AuditService audit;

    // ============================================================
    // CÁLCULO DE SITUAÇÃO (paridade com calculateSituation do Node)
    // ============================================================

    private static final Map<String, Integer> MONTH_MAP = new LinkedHashMap<>();

    static {
        MONTH_MAP.put("janeiro", 0);
        MONTH_MAP.put("fevereiro", 1);
        MONTH_MAP.put("março", 2);
        MONTH_MAP.put("marco", 2);
        MONTH_MAP.put("abril", 3);
        MONTH_MAP.put("maio", 4);
        MONTH_MAP.put("junho", 5);
        MONTH_MAP.put("julho", 6);
        MONTH_MAP.put("agosto", 7);
        MONTH_MAP.put("setembro", 8);
        MONTH_MAP.put("outubro", 9);
        MONTH_MAP.put("novembro", 10);
        MONTH_MAP.put("dezembro", 11);
    }

    private static final Pattern NAMED_MONTH = Pattern.compile("([a-zç]+)\\s*[-/]\\s*(\\d{4})");
    private static final Pattern NUMERIC_MONTH = Pattern.compile("(\\d{1,2})\\s*[-/]\\s*(\\d{4})");

    /** new Date(year, month+1, 0) — último dia do mês (month 0-indexado). */
    private static LocalDate parseDeadline(String deadline) {
        if (deadline == null) {
            return null;
        }
        String normalized = deadline.toLowerCase().trim();
        try {
            Matcher named = NAMED_MONTH.matcher(normalized);
            if (named.find()) {
                Integer month = MONTH_MAP.get(named.group(1));
                int year = Integer.parseInt(named.group(2));
                if (month != null) {
                    return YearMonth.of(year, month + 1).atEndOfMonth();
                }
            }
            Matcher numeric = NUMERIC_MONTH.matcher(normalized);
            if (numeric.find()) {
                int month = Integer.parseInt(numeric.group(1)) - 1;
                int year = Integer.parseInt(numeric.group(2));
                if (month >= 0 && month <= 11) {
                    return YearMonth.of(year, month + 1).atEndOfMonth();
                }
            }
        } catch (Exception ignored) {
            return null;
        }
        return null;
    }

    private static String calculateSituation(String status, String deadline) {
        if ("CONCLUIDO".equals(status)) {
            return "FINALIZADO";
        }
        LocalDate deadlineDate = parseDeadline(deadline);
        if (deadlineDate != null && deadlineDate.isBefore(LocalDate.now())) {
            return "EM_ATRASO";
        }
        return "NO_PRAZO";
    }

    // ============================================================
    // HELPERS DE CRUD GENÉRICO (soft delete + audit)
    // ============================================================

    private Map<String, Object> findOne(String table, long id) {
        var rows = jdbc.queryForList(
                "SELECT * FROM " + table + " WHERE id = ? AND is_deleted = FALSE", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private boolean softDelete(String table, long id, Long userId) {
        Map<String, Object> existing = findOne(table, id);
        if (existing == null) {
            return false;
        }
        int affected = jdbc.update(
                "UPDATE " + table + " SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE",
                userId, id);
        if (affected == 0) {
            return false;
        }
        audit.log(table, id, "SOFT_DELETE", userId, null, existing, null);
        return true;
    }

    // ============================================================
    // OBJECTIVES
    // ============================================================

    public List<Map<String, Object>> findAllObjectivesByDirectorate(Long cadastrosAreasId) {
        List<Map<String, Object>> rows;
        if (cadastrosAreasId != null) {
            rows = jdbc.queryForList(
                    "SELECT o.*, a.sigla AS area_sigla, a.nome AS area_nome " +
                            "FROM objectives o LEFT JOIN cadastros_areas a ON o.cadastros_areas_id = a.id " +
                            "WHERE o.is_deleted = FALSE AND o.cadastros_areas_id = ? " +
                            "ORDER BY o.cadastros_areas_id, o.code", cadastrosAreasId);
        } else {
            rows = jdbc.queryForList(
                    "SELECT o.*, a.sigla AS area_sigla, a.nome AS area_nome " +
                            "FROM objectives o LEFT JOIN cadastros_areas a ON o.cadastros_areas_id = a.id " +
                            "WHERE o.is_deleted = FALSE ORDER BY o.cadastros_areas_id, o.code");
        }
        return rows.stream().map(OkrService::toObjectiveDto).toList();
    }

    public Map<String, Object> createObjective(String code, String title, String description,
                                               Long cadastrosAreasId, Long userId) {
        Map<String, Object> obj = jdbc.queryForMap(
                "INSERT INTO objectives (code, title, description, cadastros_areas_id) " +
                        "VALUES (?, ?, ?, ?) RETURNING *",
                code, title, emptyToNull(description), cadastrosAreasId); // Node: data.description || null
        audit.log("objectives", asLong(obj.get("id")), "INSERT", userId, null, null, obj);
        return toObjectiveDto(appendAreaInfo(obj));
    }

    public Map<String, Object> updateObjective(long id, String code, String title, String description,
                                               Long cadastrosAreasId, Long userId) {
        Map<String, Object> existing = findOne("objectives", id);
        if (existing == null) {
            return null;
        }
        var rows = jdbc.queryForList(
                "UPDATE objectives SET code = COALESCE(?, code), title = COALESCE(?, title), " +
                        "description = COALESCE(?, description), cadastros_areas_id = COALESCE(?, cadastros_areas_id), " +
                        "updated_at = NOW() WHERE id = ? AND is_deleted = FALSE RETURNING *",
                code, title, description, cadastrosAreasId, id);
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> obj = rows.get(0);
        audit.log("objectives", id, "UPDATE", userId, null, existing, obj);
        return toObjectiveDto(appendAreaInfo(obj));
    }

    public boolean deleteObjective(long id, Long userId) {
        return softDelete("objectives", id, userId);
    }

    private static Map<String, Object> toObjectiveDto(Map<String, Object> o) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", o.get("id"));
        dto.put("code", o.get("code"));
        dto.put("title", o.get("title"));
        dto.put("description", o.get("description"));
        dto.put("cadastrosAreasId", o.get("cadastros_areas_id"));
        Map<String, Object> area = new LinkedHashMap<>();
        area.put("sigla", o.get("area_sigla"));
        area.put("nome", o.get("area_nome"));
        dto.put("area", area);
        dto.put("createdAt", o.get("created_at"));
        dto.put("updatedAt", o.get("updated_at"));
        return dto;
    }

    // ============================================================
    // KEY RESULTS
    // ============================================================

    public List<Map<String, Object>> findAllKeyResults(Integer objectiveId, Long cadastrosAreasId) {
        StringBuilder sql = new StringBuilder(
                "SELECT kr.*, a.sigla AS area_sigla, a.nome AS area_nome " +
                "FROM key_results kr LEFT JOIN cadastros_areas a ON kr.cadastros_areas_id = a.id " +
                "WHERE kr.is_deleted = FALSE");
        java.util.List<Object> params = new java.util.ArrayList<>();
        if (objectiveId != null) {
            sql.append(" AND kr.objective_id = ?");
            params.add(objectiveId);
        }
        if (cadastrosAreasId != null) {
            sql.append(" AND kr.cadastros_areas_id = ?");
            params.add(cadastrosAreasId);
        }
        sql.append(" ORDER BY kr.objective_id, kr.code");
        var rows = jdbc.queryForList(sql.toString(), params.toArray());
        return rows.stream().map(OkrService::toKeyResultDto).toList();
    }

    public Map<String, Object> createKeyResult(Integer objectiveId, String code, String description,
                                               String status, String deadline, Long cadastrosAreasId,
                                               Long userId) {
        String st = status != null ? status : "NAO_INICIADO";
        String dl = deadline != null ? deadline : "";
        String situation = calculateSituation(st, dl);
        Map<String, Object> kr = jdbc.queryForMap(
                "INSERT INTO key_results (objective_id, code, description, status, situation, deadline, cadastros_areas_id) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *",
                objectiveId, code, description, st, situation, dl, cadastrosAreasId);
        audit.log("key_results", asLong(kr.get("id")), "INSERT", userId, null, null, kr);
        return toKeyResultDto(appendAreaInfo(kr), situation);
    }

    public Map<String, Object> updateKeyResult(long id, String code, String description,
                                               String status, String deadline, Long userId) {
        Map<String, Object> existing = findOne("key_results", id);
        if (existing == null) {
            return null;
        }
        String finalStatus = status != null ? status : (String) existing.get("status");
        String finalDeadline = deadline != null ? deadline : (String) existing.get("deadline");
        String situation = calculateSituation(finalStatus, finalDeadline);
        var rows = jdbc.queryForList(
                "UPDATE key_results SET code = COALESCE(?, code), description = COALESCE(?, description), " +
                        "status = COALESCE(?, status), deadline = COALESCE(?, deadline), situation = ?, " +
                        "updated_at = NOW() WHERE id = ? AND is_deleted = FALSE RETURNING *",
                code, description, status, deadline, situation, id);
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> kr = rows.get(0);
        audit.log("key_results", id, "UPDATE", userId, null, existing, kr);
        return toKeyResultDto(appendAreaInfo(kr), situation);
    }

    public boolean deleteKeyResult(long id, Long userId) {
        return softDelete("key_results", id, userId);
    }

    private static Map<String, Object> toKeyResultDto(Map<String, Object> kr) {
        return toKeyResultDto(kr, calculateSituation((String) kr.get("status"), (String) kr.get("deadline")));
    }

    private static Map<String, Object> toKeyResultDto(Map<String, Object> kr, String situation) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", kr.get("id"));
        dto.put("objectiveId", kr.get("objective_id"));
        dto.put("code", kr.get("code"));
        dto.put("description", kr.get("description"));
        dto.put("status", kr.get("status"));
        dto.put("situation", situation);
        dto.put("deadline", kr.get("deadline"));
        dto.put("cadastrosAreasId", kr.get("cadastros_areas_id"));
        Map<String, Object> area = new LinkedHashMap<>();
        area.put("sigla", kr.get("area_sigla"));
        area.put("nome", kr.get("area_nome"));
        dto.put("area", area);
        dto.put("createdAt", kr.get("created_at"));
        dto.put("updatedAt", kr.get("updated_at"));
        return dto;
    }

    // ============================================================
    // INITIATIVES
    // ============================================================

    public List<Map<String, Object>> findAllInitiatives(Long cadastrosAreasId) {
        List<Map<String, Object>> rows;
        if (cadastrosAreasId != null) {
            rows = jdbc.queryForList(
                    "SELECT i.*, a.sigla AS area_sigla, a.nome AS area_nome " +
                            "FROM initiatives i LEFT JOIN cadastros_areas a ON i.cadastros_areas_id = a.id " +
                            "WHERE i.is_deleted = FALSE AND i.cadastros_areas_id = ? " +
                            "ORDER BY i.cadastros_areas_id, i.location, i.board_status", cadastrosAreasId);
        } else {
            rows = jdbc.queryForList(
                    "SELECT i.*, a.sigla AS area_sigla, a.nome AS area_nome " +
                            "FROM initiatives i LEFT JOIN cadastros_areas a ON i.cadastros_areas_id = a.id " +
                            "WHERE i.is_deleted = FALSE " +
                            "ORDER BY i.cadastros_areas_id, i.location, i.board_status");
        }
        return rows.stream().map(OkrService::toInitiativeDto).toList();
    }

    public Map<String, Object> createInitiative(Object keyResultId, String title, String description,
                                                String boardStatus, String location, Object sprintId,
                                                Long cadastrosAreasId, Long userId) {
        Map<String, Object> init = jdbc.queryForMap(
                "INSERT INTO initiatives (key_result_id, title, description, board_status, location, sprint_id, cadastros_areas_id) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *",
                keyResultId,
                title,
                description != null ? description : "",
                boardStatus != null ? boardStatus : "A_FAZER",
                location != null ? location : "BACKLOG",
                sprintId,
                cadastrosAreasId);
        audit.log("initiatives", asLong(init.get("id")), "INSERT", userId, null, null, init);
        return toInitiativeDto(appendAreaInfo(init));
    }

    public Map<String, Object> updateInitiative(long id, String title, String description,
                                                String boardStatus, String location, Object sprintId,
                                                Long userId) {
        Map<String, Object> existing = findOne("initiatives", id);
        if (existing == null) {
            return null;
        }
        var rows = jdbc.queryForList(
                "UPDATE initiatives SET title = COALESCE(?, title), description = COALESCE(?, description), " +
                        "board_status = COALESCE(?, board_status), location = COALESCE(?, location), " +
                        "sprint_id = COALESCE(?, sprint_id), updated_at = NOW() " +
                        "WHERE id = ? AND is_deleted = FALSE RETURNING *",
                title, description, boardStatus, location, sprintId, id);
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> init = rows.get(0);
        audit.log("initiatives", id, "UPDATE", userId, null, existing, init);
        return toInitiativeDto(appendAreaInfo(init));
    }

    public boolean deleteInitiative(long id, Long userId) {
        return softDelete("initiatives", id, userId);
    }

    private static Map<String, Object> toInitiativeDto(Map<String, Object> init) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", init.get("id"));
        dto.put("keyResultId", init.get("key_result_id"));
        dto.put("title", init.get("title"));
        dto.put("description", init.get("description"));
        dto.put("boardStatus", init.get("board_status"));
        dto.put("location", init.get("location"));
        dto.put("sprintId", init.get("sprint_id"));
        dto.put("cadastrosAreasId", init.get("cadastros_areas_id"));
        Map<String, Object> area = new LinkedHashMap<>();
        area.put("sigla", init.get("area_sigla"));
        area.put("nome", init.get("area_nome"));
        dto.put("area", area);
        dto.put("createdAt", init.get("created_at"));
        dto.put("updatedAt", init.get("updated_at"));
        return dto;
    }

    // ============================================================
    // PROGRAMS
    // ============================================================

    public List<Map<String, Object>> findAllPrograms(Long cadastrosAreasId) {
        List<Map<String, Object>> rows;
        if (cadastrosAreasId != null) {
            rows = jdbc.queryForList(
                    "SELECT p.*, a.sigla AS area_sigla, a.nome AS area_nome " +
                            "FROM programs p LEFT JOIN cadastros_areas a ON p.cadastros_areas_id = a.id " +
                            "WHERE p.is_deleted = FALSE AND p.cadastros_areas_id = ? " +
                            "ORDER BY p.cadastros_areas_id, p.name", cadastrosAreasId);
        } else {
            rows = jdbc.queryForList(
                    "SELECT p.*, a.sigla AS area_sigla, a.nome AS area_nome " +
                            "FROM programs p LEFT JOIN cadastros_areas a ON p.cadastros_areas_id = a.id " +
                            "WHERE p.is_deleted = FALSE ORDER BY p.cadastros_areas_id, p.name");
        }
        return rows.stream().map(OkrService::toProgramDto).toList();
    }

    public Map<String, Object> createProgram(String name, String description, Long cadastrosAreasId, Long userId) {
        Map<String, Object> prog = jdbc.queryForMap(
                "INSERT INTO programs (name, description, cadastros_areas_id) VALUES (?, ?, ?) RETURNING *",
                name, description != null ? description : "", cadastrosAreasId);
        audit.log("programs", asLong(prog.get("id")), "INSERT", userId, null, null, prog);
        return toProgramDto(appendAreaInfo(prog));
    }

    public Map<String, Object> updateProgram(long id, String name, String description, Long userId) {
        Map<String, Object> existing = findOne("programs", id);
        if (existing == null) {
            return null;
        }
        var rows = jdbc.queryForList(
                "UPDATE programs SET name = COALESCE(?, name), description = COALESCE(?, description), " +
                        "updated_at = NOW() WHERE id = ? AND is_deleted = FALSE RETURNING *",
                name, description, id);
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> prog = rows.get(0);
        audit.log("programs", id, "UPDATE", userId, null, existing, prog);
        return toProgramDto(appendAreaInfo(prog));
    }

    public boolean deleteProgram(long id, Long userId) {
        return softDelete("programs", id, userId);
    }

    private static Map<String, Object> toProgramDto(Map<String, Object> prog) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", prog.get("id"));
        dto.put("name", prog.get("name"));
        dto.put("description", prog.get("description"));
        dto.put("cadastrosAreasId", prog.get("cadastros_areas_id"));
        Map<String, Object> area = new LinkedHashMap<>();
        area.put("sigla", prog.get("area_sigla"));
        area.put("nome", prog.get("area_nome"));
        dto.put("area", area);
        dto.put("createdAt", prog.get("created_at"));
        dto.put("updatedAt", prog.get("updated_at"));
        return dto;
    }

    // ============================================================
    // DIRECTORATES (tabela de referência — sem soft delete)
    // ============================================================

    public List<Map<String, Object>> findAllDirectorates() {
        return jdbc.queryForList(
                "SELECT sigla AS code, nome AS name, '' AS description, proad_link " +
                        "FROM cadastros_areas WHERE COALESCE(ativo, TRUE) = TRUE AND sigla IS NOT NULL ORDER BY sigla");
    }

    public Map<String, Object> updateDirectorateProadLink(String code, String proadLink) {
        var rows = jdbc.queryForList(
                "UPDATE cadastros_areas SET proad_link = ? WHERE sigla = ? " +
                        "RETURNING sigla AS code, nome AS name, '' AS description, proad_link",
                proadLink, code);
        return rows.isEmpty() ? null : rows.get(0);
    }

    // ============================================================
    // PROGRAM INITIATIVES
    // ============================================================

    public List<Map<String, Object>> findAllProgramInitiatives() {
        var rows = jdbc.queryForList(
                "SELECT * FROM program_initiatives WHERE is_deleted = FALSE ORDER BY created_at DESC");
        return rows.stream().map(OkrService::toProgramInitiativeDto).toList();
    }

    public Map<String, Object> createProgramInitiative(Object programId, String title, String description,
                                                       String boardStatus, String priority, Long userId) {
        Map<String, Object> init = jdbc.queryForMap(
                "INSERT INTO program_initiatives (program_id, title, description, board_status, priority) " +
                        "VALUES (?, ?, ?, ?, ?) RETURNING *",
                programId, title, description,
                boardStatus != null ? boardStatus : "A_FAZER",
                priority != null ? priority : "NAO");
        audit.log("program_initiatives", asLong(init.get("id")), "INSERT", userId, null, null, init);
        return toProgramInitiativeDto(init);
    }

    public Map<String, Object> updateProgramInitiative(long id, String title, String description,
                                                       String boardStatus, String priority, Long userId) {
        Map<String, Object> existing = findOne("program_initiatives", id);
        if (existing == null) {
            return null;
        }
        var rows = jdbc.queryForList(
                "UPDATE program_initiatives SET title = COALESCE(?, title), description = COALESCE(?, description), " +
                        "board_status = COALESCE(?, board_status), priority = COALESCE(?, priority), " +
                        "updated_at = NOW() WHERE id = ? AND is_deleted = FALSE RETURNING *",
                title, description, boardStatus, priority, id);
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> init = rows.get(0);
        audit.log("program_initiatives", id, "UPDATE", userId, null, existing, init);
        return toProgramInitiativeDto(init);
    }

    public boolean deleteProgramInitiative(long id, Long userId) {
        return softDelete("program_initiatives", id, userId);
    }

    private static Map<String, Object> toProgramInitiativeDto(Map<String, Object> init) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", init.get("id"));
        dto.put("programId", init.get("program_id"));
        dto.put("title", init.get("title"));
        dto.put("description", init.get("description"));
        dto.put("boardStatus", init.get("board_status"));
        dto.put("priority", init.get("priority"));
        dto.put("createdAt", init.get("created_at"));
        return dto;
    }

    // ============================================================
    // EXECUTION CONTROLS
    // ============================================================

    public List<Map<String, Object>> findAllExecutionControls(Long cadastrosAreasId) {
        List<Map<String, Object>> rows;
        if (cadastrosAreasId != null) {
            rows = jdbc.queryForList(
                    "SELECT ec.*, a.sigla AS area_sigla, a.nome AS area_nome " +
                            "FROM execution_controls ec LEFT JOIN cadastros_areas a ON ec.cadastros_areas_id = a.id " +
                            "WHERE ec.is_deleted = FALSE AND ec.cadastros_areas_id = ? " +
                            "ORDER BY ec.ordem_linha, ec.ordem_posicao, ec.created_at DESC", cadastrosAreasId);
        } else {
            rows = jdbc.queryForList(
                    "SELECT ec.*, a.sigla AS area_sigla, a.nome AS area_nome " +
                            "FROM execution_controls ec LEFT JOIN cadastros_areas a ON ec.cadastros_areas_id = a.id " +
                            "WHERE ec.is_deleted = FALSE " +
                            "ORDER BY ec.ordem_linha, ec.ordem_posicao, ec.created_at DESC");
        }
        return rows.stream().map(OkrService::toExecutionControlListDto).toList();
    }

    public Map<String, Object> createExecutionControl(String planProgram, String krProjectInitiative,
                                                      String backlogTasks, String sprintStatus, String sprintTasks,
                                                      String progress, Long cadastrosAreasId, Long userId) {
        Map<String, Object> ctrl = jdbc.queryForMap(
                "INSERT INTO execution_controls (plan_program, kr_project_initiative, backlog_tasks, " +
                        "sprint_status, sprint_tasks, progress, cadastros_areas_id) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *",
                planProgram, krProjectInitiative, backlogTasks, sprintStatus, sprintTasks, progress, cadastrosAreasId);
        audit.log("execution_controls", asLong(ctrl.get("id")), "INSERT", userId, null, null, ctrl);
        return toExecutionControlDto(appendAreaInfo(ctrl));
    }

    public Map<String, Object> updateExecutionControl(long id, String planProgram, String krProjectInitiative,
                                                      String backlogTasks, String sprintStatus, String sprintTasks,
                                                      String progress, Long cadastrosAreasId, Long userId) {
        Map<String, Object> existing = findOne("execution_controls", id);
        if (existing == null) {
            return null;
        }
        var rows = jdbc.queryForList(
                "UPDATE execution_controls SET plan_program = COALESCE(?, plan_program), " +
                        "kr_project_initiative = COALESCE(?, kr_project_initiative), " +
                        "backlog_tasks = COALESCE(?, backlog_tasks), sprint_status = COALESCE(?, sprint_status), " +
                        "sprint_tasks = COALESCE(?, sprint_tasks), progress = COALESCE(?, progress), " +
                        "cadastros_areas_id = COALESCE(?, cadastros_areas_id), updated_at = NOW() " +
                        "WHERE id = ? AND is_deleted = FALSE RETURNING *",
                planProgram, krProjectInitiative, backlogTasks, sprintStatus, sprintTasks, progress, cadastrosAreasId, id);
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> ctrl = rows.get(0);
        audit.log("execution_controls", id, "UPDATE", userId, null, existing, ctrl);
        return toExecutionControlDto(appendAreaInfo(ctrl));
    }

    public boolean deleteExecutionControl(long id, Long userId) {
        return softDelete("execution_controls", id, userId);
    }

    public void updateExecutionControlOrdenacao(List<Map<String, Object>> ordenacao, Long userId) {
        for (Map<String, Object> item : ordenacao) {
            jdbc.update(
                    "UPDATE execution_controls SET ordem_linha = ?, ordem_posicao = ?, updated_at = NOW() " +
                            "WHERE id = ? AND is_deleted = FALSE",
                    item.get("linha"), item.get("posicao"), item.get("id"));
        }
        Map<String, Object> newValues = new LinkedHashMap<>();
        newValues.put("ordenacao_atualizada", ordenacao.size());
        audit.log("execution_controls", 0L, "UPDATE", userId, null, null, newValues);
    }

    /** Resposta de listagem inclui ordemLinha/ordemPosicao (com fallback 0). */
    private static Map<String, Object> toExecutionControlListDto(Map<String, Object> ctrl) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", ctrl.get("id"));
        dto.put("planProgram", ctrl.get("plan_program"));
        dto.put("krProjectInitiative", ctrl.get("kr_project_initiative"));
        dto.put("backlogTasks", ctrl.get("backlog_tasks"));
        dto.put("sprintStatus", ctrl.get("sprint_status"));
        dto.put("sprintTasks", ctrl.get("sprint_tasks"));
        dto.put("progress", ctrl.get("progress"));
        dto.put("cadastrosAreasId", ctrl.get("cadastros_areas_id"));
        Map<String, Object> area = new LinkedHashMap<>();
        area.put("sigla", ctrl.get("area_sigla"));
        area.put("nome", ctrl.get("area_nome"));
        dto.put("area", area);
        dto.put("ordemLinha", ctrl.get("ordem_linha") != null ? ctrl.get("ordem_linha") : 0);
        dto.put("ordemPosicao", ctrl.get("ordem_posicao") != null ? ctrl.get("ordem_posicao") : 0);
        dto.put("createdAt", ctrl.get("created_at"));
        return dto;
    }

    /** Resposta de create/update NÃO inclui ordemLinha/ordemPosicao (paridade Node). */
    private static Map<String, Object> toExecutionControlDto(Map<String, Object> ctrl) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", ctrl.get("id"));
        dto.put("planProgram", ctrl.get("plan_program"));
        dto.put("krProjectInitiative", ctrl.get("kr_project_initiative"));
        dto.put("backlogTasks", ctrl.get("backlog_tasks"));
        dto.put("sprintStatus", ctrl.get("sprint_status"));
        dto.put("sprintTasks", ctrl.get("sprint_tasks"));
        dto.put("progress", ctrl.get("progress"));
        dto.put("cadastrosAreasId", ctrl.get("cadastros_areas_id"));
        Map<String, Object> area = new LinkedHashMap<>();
        area.put("sigla", ctrl.get("area_sigla"));
        area.put("nome", ctrl.get("area_nome"));
        dto.put("area", area);
        dto.put("createdAt", ctrl.get("created_at"));
        return dto;
    }

    private Map<String, Object> appendAreaInfo(Map<String, Object> entity) {
        if (entity.get("cadastros_areas_id") != null) {
            var rows = jdbc.queryForList("SELECT sigla, nome FROM cadastros_areas WHERE id = ?", entity.get("cadastros_areas_id"));
            if (!rows.isEmpty()) {
                entity.put("area_sigla", rows.get(0).get("sigla"));
                entity.put("area_nome", rows.get(0).get("nome"));
            }
        }
        return entity;
    }

    private static Long asLong(Object v) {
        return v == null ? null : ((Number) v).longValue();
    }

    private static String emptyToNull(String s) {
        return (s == null || s.isEmpty()) ? null : s;
    }
}
