package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.service.AtaComiteService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Atas dos comitês (CGTIC/CGOVTIC) do Orçamento de TIC — juntada/reflexo do ato externo (RN-GERAL-04).
 * Autenticação por header x-user-id (padrão do domínio de contratações).
 */
@RestController
@RequestMapping("/api/orcamento/atas")
@RequiredArgsConstructor
public class AtaComiteController {

    private final AtaComiteService service;

    // GET /api/orcamento/atas?cicloId=3
    @GetMapping
    public List<Map<String, Object>> listar(@RequestParam(value = "cicloId", required = false) Long cicloId) {
        return service.listar(cicloId);
    }

    // POST /api/orcamento/atas { cicloId, comite, numero, dataAta, decisao, anexoUrl }
    @PostMapping
    public ResponseEntity<Map<String, Object>> registrar(@RequestBody Map<String, Object> body,
                                                         @RequestHeader(value = "x-user-id", required = false) Long userId) {
        Long cicloId = body.get("cicloId") instanceof Number n ? n.longValue() : null;
        Map<String, Object> ata = service.registrar(
                cicloId,
                str(body.get("comite")),
                str(body.get("numero")),
                str(body.get("dataAta")),
                str(body.get("decisao")),
                str(body.get("anexoUrl")),
                userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(ata);
    }

    // DELETE /api/orcamento/atas/:id
    @DeleteMapping("/{id:\\d+}")
    public ResponseEntity<Void> excluir(@PathVariable long id) {
        service.excluir(id);
        return ResponseEntity.noContent().build();
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }
}
