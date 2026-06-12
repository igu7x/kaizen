package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.service.OkrService;
import br.jus.tjgo.kaizen.util.PgErrors;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Porte fiel de okr.ts. Montado em /api (igual ao Node: app.use('/api', okrRouter)).
 * Categoria A — userId via requestUserId() (fallback 1). objectives/key-results/metas
 * usam authorize(['ADMIN']); demais mutations são públicas (paridade Node).
 */
@Tag(name = "OKR", description = "Objetivos, Key Results, iniciativas, programas, diretorias e controles de execução (montado em /api).")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class OkrController {

    private final OkrService okrService;

    private Long currentUserId() {
        return AuthContext.requestUserId();
    }

    // ============================================================
    // OBJECTIVES
    // ============================================================

    @GetMapping("/objectives")
    public List<Map<String, Object>> listObjectives(@RequestParam(value = "directorate", required = false) String directorate) {
        return okrService.findAllObjectivesByDirectorate(directorate);
    }

    @PostMapping("/objectives")
    public ResponseEntity<?> createObjective(@RequestBody Map<String, Object> body) {
        AuthContext.requireRole(List.of("ADMIN")); // middleware authorize roda antes do handler
        String code = str(body.get("code"));
        String title = str(body.get("title"));
        String directorate = str(body.get("directorate"));
        if (code == null || title == null || directorate == null) {
            return ResponseEntity.status(400).body(Map.of("error", "Campos obrigatórios: code, title, directorate"));
        }
        try {
            Map<String, Object> objective = okrService.createObjective(
                    code, title, str(body.get("description")), directorate, currentUserId());
            return ResponseEntity.status(HttpStatus.CREATED).body(objective);
        } catch (DataAccessException e) {
            if (PgErrors.is(e, "23505")) {
                return ResponseEntity.status(409).body(Map.of("error", "Código já existe para esta diretoria"));
            }
            throw e;
        }
    }

    @PutMapping("/objectives/{id:\\d+}")
    public ResponseEntity<?> updateObjective(@PathVariable long id, @RequestBody Map<String, Object> body) {
        AuthContext.requireRole(List.of("ADMIN"));
        Map<String, Object> objective = okrService.updateObjective(
                id, str(body.get("code")), str(body.get("title")), str(body.get("description")),
                str(body.get("directorate")), currentUserId());
        if (objective == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Objetivo não encontrado"));
        }
        return ResponseEntity.ok(objective);
    }

    @DeleteMapping("/objectives/{id:\\d+}")
    public ResponseEntity<?> deleteObjective(@PathVariable long id) {
        AuthContext.requireRole(List.of("ADMIN"));
        if (!okrService.deleteObjective(id, currentUserId())) {
            return ResponseEntity.status(404).body(Map.of("error", "Objetivo não encontrado"));
        }
        return ResponseEntity.ok(java.util.Collections.singletonMap("success", true));
    }

    // ============================================================
    // KEY RESULTS
    // ============================================================

    @GetMapping("/key-results")
    public List<Map<String, Object>> listKeyResults(@RequestParam(value = "objectiveId", required = false) Integer objectiveId,
                                                    @RequestParam(value = "directorate", required = false) String directorate) {
        return okrService.findAllKeyResults(objectiveId, directorate);
    }

    @PostMapping("/key-results")
    public ResponseEntity<?> createKeyResult(@RequestBody Map<String, Object> body) {
        AuthContext.requireRole(List.of("ADMIN")); // middleware authorize roda antes do handler
        Integer objectiveId = asInt(body.get("objectiveId"));
        String code = str(body.get("code"));
        String description = str(body.get("description"));
        String directorate = str(body.get("directorate"));
        if (objectiveId == null || code == null || description == null || directorate == null) {
            return ResponseEntity.status(400).body(Map.of("error",
                    "Campos obrigatórios: objectiveId, code, description, directorate"));
        }
        try {
            Map<String, Object> kr = okrService.createKeyResult(
                    objectiveId, code, description,
                    body.get("status") != null ? str(body.get("status")) : "NAO_INICIADO",
                    body.get("deadline") != null ? str(body.get("deadline")) : "",
                    directorate, currentUserId());
            return ResponseEntity.status(HttpStatus.CREATED).body(kr);
        } catch (DataAccessException e) {
            if (PgErrors.is(e, "23503")) {
                return ResponseEntity.status(404).body(Map.of("error", "Objetivo não encontrado"));
            }
            throw e;
        }
    }

    @PutMapping("/key-results/{id:\\d+}")
    public ResponseEntity<?> updateKeyResult(@PathVariable long id, @RequestBody Map<String, Object> body) {
        AuthContext.requireKRUpdate(body);
        Map<String, Object> kr = okrService.updateKeyResult(
                id, str(body.get("code")), str(body.get("description")),
                str(body.get("status")), str(body.get("deadline")), currentUserId());
        if (kr == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Key Result não encontrado"));
        }
        return ResponseEntity.ok(kr);
    }

    @DeleteMapping("/key-results/{id:\\d+}")
    public ResponseEntity<?> deleteKeyResult(@PathVariable long id) {
        AuthContext.requireRole(List.of("ADMIN"));
        if (!okrService.deleteKeyResult(id, currentUserId())) {
            return ResponseEntity.status(404).body(Map.of("error", "Key Result não encontrado"));
        }
        return ResponseEntity.ok(java.util.Collections.singletonMap("success", true));
    }

    // ============================================================
    // INITIATIVES (mutations públicas no Node)
    // ============================================================

    @GetMapping("/initiatives")
    public List<Map<String, Object>> listInitiatives(@RequestParam(value = "directorate", required = false) String directorate) {
        return okrService.findAllInitiatives(directorate);
    }

    @PostMapping("/initiatives")
    public ResponseEntity<?> createInitiative(@RequestBody Map<String, Object> body) {
        Object keyResultId = body.get("keyResultId");
        String title = str(body.get("title"));
        String directorate = str(body.get("directorate"));
        if (keyResultId == null || title == null || directorate == null) {
            return ResponseEntity.status(400).body(Map.of("error", "Campos obrigatórios: keyResultId, title, directorate"));
        }
        try {
            Map<String, Object> init = okrService.createInitiative(
                    keyResultId, title, str(body.get("description")), str(body.get("boardStatus")),
                    str(body.get("location")), body.get("sprintId"), directorate, currentUserId());
            return ResponseEntity.status(HttpStatus.CREATED).body(init);
        } catch (DataAccessException e) {
            if (PgErrors.is(e, "23503")) {
                return ResponseEntity.status(404).body(Map.of("error", "Key Result não encontrado"));
            }
            throw e;
        }
    }

    @PutMapping("/initiatives/{id:\\d+}")
    public ResponseEntity<?> updateInitiative(@PathVariable long id, @RequestBody Map<String, Object> body) {
        Map<String, Object> init = okrService.updateInitiative(
                id, str(body.get("title")), str(body.get("description")), str(body.get("boardStatus")),
                str(body.get("location")), body.get("sprintId"), currentUserId());
        if (init == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Iniciativa não encontrada"));
        }
        return ResponseEntity.ok(init);
    }

    @DeleteMapping("/initiatives/{id:\\d+}")
    public ResponseEntity<?> deleteInitiative(@PathVariable long id) {
        if (!okrService.deleteInitiative(id, currentUserId())) {
            return ResponseEntity.status(404).body(Map.of("error", "Iniciativa não encontrada"));
        }
        return ResponseEntity.ok(java.util.Collections.singletonMap("success", true));
    }

    // ============================================================
    // PROGRAMS (mutations públicas no Node)
    // ============================================================

    @GetMapping("/programs")
    public List<Map<String, Object>> listPrograms(@RequestParam(value = "directorate", required = false) String directorate) {
        return okrService.findAllPrograms(directorate);
    }

    @PostMapping("/programs")
    public ResponseEntity<?> createProgram(@RequestBody Map<String, Object> body) {
        String name = str(body.get("name"));
        String directorate = str(body.get("directorate"));
        if (name == null || directorate == null) {
            return ResponseEntity.status(400).body(Map.of("error", "Campos obrigatórios: name, directorate"));
        }
        Map<String, Object> program = okrService.createProgram(name, str(body.get("description")), directorate, currentUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(program);
    }

    @PutMapping("/programs/{id:\\d+}")
    public ResponseEntity<?> updateProgram(@PathVariable long id, @RequestBody Map<String, Object> body) {
        Map<String, Object> program = okrService.updateProgram(id, str(body.get("name")), str(body.get("description")), currentUserId());
        if (program == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Programa não encontrado"));
        }
        return ResponseEntity.ok(program);
    }

    @DeleteMapping("/programs/{id:\\d+}")
    public ResponseEntity<?> deleteProgram(@PathVariable long id) {
        if (!okrService.deleteProgram(id, currentUserId())) {
            return ResponseEntity.status(404).body(Map.of("error", "Programa não encontrado"));
        }
        return ResponseEntity.ok(java.util.Collections.singletonMap("success", true));
    }

    // ============================================================
    // DIRECTORATES
    // ============================================================

    @GetMapping("/directorates")
    public List<Map<String, Object>> listDirectorates() {
        return okrService.findAllDirectorates();
    }

    @PutMapping("/directorates/{code}")
    public ResponseEntity<?> updateDirectorate(@PathVariable String code, @RequestBody Map<String, Object> body) {
        Map<String, Object> dir = okrService.updateDirectorateProadLink(code, str(body.get("proadLink")));
        if (dir == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Diretoria não encontrada"));
        }
        return ResponseEntity.ok(dir);
    }

    // ============================================================
    // PROGRAM INITIATIVES (mutations públicas no Node)
    // ============================================================

    @GetMapping("/program-initiatives")
    public List<Map<String, Object>> listProgramInitiatives() {
        return okrService.findAllProgramInitiatives();
    }

    @PostMapping("/program-initiatives")
    public ResponseEntity<?> createProgramInitiative(@RequestBody Map<String, Object> body) {
        Object programId = body.get("programId");
        String title = str(body.get("title"));
        if (programId == null || title == null) {
            return ResponseEntity.status(400).body(Map.of("error", "Campos obrigatórios: programId, title"));
        }
        Map<String, Object> init = okrService.createProgramInitiative(
                programId, title, str(body.get("description")), str(body.get("boardStatus")), str(body.get("priority")), currentUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(init);
    }

    @PutMapping("/program-initiatives/{id:\\d+}")
    public ResponseEntity<?> updateProgramInitiative(@PathVariable long id, @RequestBody Map<String, Object> body) {
        Map<String, Object> init = okrService.updateProgramInitiative(
                id, str(body.get("title")), str(body.get("description")), str(body.get("boardStatus")), str(body.get("priority")), currentUserId());
        if (init == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Iniciativa não encontrada"));
        }
        return ResponseEntity.ok(init);
    }

    @DeleteMapping("/program-initiatives/{id:\\d+}")
    public ResponseEntity<?> deleteProgramInitiative(@PathVariable long id) {
        if (!okrService.deleteProgramInitiative(id, currentUserId())) {
            return ResponseEntity.status(404).body(Map.of("error", "Iniciativa não encontrada"));
        }
        return ResponseEntity.ok(java.util.Collections.singletonMap("success", true));
    }

    // ============================================================
    // EXECUTION CONTROLS (mutations públicas no Node)
    // ============================================================

    @GetMapping("/execution-controls")
    public List<Map<String, Object>> listExecutionControls(@RequestParam(value = "directorate", required = false) String directorate) {
        return okrService.findAllExecutionControls(directorate);
    }

    @PostMapping("/execution-controls")
    public ResponseEntity<?> createExecutionControl(@RequestBody Map<String, Object> body) {
        String planProgram = str(body.get("planProgram"));
        String krProjectInitiative = str(body.get("krProjectInitiative"));
        String directorate = str(body.get("directorate"));
        if (planProgram == null || krProjectInitiative == null || directorate == null) {
            return ResponseEntity.status(400).body(Map.of("error",
                    "Campos obrigatórios: planProgram, krProjectInitiative, directorate"));
        }
        Map<String, Object> ctrl = okrService.createExecutionControl(
                planProgram, krProjectInitiative, str(body.get("backlogTasks")), str(body.get("sprintStatus")),
                str(body.get("sprintTasks")), str(body.get("progress")), directorate, currentUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ctrl);
    }

    /** Rota estática — deve casar ANTES de /{id} (já garantido por {id:\\d+}). */
    @PutMapping("/execution-controls/ordenacao")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> updateExecutionControlOrdenacao(@RequestBody Map<String, Object> body) {
        Object ord = body.get("ordenacao");
        if (!(ord instanceof List)) {
            return ResponseEntity.status(400).body(Map.of("error", "Ordenação inválida"));
        }
        okrService.updateExecutionControlOrdenacao((List<Map<String, Object>>) ord, currentUserId());
        return ResponseEntity.ok(Map.of("success", true, "message", "Ordenação atualizada"));
    }

    @PutMapping("/execution-controls/{id:\\d+}")
    public ResponseEntity<?> updateExecutionControl(@PathVariable long id, @RequestBody Map<String, Object> body) {
        Map<String, Object> ctrl = okrService.updateExecutionControl(
                id, str(body.get("planProgram")), str(body.get("krProjectInitiative")), str(body.get("backlogTasks")),
                str(body.get("sprintStatus")), str(body.get("sprintTasks")), str(body.get("progress")),
                str(body.get("directorate")), currentUserId());
        if (ctrl == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Registro não encontrado"));
        }
        return ResponseEntity.ok(ctrl);
    }

    @DeleteMapping("/execution-controls/{id:\\d+}")
    public ResponseEntity<?> deleteExecutionControl(@PathVariable long id) {
        if (!okrService.deleteExecutionControl(id, currentUserId())) {
            return ResponseEntity.status(404).body(Map.of("error", "Registro não encontrado"));
        }
        return ResponseEntity.ok(java.util.Collections.singletonMap("success", true));
    }

    // ============================================================
    // HELPERS
    // ============================================================

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    private static Integer asInt(Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof Number n) {
            return n.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(v));
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
