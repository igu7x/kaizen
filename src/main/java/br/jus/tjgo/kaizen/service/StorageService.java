package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.config.EcsStorageProperties;
import br.jus.tjgo.kaizen.exception.ApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.InputStream;
import java.util.Set;
import java.util.UUID;

/**
 * Operações de storage S3-compatible (OpenShift ECS) para arquivos de ATAs dos comitês.
 *
 * <p>Regras de segurança implementadas:
 * <ul>
 *   <li>Isolamento por ambiente via prefixo {@code {ambiente}/} na key.</li>
 *   <li>UUID na key para evitar colisão e IDOR.</li>
 *   <li>Streaming — nunca carrega o arquivo inteiro na memória da JVM.</li>
 *   <li>Validação de extensão e tamanho antes do upload.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StorageService {

    private final S3Client s3;
    private final EcsStorageProperties props;

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(".pdf", ".doc", ".docx");
    private static final long MAX_FILE_SIZE = 15L * 1024 * 1024; // 15 MB

    /**
     * Valida extensão e tamanho do arquivo antes do upload.
     *
     * @throws ApiException 400 se extensão não permitida ou tamanho excedido
     */
    public void validarArquivo(String filename, long size) {
        if (filename == null || filename.isBlank()) {
            throw new ApiException(400, "Nome do arquivo é obrigatório.");
        }

        String ext = extrairExtensao(filename).toLowerCase();
        if (!ALLOWED_EXTENSIONS.contains(ext)) {
            throw new ApiException(400,
                    "Extensão '" + ext + "' não permitida. Aceitas: " + ALLOWED_EXTENSIONS);
        }

        if (size > MAX_FILE_SIZE) {
            throw new ApiException(400,
                    "Arquivo excede o limite de 15 MB (tamanho: " + (size / (1024 * 1024)) + " MB).");
        }
    }

    /**
     * Faz upload via streaming. Retorna a {@code fileKey} gerada.
     *
     * <p>Padrão de key: {@code {ambiente}/atas-comite/{cicloId}/{comite}/{uuid}_{filename}}.
     */
    public String upload(Long cicloId, String comite, String originalFilename,
                         String contentType, long fileSize, InputStream stream) {
        String fileKey = gerarFileKey(cicloId, comite, originalFilename);

        PutObjectRequest putReq = PutObjectRequest.builder()
                .bucket(props.bucket())
                .key(fileKey)
                .contentType(contentType != null ? contentType : "application/octet-stream")
                .contentLength(fileSize)
                .build();

        s3.putObject(putReq, RequestBody.fromInputStream(stream, fileSize));

        log.info("[Storage] Upload OK → bucket={}, key={}, size={}", props.bucket(), fileKey, fileSize);
        return fileKey;
    }

    /**
     * Faz download via streaming. O caller é responsável por fechar o stream retornado.
     *
     * @return stream do objeto S3 (nunca carregado inteiro em memória)
     */
    public InputStream download(String fileKey) {
        GetObjectRequest getReq = GetObjectRequest.builder()
                .bucket(props.bucket())
                .key(fileKey)
                .build();

        return s3.getObject(getReq);
    }

    /**
     * Exclui objeto do S3. Operação idempotente (não falha se o objeto não existir).
     */
    public void delete(String fileKey) {
        DeleteObjectRequest delReq = DeleteObjectRequest.builder()
                .bucket(props.bucket())
                .key(fileKey)
                .build();

        s3.deleteObject(delReq);
        log.info("[Storage] Delete OK → bucket={}, key={}", props.bucket(), fileKey);
    }

    /**
     * Faz upload de evidência de entrega de projeto via streaming. Retorna a {@code fileKey} gerada.
     *
     * <p>Padrão de key: {@code {ambiente}/projetos/{projetoId}/entregas/{entregaId}/{uuid}_{filename}}.
     */
    public String uploadEvidenciaEntrega(Long projetoId, Long entregaId, String originalFilename,
                         String contentType, long fileSize, InputStream stream) {
        String uuid = UUID.randomUUID().toString();
        String safeFilename = originalFilename.replaceAll("[^a-zA-Z0-9._\\-]", "_");
        String fileKey = String.format("%s/projetos/%d/entregas/%d/%s_%s",
                props.ambiente(), projetoId, entregaId, uuid, safeFilename);

        PutObjectRequest putReq = PutObjectRequest.builder()
                .bucket(props.bucket())
                .key(fileKey)
                .contentType(contentType != null ? contentType : "application/octet-stream")
                .contentLength(fileSize)
                .build();

        s3.putObject(putReq, RequestBody.fromInputStream(stream, fileSize));

        log.info("[Storage] Upload Evidencia OK → bucket={}, key={}, size={}", props.bucket(), fileKey, fileSize);
        return fileKey;
    }

    /**
     * Faz upload do arquivo do PCA via streaming. Retorna a {@code fileKey} gerada.
     *
     * <p>Padrão de key: {@code {ambiente}/pca/{cicloId}/{uuid}_{filename}}.
     */
    public String uploadPca(Long cicloId, String originalFilename,
                         String contentType, long fileSize, InputStream stream) {
        String uuid = UUID.randomUUID().toString();
        String safeFilename = originalFilename.replaceAll("[^a-zA-Z0-9._\\-]", "_");
        String fileKey = String.format("%s/pca/%d/%s_%s",
                props.ambiente(), cicloId, uuid, safeFilename);

        PutObjectRequest putReq = PutObjectRequest.builder()
                .bucket(props.bucket())
                .key(fileKey)
                .contentType(contentType != null ? contentType : "application/octet-stream")
                .contentLength(fileSize)
                .build();

        s3.putObject(putReq, RequestBody.fromInputStream(stream, fileSize));

        log.info("[Storage] Upload PCA OK → bucket={}, key={}, size={}", props.bucket(), fileKey, fileSize);
        return fileKey;
    }

    /**
     * Faz upload de documento do Planejamento da Contratação via streaming. Retorna a {@code fileKey} gerada.
     *
     * <p>Padrão de key: {@code {ambiente}/contract-plans/{planId}/{uuid}_{filename}}.
     */
    public String uploadContractPlan(Long planId, String documentType, String originalFilename,
                                     String contentType, long fileSize, InputStream stream) {
        String uuid = UUID.randomUUID().toString();
        String safeFilename = originalFilename.replaceAll("[^a-zA-Z0-9._\\-]", "_");
        String fileKey = String.format("%s/contract-plans/%d/%s_%s",
                props.ambiente(), planId, uuid, safeFilename);

        PutObjectRequest putReq = PutObjectRequest.builder()
                .bucket(props.bucket())
                .key(fileKey)
                .contentType(contentType != null ? contentType : "application/octet-stream")
                .contentLength(fileSize)
                .build();

        s3.putObject(putReq, RequestBody.fromInputStream(stream, fileSize));

        log.info("[Storage] Upload ContractPlan OK → bucket={}, key={}, size={}", props.bucket(), fileKey, fileSize);
        return fileKey;
    }

    /**
     * Gera fileKey com isolamento de ambiente e UUID anti-colisão/IDOR.
     *
     * <p>Formato: {@code {ambiente}/atas-comite/{cicloId}/{comite}/{uuid}_{filename}}
     */
    private String gerarFileKey(Long cicloId, String comite, String originalFilename) {
        String uuid = UUID.randomUUID().toString();
        String safeFilename = originalFilename.replaceAll("[^a-zA-Z0-9._\\-]", "_");
        return String.format("%s/atas-comite/%d/%s/%s_%s",
                props.ambiente(), cicloId, comite, uuid, safeFilename);
    }

    private static String extrairExtensao(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot) : "";
    }
}
