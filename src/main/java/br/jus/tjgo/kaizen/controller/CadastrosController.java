package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.auth.AuthenticatedUser;
import br.jus.tjgo.kaizen.service.CadastrosProjetosService;
import br.jus.tjgo.kaizen.service.TepService;
import br.jus.tjgo.kaizen.util.Flash;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Controller do módulo Cadastros — operações de Projetos (e seus aninhados:
 * Entregas, Riscos, Entraves, Tarefas, Áreas, TAP/TEP).
 *
 * Nome histórico era ContratosController (espelhando contratos-projetos.ts do backend Node);
 * renomeado em jun/2026 para refletir o módulo correto (Cadastros). NÃO confundir com o
 * módulo PCA (Contratações de TI), que é distinto.
 *
 * Roteamento dual: responde tanto em /api/cadastros (caminho atual) quanto em
 * /api/contratos (caminho legado, mantido por compatibilidade com o frontend institucional
 * do TJGO durante o cutover Node → Java). Após o cutover estável, a forma /api/contratos
 * pode ser removida.
 *
 * Autorização: entregas/evidências exigem ADMIN ou gestor do projeto (canEdit...).
 * TAP validar/recusar/revogar: identity-based por camada (no service). TEP create/delete:
 * apenas superadmin. userId derivado do JWT/principal ou Bearer base64.
 */
@Slf4j
@RestController
@RequestMapping({"/api/cadastros", "/api/contratos"})
@RequiredArgsConstructor
public class CadastrosController {

    private final CadastrosProjetosService service;
    private final TepService tepService;
    private final ObjectMapper objectMapper;

    // ---------- helpers de auth ----------

    private Long getUserId(HttpServletRequest req) {
        Long id = AuthContext.getCurrentUser().map(AuthenticatedUser::id).orElse(null);
        if (id != null) {
            return id;
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
        return null;
    }

    private String getUserRole() {
        return AuthContext.getCurrentUser().map(AuthenticatedUser::role).orElse(null);
    }

    private boolean canEditEntregasDoProjeto(HttpServletRequest req, long projetoId) {
        return service.isGestorOrAdmin(projetoId, getUserId(req), getUserRole());
    }

    private boolean canEditEntregaById(HttpServletRequest req, long entregaId) {
        Long projetoId = service.projetoIdDaEntrega(entregaId);
        if (projetoId == null) {
            return false;
        }
        return canEditEntregasDoProjeto(req, projetoId);
    }

    private static Map<String, Object> err(String error) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("error", error);
        return m;
    }

    private static ResponseEntity<?> fail(String fixed, Exception e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("error", fixed);
        m.put("details", e.getMessage());
        return ResponseEntity.status(500).body(m);
    }

    // ============================================================
    // DEBUG / DIAGNÓSTICO
    // ============================================================

    @GetMapping("/debug/tarefas")
    public ResponseEntity<?> debugTarefas(@RequestParam(value = "projeto_id", required = false) Integer projetoId,
                                          @RequestParam(value = "entrega_id", required = false) Integer entregaId) {
        try {
            return ResponseEntity.ok(service.getDebugTarefas(projetoId, entregaId));
        } catch (Exception e) {
            return fail("Erro no diagnóstico", e);
        }
    }

    // ============================================================
    // PROJETOS
    // ============================================================

    @GetMapping("/projetos")
    public ResponseEntity<?> listProjetos(HttpServletRequest req,
                                          @RequestParam(value = "diretoria", required = false) String diretoria) {
        try {
            // Se não veio diretoria, derivar do usuário logado (apenas req.userId, como o Node).
            if (diretoria == null) {
                Long userId = AuthContext.getCurrentUser().map(AuthenticatedUser::id).orElse(null);
                if (userId != null) {
                    String dir = service.lookupUserDiretoriaForProjetos(userId);
                    if (dir != null) {
                        diretoria = dir;
                    }
                }
            }
            return ResponseEntity.ok(service.getAllProjetos(diretoria));
        } catch (Exception e) {
            return fail("Erro ao listar projetos", e);
        }
    }

