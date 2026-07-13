package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.service.PacCapacitacaoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Matriz do Plano Anual de Capacitação (Pessoas > Plano Anual de Capacitação).
 * ?modulo=ti (default) | apoio.
 */
@RestController
@RequestMapping("/api/pac-capacitacao")
@RequiredArgsConstructor
public class PacCapacitacaoController {

    private final PacCapacitacaoService service;

    @GetMapping
    public List<Map<String, Object>> list(
            @RequestParam(value = "modulo", required = false, defaultValue = "ti") String modulo) {
        return service.list(modulo);
    }

    @GetMapping("/{id:\\d+}")
    public ResponseEntity<?> getById(@PathVariable long id) {
        Map<String, Object> item = service.getById(id);
        if (item == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Item não encontrado"));
        }
        return ResponseEntity.ok(item);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        return ResponseEntity.status(201).body(service.create(body));
    }

    @PutMapping("/{id:\\d+}")
    public ResponseEntity<?> update(@PathVariable long id, @RequestBody Map<String, Object> body) {
        Map<String, Object> atual = service.getById(id);
        if (atual == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Item não encontrado"));
        }
        return ResponseEntity.ok(service.update(id, body));
    }

    @DeleteMapping("/{id:\\d+}")
    public ResponseEntity<?> delete(@PathVariable long id) {
        if (!service.delete(id)) {
            return ResponseEntity.status(404).body(Map.of("error", "Item não encontrado"));
        }
        return ResponseEntity.ok(Map.of("message", "Item excluído com sucesso"));
    }
}
