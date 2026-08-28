package br.jus.tjgo.kaizen.dto;

public record UpdateContractPlanRequest(
        String objectName,
        Long cadastrosAreasId,
        Long cadastrosUnidadesId,
        String description,
        String justification,
        Long estimatedValueCents,
        Integer priorityLevel,
        String estimatedDate,
        String loaReference,
        String situation
) {}
