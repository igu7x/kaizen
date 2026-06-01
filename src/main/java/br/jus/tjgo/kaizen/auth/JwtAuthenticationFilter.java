package br.jus.tjgo.kaizen.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Base64;
import java.util.List;

/**
 * Filtro de autenticacao permissivo — paridade com middleware authenticate do Node (auth.ts).
 * Aceita JWT Keycloak (contem '.', busca por email) e base64 puro {"userId":N} (login local).
 * Token invalido ou ausente NAO bloqueia: segue sem auth, controllers decidem (Cat. A vs B).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final UserRepository userRepo;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String authHeader = req.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            try {
                AuthenticatedUser user = null;

                if (token.contains(".")) {
                    // JWT Keycloak — decodifica payload (parte 2), busca por email
                    String[] parts = token.split("\\.");
                    if (parts.length >= 2) {
                        String payloadPart = parts[1].replace('-', '+').replace('_', '/');
                        byte[] decoded = Base64.getDecoder().decode(
                                payloadPart + "=".repeat((4 - payloadPart.length() % 4) % 4)
                        );
                        JsonNode payload = objectMapper.readTree(decoded);
                        if (payload.hasNonNull("email")) {
                            user = userRepo.findAuthByEmail(payload.get("email").asText()).orElse(null);
                        }
                        if (user == null && payload.hasNonNull("userId")) {
                            user = userRepo.findAuthById(payload.get("userId").asLong()).orElse(null);
                        }
                    }
                } else {
                    // Base64 puro {"userId":N} — atalho de login local (paridade Node)
                    byte[] decoded = Base64.getDecoder().decode(token);
                    JsonNode payload = objectMapper.readTree(decoded);
                    if (payload.hasNonNull("userId")) {
                        user = userRepo.findAuthById(payload.get("userId").asLong()).orElse(null);
                    }
                }

                if (user != null) {
                    var auth = new UsernamePasswordAuthenticationToken(
                            user, null,
                            List.of(new SimpleGrantedAuthority("ROLE_" + user.role()))
                    );
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (Exception e) {
                log.warn("[Auth] Token invalido: {}", e.getMessage());
                // Permissivo: erro de token NAO bloqueia.
            }
        }
        chain.doFilter(req, res);
    }
}
