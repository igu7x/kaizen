package br.jus.tjgo.kaizen.integration.gemini.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record OpenAIRequestDTO(
    String model,
    List<Message> messages,
    Double temperature
) {
    public record Message(
        String role,
        List<ContentPart> content
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ContentPart(
        String type,
        String text,
        @JsonProperty("image_url") ImageUrl imageUrl
    ) {
        public static ContentPart text(String text) {
            return new ContentPart("text", text, null);
        }

        public static ContentPart image(String dataUrl) {
            return new ContentPart("image_url", null, new ImageUrl(dataUrl));
        }
    }

    public record ImageUrl(String url) {}
}
