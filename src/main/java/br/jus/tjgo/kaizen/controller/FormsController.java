package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.service.FormService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de forms.ts (formulários dinâmicos). Categoria A — userId via requestUserId()
 * (fallback 1); sem checagem de role. POST /responses lê userId do body.
 */
@RestController
@RequestMapping("/api/forms")
@RequiredArgsConstructor
public class FormsController {

    private final FormService formService;

    private Long currentUserId() {
        return AuthContext.requestUserId();
    }

    @GetMapping
    public List<Map<String, Object>> list(@RequestParam(value = "cadastrosAreasId", required = false) Long cadastrosAreasId,
                                          @RequestParam(value = "isAdmin", required = false) String isAdmin) {
        return formService.findAllForms(cadastrosAreasId, "true".equals(isAdmin));
    }

    @GetMapping("/{id:\\d+}")
    public ResponseEntity<?> getById(@PathVariable long id) {
        Map<String, Object> form = formService.findFormById(id);
        if (form == null) {
            return ResponseEntity.status(404).body(err("Formulário não encontrado"));
        }
        return ResponseEntity.ok(form);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        if (isBlank(body.get("title"))) {
            return ResponseEntity.status(400).body(err("Campo obrigatório: title"));
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("title", body.get("title"));
        data.put("description", body.get("description"));
        data.put("cadastros_areas_id", body.get("cadastrosAreasId"));
        data.put("allowed_areas_ids", body.get("allowedAreasIds"));
        data.put("status", body.get("status") != null ? body.get("status") : "DRAFT");
        return ResponseEntity.status(HttpStatus.CREATED).body(formService.createForm(data, currentUserId()));
    }

    @PutMapping("/{id:\\d+}")
    public ResponseEntity<?> update(@PathVariable long id, @RequestBody Map<String, Object> body) {
        Map<String, Object> data = new LinkedHashMap<>();
        if (body.containsKey("title")) data.put("title", body.get("title"));
        if (body.containsKey("description")) data.put("description", body.get("description"));
        if (body.containsKey("status")) data.put("status", body.get("status"));
        if (body.containsKey("allowedAreasIds")) data.put("allowed_areas_ids", body.get("allowedAreasIds"));
        Map<String, Object> form = formService.updateForm(id, data, currentUserId());
        if (form == null) {
            return ResponseEntity.status(404).body(err("Formulário não encontrado"));
        }
        return ResponseEntity.ok(form);
    }

    @DeleteMapping("/{id:\\d+}")
    public ResponseEntity<?> delete(@PathVariable long id) {
        if (!formService.deleteForm(id, currentUserId())) {
            return ResponseEntity.status(404).body(err("Formulário não encontrado"));
        }
        return ResponseEntity.ok(java.util.Collections.singletonMap("success", true));
    }

    // ---------- STRUCTURE ----------

    @GetMapping("/{id:\\d+}/structure")
    public Map<String, Object> getStructure(@PathVariable long id) {
        return formService.getFormStructure(id);
    }

    @PostMapping("/{id:\\d+}/structure")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> saveStructure(@PathVariable long id, @RequestBody Map<String, Object> body) {
        List<Map<String, Object>> sections = body.get("sections") instanceof List ? (List<Map<String, Object>>) body.get("sections") : List.of();
        List<Map<String, Object>> fields = body.get("fields") instanceof List ? (List<Map<String, Object>>) body.get("fields") : List.of();
        formService.saveFormStructure(id, sections, fields, currentUserId());
        return ResponseEntity.ok(Map.of("success", true, "message", "Estrutura atualizada com sucesso"));
    }

    // ---------- RESPONSES ----------

    @GetMapping("/{id:\\d+}/responses")
    public List<Map<String, Object>> getResponses(@PathVariable long id) {
        return formService.getFormResponses(id);
    }

    @PostMapping("/{id:\\d+}/responses")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> saveResponse(@PathVariable long id, @RequestBody Map<String, Object> body) {
        Object userIdRaw = body.get("userId");
        Object answersRaw = body.get("answers");
        if (userIdRaw == null || answersRaw == null) {
            return ResponseEntity.status(400).body(err("Campos obrigatórios: userId, answers"));
        }
        Long userIdNum;
        try {
            userIdNum = userIdRaw instanceof Number n ? n.longValue() : Long.parseLong(String.valueOf(userIdRaw));
        } catch (NumberFormatException e) {
            return ResponseEntity.status(400).body(err("userId deve ser um número válido"));
        }
        List<Map<String, Object>> normalized = new ArrayList<>();
        for (Object o : (List<Object>) answersRaw) {
            Map<String, Object> answer = (Map<String, Object>) o;
            Map<String, Object> n = new LinkedHashMap<>();
            Object fid = answer.get("fieldId");
            n.put("fieldId", fid instanceof Number num ? num.intValue()
                    : (fid != null ? Integer.parseInt(String.valueOf(fid)) : null));
            n.put("value", answer.get("value"));
            normalized.add(n);
        }
        String status = body.get("status") != null ? String.valueOf(body.get("status")) : "SUBMITTED";
        try {
            Map<String, Object> response = formService.saveFormResponse(id, userIdNum, normalized, status);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (RuntimeException e) {
            if ("ALREADY_SUBMITTED".equals(e.getMessage())) {
                return ResponseEntity.status(409).body(err("Você já respondeu este formulário."));
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("error", "Erro ao salvar resposta");
            m.put("details", e.getMessage());
            return ResponseEntity.status(500).body(m);
        }
    }

    private static Map<String, Object> err(String error) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("error", error);
        return m;
    }

    private static boolean isBlank(Object v) {
        return v == null || String.valueOf(v).trim().isEmpty();
    }
}
