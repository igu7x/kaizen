package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.dto.CriarIfoRequest;
import br.jus.tjgo.kaizen.dto.IfoDto;
import br.jus.tjgo.kaizen.service.IfoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * IFO (Item de Formação do Orçamento) — Orçamento de TIC, Cap. 1. Cria/consulta as bandas-envelope
 * da Formação e as envia à CCA (RF-24/26). Autenticação por header x-user-id (padrão do domínio).
 */
@RestController
@RequestMapping("/api/ifo")
@RequiredArgsConstructor
public class IfoController {

    private final IfoService service;

    // GET /api/ifo?ano=2026&cicloId=3
    @GetMapping
    public List<IfoDto> listar(@RequestParam(value = "ano", required = false) Integer ano,
                               @RequestParam(value = "cicloId", required = false) Long cicloId) {
        return service.listar(ano, cicloId);
    }

    // GET /api/ifo/:id
    @GetMapping("/{id:\\d+}")
    public IfoDto get(@PathVariable long id) {
        return service.get(id);
    }

    // POST /api/ifo — cria um IFO agrupando contratos da DFD-Consulta (RF-24)
    @PostMapping
    public ResponseEntity<IfoDto> criar(@RequestBody CriarIfoRequest req,
                                        @RequestHeader(value = "x-user-id", required = false) Long userId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.criar(req, userId));
    }

    // POST /api/ifo/:id/enviar-cca — envia o IFO à CCA (RF-26)
    @PostMapping("/{id:\\d+}/enviar-cca")
    public IfoDto enviarCca(@PathVariable long id,
                            @RequestHeader(value = "x-user-id", required = false) Long userId) {
        return service.enviarCca(id, userId);
    }

    // DELETE /api/ifo/:id — remove um IFO em rascunho
    @DeleteMapping("/{id:\\d+}")
    public ResponseEntity<Void> excluir(@PathVariable long id) {
        service.excluir(id);
        return ResponseEntity.noContent().build();
    }
}
