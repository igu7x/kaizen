package br.jus.tjgo.kaizen.dto;

public record UpdateContractPlanRequest(
        String objectName,
        String areaAcronym,
        String description,
        String justification,
        Long estimatedValueCents,
        Integer priorityLevel,
        String estimatedDate,
        String loaReference
) {}