    @GetMapping("/projetos/instrumento/{instrumentoId:\\d+}")
    public ResponseEntity<?> projetosByInstrumento(@PathVariable long instrumentoId,
                                                   @RequestParam(value = "diretoria", required = false) String diretoria) {
        try {
            return ResponseEntity.ok(service.getProjetosByInstrumentoId(instrumentoId, diretoria));
        } catch (Exception e) {
            return fail("Erro ao buscar projetos por instrumento", e);
        }
    }

    @GetMapping("/projetos/{id:\\d+}")
    public ResponseEntity<?> getProjeto(@PathVariable long id) {
        try {
            Map<String, Object> projeto = service.getProjetoById(id);
            if (projeto == null) {
                return ResponseEntity.status(404).body(err("Projeto não encontrado"));
            }
            return ResponseEntity.ok(comRelacionados(id, projeto));
        } catch (Exception e) {
            return fail("Erro ao buscar projeto", e);
        }
    }

    @PostMapping("/projetos")
    public ResponseEntity<?> createProjeto(HttpServletRequest req, @RequestBody Map<String, Object> body) {
        try {
            Map<String, Object> projeto = service.createProjeto(body, getUserId(req));
            return ResponseEntity.status(HttpStatus.CREATED).body(comRelacionados(((Number) projeto.get("id")).longValue(), projeto));
        } catch (Exception e) {
            return fail("Erro ao criar projeto", e);
        }
    }

    @PostMapping("/projetos/{id:\\d+}/gerar-tap")
    public ResponseEntity<?> gerarTap(@PathVariable long id) {
        try {
            Map<String, Object> projeto = service.gerarTapId(id);
            if (projeto == null) {
                return ResponseEntity.status(404).body(err("Projeto não encontrado"));
            }
            return ResponseEntity.ok(projeto);
        } catch (Exception e) {
            return fail("Erro ao gerar TAP ID", e);
        }
    }

    @PostMapping("/projetos/{id:\\d+}/regenerar-tap")
    public ResponseEntity<?> regenerarTap(@PathVariable long id) {
        try {
            Map<String, Object> projeto = service.regenerarTap(id);
            if (projeto == null) {
                return ResponseEntity.status(404).body(err("Projeto não encontrado"));
            }
            return ResponseEntity.ok(projeto);
        } catch (Exception e) {
            return fail("Erro ao regenerar TAP", e);
        }
    }

    @PutMapping("/projetos/{id:\\d+}")
    public ResponseEntity<?> updateProjeto(HttpServletRequest req, @PathVariable long id, @RequestBody Map<String, Object> body) {
        try {
            Map<String, Object> projeto = service.updateProjeto(id, body, getUserId(req));
            if (projeto == null) {
                return ResponseEntity.status(404).body(err("Projeto não encontrado"));
            }
            return ResponseEntity.ok(comRelacionados(id, projeto));
        } catch (Exception e) {
            return fail("Erro ao atualizar projeto", e);
        }
    }

    @DeleteMapping("/projetos/{id:\\d+}")
    public ResponseEntity<?> deleteProjeto(HttpServletRequest req, @PathVariable long id) {
        try {
            if (!service.deleteProjeto(id, getUserId(req))) {
                return ResponseEntity.status(404).body(err("Projeto não encontrado"));
            }
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return fail("Erro ao excluir projeto", e);
        }
    }

    /** {...projeto, areasExecucao, entregas, riscos, entraves} — paridade com a rota. */
    private Map<String, Object> comRelacionados(long id, Map<String, Object> projeto) {
        Map<String, Object> out = new LinkedHashMap<>(projeto);
        out.put("areasExecucao", service.getAreasExecucao(id));
        out.put("entregas", service.getEntregas(id));
        out.put("riscos", service.getRiscos(id));
        out.put("entraves", service.getEntraves(id));
        return out;
    }

