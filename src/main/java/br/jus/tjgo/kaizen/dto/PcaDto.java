package br.jus.tjgo.kaizen.dto;

public record PcaDto(
        Long id,
        String code,
        String year,
        String description,
        String justification,
        String process,
        br.jus.tjgo.kaizen.domain.Pca.FinancialResourceTypeEnum financialResourceType,
        br.jus.tjgo.kaizen.domain.Pca.PcaContractTypeEnum contractType,
        br.jus.tjgo.kaizen.domain.Pca.PcaStepEnum step,
        String objectName,
        int status,
        int contractPlansCount
) {}
