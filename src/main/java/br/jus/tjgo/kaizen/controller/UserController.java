package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.service.DomainService;
import br.jus.tjgo.kaizen.service.UserService;
import br.jus.tjgo.kaizen.util.Flash;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de routes/users.ts. Categoria A (permissivo): getCurrentUserId tem fallback 1.
 * Ver docs/AUTH_AUDIT.md (correção da 2ª tentativa).
 */
@Slf4j
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final DomainService domainService;
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    /** Espelha getCurrentUserId(req): principal -> header X-User-Id -> Bearer base64 -> 1. */
    private long getCurrentUserId(HttpServletRequest req) {
        var current = AuthContext.getCurrentUser();
        if (current.isPresent()) {
            return current.get().id();
        }
        String headerUserId = req.getHeader("X-User-Id");
        if (headerUserId != null && !headerUserId.isBlank()) {
            try {
                return Long.parseLong(headerUserId.trim());
            } catch (NumberFormatException ignored) {
                // segue
            }
        }
        String auth = req.getHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            try {
                byte[] decoded = Base64.getDecoder().decode(auth.substring(7));
                JsonNode payload = objectMapper.readTree(decoded);
                if (payload.hasNonNull("userId")) {
                    return payload.get("userId").asLong();
                }
            } catch (Exception ignored) {
                // segue
            }
        }
        return 1L;
    }

    @GetMapping("/me/perfil")
    public ResponseEntity<?> getMeuPerfil(HttpServletRequest req) {
        long userId = getCurrentUserId(req);
        Map<String, Object> user = userService.findUserById(userId);
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Usuário não encontrado"));
        }

        Object unidadeNome = null;
        Object cargoEfetivo = null;
        Object codigo = null;
        try {
            var rows = jdbc.queryForList(
                    "SELECT cu.nome AS unidade_nome, cp.cargo_efetivo, cp.cc_fc_classe " +
                            "FROM cadastros_pessoas cp " +
                            "LEFT JOIN cadastros_unidades cu ON cu.id = cp.unidade_id " +
                            "WHERE cp.user_id = ? AND cp.ativo = TRUE " +
                            "ORDER BY cp.ordem NULLS LAST, cp.id LIMIT 1",
                    userId);
            if (!rows.isEmpty()) {
                var row = rows.get(0);
                unidadeNome = row.get("unidade_nome");
                cargoEfetivo = row.get("cargo_efetivo");
                codigo = row.get("cc_fc_classe");
            }
        } catch (Exception e) {
            log.warn("[GET /users/me/perfil] erro ao buscar dados da pessoa: {}", e.getMessage());
        }

        Map<String, Object> body = new LinkedHashMap<>(user);
        body.put("unidade_nome", unidadeNome);
        body.put("cargo_efetivo", cargoEfetivo);
        body.put("codigo", codigo);
        return ResponseEntity.ok(body);
    }

    @PatchMapping("/me/perfil")
    public ResponseEntity<?> updateMeuPerfil(HttpServletRequest req,
                                             @RequestBody(required = false) Map<String, Object> body) {
        long userId = getCurrentUserId(req);
        Map<String, Object> in = body == null ? Map.of() : body;

        Object foto = in.get("foto_perfil");
        if (foto instanceof String s && s.length() > 1_500_000) {
            return ResponseEntity.status(413).body(Map.of("error", "Foto de perfil muito grande. Tente uma imagem menor."));
        }

        Map<String, Object> provided = new LinkedHashMap<>();
        if (in.containsKey("matricula")) {
            provided.put("matricula", emptyToNull(in.get("matricula")));
        }
        if (in.containsKey("cargo_funcao")) {
            provided.put("cargo_funcao", emptyToNull(in.get("cargo_funcao")));
        }
        if (in.containsKey("foto_perfil")) {
            provided.put("foto_perfil", emptyToNull(in.get("foto_perfil")));
        }

        Map<String, Object> updated = userService.updateOwnProfile(userId, provided);
        if (updated == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Usuário não encontrado"));
        }
        return ResponseEntity.ok(updated);
    }

    @GetMapping
    public List<Map<String, Object>> listUsers(HttpServletRequest req,
                                               @RequestParam(value = "dominio", required = false) String dominioParam) {
        long userId = getCurrentUserId(req);
        String dominio = (dominioParam != null && !dominioParam.isBlank()) ? dominioParam : null;
        if (dominio == null) {
            Map<String, Object> user = userService.findUserById(userId);
            // Filtra pelo domínio da diretoria do usuário, garantindo isolamento mesmo para superadmins
            if (user != null && user.get("diretoria") != null) {
                dominio = domainService.getDomainForDiretoria(String.valueOf(user.get("diretoria"))).dominio();
            }
        }
        return userService.findAllUsers("name", dominio);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getUser(@PathVariable String id) {
        Map<String, Object> user = userService.findUserById(Long.parseLong(id));
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Usuário não encontrado"));
        }
        return ResponseEntity.ok(user);
    }

    @PostMapping
    public ResponseEntity<?> createUser(HttpServletRequest req, @RequestBody Map<String, Object> body) {
        if (isBlank(body.get("name")) || isBlank(body.get("email")) || isBlank(body.get("role"))) {
            return ResponseEntity.status(400).body(Map.of("error", "Campos obrigatórios: name, email, role"));
        }
        long currentUserId = getCurrentUserId(req);
        Map<String, Object> user = userService.createUser(body, currentUserId);
        userService.syncPessoaUserId(String.valueOf(body.get("email")), ((Number) user.get("id")).longValue());
        return ResponseEntity.status(HttpStatus.CREATED).body(user);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateUser(HttpServletRequest req, @PathVariable String id,
                                        @RequestBody Map<String, Object> body) {
        long currentUserId = getCurrentUserId(req);
        Map<String, Object> user = userService.updateUser(Long.parseLong(id), body, currentUserId);
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Usuário não encontrado"));
        }
        Object email = user.get("email");
        if (email != null) {
            userService.syncPessoaUserId(String.valueOf(email), ((Number) user.get("id")).longValue());
        }
        return ResponseEntity.ok(user);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(HttpServletRequest req, @PathVariable String id) {
        long currentUserId = getCurrentUserId(req);
        long userId;
        try {
            userId = Long.parseLong(id);
        } catch (NumberFormatException e) {
            return ResponseEntity.status(400).body(Map.of("error", "ID do usuário inválido"));
        }
        if (userId == currentUserId) {
            return ResponseEntity.status(400).body(Map.of("error", "Não é possível excluir seu próprio usuário"));
        }
        boolean deleted = userService.deleteUser(userId, currentUserId);
        if (!deleted) {
            return ResponseEntity.status(404).body(Map.of("error", "Usuário não encontrado"));
        }
        return ResponseEntity.ok(Map.of("success", true));
    }

    @GetMapping("/{id}/responses")
    public List<Map<String, Object>> getUserResponses(@PathVariable String id) {
        return userService.findUserResponses(Long.parseLong(id));
    }

    private static boolean isBlank(Object v) {
        return v == null || String.valueOf(v).isBlank();
    }

    private static Object emptyToNull(Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof String s) {
            return s.isEmpty() ? null : s;
        }
        return v;
    }
}
