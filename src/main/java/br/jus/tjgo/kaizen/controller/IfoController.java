package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.dto.CriarIfoRequest;
import br.jus.tjgo.kaizen.dto.IfoDto;
import br.jus.tjgo.kaizen.service.IfoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

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
                               @RequestParam(value = "cicloId", required = false) Long cicloId,
                               @RequestParam(value = "minhasDemandas", required = false) Boolean minhasDemandas,
                               @RequestHeader(value = "x-user-id", required = false) Long userId) {
        return service.listar(ano, cicloId, minhasDemandas, userId);
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

    // PATCH /api/ifo/:id/interesse-renovacao { interesse, motivo } — RF-07 (Não → reclassifica p/ Encerramento)
    @PatchMapping("/{id:\\d+}/interesse-renovacao")
    public IfoDto interesseRenovacao(@PathVariable long id, @RequestBody Map<String, Object> body,
                                     @RequestHeader(value = "x-user-id", required = false) Long userId) {
        boolean interesse = Boolean.TRUE.equals(body.get("interesse"))
                || "true".equalsIgnoreCase(String.valueOf(body.get("interesse")));
        String motivo = body.get("motivo") == null ? null : String.valueOf(body.get("motivo"));
        return service.definirInteresseRenovacao(id, interesse, motivo, userId);
    }

    // POST /api/ifo/:id/enviar-cca — envia o IFO à CCA (RF-26)
    @PostMapping("/{id:\\d+}/enviar-cca")
    public IfoDto enviarCca(@PathVariable long id,
                            @RequestHeader(value = "x-user-id", required = false) Long userId) {
        return service.enviarCca(id, userId);
    }

    // PATCH /api/ifo/:id/validar { camada: 1|2 } — validação por demanda em 2 camadas (§8.4)
    @PatchMapping("/{id:\\d+}/validar")
    public IfoDto validar(@PathVariable long id, @RequestBody Map<String, Object> body,
                          @RequestHeader(value = "x-user-id", required = false) Long userId) {
        int camada = body.get("camada") instanceof Number n ? n.intValue()
                : Integer.parseInt(String.valueOf(body.getOrDefault("camada", "1")).trim());
        return service.validarDemanda(id, camada, userId);
    }

    // POST /api/ifo/:id/devolver-demanda — devolve a demanda à edição (RN-GERAL-07)
    @PostMapping("/{id:\\d+}/devolver-demanda")
    public IfoDto devolverDemanda(@PathVariable long id,
                                  @RequestHeader(value = "x-user-id", required = false) Long userId) {
        return service.devolverDemanda(id, userId);
    }

    // POST /api/ifo/particao/remeter { cicloId, unidadeId } — remessa da partição à CCA (RN-GERAL-08)
    @PostMapping("/particao/remeter")
    public Map<String, Object> remeterParticao(@RequestBody Map<String, Object> body,
                                               @RequestHeader(value = "x-user-id", required = false) Long userId) {
        int n = service.remeterParticao(num(body.get("cicloId")), num(body.get("unidadeId")), userId);
        return Map.of("remetidas", n);
    }

    // POST /api/ifo/particao/devolver { cicloId, unidadeId } — devolução da partição pela CCA
    @PostMapping("/particao/devolver")
    public Map<String, Object> devolverParticao(@RequestBody Map<String, Object> body,
                                                @RequestHeader(value = "x-user-id", required = false) Long userId) {
        int n = service.devolverParticao(num(body.get("cicloId")), num(body.get("unidadeId")), userId);
        return Map.of("devolvidas", n);
    }

    private static long num(Object v) {
        if (v instanceof Number n) return n.longValue();
        if (v == null) throw new br.jus.tjgo.kaizen.exception.ApiException(400, "Parâmetro numérico obrigatório");
        return Long.parseLong(String.valueOf(v).trim());
    }

    // DELETE /api/ifo/:id — remove um IFO em rascunho
    @DeleteMapping("/{id:\\d+}")
    public ResponseEntity<Void> excluir(@PathVariable long id,
                                        @RequestHeader(value = "x-user-id", required = false) Long userId) {
        service.excluir(id, userId);
        return ResponseEntity.noContent().build();
    }
}
