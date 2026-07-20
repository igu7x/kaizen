package br.jus.tjgo.kaizen.dto;

import java.time.LocalDate;

public record AtualizarIfoRequest(
        String bloco,
        String natureza,
        String objeto,
        String areaDemandante,
        Long unidadeId,
        Long areaId,
        Double valorEstimado,
        Boolean interesseRenovacao,
        
        String description,
        String justification,
        String process,
        String financialResourceType,
        String contractType,
        Long formalizedValueCents,
        Long idCadastrosAreas,
        String priority,
        LocalDate estimatedDate
) {}
