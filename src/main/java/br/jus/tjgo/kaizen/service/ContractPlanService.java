package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.domain.ContractPlan;
import br.jus.tjgo.kaizen.domain.Pca;
import br.jus.tjgo.kaizen.dto.CreateContractPlanRequest;
import br.jus.tjgo.kaizen.dto.UpdateContractPlanRequest;
import br.jus.tjgo.kaizen.exception.ApiException;
import br.jus.tjgo.kaizen.repository.ContractPlanRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ContractPlanService {

    private final ContractPlanRepository contractPlanRepository;
    private final PcaCoreService pcaCoreService;
    private final PermissoesService permissoesService;

    private void validateAccess(Long userId, String diretoriaSigla) {
        Map<String, Object> perm = permissoesService.verificarPermissao(userId, "contratacoes_novas");
        if (!Boolean.TRUE.equals(perm.get("pode_acessar"))) {
            throw new ApiException(403, "Acesso negado ao módulo de Contratos.");
        }
        if (Boolean.TRUE.equals(perm.get("apenas_propria_diretoria"))) {
            String userDir = permissoesService.getDiretoriaUsuario(userId);
            if (diretoriaSigla != null && !diretoriaSigla.equals(userDir)) {
                throw new ApiException(403, "Acesso restrito aos contratos da sua diretoria.");
            }
        }
    }

    public List<ContractPlan> findAll(Long pcaId, Integer status, String diretoriaSigla, Long userId) {
        validateAccess(userId, diretoriaSigla);
        List<ContractPlan> plans = pcaId != null
                ? contractPlanRepository.findByPcaIdAndIsDeletedFalse(pcaId)
                : contractPlanRepository.findAll().stream().filter(p -> !p.getIsDeleted()).toList();

        if (status != null) {
            plans = plans.stream().filter(p -> status.equals(p.getStatus())).toList();
        }
        if (diretoriaSigla != null) {
            plans = plans.stream().filter(p -> diretoriaSigla.equals(p.getAreaAcronym())).toList();
        }
        return plans;
    }

    public ContractPlan findById(Long id, Long userId) {
        ContractPlan plan = contractPlanRepository.findById(id)
                .filter(p -> !p.getIsDeleted())
                .orElseThrow(() -> new ApiException(404, "Plano de contratação não encontrado"));
        validateAccess(userId, plan.getAreaAcronym());
        return plan;
    }

    @Transactional
    public ContractPlan create(CreateContractPlanRequest req, Long userId) {
        validateAccess(userId, req.areaAcronym());
        Pca pca = pcaCoreService.findOrCreate(req.pcaCode(), req.pcaYear(), userId);

        ContractPlan plan = new ContractPlan();
        plan.setPca(pca);
        plan.setObjectName(req.objectName());
        plan.setAreaAcronym(req.areaAcronym());
        plan.setDescription(req.description());
        plan.setJustification(req.justification());
        plan.setEstimatedValueCents(req.estimatedValueCents() != null ? req.estimatedValueCents() : 0L);
        plan.setPriorityLevel(req.priorityLevel());
        plan.setEstimatedDate(req.estimatedDate() != null ? LocalDate.parse(req.estimatedDate()) : null);
        plan.setLoaReference(req.loaReference());
        plan.setCreatedAt(LocalDateTime.now());
        plan.setCreatedBy(userId);

        return contractPlanRepository.save(plan);
    }

    @Transactional
    public ContractPlan update(Long id, UpdateContractPlanRequest req, Long userId) {
        ContractPlan plan = findById(id, userId);
        validateAccess(userId, req.areaAcronym() != null ? req.areaAcronym() : plan.getAreaAcronym());

        if (req.objectName() != null) plan.setObjectName(req.objectName());
        if (req.areaAcronym() != null) plan.setAreaAcronym(req.areaAcronym());
        if (req.description() != null) plan.setDescription(req.description());
        if (req.justification() != null) plan.setJustification(req.justification());
        if (req.estimatedValueCents() != null) plan.setEstimatedValueCents(req.estimatedValueCents());
        if (req.priorityLevel() != null) plan.setPriorityLevel(req.priorityLevel());
        if (req.estimatedDate() != null) plan.setEstimatedDate(LocalDate.parse(req.estimatedDate()));
        if (req.loaReference() != null) plan.setLoaReference(req.loaReference());

        plan.setUpdatedAt(LocalDateTime.now());
        plan.setUpdatedBy(userId);

        return contractPlanRepository.save(plan);
    }

    @Transactional
    public ContractPlan updateStatus(Long id, int status, Long userId) {
        ContractPlan plan = findById(id, userId);
        plan.setStatus(status);
        plan.setUpdatedAt(LocalDateTime.now());
        plan.setUpdatedBy(userId);
        return contractPlanRepository.save(plan);
    }

    @Transactional
    public ContractPlan updateStep(Long id, int step, Long userId) {
        ContractPlan plan = findById(id, userId);
        plan.setStep(step);
        plan.setStepUpdatedAt(LocalDateTime.now());
        plan.setUpdatedAt(LocalDateTime.now());
        plan.setUpdatedBy(userId);
        return contractPlanRepository.save(plan);
    }

    @Transactional
    public void softDelete(Long id, Long userId) {
        ContractPlan plan = findById(id, userId);
        if (!plan.getContracts().isEmpty()) {
            throw new ApiException(400, "Não é possível excluir um plano que possui contratos vinculados.");
        }
        plan.setIsDeleted(true);
        plan.setDeletedAt(LocalDateTime.now());
        plan.setDeletedBy(userId);
        contractPlanRepository.save(plan);
    }
}
