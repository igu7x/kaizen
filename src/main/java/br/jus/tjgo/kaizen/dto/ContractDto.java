package br.jus.tjgo.kaizen.dto;

public record ContractDto(
        Long id,
        Long contractPlanId,
        String startDate,
        String endDate,
        String process,
        String contractModel,
        Long supplierId,
        br.jus.tjgo.kaizen.domain.Contract.ContractTypeEnum contractType,
        Integer additiveTermType,
        String objectName,
        String noticeNumber,
        String directory,
        String type,
        String unidade,
        Long totalValueCents,
        Long monthlyValueCents,
        String status
) {}
