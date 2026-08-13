package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.auth.AuthenticatedUser;
import br.jus.tjgo.kaizen.service.SgsiDocumentoService;
import br.jus.tjgo.kaizen.service.SgsiFrameworkService;
import br.jus.tjgo.kaizen.service.SgsiIndicadorService;
import br.jus.tjgo.kaizen.service.SgsiInstrumentoService;
import br.jus.tjgo.kaizen.service.SgsiPainelService;
import br.jus.tjgo.kaizen.service.SgsiRiscoService;
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
    private final SgsiDocumentoService documentos;
    private final SgsiIndicadorService indicadores;
    private final SgsiFrameworkService frameworks;
    private final SgsiRiscoService riscos;
    private final SgsiPainelService painel;

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

    // GET /api/sgsi/frameworks
    @GetMapping("/frameworks")
    public ResponseEntity<?> listarFrameworks() {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(frameworks.listarFrameworks());
    }

    // GET /api/sgsi/frameworks/{codigo}/itens
    @GetMapping("/frameworks/{codigo}/itens")
    public ResponseEntity<?> listarItensFramework(@PathVariable String codigo) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(frameworks.listarItens(codigo));
    }

    // PUT /api/sgsi/frameworks/itens/{itemId}/avaliacao — { status, observacao }
    @PutMapping("/frameworks/itens/{itemId:\\d+}/avaliacao")
    public ResponseEntity<?> avaliarItemFramework(@PathVariable long itemId, @RequestBody(required = false) Map<String, Object> body) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        String status = body == null ? null : str(body.get("status"));
        String observacao = body == null ? null : str(body.get("observacao"));
        try {
            Map<String, Object> item = frameworks.avaliarItem(itemId, status, observacao, userId());
            if (item == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Item não encontrado"));
            }
            return ResponseEntity.ok(item);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
        }
    }

    // GET /api/sgsi/riscos
    @GetMapping("/riscos")
    public ResponseEntity<?> listarRiscos() {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(riscos.listar());
    }

    // POST /api/sgsi/riscos
    @PostMapping("/riscos")
    public ResponseEntity<?> criarRisco(@RequestBody(required = false) Map<String, Object> body) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        try {
            return ResponseEntity.status(201).body(riscos.criar(body == null ? Map.of() : body, userId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
        }
    }

    // PUT /api/sgsi/riscos/{id}
    @PutMapping("/riscos/{id:\\d+}")
    public ResponseEntity<?> atualizarRisco(@PathVariable long id, @RequestBody(required = false) Map<String, Object> body) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        try {
            Map<String, Object> r = riscos.atualizar(id, body == null ? Map.of() : body);
            if (r == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Risco não encontrado"));
            }
            return ResponseEntity.ok(r);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
        }
    }

    // DELETE /api/sgsi/riscos/{id}
    @DeleteMapping("/riscos/{id:\\d+}")
    public ResponseEntity<?> deletarRisco(@PathVariable long id) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        if (!riscos.deletar(id)) {
            return ResponseEntity.status(404).body(Map.of("error", "Risco não encontrado"));
        }
        return ResponseEntity.ok(Map.of("success", true));
    }

    // GET /api/sgsi/painel — visão executiva agregada
    @GetMapping("/painel")
    public ResponseEntity<?> painel() {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(painel.resumo());
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

    // GET /api/sgsi/documentos?instrumento=&status=&tipo=
    @GetMapping("/documentos")
    public ResponseEntity<?> listarDocumentos(
            @RequestParam(value = "instrumento", required = false) String instrumento,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "tipo", required = false) String tipo) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(documentos.listar(instrumento, status, tipo));
    }

    // GET /api/sgsi/documentos/{id}
    @GetMapping("/documentos/{id:\\d+}")
    public ResponseEntity<?> buscarDocumento(@PathVariable long id) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        Map<String, Object> doc = documentos.buscar(id);
        if (doc == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Documento não encontrado"));
        }
        return ResponseEntity.ok(doc);
    }

    // PATCH /api/sgsi/documentos/{id} — { status }
    @PatchMapping("/documentos/{id:\\d+}")
    public ResponseEntity<?> atualizarDocumento(@PathVariable long id, @RequestBody(required = false) Map<String, Object> body) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        String status = body == null ? null : str(body.get("status"));
        try {
            Map<String, Object> atualizado = documentos.atualizarStatus(id, status);
            if (atualizado == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Documento não encontrado"));
            }
            return ResponseEntity.ok(atualizado);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
        }
    }

    // GET /api/sgsi/indicadores
    @GetMapping("/indicadores")
    public ResponseEntity<?> listarIndicadores() {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(indicadores.listar());
    }

    // GET /api/sgsi/indicadores/{id}/medicoes
    @GetMapping("/indicadores/{id:\\d+}/medicoes")
    public ResponseEntity<?> listarMedicoes(@PathVariable long id) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(indicadores.listarMedicoes(id));
    }

    // POST /api/sgsi/indicadores/{id}/medicoes — { competencia (AAAA-MM), valor, observacao }
    @PostMapping("/indicadores/{id:\\d+}/medicoes")
    public ResponseEntity<?> registrarMedicao(@PathVariable long id, @RequestBody(required = false) Map<String, Object> body) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        String competencia = body == null ? null : str(body.get("competencia"));
        String observacao = body == null ? null : str(body.get("observacao"));
        java.math.BigDecimal valor = null;
        Object raw = body == null ? null : body.get("valor");
        if (raw != null) {
            try {
                valor = new java.math.BigDecimal(String.valueOf(raw));
            } catch (NumberFormatException e) {
                return ResponseEntity.status(400).body(Map.of("error", "valor deve ser numérico"));
            }
        }
        try {
            Map<String, Object> m = indicadores.registrarMedicao(id, competencia, valor, observacao, userId());
            if (m == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Indicador não encontrado"));
            }
            return ResponseEntity.status(201).body(m);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
        }
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
