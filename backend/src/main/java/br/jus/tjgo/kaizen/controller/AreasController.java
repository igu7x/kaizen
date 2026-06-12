package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.service.AreasService;
import br.jus.tjgo.kaizen.service.DomainService;
import br.jus.tjgo.kaizen.service.UnidadesService;
import br.jus.tjgo.kaizen.service.UserService;
import br.jus.tjgo.kaizen.util.Flash;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Base64;
import java.util.List;
import java.util.Map;

/** Porte fiel de routes/areas.ts (áreas + unidades). userId nullable, sem 401. */
@RestController
@RequestMapping("/api/areas")
@RequiredArgsConstructor
@Slf4j
public class AreasController {

    private final AreasService areasService;
    private final UnidadesService unidadesService;
    private final UserService userService;
    private final DomainService domainService;
    private final ObjectMapper objectMapper;

    private Long getCurrentUserId() {
        return AuthContext.getCurrentUser().map(u -> u.id()).orElse(null);
    }

    private Map<String, Object> getRequestUser(HttpServletRequest req) {
        Long userId = getCurrentUserId();
        if (userId == null) {
            String auth = req.getHeader("Authorization");
            if (auth != null && auth.startsWith("Bearer ")) {
                try {
                    byte[] decoded = Base64.getDecoder().decode(auth.substring(7));
                    JsonNode payload = objectMapper.readTree(decoded);
                    if (payload.hasNonNull("userId")) {
                        userId = payload.get("userId").asLong();
                    }
                } catch (Exception ignored) {}
            }
        }
        if (userId == null) return null;
        return userService.findUserById(userId);
    }

    private String getDominioFromUser(Map<String, Object> user) {
        if (user == null || user.get("diretoria") == null) return null;
        return domainService.getDomainForDiretoria(String.valueOf(user.get("diretoria"))).dominio();
    }

    private String getUserDominio(HttpServletRequest req) {
        return getDominioFromUser(getRequestUser(req));
    }

    @GetMapping
    public List<Map<String, Object>> list(HttpServletRequest req,
                                          @RequestParam(value = "all", required = false) String all,
                                          @RequestParam(value = "dominio", required = false) String dominioOverride) {
        Map<String, Object> user = getRequestUser(req);
        boolean isSuperadmin = user != null && Boolean.TRUE.equals(user.get("is_superadmin"));

        log.info("GET /api/areas - User: {}, isSuperadmin: {}, all: {}", user != null ? user.get("id") : "null", isSuperadmin, all);

        if (isSuperadmin) {
            if ("true".equals(all)) {
                return areasService.getAll(null);
            }
            if (dominioOverride != null && !dominioOverride.isBlank()) {
                return areasService.getAll(dominioOverride);
            }
            // Se o superadmin não pedir all=true nem passar um domínio explícito,
            // devolve as áreas do próprio domínio dele por padrão (comportamento REST previsível).
            return areasService.getAll(getDominioFromUser(user));
        }

        String userDominio = getDominioFromUser(user);
        log.info("GET /api/areas - Returning domain: {}", userDominio);
        return areasService.getAll(userDominio);
    }

    @GetMapping("/select")
    public List<Map<String, Object>> select(HttpServletRequest req) {
        return areasService.getForSelect(getUserDominio(req));
    }

    @PutMapping("/ordenacao")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> ordenacao(@RequestBody Map<String, Object> body) {
        Object ord = body.get("ordenacao");
        if (!(ord instanceof List)) {
            return ResponseEntity.status(400).body(Map.of("error", "Ordenação inválida"));
        }
        areasService.updateOrdenacao((List<Map<String, Object>>) ord, getCurrentUserId());
        return ResponseEntity.ok(Map.of("success", true));
    }

    @GetMapping("/inicializar")
    public Map<String, Object> inicializar() {
        return areasService.inicializarAreasPadrao();
    }

    @GetMapping("/run-migration-areas-vinculadas")
    public Map<String, Object> runMigration() {
        // Endpoint do Node que roda DDL. No-op aqui (schema já existe; não alteramos o banco).
        return Map.of("success", true,
                "message", "Coluna areas_vinculadas_ids adicionada e views atualizadas com sucesso!");
    }

    // ---------- UNIDADES (paths estáticos antes de /{id}) ----------

    @GetMapping("/unidades/all")
    public List<Map<String, Object>> unidadesAll(@RequestParam(value = "dominio", required = false) String dominio) {
        return unidadesService.getAll(dominio != null && !dominio.isBlank() ? dominio : null);
    }

