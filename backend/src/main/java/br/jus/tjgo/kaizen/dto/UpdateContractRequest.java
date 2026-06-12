package br.jus.tjgo.kaizen.dto;

import java.util.List;

public record UpdateContractRequest(
        String supplier,
        String contractModel,
        String process,
        String startDate,
        String endDate,
        br.jus.tjgo.kaizen.domain.Contract.ContractTypeEnum contractType,
        Integer additiveTermType,
        String objectName,
        String description,
        String noticeNumber,
        String directory,
        Long cadastroAreaId,
        Long cadastroUnidadeId,
        Long totalValueCents,
        Long monthlyValueCents,
        List<Long> pcaIds
) {}
