package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.service.CompetenciasGestorService;
import br.jus.tjgo.kaizen.service.CompetenciasTecnicasAdminService;
import br.jus.tjgo.kaizen.service.DomainService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de competenciasGestor.ts. Montado em /api/competencias-gestor.
 * Inclui as sub-rotas tecnicas-admin. Categoria A — getCurrentUserId = requestUserId() (fallback 1).
 * As validações lançam IllegalStateException; cada handler remapeia para 403 conforme os mesmos
 * substrings checados pelo Node (paridade fiel, inclusive dos casos que viram 500).
 */
@Tag(name = "Competências — Matriz/Referencial (Gestor)", description = "Matriz de competências com workflow de 3 camadas identity-based (autor/diretoria/final), snapshot com catálogo de padrões, self-healing e admin de técnicas por unidade.")
@RestController
@RequestMapping("/api/competencias-gestor")
@RequiredArgsConstructor
public class CompetenciasGestorController {

    private final CompetenciasGestorService service;
    private final CompetenciasTecnicasAdminService tecnicasAdminService;
    private final DomainService domainService;
    private final JdbcTemplate jdbc;

    private Long currentUserId() {
        return AuthContext.requestUserId();
    }

    private boolean isSuperadmin() {
        return AuthContext.getCurrentUser().map(u -> u.isSuperadmin()).orElse(false);
    }

    /** Recorte de visibilidade da matriz — ver CompetenciasGestorService.podeVer. */
    private boolean podeVer(long id) {
        long userId = currentUserId() != null ? currentUserId() : -1L;
        return service.podeVer(id, userId, isSuperadmin(), lookupUserEmail(userId));
    }

    // GET /api/competencias-gestor
    @GetMapping
    public List<Map<String, Object>> list(@RequestParam(value = "cadastrosAreasId", required = false) Long cadastrosAreasId,
                                           @RequestParam(value = "dominio", required = false) String dominio,
                                           @RequestParam(value = "tipo", required = false) String tipo) {
        long userId = currentUserId() != null ? currentUserId() : -1L;
        boolean superadmin = isSuperadmin();
        String email = lookupUserEmail(userId);
        if (cadastrosAreasId == null && dominio == null) {
            Long userAreaId = lookupUserAreaId(currentUserId());
            if (userAreaId != null) {
                var domain = domainService.getDomainForArea(userAreaId);
                return service.findVisiveis(domain.areasIdInDomain(), tipo, userId, superadmin, email);
            }
        }
        if (dominio != null) {
            var domain = domainService.getDomainForDiretoria(dominio);
            return service.findVisiveis(domain.areasIdInDomain(), tipo, userId, superadmin, email);
        }
        if (cadastrosAreasId != null) {
            var domain = domainService.getDomainForArea(cadastrosAreasId);
            return service.findVisiveis(domain.areasIdInDomain(), tipo, userId, superadmin, email);
        }
        return service.findAll(null, tipo);
    }

    // GET /api/competencias-gestor/meu
    @GetMapping("/meu")
    public Map<String, Object> meu(@RequestParam(value = "tipo", required = false) String tipo) {
        return service.findByUserId(currentUserId(), tipo);
    }

    // GET /api/competencias-gestor/meus-preenchidos
    @GetMapping("/meus-preenchidos")
    public ResponseEntity<?> meusPreenchidos(@RequestParam(value = "tipo", required = false, defaultValue = "equipe") String tipo) {
        String email = lookupUserEmail(currentUserId());
        if (email == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Usuário não encontrado"));
        }
        return ResponseEntity.ok(service.findFormulariosPreenchidos(currentUserId(), email, tipo));
    }

    // GET /api/competencias-gestor/unidades-autorizadas
    @GetMapping("/unidades-autorizadas")
    public ResponseEntity<?> unidadesAutorizadas(@RequestParam(value = "tipo", required = false, defaultValue = "equipe") String tipo) {
        String email = lookupUserEmail(currentUserId());
        if (email == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Usuário não encontrado"));
        }
        return ResponseEntity.ok(service.findUnidadesAutorizadas(currentUserId(), email, tipo));
    }

    // GET /api/competencias-gestor/unidades-autorizadas-inventario
    @GetMapping("/unidades-autorizadas-inventario")
    public ResponseEntity<?> unidadesAutorizadasInventario() {
        long userId = currentUserId();
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT diretoria FROM users WHERE id = ?", userId);
        if (rows.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Usuário não encontrado"));
        }
        return ResponseEntity.ok(service.findTodasUnidadesAutorizadas((String) rows.get(0).get("diretoria"), userId));
    }

