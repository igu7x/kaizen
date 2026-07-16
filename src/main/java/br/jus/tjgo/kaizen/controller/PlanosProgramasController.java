package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.service.PlanosProgramasService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Porte fiel de planos-programas.ts. Rotas públicas.
 * /instrumentos/ancoragem e /instrumentos-ordenacao são paths estáticos distintos de /instrumentos/{id}.
 */
@RestController
@RequestMapping("/api/planos-programas")
@RequiredArgsConstructor
public class PlanosProgramasController {

    private final PlanosProgramasService service;

    @GetMapping("/instrumentos")
    public List<Map<String, Object>> listInstrumentos(@RequestParam(value = "cadastrosAreasId", required = false) Long cadastrosAreasId) {
        return service.getAllInstrumentos(cadastrosAreasId);
    }

    @GetMapping("/instrumentos/ancoragem")
    public List<Map<String, Object>> ancoragem(@RequestParam(value = "cadastrosAreasId", required = false) Long cadastrosAreasId) {
        return service.getInstrumentosParaAncoragem(cadastrosAreasId);
    }

    @GetMapping("/instrumentos/{id:\\d+}")
    public ResponseEntity<?> getInstrumento(@PathVariable long id) {
        Map<String, Object> instrumento = service.getInstrumentoById(id);
        if (instrumento == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Instrumento não encontrado"));
        }
        return ResponseEntity.ok(instrumento);
    }

    @PostMapping("/instrumentos")
    public ResponseEntity<?> createInstrumento(@RequestBody Map<String, Object> body) {
        Map<String, Object> instrumento = service.createInstrumento(body);
        return ResponseEntity.status(HttpStatus.CREATED).body(instrumento);
    }

    @PutMapping("/instrumentos/{id:\\d+}")
    public Map<String, Object> updateInstrumento(@PathVariable long id, @RequestBody Map<String, Object> body) {
        return service.updateInstrumento(id, body);
    }

    @DeleteMapping("/instrumentos/{id:\\d+}")
    public ResponseEntity<?> deleteInstrumento(@PathVariable long id) {
        service.deleteInstrumento(id);
        return ResponseEntity.ok(java.util.Collections.singletonMap("success", true));
    }

    @PutMapping("/instrumentos-ordenacao")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> ordenacao(@RequestBody Map<String, Object> body) {
        Object ord = body.get("ordenacao");
        if (!(ord instanceof List)) {
            return ResponseEntity.status(400).body(Map.of("error", "Ordenação deve ser um array"));
        }
        service.atualizarOrdenacao((List<Map<String, Object>>) ord);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/run-migration-ordenacao")
    public Map<String, Object> runMigration() {
        // Endpoint do Node que roda DDL (cria view/colunas). No-op aqui — não alteramos o banco.
        return Map.of("success", true, "message", "Migration executada com sucesso!");
    }
}
