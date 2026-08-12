package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.auth.AuthenticatedUser;
import br.jus.tjgo.kaizen.service.PermissoesProcessosTiService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Permissões dos Processos (Tecnologia da Informação). Espelha PermissoesTapController.
 * Categoria B (strict): exige auth. Gerência (listar/conceder/revogar) restrita a
 * ADMIN ou is_superadmin.
 */
@RestController
@RequestMapping("/api/permissoes-processos-ti")
@RequiredArgsConstructor
public class PermissoesProcessosTiController {

    private final PermissoesProcessosTiService service;

    private boolean canManage() {
        Optional<AuthenticatedUser> u = AuthContext.getCurrentUser();
        if (u.isEmpty()) return false;
        AuthenticatedUser user = u.get();
        return "ADMIN".equals(user.role()) || user.isSuperadmin();
    }

    // GET /api/permissoes-processos-ti/me → { temPermissao }
    @GetMapping("/me")
    public ResponseEntity<?> me() {
        Long userId = AuthContext.getCurrentUser().map(AuthenticatedUser::id).orElse(null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("temPermissao", service.temPermissao(userId));
        return ResponseEntity.ok(body);
    }

    // GET /api/permissoes-processos-ti — listar (admin/superadmin)
    @GetMapping
    public ResponseEntity<?> listar() {
        Long userId = AuthContext.getCurrentUser().map(AuthenticatedUser::id).orElse(null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        if (!canManage()) {
            return ResponseEntity.status(403).body(Map.of(
                    "error", "Apenas administradores podem listar as permissões dos processos"));
        }
        return ResponseEntity.ok(service.listar());
    }

    // POST /api/permissoes-processos-ti { user_id } — conceder (admin/superadmin)
    @PostMapping
    public ResponseEntity<?> conceder(@RequestBody(required = false) Map<String, Object> body) {
        Long grantedBy = AuthContext.getCurrentUser().map(AuthenticatedUser::id).orElse(null);
        if (grantedBy == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        if (!canManage()) {
            return ResponseEntity.status(403).body(Map.of(
                    "error", "Apenas administradores podem conceder permissão dos processos"));
        }
        Object raw = body == null ? null : body.get("user_id");
        if (raw == null) {
            return ResponseEntity.status(400).body(Map.of("error", "user_id é obrigatório e deve ser numérico"));
        }
        long userId;
        try {
            userId = Long.parseLong(String.valueOf(raw));
        } catch (NumberFormatException e) {
            return ResponseEntity.status(400).body(Map.of("error", "user_id é obrigatório e deve ser numérico"));
        }
        Map<String, Object> created = service.conceder(userId, grantedBy);
        if (created == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Usuário não encontrado"));
        }
        return ResponseEntity.status(201).body(created);
    }

    // DELETE /api/permissoes-processos-ti/{userId} — revogar (admin/superadmin)
    @DeleteMapping("/{userId}")
    public ResponseEntity<?> revogar(@PathVariable String userId) {
        Long actor = AuthContext.getCurrentUser().map(AuthenticatedUser::id).orElse(null);
        if (actor == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        if (!canManage()) {
            return ResponseEntity.status(403).body(Map.of(
                    "error", "Apenas administradores podem revogar permissão dos processos"));
        }
        long target;
        try {
            target = Long.parseLong(userId);
        } catch (NumberFormatException e) {
            return ResponseEntity.status(400).body(Map.of("error", "userId inválido"));
        }
        if (!service.revogar(target)) {
            return ResponseEntity.status(404).body(Map.of("error", "Permissão não encontrada"));
        }
        return ResponseEntity.ok(Collections.singletonMap("success", true));
    }
}
