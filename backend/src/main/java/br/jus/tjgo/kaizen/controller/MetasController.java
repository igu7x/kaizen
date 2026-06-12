package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.service.MetasService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Porte fiel de metas.ts. GET público; POST/PUT/DELETE com authorize(['ADMIN']).
 * Categoria A — userId via requestUserId() (fallback 1).
 */
@RestController
@RequestMapping("/api/metas")
@RequiredArgsConstructor
public class MetasController {

    private final MetasService metasService;

    private Long currentUserId() {
        return AuthContext.requestUserId();
    }

    @GetMapping
    public List<Map<String, Object>> list(@RequestParam(value = "diretoria", required = false) String diretoria) {
        return metasService.findAllMetas(diretoria);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        AuthContext.requireRole(List.of("ADMIN")); // middleware authorize roda antes do handler
        String titulo = str(body.get("titulo"));
        Object areaId = body.get("areaId");
        if (titulo == null || titulo.isEmpty() || !truthyId(areaId)) {
            return ResponseEntity.status(400).body(Map.of("error", "Campos obrigatórios: titulo, areaId"));
        }
        Map<String, Object> meta = metasService.createMeta(
                titulo,
                emptyToNull(str(body.get("descricao"))),       // Node: data.descricao || null
                areaId,
                emptyToNull(str(body.get("status"))),          // Node: data.status || 'NAO_INICIADO'
                emptyToNull(str(body.get("prazo"))),           // Node: data.prazo || null
                currentUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(meta);
    }

    @PutMapping("/{id:\\d+}")
    public ResponseEntity<?> update(@PathVariable long id, @RequestBody Map<String, Object> body) {
        AuthContext.requireRole(List.of("ADMIN"));
        Map<String, Object> meta = metasService.updateMeta(
                id,
                str(body.get("titulo")),                       // Node update usa ?? null (não converte '')
                str(body.get("descricao")),
                body.get("areaId"),
                str(body.get("status")),
                str(body.get("situacao")),
                str(body.get("prazo")),
                currentUserId());
        if (meta == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Meta não encontrada"));
        }
        return ResponseEntity.ok(meta);
    }

    @DeleteMapping("/{id:\\d+}")
    public ResponseEntity<?> delete(@PathVariable long id) {
        AuthContext.requireRole(List.of("ADMIN"));
        if (!metasService.deleteMeta(id, currentUserId())) {
            return ResponseEntity.status(404).body(Map.of("error", "Meta não encontrada"));
        }
        return ResponseEntity.ok(java.util.Collections.singletonMap("success", true));
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    private static String emptyToNull(String s) {
        return (s == null || s.isEmpty()) ? null : s;
    }

    /** Replica `!areaId` do JS: null, 0 ou '' contam como ausente. */
    private static boolean truthyId(Object v) {
        if (v == null) {
            return false;
        }
        if (v instanceof Number n) {
            return n.doubleValue() != 0;
        }
        String s = String.valueOf(v);
        return !s.isEmpty() && !"0".equals(s);
    }
}
