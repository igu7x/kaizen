package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.auth.AuthenticatedUser;
import br.jus.tjgo.kaizen.service.SgsiInstrumentoService;
import br.jus.tjgo.kaizen.service.SgsiTarefaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Módulo "Segurança da Informação" (SGSI) — 1ª fatia: Instrumentos Normativos + Tarefas 5W2H.
 * Categoria B (strict): exige auth. Enquanto o mapeamento de perfis do SGSI (Admin/Gestor/
 * Colaborador/Auditor/Leitor) não é definido, o módulo inteiro fica restrito a superadmin.
 */
@RestController
@RequestMapping("/api/sgsi")
@RequiredArgsConstructor
public class SgsiController {

    private final SgsiInstrumentoService instrumentos;
    private final SgsiTarefaService tarefas;

    /** Guarda provisória: só superadmin. Retorna null se ok, ou a resposta de erro (401/403). */
    private ResponseEntity<?> guard() {
        AuthenticatedUser u = AuthContext.getCurrentUser().orElse(null);
        if (u == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        if (!u.isSuperadmin()) {
            return ResponseEntity.status(403).body(Map.of("error", "Acesso restrito ao módulo de Segurança da Informação."));
        }
        return null;
    }

    private Long userId() {
        return AuthContext.getCurrentUser().map(AuthenticatedUser::id).orElse(null);
    }

    // GET /api/sgsi/instrumentos
    @GetMapping("/instrumentos")
    public ResponseEntity<?> listarInstrumentos() {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(instrumentos.listar());
    }

    // GET /api/sgsi/instrumentos/{codigo}
    @GetMapping("/instrumentos/{codigo}")
    public ResponseEntity<?> buscarInstrumento(@PathVariable String codigo) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        Map<String, Object> inst = instrumentos.buscar(codigo);
        if (inst == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Instrumento não encontrado"));
        }
        return ResponseEntity.ok(inst);
    }

    // GET /api/sgsi/instrumentos/{codigo}/tarefas
    @GetMapping("/instrumentos/{codigo}/tarefas")
    public ResponseEntity<?> listarTarefas(@PathVariable String codigo) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        List<Map<String, Object>> lista = tarefas.listarPorInstrumento(codigo);
        return ResponseEntity.ok(lista);
    }

    // PATCH /api/sgsi/tarefas/{id} — { status, percentual (0..1), observacao }
    @PatchMapping("/tarefas/{id:\\d+}")
    public ResponseEntity<?> atualizarTarefa(@PathVariable long id, @RequestBody(required = false) Map<String, Object> body) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        String status = body == null ? null : str(body.get("status"));
        String observacao = body == null ? null : str(body.get("observacao"));
        BigDecimal percentual = null;
        Object raw = body == null ? null : body.get("percentual");
        if (raw != null) {
            try {
                percentual = new BigDecimal(String.valueOf(raw));
            } catch (NumberFormatException e) {
                return ResponseEntity.status(400).body(Map.of("error", "percentual deve ser numérico (0 a 1)"));
            }
        }
        try {
            Map<String, Object> atualizada = tarefas.atualizar(id, status, percentual, observacao, userId());
            if (atualizada == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Tarefa não encontrada"));
            }
            return ResponseEntity.ok(atualizada);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
        }
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }
}
