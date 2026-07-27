package br.jus.tjgo.kaizen.dto;

public record DelegacaoEdicaoDto(
        Long id,
        Long cicloId,
        String estado,
        Long delegadoId,
        String delegadoNome,
        Long deleganteId,
        String deleganteNome,
        Long areaId,
        String areaNome,
        String tipo,
        String createdAt
) {}
