package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.auth.AuthenticatedUser;
import br.jus.tjgo.kaizen.service.PermissoesTapService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Porte fiel de api/src/routes/permissoes-tap.ts (Node) → Java.
 * Categoria B (strict): exige auth via {@link AuthContext#currentUserId()}.
 */
@RestController
@RequestMapping("/api/permissoes-tap")
@RequiredArgsConstructor
public class PermissoesTapController {

    private final PermissoesTapService service;

    /** ADMIN role OU is_superadmin pode gerir permissões TAP. */
    private boolean canManage() {
        Optional<AuthenticatedUser> u = AuthContext.getCurrentUser();
        if (u.isEmpty()) return false;
        AuthenticatedUser user = u.get();
        return "ADMIN".equals(user.role()) || user.isSuperadmin();
    }

    // ============================================================
    // GET /api/permissoes-tap/me
    // Retorna { temPermissao, diretoria } do usuário logado.
    // ============================================================
    @GetMapping("/me")
    public ResponseEntity<?> me() {
        Long userId = AuthContext.getCurrentUser().map(AuthenticatedUser::id).orElse(null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("temPermissao", service.temPermissao(userId));
        body.put("diretoria", service.getDiretoriaUsuario(userId));
        return ResponseEntity.ok(body);
    }

    // ============================================================
    // GET /api/permissoes-tap/projeto/{projetoId}
    // Retorna { podeEditar: boolean } pro usuário logado naquele projeto.
    // ============================================================
    @GetMapping("/projeto/{projetoId}")
    public ResponseEntity<?> podeEditarProjeto(@PathVariable String projetoId) {
        Long userId = AuthContext.getCurrentUser().map(AuthenticatedUser::id).orElse(null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        long pid;
        try {
            pid = Long.parseLong(projetoId);
        } catch (NumberFormatException e) {
            return ResponseEntity.status(400).body(Map.of("error", "projetoId inválido"));
        }
        return ResponseEntity.ok(Map.of("podeEditar", service.podeEditarTapDoProjeto(userId, pid)));
    }

    // ============================================================
    // GET /api/permissoes-tap — listar (admin/superadmin)
    // ============================================================
    @GetMapping
    public ResponseEntity<?> listar() {
        Long userId = AuthContext.getCurrentUser().map(AuthenticatedUser::id).orElse(null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        if (!canManage()) {
            return ResponseEntity.status(403).body(Map.of(
                "error", "Apenas administradores podem listar permissões do TAP"
            ));
        }
        List<Map<String, Object>> lista = service.listar();
        return ResponseEntity.ok(lista);
    }

    // ============================================================
    // POST /api/permissoes-tap  { user_id }  — conceder (admin/superadmin)
    // ============================================================
    @PostMapping
    public ResponseEntity<?> conceder(@RequestBody(required = false) Map<String, Object> body) {
        Long grantedBy = AuthContext.getCurrentUser().map(AuthenticatedUser::id).orElse(null);
        if (grantedBy == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        if (!canManage()) {
            return ResponseEntity.status(403).body(Map.of(
                "error", "Apenas administradores podem conceder permissão do TAP"
            ));
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

    // ============================================================
    // DELETE /api/permissoes-tap/{userId}  — revogar (admin/superadmin)
    // ============================================================
    @DeleteMapping("/{userId}")
    public ResponseEntity<?> revogar(@PathVariable String userId) {
        Long actor = AuthContext.getCurrentUser().map(AuthenticatedUser::id).orElse(null);
        if (actor == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        if (!canManage()) {
            return ResponseEntity.status(403).body(Map.of(
                "error", "Apenas administradores podem revogar permissão do TAP"
            ));
        }
        long target;
        try {
            target = Long.parseLong(userId);
        } catch (NumberFormatException e) {
            return ResponseEntity.status(400).body(Map.of("error", "userId inválido"));
        }
        boolean ok = service.revogar(target);
        if (!ok) {
            return ResponseEntity.status(404).body(Map.of("error", "Permissão não encontrada"));
        }
        return ResponseEntity.noContent().build();
    }
}
