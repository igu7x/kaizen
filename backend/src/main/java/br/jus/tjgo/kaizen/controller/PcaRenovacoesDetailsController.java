package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.exception.ApiException;
import br.jus.tjgo.kaizen.service.PcaRenovacoesDetailsService;
import br.jus.tjgo.kaizen.service.PcaRenovacoesService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de pca-renovacoes-details.ts. Sub-recursos da renovação (tipo='renovacao').
 * Auth idêntica a pca-renovacoes (X-User-Role header, 403 sem 401).
 */
@RestController
@RequestMapping("/api/pca-renovacoes-details")
@RequiredArgsConstructor
public class PcaRenovacoesDetailsController {

    private final PcaRenovacoesService renovacoesService;
    private final PcaRenovacoesDetailsService service;

    private void requireGestorOrAdmin(HttpServletRequest req) {
        String role = req.getHeader("x-user-role");
        if (role == null || (!role.equals("ADMIN") && !role.equals("MANAGER"))) {
            throw new ApiException(403, "Acesso negado. Apenas gestores e administradores podem realizar esta operação.");
        }
    }

    private long userId(HttpServletRequest req) {
        String v = req.getHeader("x-user-id");
        if (v == null) {
            return 1;
        }
        try {
            return Long.parseLong(v.trim());
        } catch (NumberFormatException e) {
            return 1;
        }
    }

    // ---------- DADOS COMPLETOS ----------

    @GetMapping("/{id:\\d+}/all")
    public ResponseEntity<?> all(@PathVariable long id) {
        Map<String, Object> renovacao = renovacoesService.findById(id);
        if (renovacao == null) {
            return ResponseEntity.status(404).body(err("Renovação não encontrada"));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("renovacao", renovacao);
        out.putAll(service.getAllData(id));
        return ResponseEntity.ok(out);
    }

    // ---------- DETAILS ----------

    @GetMapping("/{id:\\d+}/details")
    public ResponseEntity<?> getDetails(@PathVariable long id) {
        // Node serializa res.json(details) — pode ser null. getDetails retorna Map ou null.
        return ResponseEntity.ok(service.getDetails(id));
    }

    @PutMapping("/{id:\\d+}/details")
    public ResponseEntity<?> putDetails(HttpServletRequest req, @PathVariable long id, @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req);
        return ResponseEntity.ok(service.upsertDetails(id, body, userId(req)));
    }

    // ---------- CHECKLIST ----------

    @GetMapping("/{id:\\d+}/checklist")
    public ResponseEntity<?> getChecklist(@PathVariable long id) {
        var checklist = service.getChecklist(id);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("checklist", checklist);
        out.put("progress", service.getChecklistProgress(checklist));
        return ResponseEntity.ok(out);
    }

