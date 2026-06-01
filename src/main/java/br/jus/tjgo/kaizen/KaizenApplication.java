package br.jus.tjgo.kaizen;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

// Exclui o UserDetailsServiceAutoConfiguration: auth e via JwtAuthenticationFilter (permissivo),
// nao usamos o inMemoryUserDetailsManager — remove o "generated security password" do log.
@SpringBootApplication(exclude = {UserDetailsServiceAutoConfiguration.class})
public class KaizenApplication {

    public static void main(String[] args) {
        SpringApplication.run(KaizenApplication.class, args);
    }
}
