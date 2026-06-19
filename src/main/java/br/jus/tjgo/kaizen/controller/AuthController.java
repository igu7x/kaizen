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
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

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

    // idToken do Keycloak por userId. Nao volta na URL do redirect pro frontend (era ate 50KB
    // pra admins, estourava o HAProxy do Route em ~16KB -> 502 Bad Gateway). Fica aqui em memoria
    // e o /sso/logout resolve internamente via Authorization header do request.
    // Limpa quando o pod reinicia (aceitavel: 1 replica, e o user precisaria relogar igual).
    private static final ConcurrentMap<String, String> ID_TOKEN_STORE = new ConcurrentHashMap<>();

    private final SsoConfig sso;
    private final UserService userService;
    private final ObjectMapper objectMapper;
    private final Environment env;
    private final RestTemplate restTemplate = new RestTemplate();

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
            log.warn("SSO callback recebeu error: {} ({})", error, desc);
            return redirect(frontend + "/login?error=" + enc(desc));
        }
        String code = params.get("code");
        if (code == null || code.isEmpty()) {
            return redirect(frontend + "/login?error=" + enc("Código de autorização não recebido"));
        }
        if (!sso.isEnabled()) {
            return redirect(frontend + "/login?error=" + enc("SSO não está configurado"));
        }

        try {
            // 1. Trocar code por token no Keycloak
            MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
            form.add("grant_type", "authorization_code");
            form.add("code", code);
            form.add("client_id", sso.getClientId());
            form.add("client_secret", sso.getClientSecret());
            form.add("redirect_uri", sso.getRedirectUri());

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            HttpEntity<MultiValueMap<String, String>> req = new HttpEntity<>(form, headers);

            @SuppressWarnings("unchecked")
            Map<String, Object> tokenResp = restTemplate.postForObject(sso.getTokenUrl(), req, Map.class);
            if (tokenResp == null || tokenResp.get("access_token") == null) {
                log.warn("SSO callback: token response sem access_token: {}", tokenResp);
                return redirect(frontend + "/login?error=" + enc("Falha ao obter token do Keycloak"));
            }

            String keycloakAccessToken = String.valueOf(tokenResp.get("access_token"));
            Object idTokenObj = tokenResp.get("id_token");
            String tokenForClaims = idTokenObj != null ? String.valueOf(idTokenObj) : keycloakAccessToken;

            // 2. Decodificar JWT pra pegar email
            String email = extractEmailFromJwt(tokenForClaims);
            if (email == null || email.isBlank()) {
                log.warn("SSO callback: email nao encontrado nos claims do token");
                return redirect(frontend + "/login?error=" + enc("E-mail não encontrado no token SSO"));
            }

            // 3. Buscar user no banco
            Map<String, Object> user = userService.findUserByEmail(email);
            if (user == null) {
                log.warn("SSO callback: usuario {} nao cadastrado", email);
                return redirect(frontend + "/login?error=" + enc("Usuário não cadastrado: " + email));
            }

            // 4. Gerar token local (mesmo padrao do login local — base64, NAO JWT)
            Map<String, Object> tokenPayload = new LinkedHashMap<>();
            tokenPayload.put("userId", user.get("id"));
            tokenPayload.put("email", user.get("email"));
            String localToken = base64(tokenPayload);

            // 5. Montar payload de tokens que o frontend (AuthCallback.tsx) espera.
            //    idToken e refreshToken NAO vao no payload (juntos passavam de 80KB pra admins
            //    -> HAProxy do Route estourava com 502 Bad Gateway).
            //    - idToken: guardado em memoria aqui, /sso/logout resolve internamente.
            //    - refreshToken: o endpoint /sso/refresh nem esta implementado hoje (lanca 500
            //      por design), entao mandar vazio nao quebra nada.
            Map<String, Object> tokens = new LinkedHashMap<>();
            tokens.put("accessToken", localToken);
            tokens.put("refreshToken", "");
            tokens.put("idToken", "");
            tokens.put("expiresAt", System.currentTimeMillis() + TOKEN_TTL_MS);

            if (idTokenObj != null) {
                String idTokenStr = String.valueOf(idTokenObj);
                if (!idTokenStr.isBlank()) {
                    ID_TOKEN_STORE.put(String.valueOf(user.get("id")), idTokenStr);
                }
            }

            // 6. Decodificar returnUrl do state (base64 de {"returnUrl": "..."})
            String returnUrl = "/";
            String state = params.get("state");
            if (state != null && !state.isBlank()) {
                try {
                    byte[] stateBytes = Base64.getDecoder().decode(state);
                    @SuppressWarnings("unchecked")
                    Map<String, Object> stateMap = objectMapper.readValue(stateBytes, Map.class);
                    Object ru = stateMap.get("returnUrl");
                    if (ru != null && !String.valueOf(ru).isBlank()) {
                        returnUrl = String.valueOf(ru);
                    }
                } catch (Exception ignore) {
                    // state malformado — ignora e usa "/"
                }
            }

            // 7. Redirecionar pro AuthCallback do frontend com user+tokens+returnUrl.
            //    Remove foto_perfil do payload — coluna armazena base64 da imagem, e pra
            //    admin pode passar de 150KB (caso ifccupertino: payload total ~190KB,
            //    estourava HAProxy do Route com 502). Frontend usa avatar default no
            //    primeiro render; quando carregar telas que listam users, a foto vem nos
            //    endpoints normais de /api/users.
            Map<String, Object> userForRedirect = new LinkedHashMap<>(user);
            Object fotoRemovida = userForRedirect.remove("foto_perfil");
            String userJson = objectMapper.writeValueAsString(userForRedirect);
            String tokensJson = objectMapper.writeValueAsString(tokens);
            String query = "?user=" + enc(userJson)
                    + "&tokens=" + enc(tokensJson)
                    + "&returnUrl=" + enc(returnUrl);
            log.info("SSO callback: login OK p/ {} [user={}B tokens={}B query={}B foto_perfil_omitida={}B]",
                    email, userJson.length(), tokensJson.length(), query.length(),
                    fotoRemovida == null ? 0 : String.valueOf(fotoRemovida).length());
            return redirect(frontend + "/auth/callback" + query);
        } catch (Exception e) {
            log.error("SSO callback: erro inesperado", e);
            return redirect(frontend + "/login?error=" + enc("Erro na autenticação SSO: " + e.getMessage()));
        }
    }

    private String extractEmailFromJwt(String jwt) {
        try {
            String[] parts = jwt.split("\\.");
            if (parts.length < 2) return null;
            byte[] payloadBytes = Base64.getUrlDecoder().decode(parts[1]);
            @SuppressWarnings("unchecked")
            Map<String, Object> claims = objectMapper.readValue(payloadBytes, Map.class);
            Object email = claims.get("email");
            if (email == null) {
                email = claims.get("preferred_username");
            }
            return email == null ? null : String.valueOf(email);
        } catch (Exception e) {
            log.warn("SSO callback: falha ao decodificar JWT: {}", e.getMessage());
            return null;
        }
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
    public ResponseEntity<?> ssoLogout(
            @RequestParam(value = "redirect", required = false) String redirect,
            @RequestParam(value = "id_token_hint", required = false) String idTokenHint,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        String frontend = getFrontendUrl();
        if (!sso.isEnabled()) {
            return redirect(frontend + "/login");
        }
        String postLogoutUri = (redirect != null && !redirect.isBlank()) ? redirect : frontend + "/login";

        // Resolver id_token_hint internamente. O frontend nao recebe mais o idToken (era grande
        // demais e estourava o HAProxy no callback). Usa o Authorization Bearer <accessToken local>
        // pra descobrir o userId e buscar o idToken guardado no ID_TOKEN_STORE no momento do login.
        String resolvedIdToken = idTokenHint;
        if ((resolvedIdToken == null || resolvedIdToken.isBlank())
                && authHeader != null && authHeader.regionMatches(true, 0, "Bearer ", 0, 7)) {
            String accessTokenLocal = authHeader.substring(7).trim();
            try {
                byte[] decoded = Base64.getDecoder().decode(accessTokenLocal);
                @SuppressWarnings("unchecked")
                Map<String, Object> payload = objectMapper.readValue(decoded, Map.class);
                Object uid = payload.get("userId");
                if (uid != null) {
                    String stored = ID_TOKEN_STORE.remove(String.valueOf(uid));
                    if (stored != null && !stored.isBlank()) {
                        resolvedIdToken = stored;
                    }
                }
            } catch (Exception ignore) {
                // accessToken malformado ou nao-base64 — segue sem id_token_hint
            }
        }

        // Manda nome novo (post_logout_redirect_uri, Keycloak 19+) e nome antigo (redirect_uri,
        // Keycloak <19, que e o caso do TJGO). Tambem inclui client_id que algumas versoes exigem.
        StringBuilder logoutUrl = new StringBuilder(sso.getLogoutUrl())
                .append("?post_logout_redirect_uri=").append(enc(postLogoutUri))
                .append("&redirect_uri=").append(enc(postLogoutUri))
                .append("&client_id=").append(enc(sso.getClientId()));
        if (resolvedIdToken != null && !resolvedIdToken.isBlank()) {
            logoutUrl.append("&id_token_hint=").append(enc(resolvedIdToken));
        }
        return redirect(logoutUrl.toString());
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
        // Prioridade 1: OPENSHIFT_FRONTEND_URL (nome novo, padronizado nos secrets api2-default
        // e api1-default do TJGO). Funciona pra qualquer ambiente sem precisar inferir.
        String openshiftUrl = nullToEmpty(env.getProperty("OPENSHIFT_FRONTEND_URL")).trim();
        if (!openshiftUrl.isEmpty()
                && openshiftUrl.matches("(?i)^https?://.*")
                && !openshiftUrl.contains("${")) {
            return openshiftUrl;
        }

        // Prioridade 2: FRONTEND_URL (legado, usado em dev local).
        String frontendUrlRaw = nullToEmpty(env.getProperty("FRONTEND_URL")).trim();
        boolean valid = !frontendUrlRaw.isEmpty()
                && frontendUrlRaw.matches("(?i)^https?://.*")
                && !frontendUrlRaw.contains("${");
        if (valid) {
            return frontendUrlRaw;
        }

        // Prioridade 3: deduzir do ambiente, com fallback FRONTEND_URL_STAGING/_PRODUCTION (legado).
        String ambiente = nullToEmpty(env.getProperty("OPENSHIFT_BACKEND_AMBIENTE")).toLowerCase().trim();
        if (ambiente.equals("stag") || ambiente.equals("staging")) {
            return env.getProperty("FRONTEND_URL_STAGING", "https://painel-sgjt-stag-frontend2.apps.ocp-prd.tjgo.jus.br");
        }
        if (ambiente.equals("prd") || ambiente.equals("production")) {
            return env.getProperty("FRONTEND_URL_PRODUCTION", "https://kaizen.tjgo.jus.br");
        }
        if ("production".equals(env.getProperty("NODE_ENV"))) {
            String redirectUri = firstNonNull(env.getProperty("OPENSHIFT_SSO_KEYCLOAK_REDIRECT_URI"),
                    env.getProperty("OPENSHIFT_SSO_KEYCLOACK_REDIRECT_URI"), "");
            String apiUrl = env.getProperty("OPENSHIFT_API_URL", "");
            if (redirectUri.contains("stag") || apiUrl.contains("stag")) {
                return env.getProperty("FRONTEND_URL_STAGING", "https://painel-sgjt-stag-frontend2.apps.ocp-prd.tjgo.jus.br");
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
