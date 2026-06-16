package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.service.AmbientesService;
import br.jus.tjgo.kaizen.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Porte fiel de routes/ambientes.ts. TODAS as rotas passam por devOnly:
 * só emails da whitelist DEV_EMAILS podem acessar.
 */
@RestController
@RequestMapping("/api/ambientes")
@RequiredArgsConstructor
public class AmbientesController {

    private final AmbientesService service;
    private final UserService userService;

    /** devOnly: userId via principal ou header x-user-id; valida email == DEV_EMAIL. */
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

    private long resolveUserId(HttpServletRequest req) {
        long userId = AuthContext.getCurrentUser().map(u -> u.id()).orElse(0L);
        if (userId == 0) {
            String header = req.getHeader("x-user-id");
            if (header != null && !header.isBlank()) {
                try {
                    userId = Long.parseLong(header.trim());
                } catch (NumberFormatException ignored) {
                    // 0
                }
            }
        }
        return userId;
    }

    @GetMapping
    public ResponseEntity<?> list(HttpServletRequest req) {
        ResponseEntity<?> denied = devOnly(req);
        if (denied != null) {
            return denied;
        }
        return ResponseEntity.ok(service.getAll());
    }

    @GetMapping("/{id:\\d+}")
    public ResponseEntity<?> getById(HttpServletRequest req, @PathVariable long id) {
        ResponseEntity<?> denied = devOnly(req);
        if (denied != null) {
            return denied;
        }
        Map<String, Object> ambiente = service.getById(id);
        if (ambiente == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Ambiente não encontrado"));
        }
        return ResponseEntity.ok(ambiente);
    }

    @PostMapping
    public ResponseEntity<?> create(HttpServletRequest req, @RequestBody Map<String, Object> body) {
        ResponseEntity<?> denied = devOnly(req);
        if (denied != null) {
            return denied;
        }
        if (isBlank(body.get("nome")) || isBlank(body.get("codigo"))
                || isBlank(body.get("sigla_raiz")) || isBlank(body.get("nome_raiz"))) {
            return ResponseEntity.status(400).body(Map.of("error", "Campos obrigatórios: nome, codigo, sigla_raiz, nome_raiz"));
        }
        try {
            Map<String, Object> ambiente = service.create(body, resolveUserId(req));
            return ResponseEntity.status(HttpStatus.CREATED).body(ambiente);
        } catch (DuplicateKeyException e) {
            return ResponseEntity.status(409).body(Map.of("error", "Já existe um ambiente com este código"));
        }
    }

    @PutMapping("/{id:\\d+}")
    public ResponseEntity<?> update(HttpServletRequest req, @PathVariable long id, @RequestBody Map<String, Object> body) {
        ResponseEntity<?> denied = devOnly(req);
        if (denied != null) {
            return denied;
        }
        Map<String, Object> ambiente = service.update(id, body, resolveUserId(req));
        if (ambiente == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Ambiente não encontrado"));
        }
        return ResponseEntity.ok(ambiente);
    }

    @DeleteMapping("/{id:\\d+}")
    public ResponseEntity<?> delete(HttpServletRequest req, @PathVariable long id) {
        ResponseEntity<?> denied = devOnly(req);
        if (denied != null) {
            return denied;
        }
        boolean deleted = service.delete(id, resolveUserId(req));
        if (!deleted) {
            return ResponseEntity.status(404).body(Map.of("error", "Ambiente não encontrado ou já desativado"));
        }
        return ResponseEntity.ok(Map.of("message", "Ambiente desativado com sucesso"));
    }

    @GetMapping("/{codigo}/admins")
    public ResponseEntity<?> getAdmins(HttpServletRequest req, @PathVariable String codigo) {
        ResponseEntity<?> denied = devOnly(req);
        if (denied != null) {
            return denied;
        }
        List<Map<String, Object>> admins = service.getAdmins(codigo);
        return ResponseEntity.ok(admins);
    }

    @PostMapping("/{codigo}/admins")
    public ResponseEntity<?> addAdmin(HttpServletRequest req, @PathVariable String codigo, @RequestBody Map<String, Object> body) {
        ResponseEntity<?> denied = devOnly(req);
        if (denied != null) {
            return denied;
        }
        if (isBlank(body.get("email"))) {
            return ResponseEntity.status(400).body(Map.of("error", "Campos obrigatórios: email"));
        }
        Map<String, Object> admin = service.addAdmin(codigo, body, resolveUserId(req));
        return ResponseEntity.status(HttpStatus.CREATED).body(admin);
    }

    @DeleteMapping("/{codigo}/admins/{userId:\\d+}")
    public ResponseEntity<?> removeAdmin(HttpServletRequest req, @PathVariable String codigo, @PathVariable long userId) {
        ResponseEntity<?> denied = devOnly(req);
        if (denied != null) {
            return denied;
        }
        boolean removed = service.removeAdmin(codigo, userId);
        if (!removed) {
            return ResponseEntity.status(404).body(Map.of("error", "Usuário não encontrado"));
        }
        return ResponseEntity.ok(Map.of("message", "Admin removido com sucesso"));
    }

    @GetMapping("/developers")
    public ResponseEntity<?> getDevelopers(HttpServletRequest req) {
        ResponseEntity<?> denied = devOnly(req);
        if (denied != null) {
            return denied;
        }
        return ResponseEntity.ok(userService.getDevelopers());
    }

    @PostMapping("/developers")
    public ResponseEntity<?> addDeveloper(HttpServletRequest req, @RequestBody Map<String, Object> body) {
        ResponseEntity<?> denied = devOnly(req);
        if (denied != null) {
            return denied;
        }
        Map<String, Object> dev = userService.addDeveloper(body);
        return ResponseEntity.status(HttpStatus.CREATED).body(dev);
    }

    @DeleteMapping("/developers/{userId:\\d+}")
    public ResponseEntity<?> removeDeveloper(HttpServletRequest req, @PathVariable long userId) {
        ResponseEntity<?> denied = devOnly(req);
        if (denied != null) {
            return denied;
        }
        boolean removed = userService.removeDeveloper(userId);
        if (!removed) {
            return ResponseEntity.status(404).body(Map.of("error", "Usuário não encontrado"));
        }
        return ResponseEntity.ok(Map.of("message", "Status de desenvolvedor removido com sucesso"));
    }

    private static boolean isBlank(Object v) {
        return v == null || String.valueOf(v).isBlank();
    }
}