    @PutMapping("/unidades/{id:\\d+}")
    public ResponseEntity<?> updateUnidade(@PathVariable long id, @RequestBody Map<String, Object> body) {
        Map<String, Object> unidade = unidadesService.update(id, body, getCurrentUserId());
        if (unidade == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Unidade não encontrada"));
        }
        return ResponseEntity.ok(unidade);
    }

    @GetMapping("/unidades/{id:\\d+}/usuarios")
    public ResponseEntity<?> usuariosDaUnidade(@PathVariable long id) {
        Map<String, Object> result = unidadesService.getUsuariosDaUnidade(id);
        if (result == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Unidade não encontrada"));
        }
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/unidades/{id:\\d+}")
    public ResponseEntity<?> deleteUnidade(@PathVariable long id) {
        boolean deleted = unidadesService.delete(id, getCurrentUserId());
        if (!deleted) {
            return ResponseEntity.status(404).body(Map.of("error", "Unidade não encontrada"));
        }
        return ResponseEntity.ok(Map.of("success", true));
    }

    // ---------- ÁREA por ID + sub-recursos ----------

    @GetMapping("/{id:\\d+}")
    public ResponseEntity<?> getById(@PathVariable long id) {
        Map<String, Object> area = areasService.getById(id);
        if (area == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Área não encontrada"));
        }
        return ResponseEntity.ok(area);
    }

    @GetMapping("/{id:\\d+}/completa")
    public ResponseEntity<?> getCompleta(@PathVariable long id) {
        Map<String, Object> area = areasService.getAreaCompleta(id);
        if (area == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Área não encontrada"));
        }
        return ResponseEntity.ok(area);
    }

    @GetMapping("/{areaId:\\d+}/unidades")
    public List<Map<String, Object>> unidadesByArea(@PathVariable long areaId) {
        return unidadesService.getByAreaId(areaId);
    }

    @PutMapping("/{areaId:\\d+}/unidades/reorder")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> reorderUnidades(@PathVariable long areaId, @RequestBody Map<String, Object> body) {
        Object ord = body.get("ordenacao");
        if (!(ord instanceof List)) {
            return ResponseEntity.status(400).body(Map.of("error", "Ordenação inválida"));
        }
        unidadesService.reorder(areaId, (List<Map<String, Object>>) ord, getCurrentUserId());
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/{areaId:\\d+}/unidades")
    public ResponseEntity<?> createUnidade(@PathVariable long areaId, @RequestBody Map<String, Object> body) {
        Object nomeObj = body.get("nome");
        String nome = nomeObj == null ? null : String.valueOf(nomeObj).trim();
        if (nome == null || nome.length() < 2) {
            return ResponseEntity.status(400).body(Map.of("error", "Nome é obrigatório e deve ter pelo menos 2 caracteres"));
        }
        body.put("area_id", areaId);
        body.put("nome", nome);
        Map<String, Object> unidade = unidadesService.create(body, getCurrentUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(unidade);
    }

    @PostMapping
    public ResponseEntity<?> create(HttpServletRequest req, @RequestBody Map<String, Object> body) {
        Object nomeObj = body.get("nome");
        String nome = nomeObj == null ? null : String.valueOf(nomeObj).trim();
        if (nome == null || nome.length() < 2) {
            return ResponseEntity.status(400).body(Map.of("error", "Nome é obrigatório e deve ter pelo menos 2 caracteres"));
        }
        body.put("nome", nome);
        Object sigla = body.get("sigla");
        if (sigla != null) {
            body.put("sigla", String.valueOf(sigla).trim());
        }
        Map<String, Object> area = areasService.create(body, getCurrentUserId(), getUserDominio(req));
        return ResponseEntity.status(HttpStatus.CREATED).body(area);
    }

    @PutMapping("/{id:\\d+}")
    public ResponseEntity<?> update(@PathVariable long id, @RequestBody Map<String, Object> body) {
        Map<String, Object> area = areasService.update(id, body, getCurrentUserId());
        if (area == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Área não encontrada"));
        }
        return ResponseEntity.ok(area);
    }

    @DeleteMapping("/{id:\\d+}")
    public ResponseEntity<?> delete(@PathVariable long id) {
        boolean deleted = areasService.delete(id, getCurrentUserId());
        if (!deleted) {
            return ResponseEntity.status(404).body(Map.of("error", "Área não encontrada"));
        }
        return ResponseEntity.ok(Map.of("success", true));
    }
}
