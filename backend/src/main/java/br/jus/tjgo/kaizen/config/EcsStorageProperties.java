package br.jus.tjgo.kaizen.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Mapeamento type-safe das variáveis de ambiente do OpenShift ECS (storage S3-compatible).
 * Defaults apontam para MinIO local (vide README).
 */
@ConfigurationProperties(prefix = "kaizen.ecs")
public record EcsStorageProperties(
        String host,
        String bucket,
        String accessKey,
        String secretKey,
        String ambiente
) {}
