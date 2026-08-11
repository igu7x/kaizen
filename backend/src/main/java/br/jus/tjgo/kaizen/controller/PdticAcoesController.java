package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.service.PdticAcoesService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Ações do PDTIC (Plano Diretor de TIC) — cadastro na tela de Cadastros, consumido pela tela
 * do PDTIC no módulo Estratégia.
 */
@RestController
@RequestMapping("/api/pdtic-acoes")
@RequiredArgsConstructor
public class PdticAcoesController {

    private final PdticAcoesService service;

    @GetMapping
    public List<Map<String, Object>> list() {
        return service.list();
    }

    @GetMapping("/{id:\\d+}")
    public ResponseEntity<?> getById(@PathVariable long id) {
        Map<String, Object> acao = service.getById(id);
        if (acao == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Ação não encontrada"));
        }
        return ResponseEntity.ok(acao);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        if (body.get("nome") == null || String.valueOf(body.get("nome")).isBlank()) {
            return ResponseEntity.status(400).body(Map.of("error", "O nome da ação é obrigatório"));
        }
        return ResponseEntity.status(201).body(service.create(body));
    }

    @PutMapping("/{id:\\d+}")
    public ResponseEntity<?> update(@PathVariable long id, @RequestBody Map<String, Object> body) {
        if (service.getById(id) == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Ação não encontrada"));
        }
        return ResponseEntity.ok(service.update(id, body));
    }

    @DeleteMapping("/{id:\\d+}")
    public ResponseEntity<?> delete(@PathVariable long id) {
        if (!service.delete(id)) {
            return ResponseEntity.status(404).body(Map.of("error", "Ação não encontrada"));
        }
        return ResponseEntity.ok(Map.of("message", "Ação excluída com sucesso"));
    }

    /** Anexa a evidência (documento) da ação — corpo { nome, mime, data (base64) }. */
    @PutMapping("/{id:\\d+}/evidencia")
    public ResponseEntity<?> setEvidencia(@PathVariable long id, @RequestBody Map<String, Object> body) {
        Object data = body.get("data");
        if (data == null || String.valueOf(data).isBlank()) {
            return ResponseEntity.status(400).body(Map.of("error", "Envie o arquivo da evidência."));
        }
        Map<String, Object> upd = service.setEvidencia(
                id, str(body.get("nome")), str(body.get("mime")), str(data));
        if (upd == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Ação não encontrada"));
        }
        return ResponseEntity.ok(upd);
    }

    @DeleteMapping("/{id:\\d+}/evidencia")
    public ResponseEntity<?> removerEvidencia(@PathVariable long id) {
        Map<String, Object> upd = service.removerEvidencia(id);
        if (upd == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Ação não encontrada"));
        }
        return ResponseEntity.ok(upd);
    }

    @GetMapping("/{id:\\d+}/evidencia")
    public ResponseEntity<?> getEvidencia(@PathVariable long id) {
        Map<String, Object> ev = service.getEvidencia(id);
        if (ev == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Sem evidência para esta ação"));
        }
        return ResponseEntity.ok(ev);
    }

    private String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }
}
