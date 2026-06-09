package br.jus.tjgo.kaizen.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Health check e API info — paridade byte-a-byte com server.ts (linhas 145-184).
 * LinkedHashMap preserva a ordem dos campos (relevante p/ contract tests do Sprint 10).
 */
@RestController
public class HealthController {

    @Value("${kaizen.node-env:development}")
    private String environment;

    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "ok");
        body.put("timestamp", Instant.now());
        body.put("environment", environment);
        return body;
    }

    @GetMapping("/api")
    public Map<String, Object> apiInfo() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", "Plataforma de Gestão API");
        body.put("version", "1.0.0");
        body.put("description", "API PostgreSQL para OKR + Formulários Dinâmicos + Contratações TI");

        Map<String, Object> endpoints = new LinkedHashMap<>();
        endpoints.put("health", "/health");

        Map<String, Object> auth = new LinkedHashMap<>();
        auth.put("login", "POST /api/auth/login");
        auth.put("logout", "POST /api/auth/logout");
        endpoints.put("auth", auth);

        endpoints.put("users", "/api/users");
        endpoints.put("objectives", "/api/objectives");
        endpoints.put("keyResults", "/api/key-results");
        endpoints.put("initiatives", "/api/initiatives");
        endpoints.put("programs", "/api/programs");
        endpoints.put("directorates", "/api/directorates");
        endpoints.put("forms", "/api/forms");

        Map<String, Object> pcaItems = new LinkedHashMap<>();
        pcaItems.put("list", "GET /api/pca-items");
        pcaItems.put("get", "GET /api/pca-items/:id");
        pcaItems.put("stats", "GET /api/pca-items/stats");
        pcaItems.put("filters", "GET /api/pca-items/filters");
        pcaItems.put("create", "POST /api/pca-items");
        pcaItems.put("update", "PUT /api/pca-items/:id");
        pcaItems.put("updateStatus", "PATCH /api/pca-items/:id/status");
        pcaItems.put("delete", "DELETE /api/pca-items/:id");
        endpoints.put("pcaItems", pcaItems);

        body.put("endpoints", endpoints);
        return body;
    }
}
