package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.service.SprintsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de sprints.ts. Todas as rotas públicas.
 * GET / atualiza o status dos sprints ANTES de buscar (igual ao Node).
 */
@RestController
@RequestMapping("/api/sprints")
@RequiredArgsConstructor
public class SprintsController {

    private final SprintsService sprintsService;

    @GetMapping
    public List<Map<String, Object>> list(@RequestParam(value = "projeto_id", required = false) Integer projetoId,
                                          @RequestParam(value = "entrega_id", required = false) Integer entregaId,
                                          @RequestParam(value = "diretoria", required = false) String diretoria) {
        sprintsService.atualizarStatusSprints();
        return sprintsService.getSprintsComTarefas(projetoId, entregaId, diretoria);
    }

    @GetMapping("/todos")
    public List<Map<String, Object>> todos() {
        return sprintsService.listarTodosSprints();
    }

    @GetMapping("/estatisticas")
    public Map<String, Object> estatisticas(@RequestParam(value = "projeto_id", required = false) Integer projetoId,
                                            @RequestParam(value = "entrega_id", required = false) Integer entregaId,
                                            @RequestParam(value = "diretoria", required = false) String diretoria) {
        return sprintsService.getEstatisticas(projetoId, entregaId, diretoria);
    }

    @GetMapping("/diagnostico")
    public Map<String, Object> diagnostico(@RequestParam(value = "sprint_id", required = false) Integer sprintId,
                                           @RequestParam(value = "tarefa_id", required = false) Integer tarefaId) {
        return sprintsService.getDiagnostico(sprintId, tarefaId);
    }

    @GetMapping("/debug")
    public Map<String, Object> debug() {
        return sprintsService.getDebug();
    }

    @GetMapping("/{id:\\d+}")
    public ResponseEntity<?> getById(@PathVariable long id,
                                     @RequestParam(value = "projeto_id", required = false) Integer projetoId,
                                     @RequestParam(value = "entrega_id", required = false) Integer entregaId) {
        Map<String, Object> sprint = sprintsService.getSprintById(id, projetoId, entregaId);
        if (sprint == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Sprint não encontrado"));
        }
        return ResponseEntity.ok(sprint);
    }

    @PostMapping("/atualizar-status")
    public Map<String, Object> atualizarStatus() {
        Map<String, Object> resultado = sprintsService.atualizarStatusSprints();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("message", "Status dos sprints atualizados com sucesso");
        out.put("atualizados", resultado.get("atualizados"));
        out.put("detalhes", resultado.get("detalhes"));
        return out;
    }
}
