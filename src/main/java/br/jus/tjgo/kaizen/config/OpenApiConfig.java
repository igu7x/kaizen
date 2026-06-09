package br.jus.tjgo.kaizen.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI / Swagger UI (Sprint 11 hardening).
 * Doc disponível em /swagger-ui.html e /v3/api-docs — gerada automaticamente a partir dos
 * @GetMapping/@PostMapping etc., enriquecida pelos @Tag/@Operation nos controllers principais.
 * Facilita revisão futura e onboarding pós-cutover.
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI kaizenOpenAPI() {
        return new OpenAPI().info(new Info()
                .title("Kaizen API (Java)")
                .version("1.0")
                .description("Backend Java/Spring Boot do Kaizen (TJGO), porte fiel do backend Node/Express. "
                        + "Autenticação: Bearer JWT Keycloak (busca por email) ou base64 {\"userId\":N} (login local). "
                        + "Divergências conhecidas catalogadas em docs/KNOWN_DIVERGENCES.md.")
                .license(new License().name("TJGO — uso interno")));
    }
}
