package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.service.AvaliacaoIntegradaService;
import br.jus.tjgo.kaizen.service.DomainService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Porte fiel de avaliacaoIntegrada.ts. Montado em /api/avaliacao-integrada.
 * Categoria A — getCurrentUserId = requestUserId() (fallback 1). DELETE exige ADMIN.
 */
@Tag(name = "Avaliação Integrada", description = "Avaliação integrada (autoavaliação + gestor), validação em 2 camadas (gestor → colaborador) com snapshot de versão.")
@RestController
@RequestMapping("/api/avaliacao-integrada")
@RequiredArgsConstructor
public class AvaliacaoIntegradaController {

    private final AvaliacaoIntegradaService service;
    private final DomainService domainService;
    private final JdbcTemplate jdbc;

    private Long currentUserId() {
        return AuthContext.requestUserId();
    }

    private boolean isSuperadmin() {
        return AuthContext.getCurrentUser().map(u -> u.isSuperadmin()).orElse(false);
    }

    // GET /api/avaliacao-integrada
    @GetMapping
    public List<Map<String, Object>> list(@RequestParam(value = "cadastrosAreasId", required = false) Long cadastrosAreasId,
                                           @RequestParam(value = "dominio", required = false) String dominio,
                                           @RequestParam(value = "tipo_inventario", required = false) String tipoInventario) {
        long userId = currentUserId() != null ? currentUserId() : -1L;
        boolean superadmin = isSuperadmin();
        if (cadastrosAreasId == null && dominio == null) {
            Long userAreaId = lookupUserAreaId(currentUserId());
            if (userAreaId != null) {
                var domain = domainService.getDomainForArea(userAreaId);
                return service.findVisiveis(domain.areasIdInDomain(), tipoInventario, userId, superadmin);
            }
        }
        if (dominio != null) {
            var domain = domainService.getDomainForDiretoria(dominio);
            return service.findVisiveis(domain.areasIdInDomain(), tipoInventario, userId, superadmin);
        }
        if (cadastrosAreasId != null) {
            var domain = domainService.getDomainForArea(cadastrosAreasId);
            return service.findVisiveis(domain.areasIdInDomain(), tipoInventario, userId, superadmin);
        }
        return service.findAll(null, tipoInventario);
    }

    // GET /api/avaliacao-integrada/pendentes-colaborador
    @GetMapping("/pendentes-colaborador")
    public List<Map<String, Object>> pendentesColaborador() {
        // Mantém a rota (o front consome), mas o sentido mudou: sem validação, o que o
        // avaliado recebe aqui é o Resultado Final dele, já calculado.
        return service.findMeus(currentUserId());
    }

    // GET /api/avaliacao-integrada/tem-elegiveis
    @GetMapping("/tem-elegiveis")
    public Map<String, Object> temElegiveis() {
        Long userAreaId = lookupUserAreaId(currentUserId());
        if (userAreaId == null) {
            var domain = domainService.getDomainForDiretoria("SGJT");
            return service.temElegiveis(domain.areasIdInDomain());
        }
        var domain = domainService.getDomainForArea(userAreaId);
        return service.temElegiveis(domain.areasIdInDomain());
    }

    // GET /api/avaliacao-integrada/elegiveis/:unidadeId
    @GetMapping("/elegiveis/{unidadeId:\\d+}")
    public List<Map<String, Object>> elegiveis(@PathVariable long unidadeId,
                                               @RequestParam(value = "tipo_inventario", required = false, defaultValue = "equipe") String tipoInventario) {
        return service.getElegiveis(unidadeId, tipoInventario);
    }

    // GET /api/avaliacao-integrada/par/:autoavaliacaoId/:avaliacaoGestorId
    @GetMapping("/par/{autoavaliacaoId:\\d+}/{avaliacaoGestorId:\\d+}")
    public Map<String, Object> par(@PathVariable long autoavaliacaoId, @PathVariable long avaliacaoGestorId) {
        return service.getParData(autoavaliacaoId, avaliacaoGestorId);
    }

    // GET /api/avaliacao-integrada/:id/versoes
    @GetMapping("/{id:\\d+}/versoes")
    public List<Map<String, Object>> versoes(@PathVariable long id) {
        return service.findVersoes(id);
    }

    // GET /api/avaliacao-integrada/:id/versoes/:versao
    @GetMapping("/{id:\\d+}/versoes/{versao:\\d+}")
    public ResponseEntity<?> versaoDados(@PathVariable long id, @PathVariable int versao) {
        Object dados = service.findVersaoDados(id, versao);
        if (dados == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Versão não encontrada"));
        }
        return ResponseEntity.ok(dados);
    }

    // GET /api/avaliacao-integrada/meta/user/:userId
    @GetMapping("/meta/user/{userId:\\d+}")
    public ResponseEntity<?> getMetaAvaliacao(@PathVariable long userId) {
        Map<String, Object> meta = service.findLatestByUserId(userId);
        if (meta == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Avaliação integrada não encontrada"));
        }
        return ResponseEntity.ok(meta);
    }

    // GET /api/avaliacao-integrada/:id
    @GetMapping("/{id:\\d+}")
    public ResponseEntity<?> byId(@PathVariable long id) {
        Map<String, Object> formulario = service.findById(id);
        if (formulario == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Formulário não encontrado"));
        }
        return ResponseEntity.ok(formulario);
    }

    // O Resultado Final nao e mais preenchido nem validado: ele e calculado (70/30) quando
    // as duas avaliacoes de origem sao validadas. As rotas de escrita ficam recusando, pra
    // nenhum cliente antigo conseguir gravar nota a mao.
    private static final String SOMENTE_CALCULADO =
            "O Resultado Final e calculado automaticamente a partir da autoavaliacao (30%) e da "
                    + "avaliacao do gestor/lideranca (70%). Nao ha preenchimento nem validacao manual.";

    // POST /api/avaliacao-integrada
    @PostMapping
    public ResponseEntity<?> create(@RequestBody(required = false) Map<String, Object> body) {
        return ResponseEntity.status(HttpStatus.GONE).body(Map.of("error", SOMENTE_CALCULADO));
    }

    // PATCH /api/avaliacao-integrada/:id/validar-gestor
    @PatchMapping("/{id:\\d+}/validar-gestor")
    public ResponseEntity<?> validarGestor(@PathVariable long id) {
        return ResponseEntity.status(HttpStatus.GONE).body(Map.of("error", SOMENTE_CALCULADO));
    }

    // PATCH /api/avaliacao-integrada/:id/validar-colaborador
    @PatchMapping("/{id:\\d+}/validar-colaborador")
    public ResponseEntity<?> validarColaborador(@PathVariable long id) {
        return ResponseEntity.status(HttpStatus.GONE).body(Map.of("error", SOMENTE_CALCULADO));
    }

    // DELETE /api/avaliacao-integrada/:id (ADMIN)
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
