package br.jus.tjgo.kaizen.config;

import lombok.Getter;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Configuração SSO Keycloak — porte fiel de config/sso.ts. Lê as mesmas env vars OPENSHIFT_SSO_*.
 * Em dev (vars vazias) -> enabled=false. As URLs são construídas igual ao Node (inclusive os
 * valores "vazios" como "/realms//protocol/..." quando realm/keycloakUrl ausentes), p/ paridade.
 */
@Getter
@Component
public class SsoConfig {

    private final boolean enabled;
    private final String realm;
    private final String clientId;
    private final String clientSecret;
    private final String redirectUri;
    private final String keycloakUrl;
    private final String authorizationUrl;
    private final String tokenUrl;
    private final String userInfoUrl;
    private final String logoutUrl;

    public SsoConfig(Environment env) {
        this.realm = firstNonEmpty(env, "OPENSHIFT_SSO_KEYCLOAK_REALM", "OPENSHIFT_SSO_KEYCLOACK_REALM");
        this.clientId = get(env, "OPENSHIFT_SSO_CLIENT_ID");
        this.clientSecret = get(env, "OPENSHIFT_SSO_SECRET");
        this.redirectUri = firstNonEmpty(env, "OPENSHIFT_SSO_KEYCLOAK_REDIRECT_URI", "OPENSHIFT_SSO_KEYCLOACK_REDIRECT_URI");
        String rawKeycloakUrl = firstNonEmpty(env, "OPENSHIFT_SSO_KEYCLOAK_URL", "OPENSHIFT_SSO_KEYCLOACK_URL");

        String normalizedKeycloakUrl = (!rawKeycloakUrl.isEmpty() && !rawKeycloakUrl.matches("(?i)^https?://.*"))
                ? "https://" + rawKeycloakUrl
                : rawKeycloakUrl;

        this.enabled = !realm.isEmpty() && !clientId.isEmpty() && !clientSecret.isEmpty()
                && !redirectUri.isEmpty() && !normalizedKeycloakUrl.isEmpty();

        String baseUrl = normalizedKeycloakUrl.endsWith("/")
                ? normalizedKeycloakUrl.substring(0, normalizedKeycloakUrl.length() - 1)
                : normalizedKeycloakUrl;
        String realmPath = baseUrl + "/realms/" + realm;

        this.keycloakUrl = baseUrl;
        this.authorizationUrl = realmPath + "/protocol/openid-connect/auth";
        this.tokenUrl = realmPath + "/protocol/openid-connect/token";
        this.userInfoUrl = realmPath + "/protocol/openid-connect/userinfo";
        this.logoutUrl = realmPath + "/protocol/openid-connect/logout";
    }

    private static String get(Environment env, String key) {
        String v = env.getProperty(key);
        return v == null ? "" : v;
    }

    private static String firstNonEmpty(Environment env, String key1, String key2) {
        String v = get(env, key1);
        if (!v.isEmpty()) {
            return v;
        }
        return get(env, key2);
    }
}