    // ============================================================
    // ENTREGAS
    // ============================================================

    @GetMapping("/projetos/{projetoId:\\d+}/entregas")
    public ResponseEntity<?> listEntregas(@PathVariable long projetoId) {
        try {
            return ResponseEntity.ok(service.getEntregas(projetoId));
        } catch (Exception e) {
            return fail("Erro ao listar entregas", e);
        }
    }

    @PostMapping("/projetos/{projetoId:\\d+}/entregas")
    public ResponseEntity<?> createEntrega(HttpServletRequest req, @PathVariable long projetoId, @RequestBody Map<String, Object> body) {
        try {
            if (!canEditEntregasDoProjeto(req, projetoId)) {
                return ResponseEntity.status(403).body(err("Apenas administradores ou o gestor do projeto podem adicionar entregas."));
            }
            Map<String, Object> entrega = service.createEntrega(projetoId, body, getUserId(req));
            return ResponseEntity.status(HttpStatus.CREATED).body(entrega);
        } catch (Exception e) {
            return fail("Erro ao criar entrega", e);
        }
    }

    @PutMapping("/entregas/{id:\\d+}")
    public ResponseEntity<?> updateEntrega(HttpServletRequest req, @PathVariable long id, @RequestBody Map<String, Object> body) {
        try {
            if (!canEditEntregaById(req, id)) {
                return ResponseEntity.status(403).body(err("Apenas administradores ou o gestor do projeto podem editar entregas."));
            }
            Map<String, Object> entrega = service.updateEntrega(id, body, getUserId(req));
            if (entrega == null) {
                return ResponseEntity.status(404).body(err("Entrega não encontrada"));
            }
            return ResponseEntity.ok(entrega);
        } catch (Exception e) {
            return fail("Erro ao atualizar entrega", e);
        }
    }

    @DeleteMapping("/entregas/{id:\\d+}")
    public ResponseEntity<?> deleteEntrega(HttpServletRequest req, @PathVariable long id) {
        try {
            if (!canEditEntregaById(req, id)) {
                return ResponseEntity.status(403).body(err("Apenas administradores ou o gestor do projeto podem excluir entregas."));
            }
            if (!service.deleteEntrega(id, getUserId(req))) {
                return ResponseEntity.status(404).body(err("Entrega não encontrada"));
            }
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return fail("Erro ao excluir entrega", e);
        }
    }

    // ============================================================
    // TAREFAS DE ENTREGAS
    // ============================================================

    @GetMapping("/entregas/{entregaId:\\d+}/tarefas")
    public ResponseEntity<?> listTarefas(@PathVariable long entregaId) {
        try {
            return ResponseEntity.ok(service.getTarefasByEntregaId(entregaId));
        } catch (Exception e) {
            return fail("Erro ao listar tarefas", e);
        }
    }

    @PostMapping("/entregas/{entregaId:\\d+}/tarefas")
    public ResponseEntity<?> createTarefa(HttpServletRequest req, @PathVariable long entregaId, @RequestBody Map<String, Object> body) {
        try {
            Map<String, Object> tarefa = service.createTarefaEntrega(entregaId, body, getUserId(req));
            return ResponseEntity.status(HttpStatus.CREATED).body(tarefa);
        } catch (Exception e) {
            return fail("Erro ao criar tarefa", e);
        }
    }

    @PutMapping("/tarefas/{id:\\d+}")
    public ResponseEntity<?> updateTarefa(HttpServletRequest req, @PathVariable long id, @RequestBody Map<String, Object> body) {
        try {
            Map<String, Object> tarefa = service.updateTarefaEntrega(id, body, getUserId(req));
            if (tarefa == null) {
                return ResponseEntity.status(404).body(err("Tarefa não encontrada"));
            }
            return ResponseEntity.ok(tarefa);
        } catch (Exception e) {
            return fail("Erro ao atualizar tarefa", e);
        }
    }

