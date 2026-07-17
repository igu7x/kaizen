package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.service.AutoavaliacaoService;
import br.jus.tjgo.kaizen.service.DomainService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Porte fiel de autoavaliacao.ts. Montado em /api/autoavaliacao.
 * Categoria A — getCurrentUserId = requestUserId() (fallback 1). DELETE exige ADMIN.
 */
@RestController
@RequestMapping("/api/autoavaliacao")
@RequiredArgsConstructor
public class AutoavaliacaoController {

    private final AutoavaliacaoService service;
    private final DomainService domainService;
    private final JdbcTemplate jdbc;

    private Long currentUserId() {
        return AuthContext.requestUserId();
    }

    // GET /api/autoavaliacao
    @GetMapping
    public List<Map<String, Object>> list(@RequestParam(value = "cadastrosAreasId", required = false) Long cadastrosAreasId,
                                           @RequestParam(value = "dominio", required = false) String dominio,
                                           @RequestParam(value = "tipo_inventario", required = false) String tipoInventario) {
        if (cadastrosAreasId == null && dominio == null) {
            Long userAreaId = lookupUserAreaId(currentUserId());
            if (userAreaId != null) {
                var domain = domainService.getDomainForArea(userAreaId);
                return service.findAllByDomain(domain.areasIdInDomain(), tipoInventario);
            }
        }
        if (dominio != null) {
            var domain = domainService.getDomainForDiretoria(dominio);
            return service.findAllByDomain(domain.areasIdInDomain(), tipoInventario);
        }
        if (cadastrosAreasId != null) {
            var domain = domainService.getDomainForArea(cadastrosAreasId);
            return service.findAllByDomain(domain.areasIdInDomain(), tipoInventario);
        }
        return service.findAll(null, tipoInventario);
    }

    // GET /api/autoavaliacao/meu
    @GetMapping("/meu")
    public Map<String, Object> meu(@RequestParam(value = "tipo_inventario", required = false, defaultValue = "equipe") String tipoInventario) {
        return service.findByUserId(currentUserId(), tipoInventario);
    }

    // GET /api/autoavaliacao/por-unidade/:unidadeId
    @GetMapping("/por-unidade/{unidadeId:\\d+}")
    public List<Map<String, Object>> porUnidade(@PathVariable long unidadeId,
                                                @RequestParam(value = "tipo_inventario", required = false, defaultValue = "equipe") String tipoInventario) {
        return service.findByUnidade(unidadeId, tipoInventario);
    }

    // GET /api/autoavaliacao/:id/versoes
    @GetMapping("/{id:\\d+}/versoes")
    public List<Map<String, Object>> versoes(@PathVariable long id) {
        return service.findVersoes(id);
    }

    // GET /api/autoavaliacao/:id/versoes/:versao
    @GetMapping("/{id:\\d+}/versoes/{versao:\\d+}")
    public ResponseEntity<?> versaoDados(@PathVariable long id, @PathVariable int versao) {
        Object dados = service.findVersaoDados(id, versao);
        if (dados == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Versão não encontrada"));
        }
        return ResponseEntity.ok(dados);
    }

    // GET /api/autoavaliacao/:id
    @GetMapping("/{id:\\d+}")
    public ResponseEntity<?> byId(@PathVariable long id) {
        Map<String, Object> formulario = service.findById(id);
        if (formulario == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Formulário não encontrado"));
        }
        return ResponseEntity.ok(formulario);
    }

    // POST /api/autoavaliacao
    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        long userId = currentUserId();
        if (isBlank(body.get("nome_completo")) || isBlank(body.get("matricula")) || isBlank(body.get("cargo_funcao"))
                || isBlank(body.get("email_institucional")) || isBlank(body.get("diretoria")) || isEmptyList(body.get("respostas"))) {
            return ResponseEntity.status(400).body(Map.of("error", "Campos obrigatórios faltando"));
        }
        Map<String, Object> formulario = service.create(body, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(formulario);
    }

    // PATCH /api/autoavaliacao/:id/validar
    @PatchMapping("/{id:\\d+}/validar")
    public ResponseEntity<?> validar(@PathVariable long id) {
        long userId = currentUserId();
        String userName = lookupUserName(userId);
        Map<String, Object> result = service.validar(id, userId, userName);
        if (result != null && result.containsKey("error")) {
            return ResponseEntity.status(403).body(Map.of("error", result.get("error")));
        }
        return ResponseEntity.ok(result);
    }

    // DELETE /api/autoavaliacao/:id (ADMIN)
    @DeleteMapping("/{id:\\d+}")
    public Map<String, Object> delete(@PathVariable long id) {
        AuthContext.requireRole(List.of("ADMIN"));
        service.delete(id, currentUserId());
        return Map.of("message", "Formulário removido com sucesso");
    }

    private Long lookupUserAreaId(long userId) {
        var rows = jdbc.queryForList("SELECT cadastros_areas_id FROM users WHERE id = ?", userId);
        return rows.isEmpty() ? null : (Long) rows.get(0).get("cadastros_areas_id");
    }

    private String lookupUserName(long userId) {
        var rows = jdbc.queryForList("SELECT name FROM users WHERE id = ?", userId);
        Object name = rows.isEmpty() ? null : rows.get(0).get("name");
        return name != null ? String.valueOf(name) : "Usuário";
    }

    private static boolean isBlank(Object v) {
        return v == null || String.valueOf(v).isEmpty();
    }

    private static boolean isEmptyList(Object v) {
        return !(v instanceof List<?> list) || list.isEmpty();
    }
}
