package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.exception.ApiException;
import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.service.ParametrosCicloService;
import br.jus.tjgo.kaizen.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Endpoints REST para parametrização do Ciclo Orçamentário (Contratações de TIC).
 * Leitura aberta; escrita restrita a usuários com is_developer = true.
 */
@RestController
@RequestMapping("/api/parametros-ciclo")
@RequiredArgsConstructor
public class ParametrosCicloController {

    private final ParametrosCicloService service;
    private final UserService userService;

    // ==================== LEITURA (aberta) ====================

    /** GET /api/parametros-ciclo/formacao — fases da Formação do PCA */
    @GetMapping("/formacao")
    public List<Map<String, Object>> getFasesFormacao() {
        return service.getFasesFormacao();
    }

    /** GET /api/parametros-ciclo/revisao — janelas ordinárias da Revisão */
    @GetMapping("/revisao")
    public List<Map<String, Object>> getJanelasRevisao() {
        return service.getJanelasRevisao();
    }

    /** GET /api/parametros-ciclo/geral — parâmetros gerais */
    @GetMapping("/geral")
    public List<Map<String, Object>> getParametrosGerais() {
        return service.getParametrosGerais();
    }

    /** GET /api/parametros-ciclo — todos os parâmetros agrupados */
    @GetMapping
    public Map<String, Object> getTodos() {
        return Map.of(
                "formacao", service.getFasesFormacao(),
                "revisao", service.getJanelasRevisao(),
                "geral", service.getParametrosGerais());
    }

    // ==================== ESCRITA (is_developer only) ====================

    /** PUT /api/parametros-ciclo/formacao — atualiza fases da Formação */
    @PutMapping("/formacao")
    public List<Map<String, Object>> salvarFasesFormacao(
            @RequestBody List<Map<String, Object>> fases,
            @RequestHeader(value = "x-user-id", required = false) Long userId) {
        Long uid = resolveAndGuard(userId);
        return service.salvarFasesFormacao(fases, uid);
    }

    /** PUT /api/parametros-ciclo/revisao — atualiza janelas de Revisão */
    @PutMapping("/revisao")
    public List<Map<String, Object>> salvarJanelasRevisao(
            @RequestBody List<Map<String, Object>> janelas,
            @RequestHeader(value = "x-user-id", required = false) Long userId) {
        Long uid = resolveAndGuard(userId);
        return service.salvarJanelasRevisao(janelas, uid);
    }

    /** PUT /api/parametros-ciclo/geral/{chave} — atualiza um parâmetro geral */
    @PutMapping("/geral/{chave}")
    public Map<String, Object> salvarParametroGeral(
            @PathVariable String chave,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "x-user-id", required = false) Long userId) {
        Long uid = resolveAndGuard(userId);
        String valor = body.get("valor") != null ? String.valueOf(body.get("valor")).trim() : null;
        return service.salvarParametroGeral(chave, valor, uid);
    }

    // ==================== HELPERS ====================

    private Long resolveAndGuard(Long headerUserId) {
        Long uid = headerUserId != null
                ? headerUserId
                : AuthContext.getCurrentUser()
                .map(br.jus.tjgo.kaizen.auth.AuthenticatedUser::id)
                .orElse(null);
        if (uid == null) {
            throw new ApiException(401, "Usuário não autenticado");
        }
        if (!userService.isSuperadmin(uid)) {
            throw new ApiException(403, "Acesso restrito a administradores (is_superadmin)");
        }
        return uid;
    }
}
