package br.jus.tjgo.kaizen.dto;

public record ContractPlanDto(
        Long id,
        Long pcaId,
        String pcaCode,
        String pcaYear,
        String objectName,
        String areaAcronym,
        String description,
        String justification,
        Long estimatedValueCents,
        Integer priorityLevel,
        Integer status,
        Integer step,
        String estimatedDate,
        String loaReference,
        String title,
        int contractsCount
) {}
