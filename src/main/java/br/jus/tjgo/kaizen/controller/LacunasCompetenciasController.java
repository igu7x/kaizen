package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.service.LacunasCompetenciasService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Relatório de Lacunas de Competências. Endpoints SOMENTE DE LEITURA — o relatório é calculado
 * na hora da consulta, nada é gravado nem alterado.
 *
 * <p>Acesso restrito ao gestor da unidade e ao diretor/sub-diretor da área (e a superadmin).
 */
@Tag(name = "Competências — Lacunas",
     description = "Compara a aplicabilidade declarada na Matriz da equipe com o Resultado Final, apontando o débito de competências da unidade.")
@RestController
@RequestMapping("/api/competencias/lacunas")
@RequiredArgsConstructor
public class LacunasCompetenciasController {

    private final LacunasCompetenciasService service;

    private long currentUserId() {
        Long id = AuthContext.requestUserId();
        return id != null ? id : -1L;
    }

    private boolean isSuperadmin() {
        return AuthContext.getCurrentUser().map(u -> u.isSuperadmin()).orElse(false);
    }

    /** Unidades sobre as quais o usuário logado pode emitir o relatório. */
    @GetMapping("/unidades")
    public List<Map<String, Object>> unidades() {
        return service.unidadesPermitidas(currentUserId(), isSuperadmin());
    }

    /** Unidades cujo gestor o usuário pode analisar — as das áreas que ele dirige. */
    @GetMapping("/gestor/unidades")
    public List<Map<String, Object>> unidadesGestor() {
        return service.unidadesComGestor(currentUserId(), isSuperadmin());
    }

    /**
     * Lacunas do GESTOR da unidade: o que ele alcançou e o que está em débito, competência a
     * competência. Restrito à direção da área.
     */
    @GetMapping("/gestor")
    public ResponseEntity<?> relatorioGestor(@RequestParam("unidadeId") long unidadeId) {
        if (!service.podeGerarGestor(unidadeId, currentUserId(), isSuperadmin())) {
            return ResponseEntity.status(403).body(Map.of(
                    "error", "Apenas a direção da área pode gerar o relatório do gestor"));
        }
        Map<String, Object> relatorio = service.gerarGestor(unidadeId);
        if (relatorio == null) {
            return ResponseEntity.status(404).body(Map.of(
                    "error", "A unidade ainda não tem Matriz de Competências do Gestor — sem ela não há referência"));
        }
        return ResponseEntity.ok(relatorio);
    }

    /**
     * Relatório da unidade, calculado no momento da chamada.
     *
     * <p>O nível de corte não é mais parâmetro: cada competência traz o seu Grau mínimo esperado,
     * definido no preenchimento da matriz.
     */
    @GetMapping
    public ResponseEntity<?> relatorio(@RequestParam("unidadeId") long unidadeId) {
        long userId = currentUserId();
        if (!service.podeGerar(unidadeId, userId, isSuperadmin())) {
            return ResponseEntity.status(403).body(Map.of(
                    "error", "Apenas o gestor da unidade e a direção da área podem gerar este relatório"));
        }
        Map<String, Object> relatorio = service.gerar(unidadeId);
        if (relatorio == null) {
            return ResponseEntity.status(404).body(Map.of(
                    "error", "A unidade ainda não tem Matriz de Competências da equipe — sem ela não há o que comparar"));
        }
        return ResponseEntity.ok(relatorio);
    }
}
