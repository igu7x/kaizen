package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.exception.ApiException;
import br.jus.tjgo.kaizen.service.ColaboradoresService;
import br.jus.tjgo.kaizen.service.DomainService;
import br.jus.tjgo.kaizen.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de routes/colaboradores.ts. CRUD colaboradores + organograma (com upload de foto).
 * userId = principal -> header x-user-id -> null. Sem 401 (nenhum endpoint retorna 401 no Node).
 */
@Slf4j
@RestController
@RequestMapping("/api/colaboradores")
@RequiredArgsConstructor
public class ColaboradoresController {

    private static final Path UPLOADS_DIR = Paths.get("uploads/gestores").toAbsolutePath().normalize();

    private final ColaboradoresService service;
    private final UserService userService;
    private final DomainService domainService;

    private Long getCurrentUserId(HttpServletRequest req) {
        Long principal = AuthContext.getCurrentUser().map(u -> u.id()).orElse(null);
        if (principal != null) {
            return principal;
        }
        String header = req.getHeader("x-user-id");
        if (header != null && !header.isBlank()) {
            try {
                return Long.parseLong(header.trim());
            } catch (NumberFormatException ignored) {
                // segue
            }
        }
        return null;
    }

    private List<String> getDomainDiretorias(HttpServletRequest req) {
        Long userId = getCurrentUserId(req);
        if (userId == null) {
            return null;
        }
        Map<String, Object> user = userService.findUserById(userId);
        if (user == null || user.get("diretoria") == null) {
            return null;
        }
        return domainService.getDomainForDiretoria(String.valueOf(user.get("diretoria"))).diretoriasInDomain();
    }

    // ---------- listagem / metadados ----------

    @GetMapping
    public ResponseEntity<?> list(HttpServletRequest req,
                                  @RequestParam(value = "diretoria", required = false) String diretoria) {
        if (diretoria != null && !diretoria.isBlank() && !domainService.isValidDiretoria(diretoria)) {
            return ResponseEntity.status(400).body(Map.of("error", "Diretoria inválida"));
        }
        List<String> domainDirs = (diretoria == null || diretoria.isBlank()) ? getDomainDiretorias(req) : null;
        return ResponseEntity.ok(service.findAllColaboradores(diretoria, "colaborador", domainDirs));
    }

    @GetMapping("/estatisticas")
    public ResponseEntity<?> estatisticas(HttpServletRequest req,
                                          @RequestParam(value = "diretoria", required = false) String diretoria) {
        if (diretoria != null && !diretoria.isBlank() && !domainService.isValidDiretoria(diretoria)) {
            return ResponseEntity.status(400).body(Map.of("error", "Diretoria inválida"));
        }
        List<String> domainDirs = (diretoria == null || diretoria.isBlank()) ? getDomainDiretorias(req) : null;
        return ResponseEntity.ok(service.getEstatisticas(diretoria, domainDirs));
    }

    @GetMapping("/unidades")
    public List<String> unidades() {
        return service.getUnidadesLotacao();
    }

    @GetMapping("/situacoes")
    public List<String> situacoes() {
        return ColaboradoresService.SITUACOES_FUNCIONAIS;
    }

    @GetMapping("/diretorias")
    public List<String> diretorias() {
        return service.getAllDiretorias();
    }

    // ---------- organograma ----------

    @GetMapping("/organograma")
    public List<Map<String, Object>> organograma(HttpServletRequest req,
                                                 @RequestParam(value = "diretoria", required = false) String diretoria) {
        List<String> domainDirs = (diretoria == null || "Todas".equals(diretoria)) ? getDomainDiretorias(req) : null;
        return service.getOrganograma(diretoria, domainDirs);
    }

    @GetMapping("/organograma/diretorias")
    public List<String> organogramaDiretorias() {
        return service.getAllDiretorias();
    }

    @GetMapping("/organograma/subordinados/{id:\\d+}")
    public List<Map<String, Object>> subordinados(@PathVariable long id) {
        return service.getSubordinados(id);
    }

    @GetMapping("/organograma/linha/{linha:\\d+}")
    public ResponseEntity<?> gestoresPorLinha(HttpServletRequest req, @PathVariable int linha,
                                              @RequestParam(value = "diretoria", required = false) String diretoria) {
        if (linha < 1 || linha > 10) {
            return ResponseEntity.status(400).body(Map.of("error", "Linha deve estar entre 1 e 10"));
        }
        List<String> domainDirs = (diretoria == null || "Todas".equals(diretoria)) ? getDomainDiretorias(req) : null;
        return ResponseEntity.ok(service.getGestoresPorLinha(linha, diretoria, domainDirs));
    }

