package br.jus.tjgo.kaizen.dto;

public record CreateContractPlanRequest(
        String pcaCode,
        String pcaYear,
        String objectName,
        Long cadastrosAreasId,
        Long cadastrosUnidadesId,
        String description,
        String justification,
        Long estimatedValueCents,
        Integer priorityLevel,
        String estimatedDate,
        String loaReference,
        String proadNumber
) {}
