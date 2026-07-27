package br.jus.tjgo.kaizen.dto;

import jakarta.validation.constraints.NotNull;

public record DelegacaoEdicaoReq(
        @NotNull String estado,
        @NotNull Long delegadoId,
        @NotNull String tipo
) {}