    // GET /api/competencias-gestor/unidades-lideranca
    @GetMapping("/unidades-lideranca")
    public List<Map<String, Object>> unidadesLideranca() {
        return jdbc.queryForList(
                "SELECT cu.id, cu.nome, cu.area_id, cu.unidade_superior_id " +
                        "FROM cadastros_unidades cu " +
                        "JOIN cadastros_areas ca ON ca.id = cu.area_id " +
                        "WHERE (cu.ativo IS NOT FALSE) " +
                        "  AND COALESCE(ca.ativo, TRUE) = TRUE " +
                        "  AND (ca.gestor_user_id = ? OR ca.subdiretor_user_id = ?) " +
                        "  AND LOWER(TRIM(cu.nome)) <> LOWER(TRIM(ca.sigla)) " +
                        "ORDER BY ca.sigla, cu.nome",
                currentUserId(), currentUserId());
    }

    // GET /api/competencias-gestor/minha-unidade-gestor
    @GetMapping("/minha-unidade-gestor")
    public List<Map<String, Object>> minhaUnidadeGestor() {
        long userId = currentUserId();
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT cu.id, cu.nome, cu.area_id, cu.unidade_superior_id " +
                            "FROM cadastros_unidades cu " +
                            "WHERE cu.responsavel_user_id = ? AND (cu.ativo IS NOT FALSE) " +
                            "ORDER BY cu.nome LIMIT 1",
                    userId);
            if (!rows.isEmpty()) {
                return rows;
            }
        } catch (Exception ignored) {
        }
        return jdbc.queryForList(
                "SELECT cu.id, cu.nome, cu.area_id, cu.unidade_superior_id " +
                        "FROM cadastros_unidades cu " +
                        "JOIN cadastros_areas ca ON ca.id = cu.area_id " +
                        "WHERE ca.gestor_user_id = ? " +
                        "  AND (cu.ativo IS NOT FALSE) " +
                        "  AND COALESCE(ca.ativo, TRUE) = TRUE " +
                        "  AND LOWER(TRIM(cu.nome)) = LOWER(TRIM(ca.sigla)) " +
                        "ORDER BY cu.nome",
                userId);
    }

    // GET /api/competencias-gestor/minhas-unidades-gestor
    @GetMapping("/minhas-unidades-gestor")
    public List<Map<String, Object>> minhasUnidadesGestor() {
        try {
            return jdbc.queryForList(
                    "SELECT cu.id, cu.nome, cu.area_id, cu.unidade_superior_id " +
                            "FROM cadastros_unidades cu " +
                            "WHERE cu.responsavel_user_id = ? AND (cu.ativo IS NOT FALSE) " +
                            "ORDER BY cu.nome",
                    currentUserId());
        } catch (Exception ex) {
            return List.of();
        }
    }

    // GET /api/competencias-gestor/eh-colaborador-equipe
    @GetMapping("/eh-colaborador-equipe")
    public Map<String, Object> ehColaboradorEquipe() {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*)::int as count " +
                        "FROM cadastros_pessoas cp " +
                        "JOIN cadastros_unidades cu ON cu.id = cp.unidade_id " +
                        "JOIN cadastros_areas ca ON ca.id = cu.area_id " +
                        "WHERE cp.user_id = ? " +
                        "  AND COALESCE(cp.ativo, TRUE) = TRUE " +
                        "  AND (cu.ativo IS NOT FALSE) " +
                        "  AND LOWER(TRIM(cu.nome)) <> LOWER(TRIM(ca.sigla))",
                Integer.class, currentUserId());
        return Map.of("ehColaborador", count != null && count > 0);
    }

    // GET /api/competencias-gestor/eh-gestor-unidade
    @GetMapping("/eh-gestor-unidade")
    public Map<String, Object> ehGestorUnidade() {
        try {
            Integer count = jdbc.queryForObject(
                    "SELECT COUNT(*)::int as count FROM cadastros_unidades WHERE responsavel_user_id = ? AND (ativo IS NOT FALSE)",
                    Integer.class, currentUserId());
            return Map.of("ehGestor", count != null && count > 0);
        } catch (Exception ex) {
            return Map.of("ehGestor", false);
        }
    }

    // ============================================================
    // Editores da Matriz do Gestor (por macroárea)
    // ============================================================

    /** Áreas que o usuário logado dirige — onde ele pode administrar editores. */
    @GetMapping("/editores/minhas-areas")
    public List<Map<String, Object>> areasQueDirijo() {
        long userId = currentUserId();
        if (isSuperadmin()) {
            return jdbc.queryForList(
                    "SELECT id, sigla, nome FROM cadastros_areas " +
                            "WHERE COALESCE(ativo, TRUE) = TRUE ORDER BY sigla");
        }
        return jdbc.queryForList(
                "SELECT id, sigla, nome FROM cadastros_areas " +
                        "WHERE COALESCE(ativo, TRUE) = TRUE " +
                        "  AND (gestor_user_id = ? OR subdiretor_user_id = ?) ORDER BY sigla",
                userId, userId);
    }

    /** Áreas em que o usuário logado é editor — usado pela tela para liberar o card da matriz. */
    @GetMapping("/editores/sou-editor")
    public Map<String, Object> souEditor() {
        List<Map<String, Object>> areas = service.areasOndeEhEditor(currentUserId());
        return Map.of("editor", !areas.isEmpty(), "areas", areas);
    }

    @GetMapping("/editores")
    public ResponseEntity<?> listEditores(@RequestParam("cadastrosAreasId") long cadastrosAreasId) {
        if (!service.podeGerenciarEditores(cadastrosAreasId, currentUserId(), isSuperadmin())) {
            return ResponseEntity.status(403).body(Map.of(
                    "error", "Apenas a direção da área pode ver os editores"));
        }
        return ResponseEntity.ok(service.listEditores(cadastrosAreasId));
    }

    @PostMapping("/editores")
    public ResponseEntity<?> addEditor(@RequestBody Map<String, Object> body) {
        Long areaId = asLongOrNull(body.get("cadastros_areas_id"));
        Long novoEditor = asLongOrNull(body.get("user_id"));
        if (areaId == null || novoEditor == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "cadastros_areas_id e user_id são obrigatórios"));
        }
        if (!service.podeGerenciarEditores(areaId, currentUserId(), isSuperadmin())) {
            return ResponseEntity.status(403).body(Map.of(
                    "error", "Apenas a direção da área pode associar editores"));
        }
        service.addEditor(areaId, novoEditor, currentUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(service.listEditores(areaId));
    }

    @DeleteMapping("/editores/{editorId:\\d+}")
    public ResponseEntity<?> removeEditor(@PathVariable long editorId,
                                          @RequestParam("cadastrosAreasId") long cadastrosAreasId) {
        if (!service.podeGerenciarEditores(cadastrosAreasId, currentUserId(), isSuperadmin())) {
            return ResponseEntity.status(403).body(Map.of(
                    "error", "Apenas a direção da área pode remover editores"));
        }
        if (!service.removeEditor(editorId, cadastrosAreasId)) {
            return ResponseEntity.status(404).body(Map.of("error", "Editor não encontrado"));
        }
        return ResponseEntity.ok(service.listEditores(cadastrosAreasId));
    }

    private static Long asLongOrNull(Object v) {
        if (v == null) {
            return null;
        }
        try {
            return Long.parseLong(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    // GET /api/competencias-gestor/verificar-acesso
    @GetMapping("/verificar-acesso")
    public ResponseEntity<?> verificarAcesso() {
        long userId = currentUserId();
        String email = lookupUserEmail(userId);
        if (email == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Usuário não encontrado"));
        }
        return ResponseEntity.ok(Map.of("autorizado", service.verificarAcesso(email, userId)));
    }

    // GET /api/competencias-gestor/:id/pode-editar
    @GetMapping("/{id:\\d+}/pode-editar")
    public ResponseEntity<?> podeEditar(@PathVariable long id) {
        long userId = currentUserId();
        String email = lookupUserEmail(userId);
        if (email == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Usuário não encontrado"));
        }
        return ResponseEntity.ok(service.canEdit(id, userId, email));
    }

    // GET /api/competencias-gestor/unidade/:unidadeId
    @GetMapping("/unidade/{unidadeId:\\d+}")
    public List<Map<String, Object>> competenciasUnidade(@PathVariable long unidadeId) {
        return service.findCompetenciasByUnidade(unidadeId);
    }

    // GET /api/competencias-gestor/unidades-com-matriz?tipo=gestor
    // Ids das unidades que já têm a Matriz de Competências (do tipo) validada — usado para
    // filtrar o seletor de unidade da avaliação (só faz sentido avaliar onde há referencial).
    @GetMapping("/unidades-com-matriz")
    public List<Integer> unidadesComMatriz(
            @RequestParam(value = "tipo", required = false, defaultValue = "gestor") String tipo) {
        return service.unidadesComMatrizValidada(tipo);
    }

    // GET /api/competencias-gestor/unidade-gestor/:unidadeId
    @GetMapping("/unidade-gestor/{unidadeId:\\d+}")
    public List<Map<String, Object>> competenciasGestorUnidade(@PathVariable long unidadeId) {
        List<Map<String, Object>> competencias = service.findCompetenciasGestorByUnidade(unidadeId);
        if (!competencias.isEmpty()) {
            return competencias;
        }
        List<Map<String, Object>> unidadeRows = jdbc.queryForList(
                "SELECT cu.area_id FROM cadastros_unidades cu WHERE cu.id = ?", unidadeId);
        if (!unidadeRows.isEmpty()) {
            Object areaId = unidadeRows.get(0).get("area_id");
            List<Map<String, Object>> macro = jdbc.queryForList(
                    "SELECT cu.id FROM cadastros_unidades cu " +
                            "JOIN cadastros_areas ca ON ca.id = cu.area_id " +
                            "WHERE cu.area_id = ? AND LOWER(TRIM(cu.nome)) = LOWER(TRIM(ca.sigla)) " +
                            "  AND (cu.ativo IS NOT FALSE) LIMIT 1",
                    areaId);
            if (!macro.isEmpty()) {
                competencias = service.findCompetenciasGestorByUnidade(((Number) macro.get(0).get("id")).longValue());
            }
        }
        return competencias;
    }

    // PATCH /api/competencias-gestor/:id/validar-autor
    @PatchMapping("/{id:\\d+}/validar-autor")
    public ResponseEntity<?> validarAutor(@PathVariable long id) {
        try {
            return ResponseEntity.ok(service.validarAutor(id, currentUserId()));
        } catch (IllegalStateException e) {
            String msg = e.getMessage();
            if (contains(msg, "autor") || contains(msg, "status")) {
                return ResponseEntity.status(403).body(Map.of("error", msg));
            }
            throw e;
        }
    }

    // PATCH /api/competencias-gestor/:id/validar-diretoria
    @PatchMapping("/{id:\\d+}/validar-diretoria")
    public ResponseEntity<?> validarDiretoria(@PathVariable long id) {
        long userId = currentUserId();
        String email = lookupUserEmail(userId);
        if (email == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Usuário não encontrado"));
        }
        try {
            return ResponseEntity.ok(service.validarDiretoria(id, userId, email));
        } catch (IllegalStateException e) {
            String msg = e.getMessage();
            if (contains(msg, "permissão") || contains(msg, "validador") || contains(msg, "status")) {
                return ResponseEntity.status(403).body(Map.of("error", msg));
            }
            throw e;
        }
    }

    // PATCH /api/competencias-gestor/:id/validar-final
    @PatchMapping("/{id:\\d+}/validar-final")
    public ResponseEntity<?> validarFinal(@PathVariable long id) {
        long userId = currentUserId();
        String email = lookupUserEmail(userId);
        if (email == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Usuário não encontrado"));
        }
        try {
            return ResponseEntity.ok(service.validarFinal(id, userId, email));
        } catch (IllegalStateException e) {
            String msg = e.getMessage();
            if (contains(msg, "validador") || contains(msg, "status")) {
                return ResponseEntity.status(403).body(Map.of("error", msg));
            }
            throw e;
        }
    }

    // PATCH /api/competencias-gestor/:id/recusar-diretoria
    @PatchMapping("/{id:\\d+}/recusar-diretoria")
    public ResponseEntity<?> recusarDiretoria(@PathVariable long id, @RequestBody(required = false) Map<String, Object> body) {
        long userId = currentUserId();
        String comentario = trimToNull(body == null ? null : body.get("comentario"));
        try {
            return ResponseEntity.ok(service.recusarDiretoria(id, userId, comentario));
        } catch (IllegalStateException e) {
            String msg = e.getMessage();
            if (contains(msg, "gestor") || contains(msg, "diretoria") || contains(msg, "status") || contains(msg, "estado")) {
                return ResponseEntity.status(403).body(Map.of("error", msg));
            }
            throw e;
        }
    }

    // PATCH /api/competencias-gestor/:id/recusar-final
    @PatchMapping("/{id:\\d+}/recusar-final")
    public ResponseEntity<?> recusarFinal(@PathVariable long id, @RequestBody(required = false) Map<String, Object> body) {
        long userId = currentUserId();
        String email = lookupUserEmail(userId);
        if (email == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Usuário não encontrado"));
        }
        String comentario = trimToNull(body == null ? null : body.get("comentario"));
        try {
            return ResponseEntity.ok(service.recusarFinal(id, userId, email, comentario));
        } catch (IllegalStateException e) {
            String msg = e.getMessage();
            if (contains(msg, "validador") || contains(msg, "status")) {
                return ResponseEntity.status(403).body(Map.of("error", msg));
            }
            throw e;
        }
    }

    // GET /api/competencias-gestor/:id/versoes
    @GetMapping("/{id:\\d+}/versoes")
    public ResponseEntity<?> versoes(@PathVariable long id) {
        if (!podeVer(id)) {
            return ResponseEntity.status(403).body(Map.of("error", "Sem permissão para ver este formulário"));
        }
        return ResponseEntity.ok(service.findVersoes(id));
    }

    // GET /api/competencias-gestor/:id/versoes/:versao
    @GetMapping("/{id:\\d+}/versoes/{versao:\\d+}")
    public ResponseEntity<?> versaoDados(@PathVariable long id, @PathVariable int versao) {
        if (!podeVer(id)) {
            return ResponseEntity.status(403).body(Map.of("error", "Sem permissão para ver este formulário"));
        }
        Object dados = service.findVersaoDados(id, versao);
        if (dados == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Versão não encontrada"));
        }
        return ResponseEntity.ok(dados);
    }

    // GET /api/competencias-gestor/:id
    @GetMapping("/{id:\\d+}")
    public ResponseEntity<?> byId(@PathVariable long id) {
        if (!podeVer(id)) {
            return ResponseEntity.status(403).body(Map.of("error", "Sem permissão para ver este formulário"));
        }
        Map<String, Object> formulario = service.findById(id);
        if (formulario == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Formulário não encontrado"));
        }
        return ResponseEntity.ok(formulario);
    }

    // POST /api/competencias-gestor
    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        long userId = currentUserId();
        if (isBlank(body.get("nome_completo")) || isBlank(body.get("email_institucional"))
                || isBlank(body.get("diretoria")) || isEmptyList(body.get("competencias"))) {
            return ResponseEntity.status(400).body(Map.of("error", "Campos obrigatórios faltando"));
        }
        Map<String, Object> formulario = service.create(body, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(formulario);
    }

    // PUT /api/competencias-gestor/:id
    @PutMapping("/{id:\\d+}")
    public ResponseEntity<?> update(@PathVariable long id, @RequestBody Map<String, Object> body) {
        long userId = currentUserId();
        String email = lookupUserEmail(userId);
        if (email == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Usuário não encontrado"));
        }
        try {
            return ResponseEntity.ok(service.update(id, body, userId, email));
        } catch (IllegalStateException e) {
            String msg = e.getMessage();
            if (contains(msg, "permissão") || contains(msg, "validad")) {
                return ResponseEntity.status(403).body(Map.of("error", msg));
            }
            throw e;
        }
    }

    // DELETE /api/competencias-gestor/:id (ADMIN)
    @DeleteMapping("/{id:\\d+}")
    public Map<String, Object> delete(@PathVariable long id) {
        AuthContext.requireRole(List.of("ADMIN"));
        service.delete(id, currentUserId());
        return Map.of("message", "Formulário removido com sucesso");
    }

    // ============================================================
    // tecnicas-admin
    // ============================================================

    // GET /api/competencias-gestor/tecnicas-admin/unidades
    @GetMapping("/tecnicas-admin/unidades")
    public List<Map<String, Object>> tecnicasUnidades() {
        return tecnicasAdminService.findUnidadesGerenciaveis(currentUserId());
    }

    // GET /api/competencias-gestor/tecnicas-admin/formulario/:id
    @GetMapping("/tecnicas-admin/formulario/{id:\\d+}")
    public ResponseEntity<?> tecnicasFormulario(@PathVariable long id) {
        long userId = currentUserId();
        if (!tecnicasAdminService.canManage(id, userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Sem permissão para gerenciar este referencial"));
        }
        Map<String, Object> form = tecnicasAdminService.findFormularioCompleto(id);
        if (form == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Formulário não encontrado"));
        }
        boolean hasPending = tecnicasAdminService.hasPendingChanges(id);
        Map<String, Object> out = new LinkedHashMap<>(form);
        out.put("hasPendingChanges", hasPending);
        return ResponseEntity.ok(out);
    }

    // POST /api/competencias-gestor/tecnicas-admin/formulario/:id/itens
    @PostMapping("/tecnicas-admin/formulario/{id:\\d+}/itens")
    public ResponseEntity<?> tecnicasCreateItem(@PathVariable long id, @RequestBody Map<String, Object> body) {
        long userId = currentUserId();
        if (!tecnicasAdminService.canManage(id, userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Sem permissão"));
        }
        if (isBlank(body.get("nome")) || isBlank(body.get("descricao")) || body.get("peso") == null || isBlank(body.get("aplicabilidade"))) {
            return ResponseEntity.status(400).body(Map.of("error", "Campos nome, descricao, peso e aplicabilidade são obrigatórios"));
        }
        Map<String, Object> item = tecnicasAdminService.createItem(id, body, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(item);
    }

    // PUT /api/competencias-gestor/tecnicas-admin/itens/:itemId
    @PutMapping("/tecnicas-admin/itens/{itemId:\\d+}")
    public ResponseEntity<?> tecnicasUpdateItem(@PathVariable long itemId, @RequestBody Map<String, Object> body) {
        long userId = currentUserId();
        List<Map<String, Object>> itemRes = jdbc.queryForList(
                "SELECT formulario_id FROM competencias_gestor_itens WHERE id = ?", itemId);
        if (itemRes.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Item não encontrado"));
        }
        long formularioId = ((Number) itemRes.get(0).get("formulario_id")).longValue();
        if (!tecnicasAdminService.canManage(formularioId, userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Sem permissão"));
        }
        Map<String, Object> item = tecnicasAdminService.updateItem(itemId, body, userId);
        return ResponseEntity.ok(item);
    }

    // DELETE /api/competencias-gestor/tecnicas-admin/itens/:itemId
    @DeleteMapping("/tecnicas-admin/itens/{itemId:\\d+}")
    public ResponseEntity<?> tecnicasDeleteItem(@PathVariable long itemId) {
        long userId = currentUserId();
        List<Map<String, Object>> itemRes = jdbc.queryForList(
                "SELECT formulario_id FROM competencias_gestor_itens WHERE id = ?", itemId);
        if (itemRes.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Item não encontrado"));
        }
        long formularioId = ((Number) itemRes.get(0).get("formulario_id")).longValue();
        if (!tecnicasAdminService.canManage(formularioId, userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Sem permissão"));
        }
        tecnicasAdminService.deleteItem(itemId, userId);
        return ResponseEntity.ok(Map.of("success", true));
    }

    // POST /api/competencias-gestor/tecnicas-admin/formulario/:id/publicar
    @PostMapping("/tecnicas-admin/formulario/{id:\\d+}/publicar")
    public ResponseEntity<?> tecnicasPublicar(@PathVariable long id) {
        long userId = currentUserId();
        if (!tecnicasAdminService.canManage(id, userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Sem permissão"));
        }
        return ResponseEntity.ok(tecnicasAdminService.publish(id, userId));
    }

    // ============================================================
    // Helpers
    // ============================================================

    private Long lookupUserAreaId(long userId) {
        var rows = jdbc.queryForList("SELECT cadastros_areas_id FROM users WHERE id = ?", userId);
        return rows.isEmpty() ? null : (Long) rows.get(0).get("cadastros_areas_id");
    }

    private String lookupUserEmail(long userId) {
        var rows = jdbc.queryForList("SELECT email FROM users WHERE id = ?", userId);
        return rows.isEmpty() ? null : (String) rows.get(0).get("email");
    }

    private static boolean contains(String s, String sub) {
        return s != null && s.contains(sub);
    }

    private static String trimToNull(Object v) {
        if (v == null) {
            return null;
        }
        String s = String.valueOf(v).trim();
        return s.isEmpty() ? null : s;
    }

    private static boolean isBlank(Object v) {
        return v == null || String.valueOf(v).isEmpty();
    }

    private static boolean isEmptyList(Object v) {
        return !(v instanceof List<?> list) || list.isEmpty();
    }
}
