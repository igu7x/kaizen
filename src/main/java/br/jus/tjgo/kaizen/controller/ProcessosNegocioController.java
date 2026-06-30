package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.auth.AuthenticatedUser;
import br.jus.tjgo.kaizen.service.ProcessosNegocioService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Porte fiel de processosNegocio.ts. Montado em /api/processos-negocio (com authenticate).
 * Autorização identity-based em 3 camadas (papéis do Escritório de Processos), decidida aqui:
 *  - camada 1 (enviar / validar-autor): Responsável do Processo (responsavel_user_id de unidade no campo Responsável)
 *  - camada 2 (validar-diretoria): Revisor = gestor_user_id da cadastros_areas com sigla = processo.diretoria (trim+lower)
 *  - camada 3 (validar-final): Compliance Officer (e-mail gmpdmaciel@tjgo.jus.br)
 * Um Revisor que também seja Responsável valida nas camadas 1 e 2. As mesmas regras valem para recusar a respectiva camada.
 * getUserId retorna null sem auth → 401 (Categoria B).
 */
@Tag(name = "Processos de Negócio", description = "Cadastro e validação de processos em 3 camadas identity-based (autor → diretoria → superadmin), com versionamento e snapshots históricos.")
@RestController
@RequestMapping("/api/processos-negocio")
@RequiredArgsConstructor
public class ProcessosNegocioController {

    private final ProcessosNegocioService service;
    private final JdbcTemplate jdbc;

    /** Espelha getUserId do Node: req.userId || req.user?.id || null (sem fallback 1). */
    private Long getUserId() {
        return AuthContext.getCurrentUser().map(AuthenticatedUser::id).orElse(null);
    }

    // GET /api/processos-negocio?diretoria=XYZ
    @GetMapping
    public List<Map<String, Object>> list(@RequestParam(value = "diretoria", required = false) String diretoria) {
        return service.findAll(diretoria);
    }

    // GET /api/processos-negocio/:id
    @GetMapping("/{id:\\d+}")
    public ResponseEntity<?> byId(@PathVariable long id) {
        Map<String, Object> processo = service.findById(id);
        if (processo == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Processo não encontrado"));
        }
        return ResponseEntity.ok(processo);
    }

