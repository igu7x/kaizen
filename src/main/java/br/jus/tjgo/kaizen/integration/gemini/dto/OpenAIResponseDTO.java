package br.jus.tjgo.kaizen.integration.gemini.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record OpenAIResponseDTO(
    List<Choice> choices,
    Error error
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Choice(
        Message message
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Message(
        String role,
        String content
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Error(
        String message,
        String type,
        String code
    ) {}
}
