package br.jus.tjgo.kaizen.dto;

import java.math.BigDecimal;

public record ContractDto(
        Long id,
        Long contractPlanId,
        String startDate,
        String endDate,
        String process,
        String expenseNature,
        String contractModel,
        String supplier,
        br.jus.tjgo.kaizen.domain.Contract.ContractTypeEnum contractType,
        Integer additiveTermType,
        String objectName,
        String noticeNumber,
        String directory,
        String unidade,
        Long cadastroAreaId,
        Long cadastroUnidadeId,
        Long totalValueCents,
        Long monthlyValueCents,
        String status,
        String effectiveDate,
        String limitDate,
        Integer effectiveAdditiveTerm,
        String description,
        Long yearValue,
        String situation,
        BigDecimal yearDurationStandard
) {}
