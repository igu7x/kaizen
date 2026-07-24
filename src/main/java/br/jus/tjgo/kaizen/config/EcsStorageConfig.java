package br.jus.tjgo.kaizen.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.http.apache.ApacheHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

import java.net.URI;
import java.time.Duration;

/**
 * Configura o bean {@link S3Client} para comunicação com o OpenShift ECS (storage S3-compatible).
 *
 * <ul>
 *   <li>{@code endpointOverride} — aponta para o host customizado do ECS (não AWS).</li>
 *   <li>{@code pathStyleAccessEnabled} — necessário para buckets em ECS/MinIO.</li>
 *   <li>Timeouts agressivos via {@link ApacheHttpClient} — evita travamento de threads
 *       em instabilidades de rede do ECS.</li>
 * </ul>
 */
@Slf4j
@Configuration
@EnableConfigurationProperties(EcsStorageProperties.class)
public class EcsStorageConfig {

    @Bean
    public S3Client s3Client(EcsStorageProperties props) {
        log.info("[ECS] Configurando S3Client → host={}, bucket={}, ambiente={}",
                props.host(), props.bucket(), props.ambiente());

        return S3Client.builder()
                .endpointOverride(URI.create(props.host()))
                .region(Region.US_EAST_1) // obrigatório pelo SDK mas ignorado pelo ECS
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(props.accessKey(), props.secretKey())
                ))
                .serviceConfiguration(cfg -> cfg.pathStyleAccessEnabled(true))
                .httpClient(ApacheHttpClient.builder()
                        .connectionTimeout(Duration.ofSeconds(5))
                        .socketTimeout(Duration.ofSeconds(15))
                        .build())
                .overrideConfiguration(oc -> oc
                        .apiCallTimeout(Duration.ofSeconds(15))
                        .apiCallAttemptTimeout(Duration.ofSeconds(10)))
                .build();
    }
}
