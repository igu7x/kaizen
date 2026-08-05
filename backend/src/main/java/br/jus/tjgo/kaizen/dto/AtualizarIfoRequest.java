package br.jus.tjgo.kaizen.dto;

import java.time.LocalDate;

public record AtualizarIfoRequest(
        String bloco,
        String natureza,
        String objeto,
        Long cadastrosUnidadesId,
        Long cadastrosAreasId,
        Double valorEstimado,
        Boolean interesseRenovacao,
        
        String strategicObjective,
        Boolean isSustainable,
        Boolean isSharedAcquisition,
        String quantity,
        
        String description,
        String justification,
        String process,
        String financialResourceType,
        String contractType,
        String expenseNature,
        Long formalizedValueCents,
        String priority,
        LocalDate estimatedDate
) {}
