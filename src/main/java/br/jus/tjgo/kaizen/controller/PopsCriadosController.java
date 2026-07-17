package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.service.PopsCriadosService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * POPs (Procedimento Operacional Padrão) criados no Kaizen — Escritório de Processos.
 */
@RestController
@RequestMapping("/api/pops-criados")
@RequiredArgsConstructor
public class PopsCriadosController {

    private final PopsCriadosService service;

    @GetMapping
    public List<Map<String, Object>> list() {
        return service.list();
    }

    @GetMapping("/{id:\\d+}")
    public ResponseEntity<?> getById(@PathVariable long id) {
        Map<String, Object> pop = service.getById(id);
        if (pop == null) {
            return ResponseEntity.status(404).body(Map.of("error", "POP não encontrado"));
        }
        return ResponseEntity.ok(pop);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        return ResponseEntity.status(201).body(service.create(body));
    }

    @PutMapping("/{id:\\d+}")
    public ResponseEntity<?> update(@PathVariable long id, @RequestBody Map<String, Object> body) {
        if (service.getById(id) == null) {
            return ResponseEntity.status(404).body(Map.of("error", "POP não encontrado"));
        }
        return ResponseEntity.ok(service.update(id, body));
    }

    @DeleteMapping("/{id:\\d+}")
    public ResponseEntity<?> delete(@PathVariable long id) {
        if (!service.delete(id)) {
            return ResponseEntity.status(404).body(Map.of("error", "POP não encontrado"));
        }
        return ResponseEntity.ok(Map.of("message", "POP excluído com sucesso"));
    }
}
