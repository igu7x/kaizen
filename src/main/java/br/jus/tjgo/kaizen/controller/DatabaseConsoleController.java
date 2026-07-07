package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.service.DatabaseConsoleService;
import br.jus.tjgo.kaizen.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/database")
@RequiredArgsConstructor
public class DatabaseConsoleController {

    private final DatabaseConsoleService databaseConsoleService;
    private final UserService userService;

    /** devOnly: userId via principal ou header x-user-id; valida se é dev. */
    private ResponseEntity<?> devOnly(HttpServletRequest req) {
        long userId = AuthContext.getCurrentUser().map(u -> u.id()).orElse(0L);
        if (userId == 0) {
            String header = req.getHeader("x-user-id");
            if (header != null && !header.isBlank()) {
                try {
                    userId = Long.parseLong(header.trim());
                } catch (NumberFormatException ignored) {
                    userId = 0;
                }
            }
        }
        if (userId == 0) {
            return ResponseEntity.status(403).body(Map.of("error", "Acesso negado: usuário não identificado"));
        }
        if (!userService.isDeveloper(userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Acesso negado: apenas desenvolvedores autorizados"));
        }
        return null;
    }

    @PostMapping("/query")
    public ResponseEntity<?> executeQuery(HttpServletRequest req, @RequestBody Map<String, String> body) {
        ResponseEntity<?> denied = devOnly(req);
        if (denied != null) {
            return denied;
        }

        String query = body.get("query");
        if (query == null || query.isBlank()) {
            return ResponseEntity.status(400).body(Map.of("error", "A query não pode estar vazia."));
        }

        Map<String, Object> result = databaseConsoleService.executeQuery(query);
        return ResponseEntity.ok(result);
    }
}
