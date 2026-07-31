package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.domain.Contract;
import br.jus.tjgo.kaizen.dto.ContractDto;
import br.jus.tjgo.kaizen.dto.CreateContractRequest;
import br.jus.tjgo.kaizen.dto.UpdateContractRequest;
import br.jus.tjgo.kaizen.service.ContractService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/contracts")
@RequiredArgsConstructor
public class ContractsController {

    private final ContractService contractService;

    private ContractDto toDto(Contract contract) {
        return new ContractDto(
                contract.getId(),
                contract.getContractPlan() != null ? contract.getContractPlan().getId() : null,
                contract.getStartDate() != null ? contract.getStartDate().toString() : null,
                contract.getEndDate() != null ? contract.getEndDate().toString() : null,
                contract.getProcess(),
                contract.getExpenseNature(),
                contract.getContractModel(),
                contract.getSupplier(),
                contract.getContractType(),
                contract.getAdditiveTermType(),
                contract.getObjectName(),
                contract.getNoticeNumber(),
                contract.getCadastroAreaId(),
                contract.getCadastroUnidadeId(),
                contract.getAreaSigla(),
                contract.getUnidadeSigla(),
                contract.getTotalValueCents(),
                contract.getMonthlyValueCents(),
                "Ativo", // simplificação
                contract.getEffectiveDate() != null ? contract.getEffectiveDate().toString() : null,
                contract.getLimitDate() != null ? contract.getLimitDate().toString() : null,
                contract.getEffectiveAdditiveTerm(),
                contract.getDescription(),
                contract.getYearValue(),
                contract.getSituation(),
                contract.getYearDurationStandard()
        );
    }

    @GetMapping
    public List<ContractDto> list(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String contractType,
            @RequestParam(required = false) String searchQuery,
            @RequestParam(required = false) Boolean minhasDemandas,
            @RequestHeader(value = "x-user-id", required = false) Long userId) {
        return contractService.findAll(startDate, endDate, contractType, searchQuery, minhasDemandas, userId)
                .stream().map(this::toDto).toList();
    }

    @GetMapping("/{id}")
    public ContractDto get(@PathVariable Long id) {
        return toDto(contractService.findById(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ContractDto create(@RequestBody CreateContractRequest req, @RequestHeader("x-user-id") Long userId) {
        return toDto(contractService.create(req, userId));
    }

    @PutMapping("/{id}")
    public ContractDto update(@PathVariable Long id, @RequestBody UpdateContractRequest req, @RequestHeader("x-user-id") Long userId) {
        return toDto(contractService.update(id, req, userId));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @RequestHeader("x-user-id") Long userId) {
        contractService.softDelete(id, userId);
    }

    @GetMapping("/{id}/pcas")
    public List<java.util.Map<String, Object>> getPcas(@PathVariable Long id) {
        return contractService.getPcas(id);
    }

    @PostMapping("/{id}/pcas")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void linkPcas(@PathVariable Long id, @RequestBody java.util.Map<String, List<Long>> payload) {
        List<Long> pcaIds = payload.get("pcaIds");
        contractService.linkPcas(id, pcaIds);
    }

    @DeleteMapping("/{id}/pcas/{pcaId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unlinkPca(@PathVariable Long id, @PathVariable Long pcaId) {
        contractService.unlinkPca(id, pcaId);
    }
}
