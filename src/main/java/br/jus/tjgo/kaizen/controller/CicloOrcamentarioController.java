package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.dto.CicloDto;
import br.jus.tjgo.kaizen.dto.EntradaCicloDto;
import br.jus.tjgo.kaizen.exception.ApiException;
import br.jus.tjgo.kaizen.service.CicloOrcamentarioService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Ciclo Orçamentário (Orçamento de TIC) — fundação. Espelha o contrato tipado do frontend
 * (cicloOrcamentarioApi.ts). Autenticação por header x-user-id (padrão do domínio de contratações).
 */
@RestController
@RequestMapping("/api/ciclo-orcamentario")
@RequiredArgsConstructor
public class CicloOrcamentarioController {

    private final CicloOrcamentarioService service;

    // GET /api/ciclo-orcamentario/entrada?ano=2026 — estado das duas finalidades (RF-59/60)
    @GetMapping("/entrada")
    public EntradaCicloDto entrada(@RequestParam int ano) {
        return service.getEntrada(ano);
    }

    // GET /api/ciclo-orcamentario/:id
    @GetMapping("/{id:\\d+}")
    public CicloDto get(@PathVariable long id) {
        return service.getCiclo(id);
    }

    // POST /api/ciclo-orcamentario/formacao { ano } — obtém/abre a Formação do ano (RF-21/22)
    @PostMapping("/formacao")
    public CicloDto formacao(@RequestBody Map<String, Object> body,
                             @RequestHeader(value = "x-user-id", required = false) Long userId) {
        return service.getOuAbrirFormacao(anoDoBody(body), userId);
    }

    // PATCH /api/ciclo-orcamentario/:id/proad { proad } — registra o PROAD de instrução (RF-22)
    @PatchMapping("/{id:\\d+}/proad")
    public CicloDto proad(@PathVariable long id, @RequestBody Map<String, Object> body,
                          @RequestHeader(value = "x-user-id", required = false) Long userId) {
        return service.informarProad(id, str(body.get("proad")), userId);
    }

    // POST /api/ciclo-orcamentario/revisao { ano } — obtém/abre a revisão ordinária vigente (RF-60)
    @PostMapping("/revisao")
    public CicloDto revisao(@RequestBody Map<String, Object> body,
                            @RequestHeader(value = "x-user-id", required = false) Long userId) {
        return service.getOuAbrirRevisao(anoDoBody(body), userId);
    }

    // POST /api/ciclo-orcamentario/revisao/extraordinaria { ano } (RF-73/74)
    @PostMapping("/revisao/extraordinaria")
    public CicloDto revisaoExtraordinaria(@RequestBody Map<String, Object> body,
                                          @RequestHeader(value = "x-user-id", required = false) Long userId) {
        return service.abrirRevisaoExtraordinaria(anoDoBody(body), userId);
    }

    // PATCH /api/ciclo-orcamentario/:id/estado { estado } — transição da esteira (RF-26/32/35/37)
    @PatchMapping("/{id:\\d+}/estado")
    public CicloDto estado(@PathVariable long id, @RequestBody Map<String, Object> body,
                           @RequestHeader(value = "x-user-id", required = false) Long userId) {
        return service.atualizarEstado(id, str(body.get("estado")), userId);
    }

    // POST /api/ciclo-orcamentario/:id/publicar — publicação pela DG (RF-41/75)
    @PostMapping("/{id:\\d+}/publicar")
    public CicloDto publicar(@PathVariable long id,
                             @RequestHeader(value = "x-user-id", required = false) Long userId) {
        return service.publicar(id, userId);
    }

    private static int anoDoBody(Map<String, Object> body) {
        Object ano = body == null ? null : body.get("ano");
        if (ano instanceof Number n) {
            return n.intValue();
        }
        if (ano != null) {
            try {
                return Integer.parseInt(String.valueOf(ano).trim());
            } catch (NumberFormatException e) {
                throw new ApiException(400, "Ano inválido");
            }
        }
        throw new ApiException(400, "Ano é obrigatório");
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }
}