    @GetMapping("/organograma/possiveis-pais/{linha:\\d+}")
    public ResponseEntity<?> possiveisPais(HttpServletRequest req, @PathVariable int linha,
                                           @RequestParam(value = "diretoria", required = false) String diretoria) {
        if (linha < 2 || linha > 10) {
            return ResponseEntity.status(400).body(Map.of("error", "Linha deve estar entre 2 e 10"));
        }
        List<String> domainDirs = (diretoria == null || "Todas".equals(diretoria)) ? getDomainDiretorias(req) : null;
        return ResponseEntity.ok(service.getPossiveisPais(linha, diretoria, domainDirs));
    }

    @PutMapping("/organograma/reordenar")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> reordenar(HttpServletRequest req, @RequestBody Map<String, Object> body) {
        Object linhaObj = body.get("linha_organograma");
        Object novaOrdem = body.get("nova_ordem");
        if (linhaObj == null || !(novaOrdem instanceof List)) {
            return ResponseEntity.status(400).body(Map.of("error", "Campos obrigatórios: linha_organograma (number), nova_ordem (array)"));
        }
        int linha;
        try {
            linha = Integer.parseInt(String.valueOf(linhaObj));
        } catch (NumberFormatException e) {
            return ResponseEntity.status(400).body(Map.of("error", "Linha deve estar entre 1 e 10"));
        }
        if (linha < 1 || linha > 10) {
            return ResponseEntity.status(400).body(Map.of("error", "Linha deve estar entre 1 e 10"));
        }
        List<Map<String, Object>> ordem = (List<Map<String, Object>>) novaOrdem;
        for (Map<String, Object> item : ordem) {
            if (item.get("id") == null || !(item.get("ordem") instanceof Number)) {
                return ResponseEntity.status(400).body(Map.of("error", "Cada item deve ter: id (number) e ordem (number)"));
            }
        }
        try {
            service.reordenarGestores(linha, ordem, getCurrentUserId(req));
            return ResponseEntity.ok(Map.of("success", true, "message", "Ordem atualizada com sucesso"));
        } catch (ApiException e) {
            return mapOrgError(e);
        }
    }

    @GetMapping("/organograma/{id:\\d+}")
    public ResponseEntity<?> gestorById(@PathVariable long id) {
        Map<String, Object> gestor = service.getGestorById(id);
        if (gestor == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Gestor não encontrado"));
        }
        return ResponseEntity.ok(gestor);
    }

    @PostMapping("/organograma")
    public ResponseEntity<?> createGestor(HttpServletRequest req,
                                          @RequestParam Map<String, String> form,
                                          @RequestParam(value = "foto", required = false) MultipartFile foto) {
        String fotoPath = null;
        Path savedFile = null;
        try {
            if (foto != null && !foto.isEmpty()) {
                savedFile = saveFoto(foto);
                fotoPath = "/uploads/gestores/" + savedFile.getFileName();
            }
            Map<String, Object> data = new HashMap<>(form);
            data.put("foto_gestor", fotoPath);
            Map<String, Object> novo = service.createGestor(data, getCurrentUserId(req));
            return ResponseEntity.status(201).body(novo);
        } catch (ApiException e) {
            deleteQuietly(savedFile);
            return mapOrgError(e);
        } catch (IOException e) {
            deleteQuietly(savedFile);
            return ResponseEntity.status(500).body(Map.of("error", "Erro ao salvar foto"));
        }
    }

    @PutMapping("/organograma/{id:\\d+}")
    public ResponseEntity<?> updateGestor(HttpServletRequest req, @PathVariable long id,
                                          @RequestParam Map<String, String> form,
                                          @RequestParam(value = "foto", required = false) MultipartFile foto) {
        Path savedFile = null;
        try {
            Map<String, Object> data = new HashMap<>(form);
            if (foto != null && !foto.isEmpty()) {
                savedFile = saveFoto(foto);
                data.put("foto_gestor", "/uploads/gestores/" + savedFile.getFileName());
            } else if ("true".equals(form.get("remover_foto"))) {
                data.put("foto_gestor", null);
            }
            Map<String, Object> atualizado = service.updateGestor(id, data, getCurrentUserId(req));
            if (atualizado == null) {
                deleteQuietly(savedFile);
                return ResponseEntity.status(404).body(Map.of("error", "Gestor não encontrado"));
            }
            return ResponseEntity.ok(atualizado);
        } catch (ApiException e) {
            deleteQuietly(savedFile);
            return mapOrgError(e);
        } catch (IOException e) {
            deleteQuietly(savedFile);
            return ResponseEntity.status(500).body(Map.of("error", "Erro ao salvar foto"));
        }
    }

    @DeleteMapping("/organograma/{id:\\d+}")
    public ResponseEntity<?> deleteGestor(HttpServletRequest req, @PathVariable long id) {
        try {
            boolean deleted = service.deleteGestor(id, getCurrentUserId(req));
            if (!deleted) {
                return ResponseEntity.status(404).body(Map.of("error", "Gestor não encontrado"));
            }
            return ResponseEntity.noContent().build();
        } catch (ApiException e) {
            return mapOrgError(e);
        }
    }

