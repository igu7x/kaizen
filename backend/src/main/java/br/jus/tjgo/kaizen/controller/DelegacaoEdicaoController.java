package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.dto.DelegacaoEdicaoDto;
import br.jus.tjgo.kaizen.dto.DelegacaoEdicaoReq;
import br.jus.tjgo.kaizen.service.DelegacaoEdicaoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Delegação de permissões de edição por etapa do ciclo orçamentário.
 * Autenticação por header x-user-id (padrão do domínio de contratações).
 */
@RestController
@RequestMapping("/api/ciclo-orcamentario/{cicloId}/delegacoes")
@RequiredArgsConstructor
public class DelegacaoEdicaoController {

    private final DelegacaoEdicaoService service;

    @PostMapping
    public ResponseEntity<DelegacaoEdicaoDto> criar(
            @PathVariable long cicloId,
            @Valid @RequestBody DelegacaoEdicaoReq req,
            @RequestHeader(value = "x-user-id", required = false) Long headerUserId) {
        Long userId = resolveUserId(headerUserId);
        DelegacaoEdicaoDto dto = service.delegar(cicloId, req, userId);
        return ResponseEntity.ok(dto);
    }

    @DeleteMapping("/{id:\\d+}")
    public ResponseEntity<Void> revogar(
            @PathVariable long cicloId,
            @PathVariable long id,
            @RequestHeader(value = "x-user-id", required = false) Long headerUserId) {
        Long userId = resolveUserId(headerUserId);
        service.revogar(id, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public List<DelegacaoEdicaoDto> listar(
            @PathVariable long cicloId,
            @RequestParam String estado) {
        return service.listar(cicloId, estado);
    }

    @GetMapping("/minha")
    public ResponseEntity<Map<String, Object>> minhaDelegacao(
            @PathVariable long cicloId,
            @RequestParam String estado,
            @RequestHeader(value = "x-user-id", required = false) Long headerUserId) {
        Long userId = resolveUserId(headerUserId);
        boolean tem = service.temDelegacao(cicloId, estado, userId);
        String tipo = tem ? service.tipoDelegacao(cicloId, estado, userId) : null;
        boolean temTransicao = service.temTagTransicao(estado, userId);
        return ResponseEntity.ok(Map.of(
                "tem_delegacao", tem,
                "tipo", tipo != null ? tipo : "",
                "tem_tag_transicao", temTransicao
        ));
    }

    private Long resolveUserId(Long headerUserId) {
        if (headerUserId != null) return headerUserId;
        return AuthContext.getCurrentUser()
                .map(br.jus.tjgo.kaizen.auth.AuthenticatedUser::id)
                .orElse(null);
    }
}
