package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.service.GestaoEstrategicaService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Porte fiel de gestao-estrategica.ts. GET público; mutations com authorize(['ADMIN']).
 * userId vem do header X-User-Id (parseInt, null se ausente/inválido) — NÃO do Bearer.
 */
@RestController
@RequestMapping("/api/gestao-estrategica")
@RequiredArgsConstructor
public class GestaoEstrategicaController {

    private final GestaoEstrategicaService service;

    private Long getCurrentUserId(HttpServletRequest req) {
        String header = req.getHeader("X-User-Id");
        if (header == null) {
            return null;
        }
        try {
            return Long.parseLong(header.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    // ---------- PLANOS ----------

    @GetMapping("/planos")
    public List<Map<String, Object>> listPlanos(@RequestParam(value = "cadastrosAreasId", required = false) Long cadastrosAreasId) {
        return service.getAllPlanos(cadastrosAreasId);
    }

    @GetMapping("/planos/{id:\\d+}")
    public ResponseEntity<?> getPlano(@PathVariable long id) {
        Map<String, Object> plano = service.getPlanoById(id);
        if (plano == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Plano não encontrado"));
        }
        return ResponseEntity.ok(plano);
    }

    @GetMapping("/planos/{id:\\d+}/completo")
    public ResponseEntity<?> getPlanoCompleto(@PathVariable long id) {
        Map<String, Object> plano = service.getPlanoComProjetos(id);
        if (plano == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Plano não encontrado"));
        }
        return ResponseEntity.ok(plano);
    }

    @PostMapping("/planos")
    public ResponseEntity<?> createPlano(HttpServletRequest req, @RequestBody Map<String, Object> body) {
        AuthContext.requireRole(List.of("ADMIN"));
        String nome = trimmed(body.get("nome"));
        if (nome == null || nome.length() < 3) {
            return ResponseEntity.status(400).body(Map.of("error", "Nome é obrigatório e deve ter pelo menos 3 caracteres"));
        }
        Map<String, Object> plano = service.createPlano(nome, asLong(body.get("cadastrosAreasId")), getCurrentUserId(req));
        return ResponseEntity.status(HttpStatus.CREATED).body(plano);
    }

    @PutMapping("/planos/{id:\\d+}")
    public ResponseEntity<?> updatePlano(HttpServletRequest req, @PathVariable long id, @RequestBody Map<String, Object> body) {
        AuthContext.requireRole(List.of("ADMIN"));
        String nome = trimmedIfPresent(body, "nome");
        if (nome != null && nome.length() < 3) {
            return ResponseEntity.status(400).body(Map.of("error", "Nome deve ter pelo menos 3 caracteres"));
        }
        Map<String, Object> plano = service.updatePlano(id, nome, getCurrentUserId(req));
        if (plano == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Plano não encontrado"));
        }
        return ResponseEntity.ok(plano);
    }

    @DeleteMapping("/planos/{id:\\d+}")
    public ResponseEntity<?> deletePlano(HttpServletRequest req, @PathVariable long id) {
        AuthContext.requireRole(List.of("ADMIN"));
        if (!service.deletePlano(id, getCurrentUserId(req))) {
            return ResponseEntity.status(404).body(Map.of("error", "Plano não encontrado"));
        }
        return ResponseEntity.ok(Map.of("message", "Plano excluído com sucesso"));
    }

    // ---------- PROJETOS ----------

    @GetMapping("/projetos")
    public List<Map<String, Object>> listProjetos(@RequestParam(value = "plano_id", required = false) Integer planoId) {
        return service.getAllProjetos(planoId);
    }

    @GetMapping("/projetos/{id:\\d+}")
    public ResponseEntity<?> getProjeto(@PathVariable long id) {
        Map<String, Object> projeto = service.getProjetoById(id);
        if (projeto == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Projeto não encontrado"));
        }
        return ResponseEntity.ok(projeto);
    }

    @PostMapping("/projetos")
    public ResponseEntity<?> createProjeto(HttpServletRequest req, @RequestBody Map<String, Object> body) {
        AuthContext.requireRole(List.of("ADMIN"));
        String nome = trimmed(body.get("nome"));
        if (nome == null || nome.length() < 3) {
            return ResponseEntity.status(400).body(Map.of("error", "Nome é obrigatório e deve ter pelo menos 3 caracteres"));
        }
        Object planoId = falsyToNull(body.get("plano_id"));
        Object instrumentoId = falsyToNull(body.get("instrumento_id"));
        if (planoId == null && instrumentoId == null) {
            return ResponseEntity.status(400).body(Map.of("error", "plano_id ou instrumento_id é obrigatório"));
        }
        if (instrumentoId != null) {
            Map<String, Object> plano = service.getPlanoById(((Number) instrumentoId).longValue());
            if (plano == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Instrumento de planejamento não encontrado"));
            }
        }
        Map<String, Object> projeto = service.createProjeto(nome, planoId, instrumentoId, getCurrentUserId(req));
        return ResponseEntity.status(HttpStatus.CREATED).body(projeto);
    }

    @PutMapping("/projetos/{id:\\d+}")
    public ResponseEntity<?> updateProjeto(HttpServletRequest req, @PathVariable long id, @RequestBody Map<String, Object> body) {
        AuthContext.requireRole(List.of("ADMIN"));
        String nome = trimmedIfPresent(body, "nome");
        if (nome != null && nome.length() < 3) {
            return ResponseEntity.status(400).body(Map.of("error", "Nome deve ter pelo menos 3 caracteres"));
        }
        Map<String, Object> projeto = service.updateProjeto(id, nome, getCurrentUserId(req));
        if (projeto == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Projeto não encontrado"));
        }
        return ResponseEntity.ok(projeto);
    }

    @DeleteMapping("/projetos/{id:\\d+}")
    public ResponseEntity<?> deleteProjeto(HttpServletRequest req, @PathVariable long id) {
        AuthContext.requireRole(List.of("ADMIN"));
        if (!service.deleteProjeto(id, getCurrentUserId(req))) {
            return ResponseEntity.status(404).body(Map.of("error", "Projeto não encontrado"));
        }
        return ResponseEntity.ok(Map.of("message", "Projeto excluído com sucesso"));
    }

    // ---------- TAREFAS ----------

    @GetMapping("/tarefas")
    public List<Map<String, Object>> listTarefas(@RequestParam(value = "projeto_id", required = false) Integer projetoId) {
        return service.getAllTarefas(projetoId);
    }

    @GetMapping("/tarefas/{id:\\d+}")
    public ResponseEntity<?> getTarefa(@PathVariable long id) {
        Map<String, Object> tarefa = service.getTarefaById(id);
        if (tarefa == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Tarefa não encontrada"));
        }
        return ResponseEntity.ok(tarefa);
    }

    @PostMapping("/tarefas")
    public ResponseEntity<?> createTarefa(HttpServletRequest req, @RequestBody Map<String, Object> body) {
        AuthContext.requireRole(List.of("ADMIN"));
        String nome = trimmed(body.get("nome"));
        if (nome == null || nome.length() < 3) {
            return ResponseEntity.status(400).body(Map.of("error", "Nome é obrigatório e deve ter pelo menos 3 caracteres"));
        }
        Object projetoId = falsyToNull(body.get("projeto_id"));
        if (projetoId == null) {
            return ResponseEntity.status(400).body(Map.of("error", "projeto_id é obrigatório"));
        }
        Map<String, Object> projeto = service.getProjetoById(((Number) projetoId).longValue());
        if (projeto == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Projeto não encontrado"));
        }
        Map<String, Object> tarefa = service.createTarefa(nome, projetoId, getCurrentUserId(req));
        return ResponseEntity.status(HttpStatus.CREATED).body(tarefa);
    }

    /** Rota estática — deve casar ANTES de /tarefas/{id} (garantido por {id:\\d+}). */
    @PutMapping("/tarefas/ordenacao")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> ordenacaoTarefas(HttpServletRequest req, @RequestBody Map<String, Object> body) {
        AuthContext.requireRole(List.of("ADMIN"));
        Object ord = body.get("ordenacao");
        if (!(ord instanceof List)) {
            return ResponseEntity.status(400).body(Map.of("error", "Ordenação inválida"));
        }
        service.updateOrdenacaoTarefas((List<Map<String, Object>>) ord, getCurrentUserId(req));
        return ResponseEntity.ok(Map.of("success", true, "message", "Ordenação atualizada"));
    }

    @PutMapping("/tarefas/{id:\\d+}")
    public ResponseEntity<?> updateTarefa(HttpServletRequest req, @PathVariable long id, @RequestBody Map<String, Object> body) {
        AuthContext.requireRole(List.of("ADMIN"));
        String nome = trimmedIfPresent(body, "nome");
        if (nome != null && nome.length() < 3) {
            return ResponseEntity.status(400).body(Map.of("error", "Nome deve ter pelo menos 3 caracteres"));
        }
        String status = body.get("status") != null ? str(body.get("status")) : null;
        if (status != null && !List.of("sprint_atual", "fora_sprint", "concluida").contains(status)) {
            return ResponseEntity.status(400).body(Map.of("error", "Status inválido. Use: sprint_atual, fora_sprint ou concluida"));
        }
        String progresso = body.get("progresso") != null ? str(body.get("progresso")) : null;
        if (progresso != null && !List.of("a_fazer", "fazendo", "feito").contains(progresso)) {
            return ResponseEntity.status(400).body(Map.of("error", "Progresso inválido. Use: a_fazer, fazendo ou feito"));
        }
        Map<String, Object> tarefa = service.updateTarefa(id, nome, status, progresso, getCurrentUserId(req));
        if (tarefa == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Tarefa não encontrada"));
        }
        return ResponseEntity.ok(tarefa);
    }

    @DeleteMapping("/tarefas/{id:\\d+}")
    public ResponseEntity<?> deleteTarefa(HttpServletRequest req, @PathVariable long id) {
        AuthContext.requireRole(List.of("ADMIN"));
        if (!service.deleteTarefa(id, getCurrentUserId(req))) {
            return ResponseEntity.status(404).body(Map.of("error", "Tarefa não encontrada"));
        }
        return ResponseEntity.ok(Map.of("message", "Tarefa excluída com sucesso"));
    }

    // ---------- ESTATÍSTICAS + MIGRATION ----------

    @GetMapping("/estatisticas")
    public Map<String, Object> estatisticas(@RequestParam(value = "cadastrosAreasId", required = false) Long cadastrosAreasId) {
        return service.getEstatisticasPorDiretoria(cadastrosAreasId);
    }

    @GetMapping("/run-migration-integrar")
    public Map<String, Object> runMigration() {
        // Endpoint do Node que roda DDL. No-op aqui — não alteramos o banco.
        return Map.of("success", true,
                "message", "Migration executada com sucesso! Agora os planos/programas de Cadastros aparecem em Controle de Execução.");
    }

    // ---------- HELPERS ----------

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    private static Long asLong(Object v) {
        if (v == null) return null;
        if (v instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(String.valueOf(v));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String trimmed(Object v) {
        return v == null ? null : String.valueOf(v).trim();
    }

    /** Replica `nome?.trim()`: null se a chave estiver ausente ou valor null. */
    private static String trimmedIfPresent(Map<String, Object> body, String key) {
        Object v = body.get(key);
        return v == null ? null : String.valueOf(v).trim();
    }

    private static Object falsyToNull(Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof Number n) {
            return n.doubleValue() == 0 ? null : v;
        }
        if (v instanceof String s) {
            return s.isEmpty() ? null : v;
        }
        return v;
    }
}