    // ---------- colaborador por ID (CRUD principal) ----------

    @GetMapping("/{id:\\d+}")
    public ResponseEntity<?> getById(@PathVariable long id) {
        Map<String, Object> c = service.findColaboradorById(id);
        if (c == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Colaborador não encontrado"));
        }
        return ResponseEntity.ok(c);
    }

    @PostMapping
    public ResponseEntity<?> create(HttpServletRequest req, @RequestBody Map<String, Object> body) {
        if (isBlank(body.get("colaborador")) || isBlank(body.get("unidade_lotacao"))
                || isBlank(body.get("situacao_funcional")) || isBlank(body.get("diretoria"))) {
            return ResponseEntity.status(400).body(Map.of("error",
                    "Campos obrigatórios: colaborador, unidade_lotacao, situacao_funcional, diretoria"));
        }
        try {
            return ResponseEntity.status(201).body(service.createColaborador(body, getCurrentUserId(req)));
        } catch (ApiException e) {
            return mapColabError(e);
        }
    }

    @PutMapping("/{id:\\d+}")
    public ResponseEntity<?> update(HttpServletRequest req, @PathVariable long id, @RequestBody Map<String, Object> body) {
        try {
            Map<String, Object> atualizado = service.updateColaborador(id, body, getCurrentUserId(req));
            if (atualizado == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Colaborador não encontrado"));
            }
            return ResponseEntity.ok(atualizado);
        } catch (ApiException e) {
            return mapColabError(e);
        }
    }

    @DeleteMapping("/{id:\\d+}")
    public ResponseEntity<?> delete(HttpServletRequest req, @PathVariable long id) {
        boolean deleted = service.deleteColaborador(id, getCurrentUserId(req));
        if (!deleted) {
            return ResponseEntity.status(404).body(Map.of("error", "Colaborador não encontrado"));
        }
        return ResponseEntity.noContent().build();
    }

    // ---------- helpers ----------

    private Path saveFoto(MultipartFile foto) throws IOException {
        Files.createDirectories(UPLOADS_DIR);
        String original = foto.getOriginalFilename() == null ? "" : foto.getOriginalFilename();
        String ext = original.contains(".") ? original.substring(original.lastIndexOf('.')) : "";
        String filename = "gestor-" + System.currentTimeMillis() + "-" + java.util.UUID.randomUUID() + ext;
        Path target = UPLOADS_DIR.resolve(filename);
        foto.transferTo(target.toFile());
        return target;
    }

    private void deleteQuietly(Path p) {
        if (p != null) {
            try {
                Files.deleteIfExists(p);
            } catch (IOException ignored) {
                // best effort
            }
        }
    }

    private ResponseEntity<?> mapOrgError(ApiException e) {
        String m = e.getMessage();
        if ("LINHA_INVALIDA".equals(m)) {
            return ResponseEntity.status(400).body(Map.of("error", "Linha deve estar entre 1 e 10"));
        }
        if ("SUBORDINACAO_OBRIGATORIA".equals(m)) {
            return ResponseEntity.status(400).body(Map.of("error", "Linhas 2+ devem ter subordinação"));
        }
        if ("LINHA_1_SEM_SUBORDINACAO".equals(m)) {
            return ResponseEntity.status(400).body(Map.of("error", "Linha 1 não pode ter subordinação"));
        }
        if ("TEM_SUBORDINADOS".equals(m)) {
            return ResponseEntity.status(400).body(Map.of("error", "Não é possível excluir: existem áreas subordinadas"));
        }
        if ("IDS_INVALIDOS".equals(m)) {
            return ResponseEntity.status(400).body(Map.of("error", "Um ou mais IDs são inválidos"));
        }
        if ("LINHAS_DIFERENTES".equals(m)) {
            return ResponseEntity.status(400).body(Map.of("error", "Todos os gestores devem pertencer à mesma linha"));
        }
        throw e;
    }

    private ResponseEntity<?> mapColabError(ApiException e) {
        String m = e.getMessage();
        if ("SITUACAO_FUNCIONAL_INVALIDA".equals(m)) {
            Map<String, Object> b = new java.util.LinkedHashMap<>();
            b.put("error", "Situação funcional inválida");
            b.put("validos", ColaboradoresService.SITUACOES_FUNCIONAIS);
            return ResponseEntity.status(400).body(b);
        }
        if ("DIRETORIA_INVALIDA".equals(m)) {
            Map<String, Object> b = new java.util.LinkedHashMap<>();
            b.put("error", "Diretoria inválida");
            b.put("validas", service.getAllDiretorias());
            return ResponseEntity.status(400).body(b);
        }
        throw e;
    }

    private static boolean isBlank(Object v) {
        return v == null || String.valueOf(v).isBlank();
    }
}