    @DeleteMapping("/tarefas/{id:\\d+}")
    public ResponseEntity<?> deleteTarefa(HttpServletRequest req, @PathVariable long id) {
        try {
            if (!service.deleteTarefaEntrega(id, getUserId(req))) {
                return ResponseEntity.status(404).body(err("Tarefa não encontrada"));
            }
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return fail("Erro ao excluir tarefa", e);
        }
    }

    // ============================================================
    // RISCOS
    // ============================================================

    @GetMapping("/projetos/{projetoId:\\d+}/riscos")
    public ResponseEntity<?> listRiscos(@PathVariable long projetoId) {
        try {
            return ResponseEntity.ok(service.getRiscos(projetoId));
        } catch (Exception e) {
            return fail("Erro ao listar riscos", e);
        }
    }

    @PostMapping("/projetos/{projetoId:\\d+}/riscos")
    public ResponseEntity<?> createRisco(HttpServletRequest req, @PathVariable long projetoId, @RequestBody Map<String, Object> body) {
        try {
            Map<String, Object> risco = service.createRisco(projetoId, body, getUserId(req));
            return ResponseEntity.status(HttpStatus.CREATED).body(risco);
        } catch (Exception e) {
            return fail("Erro ao criar risco", e);
        }
    }

    @PutMapping("/riscos/{id:\\d+}")
    public ResponseEntity<?> updateRisco(HttpServletRequest req, @PathVariable long id, @RequestBody Map<String, Object> body) {
        try {
            Map<String, Object> risco = service.updateRisco(id, body, getUserId(req));
            if (risco == null) {
                return ResponseEntity.status(404).body(err("Risco não encontrado"));
            }
            return ResponseEntity.ok(risco);
        } catch (Exception e) {
            return fail("Erro ao atualizar risco", e);
        }
    }

    @DeleteMapping("/riscos/{id:\\d+}")
    public ResponseEntity<?> deleteRisco(HttpServletRequest req, @PathVariable long id) {
        try {
            if (!service.deleteRisco(id, getUserId(req))) {
                return ResponseEntity.status(404).body(err("Risco não encontrado"));
            }
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return fail("Erro ao excluir risco", e);
        }
    }

    // ============================================================
    // ENTRAVES
    // ============================================================

    @GetMapping("/projetos/{projetoId:\\d+}/entraves")
    public ResponseEntity<?> listEntraves(@PathVariable long projetoId) {
        try {
            return ResponseEntity.ok(service.getEntraves(projetoId));
        } catch (Exception e) {
            return fail("Erro ao listar entraves", e);
        }
    }

    @PostMapping("/projetos/{projetoId:\\d+}/entraves")
    public ResponseEntity<?> createEntrave(HttpServletRequest req, @PathVariable long projetoId, @RequestBody Map<String, Object> body) {
        try {
            Map<String, Object> entrave = service.createEntrave(projetoId, body, getUserId(req));
            return ResponseEntity.status(HttpStatus.CREATED).body(entrave);
        } catch (Exception e) {
            return fail("Erro ao criar entrave", e);
        }
    }

    @PutMapping("/entraves/{id:\\d+}")
    public ResponseEntity<?> updateEntrave(HttpServletRequest req, @PathVariable long id, @RequestBody Map<String, Object> body) {
        try {
            Map<String, Object> entrave = service.updateEntrave(id, body, getUserId(req));
            if (entrave == null) {
                return ResponseEntity.status(404).body(err("Entrave não encontrado"));
            }
            return ResponseEntity.ok(entrave);
        } catch (Exception e) {
            return fail("Erro ao atualizar entrave", e);
        }
    }

    @DeleteMapping("/entraves/{id:\\d+}")
    public ResponseEntity<?> deleteEntrave(HttpServletRequest req, @PathVariable long id) {
        try {
            if (!service.deleteEntrave(id, getUserId(req))) {
                return ResponseEntity.status(404).body(err("Entrave não encontrado"));
            }
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return fail("Erro ao excluir entrave", e);
        }
    }

