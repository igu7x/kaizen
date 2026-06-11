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
                contract.getContractModel(),
                contract.getSupplierId(),
                contract.getContractType(),
                contract.getAdditiveTermType(),
                contract.getObjectName(),
                contract.getNoticeNumber(),
                contract.getDirectory(),
                contract.getType(),
                contract.getUnidade(),
                contract.getTotalValueCents(),
                contract.getMonthlyValueCents(),
                "Ativo" // simplificação
        );
    }

    @GetMapping
    public List<ContractDto> list() {
        return contractService.findAll().stream().map(this::toDto).toList();
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
}
