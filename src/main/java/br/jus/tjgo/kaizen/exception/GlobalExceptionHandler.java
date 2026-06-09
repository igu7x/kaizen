package br.jus.tjgo.kaizen.exception;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Formato de erro espelha o Node (server.ts error handler): corpo { error: <mensagem> },
 * status = err.status || 500.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> handleApiException(ApiException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(error(ex.getMessage()));
    }

    /**
     * Rotas/recursos sem handler — Spring 6 lança NoResourceFoundException por padrão.
     * O Node responde com 404 + corpo específico (server.ts catch-all):
     *   { "error":"Not Found", "message":"Route GET /api/foo not found", "available":"/api" }
     * Sem este handler, cairia no genérico abaixo e viraria 500 — quebra paridade
     * com o Node em qualquer probe de rota inexistente.
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(NoResourceFoundException ex,
                                                              HttpServletRequest req) {
        String method = req.getMethod();
        String path = req.getRequestURI();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "Not Found");
        body.put("message", "Route " + method + " " + path + " not found");
        body.put("available", "/api");
        return ResponseEntity.status(404).body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception ex) {
        // Stack completo no log do servidor (diagnóstico), mas mensagem CURADA no corpo da resposta.
        // Fix D (Sprint 11): não vazar detalhe do driver SQL (ex.: "bad SQL grammar [...]") no JSON —
        // é fidelidade (Node devolve mensagem genérica) e segurança (info-leak em produção é vulnerabilidade).
        log.error("Erro nao tratado", ex);
        return ResponseEntity.status(500).body(error("Erro interno do servidor"));
    }

    private Map<String, Object> error(String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", message);
        return body;
    }
}