    // ============================================================
    // AUXILIARES (selects)
    // ============================================================

    @GetMapping("/colaboradores")
    public ResponseEntity<?> colaboradores(@RequestParam(value = "diretoria", required = false) String diretoria) {
        try {
            return ResponseEntity.ok(service.getColaboradores(diretoria));
        } catch (Exception e) {
            return fail("Erro ao listar colaboradores", e);
        }
    }

    @GetMapping("/areas")
    public ResponseEntity<?> areas(@RequestParam(value = "diretoria", required = false) String diretoria) {
        try {
            return ResponseEntity.ok(service.getAreas(diretoria));
        } catch (Exception e) {
            return fail("Erro ao listar áreas", e);
        }
    }

    // ============================================================
    // EVIDÊNCIAS DE ENTREGAS (multipart PDF)
    // ============================================================

    @PostMapping("/entregas/{id:\\d+}/upload-evidencia")
    public ResponseEntity<?> uploadEvidencia(HttpServletRequest req, @PathVariable long id,
                                             @RequestParam(value = "evidencia", required = false) MultipartFile file,
                                             @RequestParam(value = "data_conclusao", required = false) String dataConclusao) {
        try {
            if (file == null || file.isEmpty()) {
                return ResponseEntity.status(400).body(err("Nenhum arquivo enviado"));
            }
            if (!canEditEntregaById(req, id)) {
                return ResponseEntity.status(403).body(err("Apenas administradores ou o gestor do projeto podem enviar evidências."));
            }
            Map<String, Object> entrega = service.getEntregaById(id);
            if (entrega == null) {
                return ResponseEntity.status(404).body(err("Entrega não encontrada"));
            }
            // Remover arquivo legado em disco, se houver (registros antigos anteriores ao DB).
            Object oldPath = entrega.get("evidencia_filepath");
            if (oldPath != null) {
                deleteFileQuiet(oldPath.toString());
            }
            String filename = file.getOriginalFilename();
            long filesize = file.getSize();
            // Persiste o PDF NO BANCO (bytea). O filesystem do pod (OpenShift) é efêmero/somente
            // -leitura, então gravar em disco falhava com 500 em produção.
            service.updateEntregaEvidencia(id, filename, file.getBytes(), filesize);

            if (filename != null && filename.toLowerCase().endsWith(".pdf")) {
                service.updateEntregaStatus(id, "concluida");
                // Data de Conclusão informada pelo usuário sobrepõe o CURRENT_DATE padrão.
                if (dataConclusao != null && !dataConclusao.isBlank()) {
                    service.setEntregaDataConclusao(id, dataConclusao);
                }
                service.calcularProgresso(((Number) entrega.get("projeto_id")).longValue());
            }
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("success", true);
            out.put("filename", filename);
            out.put("filesize", filesize);
            return ResponseEntity.ok(out);
        } catch (Exception e) {
            return fail("Erro ao fazer upload de evidência", e);
        }
    }

    @GetMapping("/entregas/{id:\\d+}/download-evidencia")
    public ResponseEntity<?> downloadEvidencia(@PathVariable long id) {
        try {
            Map<String, Object> entrega = service.getEntregaById(id);
            if (entrega == null) {
                return ResponseEntity.status(404).body(err("Entrega não encontrada"));
            }
            String filename = entrega.get("evidencia_filename") != null
                    ? entrega.get("evidencia_filename").toString() : "evidencia.pdf";
            // Armazenamento atual: bytes no banco.
            Map<String, Object> dados = service.getEntregaEvidenciaData(id);
            Object bytes = dados == null ? null : dados.get("evidencia_data");
            if (bytes instanceof byte[] b && b.length > 0) {
                return ResponseEntity.ok()
                        .contentType(MediaType.APPLICATION_PDF)
                        .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                        .body(b);
            }
            // Fallback legado: arquivo em disco (registros antigos).
            Object filepath = entrega.get("evidencia_filepath");
            if (filepath != null) {
                Path p = Paths.get(filepath.toString());
                if (Files.exists(p)) {
                    return ResponseEntity.ok()
                            .contentType(MediaType.APPLICATION_PDF)
                            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                            .body(new FileSystemResource(p));
                }
            }
            return ResponseEntity.status(404).body(err("Evidência não disponível"));
        } catch (Exception e) {
            return fail("Erro ao baixar evidência", e);
        }
    }

