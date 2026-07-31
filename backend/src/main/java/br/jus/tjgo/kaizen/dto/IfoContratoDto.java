package br.jus.tjgo.kaizen.dto;

public record IfoContratoDto(
        Long contractId,
        Boolean interesseRenovacao,
        String motivoReclassificacao,
        Long valorContratoCents
) {}
