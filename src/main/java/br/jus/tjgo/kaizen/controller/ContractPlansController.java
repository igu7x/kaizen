package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.domain.ContractPlan;
import br.jus.tjgo.kaizen.dto.ContractPlanDto;
import br.jus.tjgo.kaizen.dto.CreateContractPlanRequest;
import br.jus.tjgo.kaizen.dto.UpdateContractPlanRequest;
import br.jus.tjgo.kaizen.service.ContractPlanService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/contract-plans")
@RequiredArgsConstructor
public class ContractPlansController {

    private final ContractPlanService contractPlanService;

    private ContractPlanDto toDto(ContractPlan plan) {
        return new ContractPlanDto(
                plan.getId(),
                plan.getPca() != null ? plan.getPca().getId() : null,
                plan.getPca() != null ? plan.getPca().getCode() : null,
                plan.getPca() != null ? plan.getPca().getYear() : null,
                plan.getObjectName(),
                plan.getAreaAcronym(),
                plan.getDescription(),
                plan.getJustification(),
                plan.getEstimatedValueCents(),
                plan.getPriorityLevel(),
                plan.getStatus(),
                plan.getStep(),
                plan.getEstimatedDate() != null ? plan.getEstimatedDate().toString() : null,
                plan.getLoaReference(),
                plan.getObjectName(),
                plan.getContracts().size()
        );
    }

    @GetMapping
    public List<ContractPlanDto> list(
            @RequestParam(required = false) Long pcaId,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) String diretoriaSigla,
            @RequestHeader("x-user-id") Long userId) {
        return contractPlanService.findAll(pcaId, status, diretoriaSigla, userId)
                .stream().map(this::toDto).toList();
    }

    @GetMapping("/{id}")
    public ContractPlanDto get(@PathVariable Long id, @RequestHeader("x-user-id") Long userId) {
        return toDto(contractPlanService.findById(id, userId));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ContractPlanDto create(@RequestBody CreateContractPlanRequest req, @RequestHeader("x-user-id") Long userId) {
        return toDto(contractPlanService.create(req, userId));
    }

    @PutMapping("/{id}")
    public ContractPlanDto update(@PathVariable Long id, @RequestBody UpdateContractPlanRequest req, @RequestHeader("x-user-id") Long userId) {
        return toDto(contractPlanService.update(id, req, userId));
    }

    @PutMapping("/{id}/status")
    public ContractPlanDto updateStatus(@PathVariable Long id, @RequestBody java.util.Map<String, Integer> body, @RequestHeader("x-user-id") Long userId) {
        return toDto(contractPlanService.updateStatus(id, body.get("status"), userId));
    }

    @PutMapping("/{id}/step")
    public ContractPlanDto updateStep(@PathVariable Long id, @RequestBody java.util.Map<String, Integer> body, @RequestHeader("x-user-id") Long userId) {
        return toDto(contractPlanService.updateStep(id, body.get("step"), userId));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @RequestHeader("x-user-id") Long userId) {
        contractPlanService.softDelete(id, userId);
    }
}
