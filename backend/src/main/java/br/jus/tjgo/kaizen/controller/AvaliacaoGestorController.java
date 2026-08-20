package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.service.AvaliacaoGestorService;
import br.jus.tjgo.kaizen.service.DomainService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de avaliacaoGestor.ts. Montado em /api/avaliacao-gestor.
 * Categoria A — getCurrentUserId = requestUserId() (fallback 1). DELETE exige ADMIN.
 */
@RestController
@RequestMapping("/api/avaliacao-gestor")
@RequiredArgsConstructor
public class AvaliacaoGestorController {

    private final AvaliacaoGestorService service;
    private final DomainService domainService;
    private final JdbcTemplate jdbc;

    private Long currentUserId() {
        return AuthContext.requestUserId();
    }

    // GET /api/avaliacao-gestor
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

    // GET /api/avaliacao-gestor/by-pessoa/:pessoaId?unidade_id=
    @GetMapping("/by-pessoa/{pessoaId:\\d+}")
    public ResponseEntity<?> byPessoa(@PathVariable long pessoaId,
                                      @RequestParam(value = "unidade_id", required = false) Long unidadeId,
                                      @RequestParam(value = "by", required = false) String by) {
        if (unidadeId == null || unidadeId == 0) {
            return ResponseEntity.status(400).body(Map.of("error", "unidade_id é obrigatório"));
        }
        // by=user → pessoaId é o user_id da pessoa (gestor sem autoavaliação); senão é o id da
        // autoavaliação (comportamento legado).
        Map<String, Object> found = "user".equals(by)
                ? service.findByPessoaUserIdAndUnidade(pessoaId, unidadeId)
                : service.findByPessoaAndUnidade(pessoaId, unidadeId);
        return ResponseEntity.ok(found);
    }

    // GET /api/avaliacao-gestor/gestor-da-unidade/:unidadeId — o gestor da unidade como avaliável
    @GetMapping("/gestor-da-unidade/{unidadeId:\\d+}")
    public ResponseEntity<?> gestorDaUnidade(@PathVariable long unidadeId,
                                             @RequestParam(value = "tipo_inventario", required = false, defaultValue = "gestor") String tipoInventario) {
        return ResponseEntity.ok(service.gestorDaUnidade(unidadeId, tipoInventario));
    }

    // GET /api/avaliacao-gestor/colaboradores-da-unidade/:unidadeId — avaliáveis da equipe,
    // com ou sem autoavaliação preenchida
    @GetMapping("/colaboradores-da-unidade/{unidadeId:\\d+}")
    public List<Map<String, Object>> colaboradoresDaUnidade(
            @PathVariable long unidadeId,
            @RequestParam(value = "tipo_inventario", required = false, defaultValue = "equipe") String tipoInventario) {
        return service.colaboradoresDaUnidade(unidadeId, tipoInventario);
    }

    // GET /api/avaliacao-gestor/:id/versoes
    @GetMapping("/{id:\\d+}/versoes")
    public List<Map<String, Object>> versoes(@PathVariable long id) {
        return service.findVersoes(id);
    }

    // GET /api/avaliacao-gestor/:id/versoes/:versao
    @GetMapping("/{id:\\d+}/versoes/{versao:\\d+}")
    public ResponseEntity<?> versaoDados(@PathVariable long id, @PathVariable int versao) {
        Object dados = service.findVersaoDados(id, versao);
        if (dados == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Versão não encontrada"));
        }
        return ResponseEntity.ok(dados);
    }

    // GET /api/avaliacao-gestor/:id
    @GetMapping("/{id:\\d+}")
    public ResponseEntity<?> byId(@PathVariable long id) {
        Map<String, Object> formulario = service.findById(id);
        if (formulario == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Formulário não encontrado"));
        }
        return ResponseEntity.ok(formulario);
    }

    // POST /api/avaliacao-gestor
    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        long userId = currentUserId();
        // A pessoa avaliada pode vir por pessoa_id (autoavaliação) OU pessoa_user_id (gestor da
        // unidade avaliado antes da autoavaliação). Lista os campos faltando com precisão.
        List<String> faltando = new ArrayList<>();
        if (body.get("pessoa_id") == null && body.get("pessoa_user_id") == null) {
            faltando.add("colaborador a ser avaliado");
        }
        if (isBlank(body.get("pessoa_nome"))) {
            faltando.add("nome do colaborador");
        }
        if (isBlank(body.get("avaliador_nome"))) {
            faltando.add("nome do avaliador");
        }
        if (isBlank(body.get("diretoria"))) {
            faltando.add("diretoria");
        }
        if (isEmptyList(body.get("respostas"))) {
            faltando.add("notas das competências");
        }
        if (!faltando.isEmpty()) {
            return ResponseEntity.status(400).body(Map.of(
                    "error", "Campos obrigatórios faltando: " + String.join(", ", faltando)));
        }
        Map<String, Object> formulario = service.create(body, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(formulario);
    }

    // PATCH /api/avaliacao-gestor/:id/validar
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

    // DELETE /api/avaliacao-gestor/:id (ADMIN)
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