    @DeleteMapping("/entregas/{id:\\d+}/evidencia")
    public ResponseEntity<?> removerEvidencia(HttpServletRequest req, @PathVariable long id) {
        try {
            if (!canEditEntregaById(req, id)) {
                return ResponseEntity.status(403).body(err("Apenas administradores ou o gestor do projeto podem remover evidências."));
            }
            Map<String, Object> entrega = service.getEntregaById(id);
            if (entrega == null) {
                return ResponseEntity.status(404).body(err("Entrega não encontrada"));
            }
            Object filepath = entrega.get("evidencia_filepath");
            if (filepath != null) {
                deleteFileQuiet(filepath.toString());
            }
            service.updateEntregaEvidencia(id, null, null, null);
            service.updateEntregaStatus(id, "nao_iniciada");
            service.calcularProgresso(((Number) entrega.get("projeto_id")).longValue());
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return fail("Erro ao remover evidência", e);
        }
    }

    private void deleteFileQuiet(String filepath) {
        try {
            Path p = Paths.get(filepath);
            if (Files.exists(p)) {
                Files.delete(p);
            }
        } catch (Exception e) {
            log.warn("Erro ao deletar arquivo {}: {}", filepath, e.getMessage());
        }
    }

    // ============================================================
    // TAP VALIDAÇÃO (3 CAMADAS) — rotas em /{id}/tap/...
    // ============================================================

    @PostMapping("/{id:\\d+}/tap/validar/{camada:\\d+}")
    public ResponseEntity<?> validarTap(HttpServletRequest req, @PathVariable long id, @PathVariable int camada) {
        Long userId = getUserId(req);
        if (userId == null) {
            return ResponseEntity.status(401).body(err("Usuário não autenticado"));
        }
        if (camada < 1 || camada > 3) {
            return ResponseEntity.status(400).body(err("Camada inválida (deve ser 1, 2 ou 3)"));
        }
        try {
            Object result = service.validarTAP(id, camada, userId);
            String msg = camada == 3 ? "TAP Vigente! Validação concluída." : "TAP validado - Camada " + camada;
            return Flash.success(result, msg);
        } catch (Exception e) {
            return ResponseEntity.status(400).body(err(msgOr(e, "Erro ao validar TAP")));
        }
    }

    @PostMapping("/{id:\\d+}/tap/recusar/{camada:\\d+}")
    public ResponseEntity<?> recusarTap(HttpServletRequest req, @PathVariable long id, @PathVariable int camada,
                                        @RequestBody(required = false) Map<String, Object> body) {
        Long userId = getUserId(req);
        String comentario = body != null && body.get("comentario") != null
                ? blankToNull(String.valueOf(body.get("comentario"))) : null;
        if (userId == null) {
            return ResponseEntity.status(401).body(err("Usuário não autenticado"));
        }
        if (camada != 2 && camada != 3) {
            return ResponseEntity.status(400).body(err("Apenas camadas 2 (Diretor) e 3 (Patrocinador) podem recusar"));
        }
        try {
            Object result = service.recusarTAP(id, camada, userId, comentario);
            return Flash.success(result, "TAP recusado. O gestor foi notificado para ajustar e revalidar.");
        } catch (Exception e) {
            return ResponseEntity.status(400).body(err(msgOr(e, "Erro ao recusar TAP")));
        }
    }

