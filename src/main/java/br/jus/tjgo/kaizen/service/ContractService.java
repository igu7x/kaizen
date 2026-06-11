package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.domain.Contract;
import br.jus.tjgo.kaizen.domain.ContractPlan;
import br.jus.tjgo.kaizen.domain.Pca;
import br.jus.tjgo.kaizen.dto.CreateContractRequest;
import br.jus.tjgo.kaizen.dto.UpdateContractRequest;
import br.jus.tjgo.kaizen.exception.ApiException;
import br.jus.tjgo.kaizen.repository.ContractPlanRepository;
import br.jus.tjgo.kaizen.repository.ContractRepository;
import br.jus.tjgo.kaizen.repository.PcaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ContractService {

    private final ContractRepository contractRepository;
    private final ContractPlanRepository contractPlanRepository;
    private final PcaRepository pcaRepository;
    private final JdbcTemplate jdbcTemplate;

    public List<Contract> findAll() {
        return contractRepository.findAll().stream().filter(c -> !c.getIsDeleted()).toList();
    }

    public Contract findById(Long id) {
        return contractRepository.findById(id)
                .filter(c -> !c.getIsDeleted())
                .orElseThrow(() -> new ApiException(404, "Contrato não encontrado"));
    }

    private String resolveUnidade(Long cadastroUnidadeId, Long cadastroAreaId) {
        try {
            if (cadastroUnidadeId != null) {
                return jdbcTemplate.queryForObject("SELECT sigla FROM cadastro_unidades WHERE id = ?", String.class, cadastroUnidadeId);
            } else if (cadastroAreaId != null) {
                return jdbcTemplate.queryForObject("SELECT sigla FROM cadastro_areas WHERE id = ?", String.class, cadastroAreaId);
            }
        } catch (Exception e) {
            // Caso o ID não exista ou ocorra erro, faz fallback
        }
        return "externo";
    }

    @Transactional
    public Contract create(CreateContractRequest req, Long userId) {
        Contract contract = new Contract();
        
        if (req.contractPlanId() != null) {
            ContractPlan plan = contractPlanRepository.findById(req.contractPlanId())
                    .orElseThrow(() -> new ApiException(404, "Plano associado não encontrado"));
            contract.setContractPlan(plan);
        }
        
        if (req.baseContractId() != null) {
            Contract base = findById(req.baseContractId());
            contract.setBaseContract(base);
        }

        contract.setSupplierId(req.supplierId());
        contract.setContractModel(req.contractModel());
        contract.setProcess(req.process());
        contract.setStartDate(req.startDate() != null ? LocalDate.parse(req.startDate()) : null);
        contract.setEndDate(req.endDate() != null ? LocalDate.parse(req.endDate()) : null);
        contract.setContractType(req.contractType());
        contract.setAdditiveTermType(req.additiveTermType());
        contract.setObjectName(req.objectName());
        contract.setDescription(req.description());
        contract.setNoticeNumber(req.noticeNumber());
        contract.setDirectory(req.directory());
        contract.setType(req.type());
        contract.setCadastroAreaId(req.cadastroAreaId());
        contract.setCadastroUnidadeId(req.cadastroUnidadeId());
        contract.setTotalValueCents(req.totalValueCents() != null ? req.totalValueCents() : 0L);
        contract.setMonthlyValueCents(req.monthlyValueCents() != null ? req.monthlyValueCents() : 0L);

        contract.setUnidade(resolveUnidade(req.cadastroUnidadeId(), req.cadastroAreaId()));

        if (req.pcaIds() != null && !req.pcaIds().isEmpty()) {
            List<Pca> pcas = pcaRepository.findAllById(req.pcaIds());
            contract.setPcas(pcas);
        }

        contract.setCreatedAt(LocalDateTime.now());
        contract.setCreatedBy(userId);

        return contractRepository.save(contract);
    }

    @Transactional
    public Contract update(Long id, UpdateContractRequest req, Long userId) {
        Contract contract = findById(id);

        if (req.supplierId() != null) contract.setSupplierId(req.supplierId());
        if (req.contractModel() != null) contract.setContractModel(req.contractModel());
        if (req.process() != null) contract.setProcess(req.process());
        if (req.startDate() != null) contract.setStartDate(LocalDate.parse(req.startDate()));
        if (req.endDate() != null) contract.setEndDate(LocalDate.parse(req.endDate()));
        if (req.contractType() != null) contract.setContractType(req.contractType());
        if (req.additiveTermType() != null) contract.setAdditiveTermType(req.additiveTermType());
        if (req.objectName() != null) contract.setObjectName(req.objectName());
        if (req.description() != null) contract.setDescription(req.description());
        if (req.noticeNumber() != null) contract.setNoticeNumber(req.noticeNumber());
        if (req.directory() != null) contract.setDirectory(req.directory());
        if (req.type() != null) contract.setType(req.type());
        if (req.totalValueCents() != null) contract.setTotalValueCents(req.totalValueCents());
        if (req.monthlyValueCents() != null) contract.setMonthlyValueCents(req.monthlyValueCents());

        boolean updateUnidade = false;
        if (req.cadastroAreaId() != null) {
            contract.setCadastroAreaId(req.cadastroAreaId());
            updateUnidade = true;
        }
        if (req.cadastroUnidadeId() != null) {
            contract.setCadastroUnidadeId(req.cadastroUnidadeId());
            updateUnidade = true;
        }
        
        if (updateUnidade) {
            contract.setUnidade(resolveUnidade(contract.getCadastroUnidadeId(), contract.getCadastroAreaId()));
        }

        if (req.pcaIds() != null) {
            List<Pca> pcas = pcaRepository.findAllById(req.pcaIds());
            contract.setPcas(pcas);
        }

        contract.setUpdatedAt(LocalDateTime.now());
        contract.setUpdatedBy(userId);

        return contractRepository.save(contract);
    }

    @Transactional
    public void softDelete(Long id, Long userId) {
        Contract contract = findById(id);
        contract.setIsDeleted(true);
        contract.setDeletedAt(LocalDateTime.now());
        contract.setDeletedBy(userId);
        contractRepository.save(contract);
    }
}
