package br.jus.tjgo.kaizen.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "kaizen.sso")
public class KaizenSsoProperties {
    private boolean enabled;
    private String realm;
    private String clientId;
    private String clientSecret;
    private String keycloakUrl;
    private String redirectUri;
}
