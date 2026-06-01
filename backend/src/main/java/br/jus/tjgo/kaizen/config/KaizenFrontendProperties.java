package br.jus.tjgo.kaizen.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "kaizen.frontend")
public class KaizenFrontendProperties {
    private String url;
}
