package br.jus.tjgo.kaizen.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
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