    @GetMapping("/projetos/{id:\\d+}/tap/versoes")
    public ResponseEntity<?> tapVersoes(@PathVariable long id) {
        try {
            return ResponseEntity.ok(service.findTapVersoes(id));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(err(msgOr(e, "Erro ao listar versões do TAP")));
        }
    }

    @GetMapping("/projetos/{id:\\d+}/tap/versoes/{versao:\\d+}")
    public ResponseEntity<?> tapVersaoDados(@PathVariable long id, @PathVariable int versao) {
        try {
            Object dados = service.findTapVersaoDados(id, versao);
            if (dados == null) {
                return ResponseEntity.status(404).body(err("Versão não encontrada"));
            }
            return ResponseEntity.ok(dados);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(err(msgOr(e, "Erro ao buscar versão do TAP")));
        }
    }

    @DeleteMapping("/{id:\\d+}/tap/validar/{camada:\\d+}")
    public ResponseEntity<?> revogarTap(HttpServletRequest req, @PathVariable long id, @PathVariable int camada) {
        Long userId = getUserId(req);
        if (userId == null) {
            return ResponseEntity.status(401).body(err("Usuário não autenticado"));
        }
        try {
            return ResponseEntity.ok(service.revogarValidacaoTAP(id, camada, userId));
        } catch (Exception e) {
            return ResponseEntity.status(400).body(err(msgOr(e, "Erro ao revogar validação")));
        }
    }

    // ============================================================
    // TEP — Termo de Encerramento (apenas superadmin p/ create/delete)
    // ============================================================

    @GetMapping("/projetos/{id:\\d+}/tep")
    public ResponseEntity<?> getTep(@PathVariable long id) {
        try {
            Map<String, Object> tep = tepService.findByProjetoId(id);
            // Node faz res.json(tep) — pode ser null (corpo "null"). Serializa explicitamente.
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(objectMapper.writeValueAsString(tep));
        } catch (Exception e) {
            return fail("Erro ao buscar TEP", e);
        }
    }

    @PostMapping("/projetos/{id:\\d+}/tep")
    public ResponseEntity<?> createTep(HttpServletRequest req, @PathVariable long id, @RequestBody(required = false) Map<String, Object> body) {
        try {
            Long userId = getUserId(req);
            if (!service.isSuperadmin(userId)) {
                return ResponseEntity.status(403).body(err("Apenas superadmins podem finalizar um projeto via TEP."));
            }
            if (userId == null) {
                return ResponseEntity.status(401).body(err("Usuário não autenticado"));
            }
            String userName = service.lookupUserName(userId);
            if (userName == null) {
                userName = "Superadmin";
            }
            Map<String, Object> b = body != null ? body : Map.of();
            String tipo = b.get("tipo_encerramento") != null ? String.valueOf(b.get("tipo_encerramento")) : null;
            String motivo = b.get("motivo_cancelamento") != null ? String.valueOf(b.get("motivo_cancelamento")) : null;
            String consGerente = b.get("consideracoes_gerente") != null ? String.valueOf(b.get("consideracoes_gerente")) : null;
            String consPatroc = b.get("consideracoes_patrocinador") != null ? String.valueOf(b.get("consideracoes_patrocinador")) : null;

            if (!"concluido".equals(tipo) && !"cancelado".equals(tipo)) {
                return ResponseEntity.status(400).body(err("tipo_encerramento deve ser \"concluido\" ou \"cancelado\"."));
            }
            if ("cancelado".equals(tipo) && blankToNull(motivo) == null) {
                return ResponseEntity.status(400).body(err("Informe o motivo do cancelamento."));
            }
            Map<String, Object> tep = tepService.upsert(id, tipo, motivo, consGerente, consPatroc, userId, userName);
            String msg = "Projeto " + ("concluido".equals(tipo) ? "concluído" : "cancelado") + " com sucesso.";
            return Flash.success(tep, msg);
        } catch (Exception e) {
            return fail("Erro ao salvar TEP", e);
        }
    }

