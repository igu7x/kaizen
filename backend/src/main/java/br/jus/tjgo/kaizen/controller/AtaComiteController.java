package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.exception.ApiException;
import br.jus.tjgo.kaizen.service.AtaComiteService;
import br.jus.tjgo.kaizen.service.StorageService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.InputStream;
import java.util.List;
import java.util.Map;

/**
 * Atas dos comitês (CGTIC/CGOVTIC) do Orçamento de TIC — juntada/reflexo do ato externo (RN-GERAL-04).
 *
 * <p>Endpoints:
 * <ul>
 *   <li>{@code GET  /api/orcamento/atas}           — lista atas (filtro opcional por cicloId)</li>
 *   <li>{@code POST /api/orcamento/atas}           — registra ata com upload opcional (multipart)</li>
 *   <li>{@code GET  /api/orcamento/atas/{id}/download} — download via streaming (autenticado)</li>
 *   <li>{@code DELETE /api/orcamento/atas/{id}}    — exclui ata (e arquivo S3 se existir)</li>
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/api/orcamento/atas")
@RequiredArgsConstructor
public class AtaComiteController {

    private final AtaComiteService service;
    private final StorageService storageService;
    private final ObjectMapper objectMapper;

    @GetMapping
    public List<Map<String, Object>> listar(@RequestParam(value = "cicloId", required = false) Long cicloId) {
        return service.listar(cicloId);
    }

    /**
     * Registra uma ata com upload opcional de arquivo.
     *
     * <p>O body é {@code multipart/form-data} com duas parts:
     * <ul>
     *   <li>{@code dados} — JSON com metadados (cicloId, comite, numero, dataAta, decisao, anexoUrl)</li>
     *   <li>{@code arquivo} — arquivo PDF/DOC/DOCX (opcional, máximo 15 MB)</li>
     * </ul>
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> registrar(
            @RequestPart("dados") String dadosJson,
            @RequestPart(value = "arquivo", required = false) MultipartFile arquivo,
            @RequestHeader(value = "x-user-id", required = false) Long userId) {
        try {
            JsonNode dados = objectMapper.readTree(dadosJson);

            Long cicloId = dados.has("cicloId") && !dados.get("cicloId").isNull()
                    ? dados.get("cicloId").asLong() : null;

            String originalFilename = null;
            String contentType = null;
            long fileSize = 0;

            if (arquivo != null && !arquivo.isEmpty()) {
                originalFilename = arquivo.getOriginalFilename();
                contentType = arquivo.getContentType();
                fileSize = arquivo.getSize();
            }

            try (InputStream fileStream = (arquivo != null && !arquivo.isEmpty()) ? arquivo.getInputStream() : null) {
                Map<String, Object> ata = service.registrar(
                        cicloId,
                        jsonStr(dados, "comite"),
                        jsonStr(dados, "numero"),
                        jsonStr(dados, "dataAta"),
                        jsonStr(dados, "decisao"),
                        jsonStr(dados, "anexoUrl"),
                        userId,
                        originalFilename, contentType, fileSize, fileStream);

                return ResponseEntity.status(HttpStatus.CREATED).body(ata);
            }
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            log.error("[AtaComite] Erro ao registrar ata", e);
            throw new ApiException(500, "Erro interno ao registrar ata: " + e.getMessage());
        }
    }

    /**
     * Download de arquivo da ata via streaming — autenticação obrigatória.
     *
     * <p>O {@code fileKey} nunca é exposto ao client; o acesso é por {@code ata.id}.
     * O stream é escrito direto no {@code OutputStream} sem carregar o arquivo inteiro na memória.
     */
    @GetMapping("/{id:\\d+}/download")
    public ResponseEntity<StreamingResponseBody> download(@PathVariable long id) {
        // Exigir autenticação
        AuthContext.currentUserId();

        Map<String, Object> ata = service.buscarPorId(id);
        String fileKey = (String) ata.get("file_key");
        if (fileKey == null || fileKey.isBlank()) {
            throw new ApiException(404, "Esta ata não possui arquivo anexado.");
        }

        String originalFilename = (String) ata.get("original_filename");
        String contentType = (String) ata.get("content_type");
        Number fileSizeNum = (Number) ata.get("file_size");

        StreamingResponseBody body = outputStream -> {
            try (InputStream s3Stream = storageService.download(fileKey)) {
                s3Stream.transferTo(outputStream);
            }
        };

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                contentType != null ? contentType : "application/octet-stream"));
        headers.set(HttpHeaders.CONTENT_DISPOSITION,
                "inline; filename=\"" + (originalFilename != null ? originalFilename : "ata") + "\"");
        if (fileSizeNum != null) {
            headers.setContentLength(fileSizeNum.longValue());
        }

        return ResponseEntity.ok().headers(headers).body(body);
    }

    @DeleteMapping("/{id:\\d+}")
    public ResponseEntity<Void> excluir(@PathVariable long id) {
        service.excluir(id);
        return ResponseEntity.noContent().build();
    }

    private static String jsonStr(JsonNode node, String field) {
        return node.has(field) && !node.get(field).isNull() ? node.get(field).asText() : null;
    }
}
