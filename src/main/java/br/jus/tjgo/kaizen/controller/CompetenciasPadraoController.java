package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.auth.AuthenticatedUser;
import br.jus.tjgo.kaizen.exception.ApiException;
import br.jus.tjgo.kaizen.service.CompetenciasPadraoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Porte fiel de competenciasPadrao.ts. Montado em /api/competencias-padrao (com authenticate).
 * Mutations e listagens admin exigem superadmin (requireSuperAdmin).
 */
@RestController
@RequestMapping("/api/competencias-padrao")
@RequiredArgsConstructor
public class CompetenciasPadraoController {

    private final CompetenciasPadraoService service;
    private final JdbcTemplate jdbc;

    // GET /api/competencias-padrao — listar competências ativas (qualquer autenticado)
    @GetMapping
    public Object listAtivas() {
        return service.findAllActive();
    }

    // GET /api/competencias-padrao/all — listar todas (admin)
    @GetMapping("/all")
    public Object listAll() {
        requireSuperAdmin();
        return service.findAll();
    }

    // GET /api/competencias-padrao/versao-atual
    @GetMapping("/versao-atual")
    public Map<String, Object> versaoAtual() {
        return Map.of("versao", service.getCurrentVersion());
    }

    // GET /api/competencias-padrao/versoes — histórico (admin)
    @GetMapping("/versoes")
    public Object versoes() {
        requireSuperAdmin();
        return service.getVersionHistory();
    }

    // GET /api/competencias-padrao/pending-changes (admin)
    @GetMapping("/pending-changes")
    public Map<String, Object> pendingChanges() {
        requireSuperAdmin();
        return Map.of("hasPendingChanges", service.hasPendingChanges());
    }

    // GET /api/competencias-padrao/diff/:fromVersion
    @GetMapping("/diff/{fromVersion:\\d+}")
    public Object diff(@PathVariable int fromVersion) {
        return service.getDiffSinceVersion(fromVersion);
    }

    // POST /api/competencias-padrao — criar (admin)
    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        long userId = requireSuperAdmin();
        String tipo = str(body.get("tipo"));
        String nome = str(body.get("nome"));
        String descricao = str(body.get("descricao"));
        if (tipo == null || nome == null || descricao == null) {
            return ResponseEntity.status(400).body(Map.of("error", "Campos tipo, nome e descricao são obrigatórios"));
        }
        Integer ordem = asInt(body.get("ordem"));
        Map<String, Object> comp = service.create(tipo, nome, descricao, ordem, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(comp);
    }

    // PUT /api/competencias-padrao/:id — atualizar (admin)
    @PutMapping("/{id:\\d+}")
    public Object update(@PathVariable long id, @RequestBody Map<String, Object> body) {
        long userId = requireSuperAdmin();
        return service.update(id, str(body.get("nome")), str(body.get("descricao")), asInt(body.get("ordem")), userId);
    }

    // DELETE /api/competencias-padrao/:id — desativar (admin)
    @DeleteMapping("/{id:\\d+}")
    public Map<String, Object> delete(@PathVariable long id) {
        long userId = requireSuperAdmin();
        service.softDelete(id, userId);
        return Map.of("success", true);
    }

    // POST /api/competencias-padrao/:id/reactivate — reativar (admin)
    @PostMapping("/{id:\\d+}/reactivate")
    public Map<String, Object> reactivate(@PathVariable long id) {
        long userId = requireSuperAdmin();
        service.reactivate(id, userId);
        return Map.of("success", true);
    }

    // POST /api/competencias-padrao/publicar — publicar nova versão (admin)
    @PostMapping("/publicar")
    public Object publicar() {
        long userId = requireSuperAdmin();
        return service.publish(userId);
    }

    /**
     * Espelha requireSuperAdmin do Node: 401 se não autenticado/erro de consulta, 403 se não superadmin.
     * Retorna o userId (getCurrentUserId) para uso nas mutations.
     */
    private long requireSuperAdmin() {
        Long userId = AuthContext.getCurrentUser().map(AuthenticatedUser::id).orElse(null);
        if (userId == null) {
            throw new ApiException(401, "Não autenticado");
        }
        Boolean isSuper;
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT is_superadmin FROM users WHERE id = ?", userId);
            isSuper = !rows.isEmpty() && Boolean.TRUE.equals(rows.get(0).get("is_superadmin"));
        } catch (Exception e) {
            throw new ApiException(401, "Não autenticado");
        }
        if (!Boolean.TRUE.equals(isSuper)) {
            throw new ApiException(403, "Acesso restrito a superadministradores");
        }
        return userId;
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    private static Integer asInt(Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof Number n) {
            return n.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(v));
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
