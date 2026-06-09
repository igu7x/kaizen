package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.exception.ApiException;
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
 * Porte fiel de pca-renovacoes.ts. Auth: X-User-Role header == ADMIN ou MANAGER (case-sensitive),
 * 403 inclusive quando ausente (NÃO há 401). userId via X-User-Id header (default 1).
 */
@RestController
@RequestMapping("/api/pca-renovacoes")
@RequiredArgsConstructor
public class PcaRenovacoesController {

    private final PcaRenovacoesService service;

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

    @GetMapping
    public List<Map<String, Object>> list() {
        return service.findAll();
    }

    @GetMapping("/stats")
    public Map<String, Object> stats() {
        return service.getStats();
    }

    @GetMapping("/resumo")
    public Map<String, Object> resumo() {
        return service.getResumo();
    }

    @GetMapping("/filters")
    public Map<String, Object> filters() {
        return service.getFilters();
    }

    @GetMapping("/{id:\\d+}")
    public ResponseEntity<?> getById(@PathVariable long id) {
        Map<String, Object> r = service.findById(id);
        if (r == null) {
            return ResponseEntity.status(404).body(err("Renovação não encontrada"));
        }
        return ResponseEntity.ok(r);
    }

    @PostMapping
    public ResponseEntity<?> create(HttpServletRequest req, @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req);
        Object itemPca = body.get("item_pca");
        if (isBlank(itemPca) || isBlank(body.get("area_demandante")) || isBlank(body.get("gestor_demandante"))
                || isBlank(body.get("contratada")) || isBlank(body.get("objeto"))
                || body.get("valor_anual") == null || isBlank(body.get("data_estimada_contratacao"))) {
            return ResponseEntity.status(400).body(err("Todos os campos obrigatórios devem ser preenchidos"));
        }
        if (String.valueOf(itemPca).length() > 50) {
            return ResponseEntity.status(400).body(err("Item PCA deve ter no máximo 50 caracteres"));
        }
        double valorAnual = parseFloatJs(body.get("valor_anual"));
        if (valorAnual <= 0) {
            return ResponseEntity.status(400).body(err("Valor anual deve ser maior que zero"));
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("item_pca", itemPca);
        data.put("area_demandante", body.get("area_demandante"));
        data.put("gestor_demandante", body.get("gestor_demandante"));
        data.put("contratada", body.get("contratada"));
        data.put("objeto", body.get("objeto"));
        data.put("valor_anual", valorAnual);
        data.put("data_estimada_contratacao", body.get("data_estimada_contratacao"));
        data.put("status", body.get("status"));
        Map<String, Object> created = service.create(data, userId(req));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id:\\d+}")
    public ResponseEntity<?> update(HttpServletRequest req, @PathVariable long id, @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req);
        Map<String, Object> updated = service.update(id, body, userId(req));
        if (updated == null) {
            return ResponseEntity.status(404).body(err("Renovação não encontrada"));
        }
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/{id:\\d+}/status")
    public ResponseEntity<?> updateStatus(HttpServletRequest req, @PathVariable long id, @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req);
        String status = str(body.get("status"));
        if (status == null || !List.of("Concluída", "Em andamento", "Não Iniciada").contains(status)) {
            return ResponseEntity.status(400).body(err("Status inválido"));
        }
        Map<String, Object> updated = service.updateStatus(id, status, userId(req));
        if (updated == null) {
            return ResponseEntity.status(404).body(err("Renovação não encontrada"));
        }
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id:\\d+}")
    public ResponseEntity<?> delete(HttpServletRequest req, @PathVariable long id) {
        requireGestorOrAdmin(req);
        if (!service.softDelete(id, userId(req))) {
            return ResponseEntity.status(404).body(err("Renovação não encontrada"));
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "Renovação excluída com sucesso"));
    }

    private static Map<String, Object> err(String error) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("error", error);
        return m;
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    private static boolean isBlank(Object v) {
        return v == null || String.valueOf(v).trim().isEmpty();
    }

    private static double parseFloatJs(Object v) {
        if (v == null) {
            return Double.NaN;
        }
        if (v instanceof Number n) {
            return n.doubleValue();
        }
        try {
            return Double.parseDouble(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return Double.NaN;
        }
    }
}
