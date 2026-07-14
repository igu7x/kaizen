package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.dto.CicloDto;
import br.jus.tjgo.kaizen.dto.EntradaCicloDto;
import br.jus.tjgo.kaizen.exception.ApiException;
import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.auth.TagAcao;
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
        return service.getOuAbrirFormacao(anoDoBody(body), resolveUserId(userId));
    }

    // PATCH /api/ciclo-orcamentario/:id/proad { proad } — registra o PROAD de instrução (RF-22)
    @PatchMapping("/{id:\\d+}/proad")
    @TagAcao("PCA_REGISTRAR_PROAD")
    public CicloDto proad(@PathVariable long id, @RequestBody Map<String, Object> body,
                          @RequestHeader(value = "x-user-id", required = false) Long userId) {
        return service.informarProad(id, str(body.get("proad")), resolveUserId(userId));
    }

    // POST /api/ciclo-orcamentario/revisao { ano } — obtém/abre a revisão ordinária vigente (RF-60)
    @PostMapping("/revisao")
    public CicloDto revisao(@RequestBody Map<String, Object> body,
                            @RequestHeader(value = "x-user-id", required = false) Long userId) {
        return service.getOuAbrirRevisao(anoDoBody(body), resolveUserId(userId));
    }

    // POST /api/ciclo-orcamentario/revisao/extraordinaria { ano } (RF-73/74)
    @PostMapping("/revisao/extraordinaria")
    public CicloDto revisaoExtraordinaria(@RequestBody Map<String, Object> body,
                                          @RequestHeader(value = "x-user-id", required = false) Long userId) {
        return service.abrirRevisaoExtraordinaria(anoDoBody(body), resolveUserId(userId));
    }

    // PATCH /api/ciclo-orcamentario/:id/estado { estado } — transição da esteira (RF-26/32/35/37)
    @PatchMapping("/{id:\\d+}/estado")
    public CicloDto estado(@PathVariable long id, @RequestBody Map<String, Object> body,
                           @RequestHeader(value = "x-user-id", required = false) Long userId) {
        return service.atualizarEstado(id, str(body.get("estado")), resolveUserId(userId));
    }

    // PATCH /api/ciclo-orcamentario/revisao/item/:itemId — edita campos revisáveis de um item (RF-62..69)
    @PatchMapping("/revisao/item/{itemId:\\d+}")
    public Map<String, Object> editarItemRevisao(@PathVariable long itemId,
                                                 @RequestBody Map<String, Object> body,
                                                 @RequestHeader(value = "x-user-id", required = false) Long userId) {
        return service.editarItemRevisao(itemId, body, resolveUserId(userId));
    }

    // GET /api/ciclo-orcamentario/revisao/validacoes?ano=2026 — validação por item da revisão aberta (§8.4)
    @GetMapping("/revisao/validacoes")
    public java.util.List<Map<String, Object>> validacoesRevisao(@RequestParam int ano) {
        return service.validacoesRevisao(ano);
    }

    // PATCH /api/ciclo-orcamentario/revisao/item/:itemId/validar { camada: 1|2 } — valida a demanda (§8.4)
    @PatchMapping("/revisao/item/{itemId:\\d+}/validar")
    public Map<String, Object> validarItemRevisao(@PathVariable long itemId,
                                                  @RequestBody Map<String, Object> body,
                                                  @RequestHeader(value = "x-user-id", required = false) Long userId) {
        int camada = body.get("camada") instanceof Number n ? n.intValue()
                : Integer.parseInt(String.valueOf(body.getOrDefault("camada", "1")).trim());
        return service.validarItemRevisao(itemId, camada, resolveUserId(userId));
    }

    // POST /api/ciclo-orcamentario/revisao/item/:itemId/devolver — devolve a demanda à edição (RN-GERAL-07)
    @PostMapping("/revisao/item/{itemId:\\d+}/devolver")
    public Map<String, Object> devolverItemRevisao(@PathVariable long itemId,
                                                   @RequestHeader(value = "x-user-id", required = false) Long userId) {
        return service.devolverItemRevisao(itemId, resolveUserId(userId));
    }

    // POST /api/ciclo-orcamentario/:id/avancar — encaminha ao próximo ator da esteira (RNF-07)
    @PostMapping("/{id:\\d+}/avancar")
    public CicloDto avancar(@PathVariable long id,
                            @RequestHeader(value = "x-user-id", required = false) Long userId) {
        return service.avancar(id, resolveUserId(userId));
    }

    // POST /api/ciclo-orcamentario/:id/retroceder — retorna ao ator anterior (correção)
    @PostMapping("/{id:\\d+}/retroceder")
    public CicloDto retroceder(@PathVariable long id,
                               @RequestHeader(value = "x-user-id", required = false) Long userId) {
        return service.retroceder(id, resolveUserId(userId));
    }

    // POST /api/ciclo-orcamentario/:id/sincronizar-data — aplica o auto-fechamento por data (RF-31/69)
    @PostMapping("/{id:\\d+}/sincronizar-data")
    public CicloDto sincronizarData(@PathVariable long id,
                                    @RequestHeader(value = "x-user-id", required = false) Long userId) {
        return service.sincronizarPorData(id, resolveUserId(userId));
    }

    // POST /api/ciclo-orcamentario/:id/publicar — publicação pela DG (RF-41/75)
    @PostMapping("/{id:\\d+}/publicar")
    @TagAcao("PCA_REMETER_DG")
    public CicloDto publicar(@PathVariable long id,
                             @RequestHeader(value = "x-user-id", required = false) Long userId) {
        return service.publicar(id, resolveUserId(userId));
    }

    // PATCH /api/ciclo-orcamentario/:id/link { campo, valor }
    @PatchMapping("/{id:\\d+}/link")
    public CicloDto salvarLink(@PathVariable long id,
                               @RequestBody Map<String, Object> body,
                               @RequestHeader(value = "x-user-id", required = false) Long userId) {
        return service.salvarLink(id, str(body.get("campo")), str(body.get("valor")), resolveUserId(userId));
    }

    // DELETE /api/ciclo-orcamentario/:id/link { campo }
    @DeleteMapping("/{id:\\d+}/link")
    public CicloDto excluirLink(@PathVariable long id,
                                @RequestBody Map<String, Object> body,
                                @RequestHeader(value = "x-user-id", required = false) Long userId) {
        return service.excluirLink(id, str(body.get("campo")), resolveUserId(userId));
    }

    private Long resolveUserId(Long headerUserId) {
        if (headerUserId != null) {
            return headerUserId;
        }
        return AuthContext.getCurrentUser().map(br.jus.tjgo.kaizen.auth.AuthenticatedUser::id).orElse(null);
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
