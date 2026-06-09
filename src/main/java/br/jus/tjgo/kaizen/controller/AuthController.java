package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.config.SsoConfig;
import br.jus.tjgo.kaizen.exception.ApiException;
import br.jus.tjgo.kaizen.service.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Porte fiel de routes/auth.ts. Login local/base64 (NÃO JWT — replica auth.ts 271-297);
 * JWT real só no fluxo SSO Keycloak (desabilitado em dev). /me sempre 401 (igual ao Node).
 */
@Tag(name = "Auth", description = "Login local/base64 e fluxo SSO Keycloak. /me sempre 401 (paridade com o Node).")
@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final long TOKEN_TTL_MS = 8L * 60 * 60 * 1000;

    private final SsoConfig sso;
    private final UserService userService;
    private final ObjectMapper objectMapper;
    private final Environment env;

    // ---------- SSO (Keycloak) ----------

    @GetMapping("/sso/status")
    public Map<String, Object> ssoStatus() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("enabled", sso.isEnabled());
        body.put("realm", sso.getRealm());
        body.put("clientId", sso.getClientId());
        body.put("keycloakUrl", sso.getKeycloakUrl());
        body.put("authorizationUrl", sso.getAuthorizationUrl());
        body.put("redirectUri", sso.getRedirectUri());
        return body;
    }

    @GetMapping("/sso/login")
    public ResponseEntity<?> ssoLogin(@RequestParam(value = "returnUrl", required = false) String returnUrl) {
        if (!sso.isEnabled()) {
            return ResponseEntity.status(503).body(Map.of("error", "SSO não está configurado"));
        }
        String state = base64(Map.of("returnUrl", returnUrl == null ? "/" : returnUrl));
        String authUrl = sso.getAuthorizationUrl()
                + "?client_id=" + enc(sso.getClientId())
                + "&redirect_uri=" + enc(sso.getRedirectUri())
                + "&response_type=code&scope=openid&state=" + enc(state);
        return ResponseEntity.status(302).location(URI.create(authUrl)).build();
    }

    @GetMapping("/callback")
    public ResponseEntity<?> callback(@RequestParam Map<String, String> params) {
        return handleSsoCallback(params);
    }

    @GetMapping("/sso/callback")
    public ResponseEntity<?> ssoCallback(@RequestParam Map<String, String> params) {
        return handleSsoCallback(params);
    }

    private ResponseEntity<?> handleSsoCallback(Map<String, String> params) {
        String frontend = getFrontendUrl();
        String error = params.get("error");
        if (error != null) {
            String desc = params.getOrDefault("error_description", error);
            return redirect(frontend + "/login?error=" + enc(desc));
        }
        String code = params.get("code");
        if (code == null || code.isEmpty()) {
            return redirect(frontend + "/login?error=" + enc("Código de autorização não recebido"));
        }
        // SSO desabilitado em dev: a troca de código exigiria Keycloak. Falha de forma fiel.
        return redirect(frontend + "/login?error=" + enc("Erro na autenticação SSO"));
    }

    @PostMapping("/sso/refresh")
    public ResponseEntity<?> ssoRefresh(@RequestBody(required = false) Map<String, Object> body) {
        Object refreshToken = body == null ? null : body.get("refreshToken");
        if (refreshToken == null || String.valueOf(refreshToken).isBlank()) {
            return ResponseEntity.status(400).body(Map.of("error", "Refresh token é obrigatório"));
        }
        throw new ApiException(500, "SSO não configurado");
    }

    @GetMapping("/sso/logout")
    public ResponseEntity<?> ssoLogout(@RequestParam(value = "redirect", required = false) String redirect) {
        String frontend = getFrontendUrl();
        if (!sso.isEnabled()) {
            return redirect(frontend + "/login");
        }
        String postLogoutUri = (redirect != null && !redirect.isBlank()) ? redirect : frontend + "/login";
        String logoutUrl = sso.getLogoutUrl() + "?post_logout_redirect_uri=" + enc(postLogoutUri);
        return redirect(logoutUrl);
    }

    // ---------- Login local (dev/staging) ----------

    @PostMapping("/local/login")
    public ResponseEntity<?> localLogin(HttpServletRequest req, @RequestBody(required = false) Map<String, Object> body) {
        String combinedHost = combinedHost(req);
        if (!isLocalLoginEnabledWithHost(combinedHost)) {
            return ResponseEntity.status(403).body(Map.of("error", "Login local não está disponível neste ambiente"));
        }
        return doLogin(body);
    }

    @GetMapping("/local/status")
    public Map<String, Object> localStatus(HttpServletRequest req) {
        String combinedHost = combinedHost(req);
        boolean enabled = isLocalLoginEnabledWithHost(combinedHost);

        Map<String, Object> debug = new LinkedHashMap<>();
        debug.put("requestHost", nullToEmpty(req.getHeader("host")));
        debug.put("origin", nullToEmpty(req.getHeader("origin")));
        debug.put("nodeEnv", env.getProperty("NODE_ENV"));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("enabled", enabled);
        body.put("_debug", debug);
        return body;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody(required = false) Map<String, Object> body) {
        return doLogin(body);
    }

    private ResponseEntity<?> doLogin(Map<String, Object> body) {
        Object email = body == null ? null : body.get("email");
        Object password = body == null ? null : body.get("password");
        if (isBlank(email) || isBlank(password)) {
            return ResponseEntity.status(400).body(Map.of("error", "Email e senha são obrigatórios"));
        }
        Map<String, Object> user = userService.authenticate(String.valueOf(email), String.valueOf(password));
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Credenciais inválidas"));
        }
        Map<String, Object> tokenPayload = new LinkedHashMap<>();
        tokenPayload.put("userId", user.get("id"));
        tokenPayload.put("email", user.get("email"));

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("user", user);
        resp.put("accessToken", base64(tokenPayload));
        resp.put("expiresAt", System.currentTimeMillis() + TOKEN_TTL_MS);
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/logout")
    public Map<String, Object> logout() {
        return Map.of("message", "Logout realizado com sucesso");
    }

    @GetMapping("/me")
    public ResponseEntity<?> me() {
        return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
    }

    // ---------- helpers (porte de auth.ts) ----------

    private boolean isLocalLoginEnabledWithHost(String requestHost) {
        String nodeEnv = env.getProperty("NODE_ENV", "development");
        String frontendUrl = env.getProperty("FRONTEND_URL", "");
        String redirectUri = firstNonNull(env.getProperty("OPENSHIFT_SSO_KEYCLOAK_REDIRECT_URI"),
                env.getProperty("OPENSHIFT_SSO_KEYCLOACK_REDIRECT_URI"), "");
        String clientId = env.getProperty("OPENSHIFT_SSO_CLIENT_ID", "");
        String apiUrl = env.getProperty("OPENSHIFT_API_URL", "");

        String allSources = (frontendUrl + "|" + redirectUri + "|" + clientId + "|" + apiUrl + "|" + requestHost)
                .toLowerCase();

        if (allSources.contains("kaizen.tjgo.jus.br")) {
            return false;
        }
        if (allSources.contains("stag")) {
            return true;
        }
        if (nodeEnv.equals("development") || nodeEnv.equals("dev")
                || requestHost.contains("localhost") || requestHost.contains("127.0.0.1")) {
            return true;
        }
        if (nodeEnv.equals("production")) {
            if (allSources.contains("tjgo.jus.br") && !allSources.contains("kaizen")) {
                return true;
            }
            return false;
        }
        return true;
    }

    private String getFrontendUrl() {
        String frontendUrlRaw = nullToEmpty(env.getProperty("FRONTEND_URL")).trim();
        boolean valid = !frontendUrlRaw.isEmpty()
                && frontendUrlRaw.matches("(?i)^https?://.*")
                && !frontendUrlRaw.contains("${");
        if (valid) {
            return frontendUrlRaw;
        }
        String ambiente = nullToEmpty(env.getProperty("OPENSHIFT_BACKEND_AMBIENTE")).toLowerCase().trim();
        if (ambiente.equals("stag") || ambiente.equals("staging")) {
            return env.getProperty("FRONTEND_URL_STAGING", "https://painel-sgjt-stag-frontend.apps.ocp-prd.tjgo.jus.br");
        }
        if (ambiente.equals("prd") || ambiente.equals("production")) {
            return env.getProperty("FRONTEND_URL_PRODUCTION", "https://kaizen.tjgo.jus.br");
        }
        if ("production".equals(env.getProperty("NODE_ENV"))) {
            String redirectUri = firstNonNull(env.getProperty("OPENSHIFT_SSO_KEYCLOAK_REDIRECT_URI"),
                    env.getProperty("OPENSHIFT_SSO_KEYCLOACK_REDIRECT_URI"), "");
            String apiUrl = env.getProperty("OPENSHIFT_API_URL", "");
            if (redirectUri.contains("stag") || apiUrl.contains("stag")) {
                return env.getProperty("FRONTEND_URL_STAGING", "https://painel-sgjt-stag-frontend.apps.ocp-prd.tjgo.jus.br");
            }
            return env.getProperty("FRONTEND_URL_PRODUCTION", "https://kaizen.tjgo.jus.br");
        }
        return "http://localhost:5173";
    }

    private static String combinedHost(HttpServletRequest req) {
        return nullToEmpty(req.getHeader("host")) + "|"
                + nullToEmpty(req.getHeader("origin")) + "|"
                + nullToEmpty(req.getHeader("referer"));
    }

    private String base64(Object payload) {
        try {
            return Base64.getEncoder().encodeToString(objectMapper.writeValueAsBytes(payload));
        } catch (Exception e) {
            throw new ApiException(500, "Falha ao gerar token", e);
        }
    }

    private static ResponseEntity<?> redirect(String url) {
        return ResponseEntity.status(302).location(URI.create(url)).build();
    }

    private static String enc(String v) {
        return URLEncoder.encode(v == null ? "" : v, StandardCharsets.UTF_8);
    }

    private static boolean isBlank(Object v) {
        return v == null || String.valueOf(v).isBlank();
    }

    private static String nullToEmpty(String v) {
        return v == null ? "" : v;
    }

    private static String firstNonNull(String a, String b, String def) {
        if (a != null && !a.isEmpty()) {
            return a;
        }
        if (b != null && !b.isEmpty()) {
            return b;
        }
        return def;
    }
}
