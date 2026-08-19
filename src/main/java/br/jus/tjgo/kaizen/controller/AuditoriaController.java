package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.auth.AuthenticatedUser;
import br.jus.tjgo.kaizen.service.AuditoriaService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Trilha de auditoria GLOBAL do Kaizen (todos os módulos). Acesso restrito a superadmin — replica a
 * guarda do SgsiController: o backend é permitAll, então a proteção é feita aqui no controller.
 */
@Tag(name = "Auditoria", description = "Trilha de auditoria global (audit_log). Somente superadmin.")
@RestController
@RequestMapping("/api/auditoria")
@RequiredArgsConstructor
public class AuditoriaController {

    private final AuditoriaService auditoria;

    /** Retorna null se ok; senão a resposta de erro (401/403). */
    private ResponseEntity<?> guard() {
        AuthenticatedUser u = AuthContext.getCurrentUser().orElse(null);
        if (u == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        if (!u.isSuperadmin()) {
            return ResponseEntity.status(403).body(Map.of("error", "Acesso restrito ao superadministrador."));
        }
        return null;
    }

    /**
     * Listagem paginada da trilha. Sem teto: o cliente pagina até o fim ({@code total} vem na
     * resposta) ou pede {@code tamanho=0} pra receber todos os registros do filtro de uma vez.
     */
    @GetMapping
    public ResponseEntity<?> listar(
            @RequestParam(required = false) String acao,
            @RequestParam(required = false) String tabela,
            @RequestParam(required = false) String busca,
            @RequestParam(required = false) Integer pagina,
            @RequestParam(required = false) Integer tamanho) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(auditoria.listar(acao, tabela, busca, pagina, tamanho));
    }

    @GetMapping("/facetas")
    public ResponseEntity<?> facetas() {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(auditoria.facetas());
    }

    /** Registro completo (inclui old_values/new_values) — alimenta o "o que mudou" da tela. */
    @GetMapping("/{id}")
    public ResponseEntity<?> detalhe(@PathVariable long id) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        Map<String, Object> reg = auditoria.buscarPorId(id);
        if (reg == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Registro de auditoria não encontrado."));
        }
        return ResponseEntity.ok(reg);
    }
}
