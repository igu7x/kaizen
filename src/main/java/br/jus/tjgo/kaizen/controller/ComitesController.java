package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.exception.ApiException;
import br.jus.tjgo.kaizen.service.ComitesService;
import br.jus.tjgo.kaizen.service.DomainService;
import br.jus.tjgo.kaizen.util.PgErrors;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.FileSystemResource;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de comites.ts. Auth header-based: X-User-Role obrigatório (401 se ausente);
 * X-User-Diretoria='SGJT' tem bypass total; senão role em [GESTOR,ADMIN,MANAGER] (uppercase).
 * userId via X-User-Id (default 1). Upload de ata em PDF (uploadAta -> comites/atas/{sigla}/{ano}).
 */
@Slf4j
@RestController
@RequestMapping("/api/comites")
@RequiredArgsConstructor
public class ComitesController {

    private final ComitesService service;
    private final DomainService domainService;

    private static final Path UPLOAD_BASE = Paths.get("uploads").toAbsolutePath().normalize();

    private void requireGestorOrAdmin(HttpServletRequest req) {
        String role = req.getHeader("x-user-role");
        String diretoria = req.getHeader("x-user-diretoria");
        if (role == null) {
            throw new ApiException(401, "Não autenticado");
        }
        if (diretoria != null && "SGJT".equals(diretoria.toUpperCase())) {
            return;
        }
        String up = role.toUpperCase();
        if (!up.equals("GESTOR") && !up.equals("ADMIN") && !up.equals("MANAGER")) {
            throw new ApiException(403, "Sem permissão. Apenas gestores e administradores.");
        }
    }

    private long userId(HttpServletRequest req) {
        String v = req.getHeader("x-user-id");
        if (v == null) {
            return 1;
        }
        try {
            return Long.parseLong(v.trim());
        } catch (NumberFormatException e) {
            return 1;
        }
    }

    // ======================== COMITÊS ========================

