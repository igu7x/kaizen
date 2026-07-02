package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.exception.ApiException;
import br.jus.tjgo.kaizen.service.OrcamentoPapelService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Cap. 8 (Orçamento de TIC) — atribuição de Editores por escopo (RN-GERAL-09). A atribuição/revogação
 * é ato de Autoridade do próprio escopo (gateado no service). Autenticação por header x-user-id.
 */
@RestController
@RequestMapping("/api/orcamento/editores")
@RequiredArgsConstructor
public class OrcamentoPapelController {

    private final OrcamentoPapelService service;

    // GET /api/orcamento/editores?escopo=cca&cicloId=3
    @GetMapping
    public List<Map<String, Object>> listar(@RequestParam(value = "escopo", required = false) String escopo,
                                            @RequestParam(value = "cicloId", required = false) Long cicloId) {
        return service.listarEditores(escopo, cicloId);
    }

    // POST /api/orcamento/editores { userId, escopo, cicloId? }
    @PostMapping
    public ResponseEntity<Void> atribuir(@RequestBody Map<String, Object> body,
                                         @RequestHeader(value = "x-user-id", required = false) Long by) {
        long userId = num(body.get("userId"));
        String escopo = String.valueOf(body.get("escopo"));
        Long cicloId = body.get("cicloId") instanceof Number n ? n.longValue() : null;
        service.atribuirEditor(userId, escopo, cicloId, by);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    // DELETE /api/orcamento/editores?userId=10&escopo=cca&cicloId=3
    @DeleteMapping
    public ResponseEntity<Void> revogar(@RequestParam long userId, @RequestParam String escopo,
                                        @RequestParam(value = "cicloId", required = false) Long cicloId) {
        service.revogarEditor(userId, escopo, cicloId);
        return ResponseEntity.noContent().build();
    }

    private static long num(Object v) {
        if (v instanceof Number n) return n.longValue();
        if (v == null) throw new ApiException(400, "userId é obrigatório");
        return Long.parseLong(String.valueOf(v).trim());
    }
}