    @DeleteMapping("/projetos/{id:\\d+}/tep")
    public ResponseEntity<?> deleteTep(HttpServletRequest req, @PathVariable long id) {
        try {
            if (!service.isSuperadmin(getUserId(req))) {
                return ResponseEntity.status(403).body(err("Apenas superadmins podem reverter a finalização."));
            }
            tepService.delete(id);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return fail("Erro ao reverter TEP", e);
        }
    }

    @PostMapping("/projetos/{id:\\d+}/tep/validar/{camada:\\d+}")
    public ResponseEntity<?> validarTep(HttpServletRequest req, @PathVariable long id, @PathVariable int camada) {
        Long userId = getUserId(req);
        if (userId == null) {
            return ResponseEntity.status(401).body(err("Usuário não autenticado"));
        }
        if (camada < 1 || camada > 3) {
            return ResponseEntity.status(400).body(err("Camada inválida (deve ser 1, 2 ou 3)"));
        }
        try {
            Object result = tepService.validarCamada(id, camada, userId);
            String msg = camada == 3 ? "TEP Vigente! Validação concluída." : "TEP validado — Camada " + camada;
            return Flash.success(result, msg);
        } catch (Exception e) {
            return ResponseEntity.status(400).body(err(msgOr(e, "Erro ao validar TEP")));
        }
    }

    @PostMapping("/projetos/{id:\\d+}/tep/recusar/{camada:\\d+}")
    public ResponseEntity<?> recusarTep(HttpServletRequest req, @PathVariable long id, @PathVariable int camada,
                                        @RequestBody(required = false) Map<String, Object> body) {
        Long userId = getUserId(req);
        String comentario = body != null && body.get("comentario") != null
                ? blankToNull(String.valueOf(body.get("comentario"))) : null;
        if (userId == null) {
            return ResponseEntity.status(401).body(err("Usuário não autenticado"));
        }
        if (camada != 2 && camada != 3) {
            return ResponseEntity.status(400).body(err("Apenas camadas 2 (Diretor) e 3 (Patrocinador) podem recusar"));
        }
        try {
            Object result = tepService.recusarCamada(id, camada, userId, comentario);
            return Flash.success(result, "TEP recusado. O gestor foi notificado para ajustar e revalidar.");
        } catch (Exception e) {
            return ResponseEntity.status(400).body(err(msgOr(e, "Erro ao recusar TEP")));
        }
    }

    @GetMapping("/projetos/{id:\\d+}/tep/versoes")
    public ResponseEntity<?> tepVersoes(@PathVariable long id) {
        try {
            return ResponseEntity.ok(tepService.findVersoes(id));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(err(msgOr(e, "Erro ao listar versões do TEP")));
        }
    }

    @GetMapping("/projetos/{id:\\d+}/tep/versoes/{versao:\\d+}")
    public ResponseEntity<?> tepVersaoDados(@PathVariable long id, @PathVariable int versao) {
        try {
            Object dados = tepService.findVersaoDados(id, versao);
            if (dados == null) {
                return ResponseEntity.status(404).body(err("Versão não encontrada"));
            }
            return ResponseEntity.ok(dados);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(err(msgOr(e, "Erro ao buscar versão do TEP")));
        }
    }

    @DeleteMapping("/projetos/{id:\\d+}/tep/validar/{camada:\\d+}")
    public ResponseEntity<?> revogarTep(@PathVariable long id, @PathVariable int camada) {
        if (camada < 1 || camada > 3) {
            return ResponseEntity.status(400).body(err("Camada inválida"));
        }
        try {
            return ResponseEntity.ok(tepService.revogarValidacao(id, camada));
        } catch (Exception e) {
            return ResponseEntity.status(400).body(err(msgOr(e, "Erro ao revogar validação")));
        }
    }

    // ---------- helpers ----------

    private static String msgOr(Exception e, String fallback) {
        return e.getMessage() != null ? e.getMessage() : fallback;
    }

    private static String blankToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
