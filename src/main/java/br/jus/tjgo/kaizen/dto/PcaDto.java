package br.jus.tjgo.kaizen.dto;

public record PcaDto(
        Long id,
        String code,
        String year,
        String description,
        String objectName,
        int status,
        int contractPlansCount
) {}
