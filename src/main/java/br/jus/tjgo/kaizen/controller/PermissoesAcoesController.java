package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.dto.CreatePermissaoAcaoReq;
import br.jus.tjgo.kaizen.dto.PermissaoAcaoListDto;
import br.jus.tjgo.kaizen.dto.TagAcaoDto;
import br.jus.tjgo.kaizen.service.PermissoesAcoesService;
import br.jus.tjgo.kaizen.auth.AuthContext;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/permissoes-acoes")
public class PermissoesAcoesController {

    private final PermissoesAcoesService permissoesAcoesService;

    public PermissoesAcoesController(PermissoesAcoesService permissoesAcoesService) {
        this.permissoesAcoesService = permissoesAcoesService;
    }

    @GetMapping
    public ResponseEntity<List<PermissaoAcaoListDto>> listarTodasPermissoes() {
        AuthContext.requireRole(List.of("ADMIN"));
        return ResponseEntity.ok(permissoesAcoesService.listarTodasPermissoes());
    }

    @PostMapping
    public ResponseEntity<Void> adicionarPermissao(@RequestBody CreatePermissaoAcaoReq req) {
        AuthContext.requireRole(List.of("ADMIN"));
        permissoesAcoesService.adicionarPermissao(req);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> removerPermissao(@PathVariable Long id) {
        AuthContext.requireRole(List.of("ADMIN"));
        permissoesAcoesService.removerPermissao(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/tags")
    public ResponseEntity<List<TagAcaoDto>> listarTags() {
        AuthContext.requireRole(List.of("ADMIN"));
        return ResponseEntity.ok(permissoesAcoesService.listarTags());
    }
}
