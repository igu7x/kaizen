package br.jus.tjgo.kaizen.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * CORS byte-a-byte com o Node (server.ts linhas 77-101).
 * Lista explicita de origins + regex *.tjgo.jus.br; headers custom X-User-*; OPTIONS -> 200.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class KaizenCorsFilter extends OncePerRequestFilter {

    private static final List<String> ALLOWED_ORIGINS = List.of(
            "http://localhost:5173",
            "http://localhost:8080",
            "http://localhost:3000",
            "https://painel-sgjt-stag-frontend.apps.ocp-prd.tjgo.jus.br",
            "http://painel-sgjt-stag-frontend.apps.ocp-prd.tjgo.jus.br",
            "https://painel-sgjt-prd-frontend.apps.ocp-prd.tjgo.jus.br",
            "http://painel-sgjt-prd-frontend.apps.ocp-prd.tjgo.jus.br",
            "https://kaizen.tjgo.jus.br",
            "http://kaizen.tjgo.jus.br"
    );

    private static final Pattern TJGO_PATTERN = Pattern.compile(
            "^https?://([a-z0-9-]+\\.)*tjgo\\.jus\\.br$",
            Pattern.CASE_INSENSITIVE
    );

    private final List<String> extraOrigins;

    public KaizenCorsFilter(org.springframework.core.env.Environment env) {
        String configured = env.getProperty("kaizen.cors.extra-origins", "");
        List<String> extras = new ArrayList<>();
        if (configured != null && !configured.isBlank()) {
            for (String o : configured.split(",")) {
                String trimmed = o.trim();
                if (!trimmed.isEmpty()) {
                    extras.add(trimmed);
                }
            }
        }
        this.extraOrigins = extras;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String origin = req.getHeader("Origin");
        boolean isAllowedTjgo = origin != null && TJGO_PATTERN.matcher(origin).matches();

        if (origin != null && (ALLOWED_ORIGINS.contains(origin) || extraOrigins.contains(origin) || isAllowedTjgo)) {
            res.setHeader("Access-Control-Allow-Origin", origin);
        } else if (origin == null) {
            res.setHeader("Access-Control-Allow-Origin", "*");
        }

        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers",
                "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-User-Role, X-User-Id, X-User-Diretoria");
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Expose-Headers", "X-Flash-Success, X-Flash-Notice, X-Flash-Error");
        res.setHeader("Access-Control-Max-Age", "86400");

        if ("OPTIONS".equalsIgnoreCase(req.getMethod())) {
            res.setStatus(HttpServletResponse.SC_OK);
            return;
        }

        chain.doFilter(req, res);
    }
}
