package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.service.HomeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Porte fiel de home.ts. Montado em /api/home (com authenticate).
 * Categoria B (strict): usa currentUserId() — lança 401 sem auth (NÃO usa requestUserId/fallback).
 */
@Tag(name = "Home / Dashboard", description = "Resumo personalizado de pendências do usuário logado (13 blocos, try/catch silencioso por bloco).")
@Slf4j
@RestController
@RequestMapping("/api/home")
@RequiredArgsConstructor
public class HomeController {

    private final HomeService homeService;

    // GET /api/home/resumo
    @Operation(summary = "Resumo de pendências do usuário", description = "Categoria B (strict): 401 sem auth. Retorna { user, pendencias[], projetos }.")
    @GetMapping("/resumo")
    public ResponseEntity<?> resumo() {
        long userId = AuthContext.currentUserId(); // 401 (Categoria B) se sem auth — fora do try
        try {
            Map<String, Object> resumo = homeService.getResumo(userId);
            if (resumo == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Usuário não encontrado"));
            }
            return ResponseEntity.ok(resumo);
        } catch (Exception e) {
            log.error("[home/resumo] erro: {}", e.getMessage());
            return ResponseEntity.status(500).body(Map.of("error", "Erro ao carregar resumo"));
        }
    }
}
