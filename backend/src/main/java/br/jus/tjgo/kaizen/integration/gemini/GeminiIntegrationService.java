package br.jus.tjgo.kaizen.integration.gemini;

import br.jus.tjgo.kaizen.integration.gemini.dto.AnexoDTO;
import br.jus.tjgo.kaizen.integration.gemini.dto.GeminiResponseDTO;
import br.jus.tjgo.kaizen.integration.gemini.dto.OpenAIRequestDTO;
import br.jus.tjgo.kaizen.integration.gemini.dto.OpenAIResponseDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
public class GeminiIntegrationService {

    private final RestClient restClient;
    
    @Value("${gemini.api.default-token:}")
    private String defaultToken;
    
    @Value("${gemini.api.default-model:gemini-2.5-flash}")
    private String defaultModel;
    
    @Value("${gemini.api.url:https://generativelanguage.googleapis.com/v1beta/openai/chat/completions}")
    private String apiUrl;

    public GeminiIntegrationService(RestClient.Builder restClientBuilder) {
        this.restClient = restClientBuilder.build();
    }

    public GeminiResponseDTO processarPrompt(String token, String modelo, String prompt, List<AnexoDTO> anexos) {
        String finalToken = (token == null || token.isBlank()) ? defaultToken : token;
        String finalModel = (modelo == null || modelo.isBlank()) ? defaultModel : modelo;

        if (finalToken == null || finalToken.isBlank()) {
            throw new IllegalArgumentException("API Token do Gemini não configurado.");
        }

        List<OpenAIRequestDTO.ContentPart> contentParts = new ArrayList<>();
        contentParts.add(OpenAIRequestDTO.ContentPart.text(prompt));

        if (anexos != null && !anexos.isEmpty()) {
            for (AnexoDTO anexo : anexos) {
                String dataUrl = "data:" + anexo.mimeType() + ";base64," + anexo.base64Data();
                contentParts.add(OpenAIRequestDTO.ContentPart.image(dataUrl));
            }
        }

        OpenAIRequestDTO.Message message = new OpenAIRequestDTO.Message("user", contentParts);
        OpenAIRequestDTO requestDTO = new OpenAIRequestDTO(finalModel, List.of(message), 0.2);

        try {
            log.info("Enviando requisicao para o Gemini na URL: {}", apiUrl);
            
            OpenAIResponseDTO response = restClient.post()
                    .uri(apiUrl)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + finalToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestDTO)
                    .retrieve()
                    .body(OpenAIResponseDTO.class);

            if (response != null && response.error() != null) {
                log.error("Erro retornado pela API Gemini: {} - {}", response.error().code(), response.error().message());
                throw new RuntimeException("Erro na API Gemini: " + response.error().message());
            }

            if (response != null && response.choices() != null && !response.choices().isEmpty()) {
                String responseText = response.choices().get(0).message().content();
                return new GeminiResponseDTO(responseText);
            }

            throw new RuntimeException("Resposta vazia ou invalida da API.");

        } catch (Exception e) {
            log.error("Falha ao comunicar com API Gemini", e);
            throw new RuntimeException("Falha ao comunicar com API Gemini: " + e.getMessage(), e);
        }
    }
}
