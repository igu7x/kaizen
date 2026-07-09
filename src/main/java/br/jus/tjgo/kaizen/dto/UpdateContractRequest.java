package br.jus.tjgo.kaizen.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import java.math.BigDecimal;

@JsonIgnoreProperties(ignoreUnknown = true)
public record UpdateContractRequest(
        String supplier,
        String contractModel,
        String process,
        String expenseNature,
        String startDate,
        String endDate,
        String effectiveDate,
        String limitDate,
        br.jus.tjgo.kaizen.domain.Contract.ContractTypeEnum contractType,
        String situation,
        Integer additiveTermType,
        String objectName,
        String description,
        String noticeNumber,
        String directory,
        String unidade,
        Long cadastroAreaId,
        Long cadastroUnidadeId,
        Long totalValueCents,
        Long monthlyValueCents,
        List<Long> pcaIds,
        BigDecimal yearDurationStandard
) {}
