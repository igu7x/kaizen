package br.jus.tjgo.kaizen.config;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Serve arquivos estaticos de uploads (paridade com server.ts: app.use('/uploads', ...)).
 * Cria as pastas uploads/ e uploads/gestores/ no boot, como o Node faz.
 */
@Slf4j
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final Path uploadsPath = Paths.get("uploads").toAbsolutePath().normalize();

    @PostConstruct
    public void ensureUploadDirs() {
        try {
            Files.createDirectories(uploadsPath);
            Files.createDirectories(uploadsPath.resolve("gestores"));
            log.info("Servindo uploads de: {}", uploadsPath);
        } catch (IOException e) {
            log.warn("Nao foi possivel criar pastas de upload: {}", e.getMessage());
        }
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(uploadsPath.toUri().toString());
    }
}
