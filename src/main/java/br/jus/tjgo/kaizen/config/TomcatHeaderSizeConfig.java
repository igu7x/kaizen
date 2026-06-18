package br.jus.tjgo.kaizen.config;

import org.apache.coyote.http11.AbstractHttp11Protocol;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Aumenta o limite de tamanho dos HTTP headers (request e response) do Tomcat.
 *
 * <p>Justificativa: o redirect do callback SSO embute id_token + refresh_token do Keycloak
 * (JWTs grandes, ~3-5KB cada) + payload do user JSON na query string do Location header.
 * URL-encoded passa do limite padrao do Tomcat (8KB), estourando com
 * {@code HeadersTooLargeException} na hora de escrever a resposta.
 *
 * <p>Tentamos primeiro via application.yml com {@code server.tomcat.max-http-response-header-size},
 * mas em Spring Boot 3.3.5 essa propriedade nao chegou a ser aplicada pelo Tomcat
 * em runtime (provavelmente um issue de mapeamento). Esta config aplica direto no
 * {@code AbstractHttp11Protocol#setMaxHttpHeaderSize}, que vale pra request E response.
 */
@Configuration
public class TomcatHeaderSizeConfig {

    private static final int MAX_HEADER_BYTES = 64 * 1024; // 64KB

    @Bean
    public WebServerFactoryCustomizer<TomcatServletWebServerFactory> tomcatHeaderSizeCustomizer() {
        return factory -> factory.addConnectorCustomizers(connector -> {
            if (connector.getProtocolHandler() instanceof AbstractHttp11Protocol<?> protocol) {
                protocol.setMaxHttpRequestHeaderSize(MAX_HEADER_BYTES);
                protocol.setMaxHttpResponseHeaderSize(MAX_HEADER_BYTES);
            }
        });
    }
}