    @PatchMapping("/{id:\\d+}/checklist/{checklistId:\\d+}/status")
    public ResponseEntity<?> updateChecklist(HttpServletRequest req, @PathVariable long id,
                                             @PathVariable long checklistId, @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req);
        String status = str(body.get("status"));
        if (status == null || !List.of("Concluída", "Em andamento", "Não Iniciada").contains(status)) {
            return ResponseEntity.status(400).body(err("Status inválido"));
        }
        Map<String, Object> item = service.updateChecklistStatus(checklistId, status, userId(req));
        if (item == null) {
            return ResponseEntity.status(404).body(err("Item do checklist não encontrado"));
        }
        return ResponseEntity.ok(item);
    }

    // ---------- PONTOS DE CONTROLE ----------

    @GetMapping("/{id:\\d+}/pontos-controle")
    public ResponseEntity<?> getPontosControle(@PathVariable long id) {
        return ResponseEntity.ok(service.getPontosControle(id));
    }

    @GetMapping("/{id:\\d+}/pontos-controle-com-tarefas")
    public ResponseEntity<?> pontosControleComTarefas(@PathVariable long id) {
        return ResponseEntity.ok(service.getPontosControleComTarefas(id));
    }

    @PostMapping("/{id:\\d+}/pontos-controle")
    public ResponseEntity<?> createPontoControle(HttpServletRequest req, @PathVariable long id, @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req);
        if (body.get("ponto_controle") == null || body.get("data") == null || body.get("proxima_reuniao") == null) {
            return ResponseEntity.status(400).body(err("Todos os campos são obrigatórios"));
        }
        Map<String, Object> pc = service.createPontoControle(id, body, userId(req));
        return ResponseEntity.status(HttpStatus.CREATED).body(pc);
    }

    @PutMapping("/{id:\\d+}/pontos-controle/{pcId:\\d+}")
    public ResponseEntity<?> updatePontoControle(HttpServletRequest req, @PathVariable long id,
                                                 @PathVariable long pcId, @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req);
        Map<String, Object> pc = service.updatePontoControle(pcId, body, userId(req));
        if (pc == null) {
            return ResponseEntity.status(404).body(err("Ponto de controle não encontrado"));
        }
        return ResponseEntity.ok(pc);
    }

    @DeleteMapping("/{id:\\d+}/pontos-controle/{pcId:\\d+}")
    public ResponseEntity<?> deletePontoControle(HttpServletRequest req, @PathVariable long id, @PathVariable long pcId,
                                                 @RequestParam(value = "deleteTarefas", required = false) String deleteTarefas) {
        requireGestorOrAdmin(req);
        boolean deleted = service.deletePontoControle(pcId, "true".equals(deleteTarefas));
        if (!deleted) {
            return ResponseEntity.status(404).body(err("Ponto de controle não encontrado"));
        }
        return ResponseEntity.ok(Map.of("success", true));
    }

    // ---------- TAREFAS ----------

    @GetMapping("/{id:\\d+}/tarefas")
    public ResponseEntity<?> getTarefas(@PathVariable long id) {
        return ResponseEntity.ok(service.getTarefas(id));
    }

    @GetMapping("/{id:\\d+}/tarefas-orfas")
    public ResponseEntity<?> tarefasOrfas(@PathVariable long id) {
        return ResponseEntity.ok(service.getTarefasOrfas(id));
    }

    @PostMapping("/{id:\\d+}/tarefas")
    public ResponseEntity<?> createTarefa(HttpServletRequest req, @PathVariable long id, @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req);
        if (body.get("tarefa") == null || body.get("responsavel") == null || body.get("prazo") == null) {
            return ResponseEntity.status(400).body(err("Tarefa, responsável e prazo são obrigatórios"));
        }
        Map<String, Object> t = service.createTarefa(id, body, userId(req));
        return ResponseEntity.status(HttpStatus.CREATED).body(t);
    }

    @PutMapping("/{id:\\d+}/tarefas/{tarefaId:\\d+}")
    public ResponseEntity<?> updateTarefa(HttpServletRequest req, @PathVariable long id,
                                          @PathVariable long tarefaId, @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req);
        Map<String, Object> t = service.updateTarefa(tarefaId, body, userId(req));
        if (t == null) {
            return ResponseEntity.status(404).body(err("Tarefa não encontrada"));
        }
        return ResponseEntity.ok(t);
    }

    @DeleteMapping("/{id:\\d+}/tarefas/{tarefaId:\\d+}")
    public ResponseEntity<?> deleteTarefa(HttpServletRequest req, @PathVariable long id, @PathVariable long tarefaId) {
        requireGestorOrAdmin(req);
        if (!service.deleteTarefa(tarefaId)) {
            return ResponseEntity.status(404).body(err("Tarefa não encontrada"));
        }
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PatchMapping("/{id:\\d+}/tarefas/{tarefaId:\\d+}/associar-pc")
    public ResponseEntity<?> associarPc(HttpServletRequest req, @PathVariable long id,
                                        @PathVariable long tarefaId, @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req);
        Map<String, Object> t = service.associarTarefaAPontoControle(tarefaId, body.get("ponto_controle_id"), userId(req));
        if (t == null) {
            return ResponseEntity.status(404).body(err("Tarefa não encontrada"));
        }
        return ResponseEntity.ok(t);
    }

    // ---------- SALVAR TODAS AS MUDANÇAS ----------

    @PatchMapping("/{id:\\d+}/save-all-changes")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> saveAllChanges(HttpServletRequest req, @PathVariable long id, @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req);
        Map<String, Object> details = body.get("details") instanceof Map ? (Map<String, Object>) body.get("details") : null;
        List<Map<String, Object>> checklist = body.get("checklist_updates") instanceof List ? (List<Map<String, Object>>) body.get("checklist_updates") : null;
        List<Map<String, Object>> tarefas = body.get("tarefas_updates") instanceof List ? (List<Map<String, Object>>) body.get("tarefas_updates") : null;
        return ResponseEntity.ok(service.saveAllChanges(id, details, checklist, tarefas, userId(req)));
    }

    private static Map<String, Object> err(String error) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("error", error);
        return m;
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }
}
