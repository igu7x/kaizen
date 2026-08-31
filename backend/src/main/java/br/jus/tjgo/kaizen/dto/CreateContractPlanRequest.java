package br.jus.tjgo.kaizen.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record CreateContractPlanRequest(

        Long pcaId,
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