    @GetMapping
    public ResponseEntity<?> list(HttpServletRequest req, @RequestParam(value = "dominio", required = false) String dominio) {
        try {
            String d = dominio;
            if (d == null) {
                String diretoria = req.getHeader("x-user-diretoria");
                if (diretoria != null) {
                    d = domainService.getDomainForDiretoria(diretoria).dominio();
                }
            }
            return ResponseEntity.ok(service.findAll(d));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(err(e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> create(HttpServletRequest req, @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req);
        if (isBlank(body.get("nome")) || isBlank(body.get("sigla"))) {
            return ResponseEntity.status(400).body(err("Nome e sigla são obrigatórios"));
        }
        Object dominio = body.get("dominio");
        if (dominio == null) {
            String diretoria = req.getHeader("x-user-diretoria");
            dominio = diretoria != null ? domainService.getDomainForDiretoria(diretoria).dominio() : "SGJT";
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("nome", body.get("nome"));
        data.put("sigla", body.get("sigla"));
        data.put("descricao", body.get("descricao"));
        data.put("icone", body.get("icone"));
        data.put("cor", body.get("cor"));
        data.put("dominio", dominio);
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(service.create(data, userId(req)));
        } catch (DataAccessException e) {
            if (PgErrors.is(e, "23505")) {
                return ResponseEntity.status(409).body(err("Já existe um comitê com esta sigla"));
            }
            return ResponseEntity.status(500).body(err(e.getMessage()));
        }
    }

    @PutMapping("/{id:\\d+}")
    public ResponseEntity<?> update(HttpServletRequest req, @PathVariable long id, @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req);
        Map<String, Object> updated = service.update(id, body, userId(req));
        if (updated == null) {
            return ResponseEntity.status(404).body(err("Comitê não encontrado"));
        }
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id:\\d+}")
    public ResponseEntity<?> delete(HttpServletRequest req, @PathVariable long id) {
        requireGestorOrAdmin(req);
        if (!service.deleteComite(id, userId(req))) {
            return ResponseEntity.status(404).body(err("Comitê não encontrado"));
        }
        return ResponseEntity.ok(Map.of("message", "Comitê excluído com sucesso"));
    }

    @GetMapping("/{sigla}")
    public ResponseEntity<?> getBySigla(@PathVariable String sigla) {
        Map<String, Object> comite = service.findBySigla(sigla);
        if (comite == null) {
            try {
                comite = service.findById(Long.parseLong(sigla));
            } catch (NumberFormatException ignored) {
                // segue
            }
        }
        if (comite == null) {
            return ResponseEntity.status(404).body(err("Comitê não encontrado"));
        }
        return ResponseEntity.ok(comite);
    }

    // ======================== MEMBROS ========================

    @GetMapping("/{comiteId:\\d+}/membros")
    public List<Map<String, Object>> listMembros(@PathVariable long comiteId) {
        return service.findMembros(comiteId);
    }

    @PostMapping("/{comiteId:\\d+}/membros")
    public ResponseEntity<?> createMembro(HttpServletRequest req, @PathVariable long comiteId, @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req);
        if (isBlank(body.get("nome")) || isBlank(body.get("cargo"))) {
            return ResponseEntity.status(400).body(err("Nome e cargo são obrigatórios"));
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createMembro(comiteId, body, userId(req)));
    }

    @PutMapping("/{comiteId:\\d+}/membros/{id:\\d+}")
    public ResponseEntity<?> updateMembro(HttpServletRequest req, @PathVariable long comiteId, @PathVariable long id, @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req);
        Map<String, Object> updated = service.updateMembro(id, body, userId(req));
        if (updated == null) {
            return ResponseEntity.status(404).body(err("Membro não encontrado"));
        }
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{comiteId:\\d+}/membros/{id:\\d+}")
    public ResponseEntity<?> deleteMembro(HttpServletRequest req, @PathVariable long comiteId, @PathVariable long id) {
        requireGestorOrAdmin(req);
        if (!service.deleteMembro(id, userId(req))) {
            return ResponseEntity.status(404).body(err("Membro não encontrado"));
        }
        return ResponseEntity.ok(Map.of("message", "Membro removido com sucesso"));
    }

    // ======================== REUNIÕES ========================

    @GetMapping("/{comiteId:\\d+}/reunioes")
    public List<Map<String, Object>> listReunioes(@PathVariable long comiteId, @RequestParam(value = "ano", required = false) Integer ano) {
        return service.findReunioes(comiteId, ano);
    }

    @GetMapping("/{comiteId:\\d+}/reunioes/{id:\\d+}")
    public ResponseEntity<?> getReuniao(@PathVariable long comiteId, @PathVariable long id) {
        Map<String, Object> r = service.findReuniaoById(id);
        if (r == null) {
            return ResponseEntity.status(404).body(err("Reunião não encontrada"));
        }
        return ResponseEntity.ok(r);
    }

    @PostMapping("/{comiteId:\\d+}/reunioes")
    public ResponseEntity<?> createReuniao(HttpServletRequest req, @PathVariable long comiteId, @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req);
        if (body.get("numero") == null || body.get("ano") == null || body.get("data") == null) {
            return ResponseEntity.status(400).body(err("Número, ano e data são obrigatórios"));
        }
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(service.createReuniao(comiteId, body, userId(req)));
        } catch (DataAccessException e) {
            if (PgErrors.is(e, "23505")) {
                return ResponseEntity.status(409).body(err("Já existe uma reunião com este número e ano"));
            }
            return ResponseEntity.status(500).body(err(e.getMessage()));
        }
    }

    @PutMapping("/{comiteId:\\d+}/reunioes/{id:\\d+}")
    public ResponseEntity<?> updateReuniao(HttpServletRequest req, @PathVariable long comiteId, @PathVariable long id, @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req);
        Map<String, Object> updated = service.updateReuniao(id, body, userId(req));
        if (updated == null) {
            return ResponseEntity.status(404).body(err("Reunião não encontrada"));
        }
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{comiteId:\\d+}/reunioes/{id:\\d+}")
    public ResponseEntity<?> deleteReuniao(HttpServletRequest req, @PathVariable long comiteId, @PathVariable long id) {
        requireGestorOrAdmin(req);
        if (!service.deleteReuniao(id, userId(req))) {
            return ResponseEntity.status(404).body(err("Reunião não encontrada"));
        }
        return ResponseEntity.ok(Map.of("message", "Reunião removida com sucesso"));
    }

    // ======================== PAUTA ========================

    @GetMapping("/{comiteId:\\d+}/reunioes/{reuniaoId:\\d+}/pauta")
    public List<Map<String, Object>> listPauta(@PathVariable long comiteId, @PathVariable long reuniaoId) {
        return service.findPauta(reuniaoId);
    }

    @PostMapping("/{comiteId:\\d+}/reunioes/{reuniaoId:\\d+}/pauta")
    public ResponseEntity<?> createPauta(HttpServletRequest req, @PathVariable long comiteId, @PathVariable long reuniaoId, @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req);
        if (body.get("numero_item") == null || isBlank(body.get("descricao"))) {
            return ResponseEntity.status(400).body(err("Número do item e descrição são obrigatórios"));
        }
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(service.createPauta(reuniaoId, body, userId(req)));
        } catch (DataAccessException e) {
            if (PgErrors.is(e, "23505")) {
                return ResponseEntity.status(409).body(err("Já existe um item com este número nesta reunião"));
            }
            return ResponseEntity.status(500).body(err(e.getMessage()));
        }
    }

    @PutMapping("/{comiteId:\\d+}/reunioes/{reuniaoId:\\d+}/pauta/{id:\\d+}")
    public ResponseEntity<?> updatePauta(HttpServletRequest req, @PathVariable long comiteId, @PathVariable long reuniaoId, @PathVariable long id, @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req);
        Map<String, Object> updated = service.updatePauta(id, body, userId(req));
        if (updated == null) {
            return ResponseEntity.status(404).body(err("Item não encontrado"));
        }
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{comiteId:\\d+}/reunioes/{reuniaoId:\\d+}/pauta/{id:\\d+}")
    public ResponseEntity<?> deletePauta(HttpServletRequest req, @PathVariable long comiteId, @PathVariable long reuniaoId, @PathVariable long id) {
        requireGestorOrAdmin(req);
        if (!service.deletePauta(id, userId(req))) {
            return ResponseEntity.status(404).body(err("Item não encontrado"));
        }
        return ResponseEntity.ok(Map.of("message", "Item removido com sucesso"));
    }

    // ======================== QUADRO DE CONTROLE ========================

    @GetMapping("/{comiteId:\\d+}/quadro-controle")
    public List<Map<String, Object>> listQuadro(@PathVariable long comiteId) {
        return service.findQuadroControle(comiteId);
    }

    @PostMapping("/{comiteId:\\d+}/quadro-controle")
    public ResponseEntity<?> createQuadro(HttpServletRequest req, @PathVariable long comiteId, @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req);
        if (isBlank(body.get("item"))) {
            return ResponseEntity.status(400).body(err("Item (título) é obrigatório"));
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createQuadroControle(comiteId, body, userId(req)));
    }

    @PutMapping("/{comiteId:\\d+}/quadro-controle/{id:\\d+}")
    public ResponseEntity<?> updateQuadro(HttpServletRequest req, @PathVariable long comiteId, @PathVariable long id, @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req);
        Map<String, Object> updated = service.updateQuadroControle(id, body, userId(req));
        if (updated == null) {
            return ResponseEntity.status(404).body(err("Item não encontrado"));
        }
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{comiteId:\\d+}/quadro-controle/{id:\\d+}")
    public ResponseEntity<?> deleteQuadro(HttpServletRequest req, @PathVariable long comiteId, @PathVariable long id) {
        requireGestorOrAdmin(req);
        if (!service.deleteQuadroControle(id, userId(req))) {
            return ResponseEntity.status(404).body(err("Item não encontrado"));
        }
        return ResponseEntity.ok(Map.of("message", "Item removido com sucesso"));
    }

    // ======================== UPLOAD DE ATA ========================

    @PostMapping("/{sigla}/reunioes/{reuniaoId:\\d+}/upload-ata")
    public ResponseEntity<?> uploadAta(HttpServletRequest req, @PathVariable String sigla, @PathVariable long reuniaoId,
                                       @RequestParam(value = "ata", required = false) MultipartFile ata,
                                       @RequestParam(value = "numero", required = false) String numero,
                                       @RequestParam(value = "ano", required = false) String ano) {
        requireGestorOrAdmin(req);
        Path saved = null;
        try {
            if (ata == null || ata.isEmpty()) {
                return ResponseEntity.status(400).body(err("Nenhum arquivo enviado"));
            }
            String siglaSan = sigla.toLowerCase().replaceAll("[^a-z0-9-]", "-");
            String anoStr = (ano != null && !ano.isEmpty()) ? ano : String.valueOf(LocalDate.now().getYear());
            String numeroStr = (numero != null && !numero.isEmpty()) ? numero : "0";
            long ts = System.currentTimeMillis();
            Path dir = UPLOAD_BASE.resolve("comites").resolve("atas").resolve(siglaSan).resolve(anoStr);
            Files.createDirectories(dir);
            String filename = "ata-reuniao-" + numeroStr + "-" + anoStr + "-" + ts + ".pdf";
            saved = dir.resolve(filename);
            ata.transferTo(saved);

            Map<String, Object> reuniao = service.findReuniaoById(reuniaoId);
            if (reuniao == null) {
                Files.deleteIfExists(saved);
                return ResponseEntity.status(404).body(err("Reunião não encontrada"));
            }
            Object oldPath = reuniao.get("ata_filepath");
            if (oldPath != null) {
                deleteQuiet(oldPath.toString());
            }
            service.updateReuniaoAta(reuniaoId, filename, saved.toString(), ata.getSize(), userId(req));
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("message", "Ata enviada com sucesso");
            out.put("filename", filename);
            out.put("filesize", ata.getSize());
            out.put("uploaded_at", java.time.Instant.now());
            return ResponseEntity.ok(out);
        } catch (Exception e) {
            if (saved != null) {
                deleteQuiet(saved.toString());
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("error", "Erro ao fazer upload da ata");
            m.put("details", e.getMessage());
            return ResponseEntity.status(500).body(m);
        }
    }

    @GetMapping("/{sigla}/reunioes/{reuniaoId:\\d+}/ata")
    public ResponseEntity<?> getAtaInfo(@PathVariable String sigla, @PathVariable long reuniaoId) {
        Map<String, Object> reuniao = service.findReuniaoById(reuniaoId);
        if (reuniao == null) {
            return ResponseEntity.status(404).body(err("Reunião não encontrada"));
        }
        if (reuniao.get("ata_filename") == null) {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("has_ata", false);
            out.put("error", "Ata não disponível");
            return ResponseEntity.ok(out);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("has_ata", true);
        out.put("filename", reuniao.get("ata_filename"));
        out.put("filesize", reuniao.get("ata_filesize"));
        out.put("uploaded_at", reuniao.get("ata_uploaded_at"));
        return ResponseEntity.ok(out);
    }

    @GetMapping("/{sigla}/reunioes/{reuniaoId:\\d+}/download-ata")
    public ResponseEntity<?> downloadAta(@PathVariable String sigla, @PathVariable long reuniaoId) {
        Map<String, Object> reuniao = service.findReuniaoById(reuniaoId);
        if (reuniao == null) {
            return ResponseEntity.status(404).body(err("Reunião não encontrada"));
        }
        Object filepath = reuniao.get("ata_filepath");
        if (filepath == null) {
            return ResponseEntity.status(404).body(err("Ata não disponível"));
        }
        Path p = Paths.get(filepath.toString());
        if (!Files.exists(p)) {
            return ResponseEntity.status(404).body(err("Arquivo não encontrado no servidor"));
        }
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + reuniao.get("ata_filename") + "\"")
                .body(new FileSystemResource(p));
    }

    @DeleteMapping("/{sigla}/reunioes/{reuniaoId:\\d+}/ata")
    public ResponseEntity<?> deleteAta(HttpServletRequest req, @PathVariable String sigla, @PathVariable long reuniaoId) {
        requireGestorOrAdmin(req);
        Map<String, Object> reuniao = service.findReuniaoById(reuniaoId);
        if (reuniao == null) {
            return ResponseEntity.status(404).body(err("Reunião não encontrada"));
        }
        Object filepath = reuniao.get("ata_filepath");
        if (filepath != null) {
            deleteQuiet(filepath.toString());
        }
        service.updateReuniaoAta(reuniaoId, null, null, null, userId(req));
        return ResponseEntity.ok(Map.of("message", "Ata deletada com sucesso"));
    }

    // ======================== HELPERS ========================

    private void deleteQuiet(String filepath) {
        try {
            Files.deleteIfExists(Paths.get(filepath));
        } catch (Exception e) {
            log.warn("Erro ao deletar arquivo {}: {}", filepath, e.getMessage());
        }
    }

    private static Map<String, Object> err(String error) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("error", error);
        return m;
    }

    private static boolean isBlank(Object v) {
        return v == null || String.valueOf(v).trim().isEmpty();
    }
}