    // POST /api/processos-negocio — só o Gestor do Escritório de Processos (superadmin) cria do zero
    @Operation(summary = "Criar processo (rascunho)", description = "Cria com status 'em_elaboracao', versão 1.0, ciclos 0. Apenas o Gestor do Escritório de Processos (users.is_superadmin) pode criar do zero.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Criado"),
            @ApiResponse(responseCode = "403", description = "Não é Gestor do Escritório (superadmin)"),
            @ApiResponse(responseCode = "413", description = "Fluxograma > 6MB ou documentos > 20MB")
    })
    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        Long userId = getUserId();
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        boolean isSuper = AuthContext.getCurrentUser().map(AuthenticatedUser::isSuperadmin).orElse(false);
        if (!isSuper) {
            return ResponseEntity.status(403).body(Map.of("error", "Apenas o Gestor do Escritório de Processos pode criar um novo processo."));
        }
        try {
            Map<String, Object> created = service.create(body, userId);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (RuntimeException e) {
            ResponseEntity<?> tooLarge = mapTooLarge(e);
            if (tooLarge != null) {
                return tooLarge;
            }
            throw e;
        }
    }

    // PUT /api/processos-negocio/:id (ADMIN, MANAGER)
    @PutMapping("/{id:\\d+}")
    public ResponseEntity<?> update(@PathVariable long id, @RequestBody Map<String, Object> body) {
        Long userId = getUserId();
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        Map<String, Object> processo = service.findById(id);
        if (processo == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Processo não encontrado"));
        }
        if (!podeEditarProcesso(processo, id)) {
            return ResponseEntity.status(403).body(Map.of("error", "Você não tem permissão para editar este processo."));
        }
        try {
            Map<String, Object> updated = service.update(id, body, userId);
            if (updated == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Processo não encontrado"));
            }
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            ResponseEntity<?> tooLarge = mapTooLarge(e);
            if (tooLarge != null) {
                return tooLarge;
            }
            throw e;
        }
    }

    // PATCH /api/processos-negocio/:id/enviar — camada 1: o Responsável do Processo valida ao enviar
    @PatchMapping("/{id:\\d+}/enviar")
    public ResponseEntity<?> enviar(@PathVariable long id) {
        Long userId = getUserId();
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        Map<String, Object> processo = service.findById(id);
        if (processo == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Processo não encontrado"));
        }
        if (!isResponsavelProcesso(id, userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Apenas o Responsável do Processo pode enviar para validação (camada 1)."));
        }
        Map<String, Object> user = lookupUser(userId);
        Map<String, Object> updated = service.enviarParaValidacao(id, userId, userName(user, "Responsável"));
        if (updated == null) {
            return ResponseEntity.status(400).body(Map.of("error", "Processo não pode ser enviado (verifique status atual)"));
        }
        return ResponseEntity.ok(updated);
    }

    // PATCH /api/processos-negocio/:id/iniciar-revisao — reabre processo vigente p/ revisão antecipada
    @Operation(summary = "Iniciar revisão antecipada", description = "Reabre um processo vigente (status 'validado_final') voltando-o para 'em_elaboracao', para o responsável revisar antes do prazo. Permitido ao Responsável do Processo (responsavel_user_id de unidade no campo Responsável) ou a superadmin.")
    @ApiResponses({ @ApiResponse(responseCode = "200", description = "em_elaboracao"),
            @ApiResponse(responseCode = "403", description = "Não é responsável nem superadmin"),
            @ApiResponse(responseCode = "400", description = "Processo não está vigente (validado_final)") })
    @PatchMapping("/{id:\\d+}/iniciar-revisao")
    public ResponseEntity<?> iniciarRevisao(@PathVariable long id) {
        Long userId = getUserId();
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        Map<String, Object> processo = service.findById(id);
        if (processo == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Processo não encontrado"));
        }
        Map<String, Object> user = lookupUser(userId);
        boolean isSuper = user != null && Boolean.TRUE.equals(user.get("is_superadmin"));
        if (!isSuper && !isResponsavelProcesso(id, userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Apenas o responsável do processo ou um gestor do Escritório de Processos pode iniciar a revisão."));
        }
        Map<String, Object> updated = service.iniciarRevisao(id, userId);
        if (updated == null) {
            return ResponseEntity.status(400).body(Map.of("error", "A revisão só pode ser iniciada para um processo vigente (Modelo K1)."));
        }
        return ResponseEntity.ok(updated);
    }

    // POST /api/processos-negocio/:id/editores — atribui um editor (Gestor do Escritório, Responsável ou Revisor)
    @Operation(summary = "Atribuir editor", description = "Body: { user_id }. Associa um usuário com permissão de editar/salvar o conteúdo do processo. Permitido a superadmin (Gestor do Escritório), Responsável do Processo ou Revisor (gestor da diretoria).")
    @ApiResponses({ @ApiResponse(responseCode = "200", description = "Editor adicionado"),
            @ApiResponse(responseCode = "403", description = "Sem permissão para gerenciar editores"),
            @ApiResponse(responseCode = "404", description = "Processo ou usuário não encontrado") })
    @PostMapping("/{id:\\d+}/editores")
    public ResponseEntity<?> addEditor(@PathVariable long id, @RequestBody Map<String, Object> body) {
        Long userId = getUserId();
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        Map<String, Object> processo = service.findById(id);
        if (processo == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Processo não encontrado"));
        }
        if (!podeGerenciarEditores(processo, id, userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Apenas o Gestor do Escritório, o Responsável ou o Revisor do processo podem atribuir editores."));
        }
        Long editorUserId = parseLong(body == null ? null : body.get("user_id"));
        if (editorUserId == null) {
            return ResponseEntity.status(400).body(Map.of("error", "user_id é obrigatório."));
        }
        Map<String, Object> updated = service.addEditor(id, editorUserId, userId);
        if (updated == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Usuário não encontrado."));
        }
        return ResponseEntity.ok(updated);
    }

    // DELETE /api/processos-negocio/:id/editores/:editorUserId — remove um editor
    @Operation(summary = "Remover editor", description = "Remove um editor do processo. Mesmas regras de quem pode atribuir.")
    @DeleteMapping("/{id:\\d+}/editores/{editorUserId:\\d+}")
    public ResponseEntity<?> removeEditor(@PathVariable long id, @PathVariable long editorUserId) {
        Long userId = getUserId();
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        Map<String, Object> processo = service.findById(id);
        if (processo == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Processo não encontrado"));
        }
        if (!podeGerenciarEditores(processo, id, userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Apenas o Gestor do Escritório, o Responsável ou o Revisor do processo podem remover editores."));
        }
        Map<String, Object> updated = service.removeEditor(id, editorUserId, userId);
        if (updated == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Processo não encontrado"));
        }
        return ResponseEntity.ok(updated);
    }

    // PATCH /api/processos-negocio/:id/validar-autor — camada 1: APENAS o Responsável do Processo
    @Operation(summary = "Validar camada 1 (Responsável)", description = "Apenas o Responsável do Processo (responsavel_user_id de unidade no campo Responsável). Exige status 'enviado'.")
    @ApiResponses({ @ApiResponse(responseCode = "200", description = "validado_autor"),
            @ApiResponse(responseCode = "403", description = "Não é o Responsável"),
            @ApiResponse(responseCode = "400", description = "Status inválido") })
    @PatchMapping("/{id:\\d+}/validar-autor")
    public ResponseEntity<?> validarAutor(@PathVariable long id) {
        Long userId = getUserId();
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        Map<String, Object> processo = service.findById(id);
        if (processo == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Processo não encontrado"));
        }
        if (!isResponsavelProcesso(id, userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Apenas o Responsável do Processo pode validar nesta camada."));
        }
        Map<String, Object> user = lookupUser(userId);
        Map<String, Object> updated = service.validarAutor(id, userId, userName(user, "Responsável"));
        if (updated == null) {
            return ResponseEntity.status(400).body(Map.of("error", "Validação do autor só é permitida quando o processo está enviado"));
        }
        return ResponseEntity.ok(updated);
    }

    // PATCH /api/processos-negocio/:id/validar-diretoria — camada 2: APENAS o gestor da diretoria
    @Operation(summary = "Validar camada 2 (diretoria)", description = "Apenas o gestor_user_id da cadastros_areas cuja sigla = processo.diretoria. Exige status 'validado_autor'.")
    @ApiResponses({ @ApiResponse(responseCode = "200", description = "validado_diretoria"),
            @ApiResponse(responseCode = "403", description = "Não é o gestor da diretoria") })
    @PatchMapping("/{id:\\d+}/validar-diretoria")
    public ResponseEntity<?> validarDiretoria(@PathVariable long id) {
        Long userId = getUserId();
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        Map<String, Object> processo = service.findById(id);
        if (processo == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Processo não encontrado"));
        }
        Object gestorUserId = lookupGestorUserId(str(processo.get("diretoria")));
        if (gestorUserId == null || !eqId(gestorUserId, userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Apenas o diretor da diretoria cadastrada no processo pode validar nesta camada."));
        }
        Map<String, Object> user = lookupUser(userId);
        Map<String, Object> updated = service.validarDiretoria(id, userId, userName(user, "Diretoria"));
        if (updated == null) {
            return ResponseEntity.status(400).body(Map.of("error", "Validação da diretoria só é permitida após validação do autor"));
        }
        return ResponseEntity.ok(updated);
    }

    // PATCH /api/processos-negocio/:id/validar-final — camada 3: APENAS o Compliance Officer
    @Operation(summary = "Validar camada 3 (Compliance Officer)", description = "Apenas o Compliance Officer (e-mail gmpdmaciel@tjgo.jus.br). Exige 'validado_diretoria'. Faz bump de versão (a partir do 2º ciclo) e grava snapshot histórico.")
    @ApiResponses({ @ApiResponse(responseCode = "200", description = "validado_final"),
            @ApiResponse(responseCode = "403", description = "Não é o Compliance Officer") })
    @PatchMapping("/{id:\\d+}/validar-final")
    public ResponseEntity<?> validarFinal(@PathVariable long id) {
        Long userId = getUserId();
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        Map<String, Object> user = lookupUser(userId);
        if (user == null || !isComplianceOfficer(str(user.get("email")))) {
            return ResponseEntity.status(403).body(Map.of("error", "Apenas o Compliance Officer pode realizar a validação final."));
        }
        Map<String, Object> updated = service.validarFinal(id, userId, userName(user, "Validador Final"));
        if (updated == null) {
            return ResponseEntity.status(400).body(Map.of("error", "Validação final só é permitida após validação da diretoria"));
        }
        return ResponseEntity.ok(updated);
    }

    // PATCH /api/processos-negocio/:id/recusar — só quem pode validar a camada pode recusá-la
    @Operation(summary = "Recusar processo", description = "Body: { camada: autor|diretoria|final, motivo }. Aplica as mesmas regras de quem valida a camada. Volta status para 'recusado'.")
    @PatchMapping("/{id:\\d+}/recusar")
    public ResponseEntity<?> recusar(@PathVariable long id, @RequestBody(required = false) Map<String, Object> body) {
        Long userId = getUserId();
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        String camada = body != null ? str(body.get("camada")) : null;
        String motivo = body != null && body.get("motivo") != null ? String.valueOf(body.get("motivo")).trim() : "";
        if (camada == null || !List.of("autor", "diretoria", "final").contains(camada)) {
            return ResponseEntity.status(400).body(Map.of("error", "Camada inválida (use: autor | diretoria | final)"));
        }
        Map<String, Object> processo = service.findById(id);
        if (processo == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Processo não encontrado"));
        }
        Map<String, Object> user = lookupUser(userId);

        if ("autor".equals(camada)) {
            if (!isResponsavelProcesso(id, userId)) {
                return ResponseEntity.status(403).body(Map.of("error", "Apenas o Responsável do Processo pode recusar nesta camada."));
            }
        } else if ("diretoria".equals(camada)) {
            Object gestorUserId = lookupGestorUserId(str(processo.get("diretoria")));
            if (gestorUserId == null || !eqId(gestorUserId, userId)) {
                return ResponseEntity.status(403).body(Map.of("error", "Apenas o diretor da diretoria cadastrada pode recusar nesta camada."));
            }
        } else { // final
            if (user == null || !isComplianceOfficer(str(user.get("email")))) {
                return ResponseEntity.status(403).body(Map.of("error", "Apenas o Compliance Officer pode recusar na camada final."));
            }
        }

        Map<String, Object> updated = service.recusar(id, userId, userName(user, "Validador"), camada, motivo);
        if (updated == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Processo não encontrado"));
        }
        return ResponseEntity.ok(updated);
    }

    // PUT /api/processos-negocio/:id/aprovacao — anexa o PDF de aprovação (superadmin)
    @Operation(summary = "Anexar PDF de aprovação (Modelo K1)", description = "Restrito a superadmin. O PDF de aprovação + status validado_final tornam o processo um Modelo K1.")
    @ApiResponses({ @ApiResponse(responseCode = "200", description = "Aprovação anexada"),
            @ApiResponse(responseCode = "403", description = "Não é superadmin"),
            @ApiResponse(responseCode = "413", description = "PDF > 6MB") })
    @PutMapping("/{id:\\d+}/aprovacao")
    public ResponseEntity<?> setAprovacao(@PathVariable long id, @RequestBody Map<String, Object> body) {
        Long userId = getUserId();
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        Map<String, Object> user = lookupUser(userId);
        if (user == null || !Boolean.TRUE.equals(user.get("is_superadmin"))) {
            return ResponseEntity.status(403).body(Map.of("error", "Apenas superadmin pode anexar o PDF de aprovação."));
        }
        try {
            Map<String, Object> updated = service.addAprovacao(id, str(body.get("aprovacao_comite")),
                    str(body.get("aprovacao_data")), str(body.get("aprovacao_filename")),
                    str(body.get("aprovacao_mime")), str(body.get("aprovacao_em")), userId);
            if (updated == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Processo não encontrado"));
            }
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            ResponseEntity<?> tooLarge = mapTooLarge(e);
            if (tooLarge != null) {
                return tooLarge;
            }
            if ("APROVACAO_REQUIRED".equals(e.getMessage())) {
                return ResponseEntity.status(400).body(Map.of("error", "PDF de aprovação é obrigatório."));
            }
            if ("COMITE_REQUIRED".equals(e.getMessage())) {
                return ResponseEntity.status(400).body(Map.of("error", "Comitê é obrigatório."));
            }
            throw e;
        }
    }

    // DELETE /api/processos-negocio/:id/aprovacao?comite=CGTIC — remove a aprovação de um comitê (superadmin)
    @DeleteMapping("/{id:\\d+}/aprovacao")
    public ResponseEntity<?> removeAprovacao(@PathVariable long id,
                                             @RequestParam(value = "comite", required = false) String comite) {
        Long userId = getUserId();
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        Map<String, Object> user = lookupUser(userId);
        if (user == null || !Boolean.TRUE.equals(user.get("is_superadmin"))) {
            return ResponseEntity.status(403).body(Map.of("error", "Apenas superadmin pode remover o PDF de aprovação."));
        }
        Map<String, Object> updated = service.removeAprovacao(id, comite, userId);
        if (updated == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Processo não encontrado"));
        }
        return ResponseEntity.ok(updated);
    }

    // GET /api/processos-negocio/:id/versoes
    @GetMapping("/{id:\\d+}/versoes")
    public List<Map<String, Object>> versoes(@PathVariable long id) {
        return service.listVersoes(id);
    }

    // GET /api/processos-negocio/:id/versoes/:historicoId
    @GetMapping("/{id:\\d+}/versoes/{historicoId:\\d+}")
    public ResponseEntity<?> versaoSnapshot(@PathVariable long id, @PathVariable long historicoId) {
        Object snapshot = service.getVersaoSnapshot(id, historicoId);
        if (snapshot == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Versão não encontrada"));
        }
        return ResponseEntity.ok(snapshot);
    }

    // DELETE /api/processos-negocio/:id (ADMIN)
    @DeleteMapping("/{id:\\d+}")
    public ResponseEntity<?> delete(@PathVariable long id) {
        AuthContext.requireRole(List.of("ADMIN"));
        Long userId = getUserId();
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        boolean ok = service.delete(id, userId);
        if (!ok) {
            return ResponseEntity.status(404).body(Map.of("error", "Processo não encontrado"));
        }
        return ResponseEntity.ok(java.util.Collections.singletonMap("success", true));
    }

    // ============================================================
    // Helpers
    // ============================================================

    private ResponseEntity<?> mapTooLarge(RuntimeException e) {
        if ("FLUXOGRAMA_TOO_LARGE".equals(e.getMessage())) {
            return ResponseEntity.status(413).body(Map.of("error", "Fluxograma muito grande. Tamanho máximo: 6MB."));
        }
        if ("DOCUMENTOS_TOO_LARGE".equals(e.getMessage())) {
            return ResponseEntity.status(413).body(Map.of("error", "Total de documentos anexados muito grande. Limite: 20MB."));
        }
        if ("APROVACAO_TOO_LARGE".equals(e.getMessage())) {
            return ResponseEntity.status(413).body(Map.of("error", "PDF de aprovação muito grande. Tamanho máximo: 6MB."));
        }
        return null;
    }

    private Map<String, Object> lookupUser(long userId) {
        var rows = jdbc.queryForList(
                "SELECT name, email, is_superadmin FROM users WHERE id = ? AND is_deleted = FALSE", userId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private static final String COMPLIANCE_OFFICER_EMAIL = "gmpdmaciel@tjgo.jus.br";

    /**
     * Pode editar/salvar o conteúdo do processo — estritamente os 5 papéis do Escritório de
     * Processos: Gestor do Escritório (superadmin), Compliance Officer, Responsável do Processo,
     * Editor atribuído ou Revisor (gestor da diretoria cadastrada).
     */
    private boolean podeEditarProcesso(Map<String, Object> processo, long id) {
        var opt = AuthContext.getCurrentUser();
        if (opt.isEmpty()) {
            return false;
        }
        AuthenticatedUser u = opt.get();
        if (u.isSuperadmin()) {
            return true;
        }
        if (isComplianceOfficer(u.email())) {
            return true;
        }
        long userId = u.id();
        if (isResponsavelProcesso(id, userId) || isEditorProcesso(id, userId)) {
            return true;
        }
        Object gestorUserId = lookupGestorUserId(str(processo.get("diretoria")));
        return gestorUserId != null && eqId(gestorUserId, userId);
    }

    private static boolean isComplianceOfficer(String email) {
        return email != null && COMPLIANCE_OFFICER_EMAIL.equalsIgnoreCase(email.trim());
    }

    /** True quando o usuário é editor atribuído ao processo (editores JSONB). */
    private boolean isEditorProcesso(long id, long userId) {
        var rows = jdbc.queryForList(
                "SELECT 1 FROM processos_negocio p, " +
                        "jsonb_array_elements(COALESCE(p.editores, '[]'::jsonb)) e " +
                        "WHERE p.id = ? AND (e->>'user_id') ~ '^[0-9]+$' AND (e->>'user_id')::int = ?",
                id, userId);
        return !rows.isEmpty();
    }

    /** Pode gerenciar editores: superadmin (Gestor do Escritório), Responsável do Processo ou Revisor (gestor da diretoria). */
    private boolean podeGerenciarEditores(Map<String, Object> processo, long id, long userId) {
        Map<String, Object> user = lookupUser(userId);
        if (user != null && Boolean.TRUE.equals(user.get("is_superadmin"))) {
            return true;
        }
        if (isResponsavelProcesso(id, userId)) {
            return true;
        }
        Object gestorUserId = lookupGestorUserId(str(processo.get("diretoria")));
        return gestorUserId != null && eqId(gestorUserId, userId);
    }

    private static Long parseLong(Object v) {
        if (v instanceof Number n) {
            return n.longValue();
        }
        if (v != null) {
            try {
                return Long.parseLong(String.valueOf(v).trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    /** True quando o usuário é responsável vinculado de uma unidade no campo "Responsável" (proprietarios JSONB). */
    private boolean isResponsavelProcesso(long id, long userId) {
        var rows = jdbc.queryForList(
                "SELECT 1 FROM processos_negocio p, " +
                        "jsonb_array_elements(COALESCE(p.proprietarios, '[]'::jsonb)) e " +
                        "WHERE p.id = ? AND (e->>'responsavel_user_id') ~ '^[0-9]+$' " +
                        "AND (e->>'responsavel_user_id')::int = ?",
                id, userId);
        return !rows.isEmpty();
    }

    private Object lookupGestorUserId(String diretoria) {
        var rows = jdbc.queryForList(
                "SELECT gestor_user_id FROM cadastros_areas " +
                        "WHERE LOWER(TRIM(sigla)) = LOWER(TRIM(?)) AND COALESCE(ativo, TRUE) = TRUE LIMIT 1",
                diretoria);
        return rows.isEmpty() ? null : rows.get(0).get("gestor_user_id");
    }

    private static String userName(Map<String, Object> user, String fallback) {
        if (user != null && user.get("name") != null) {
            return String.valueOf(user.get("name"));
        }
        return fallback;
    }

    private static boolean eqId(Object a, long b) {
        return a instanceof Number n && n.longValue() == b;
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }
}
