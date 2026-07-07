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

    /**
     * Domínio válido de `contracts.situation` (DFD-Consulta do Orçamento de TIC). Validado aqui no
     * backend — o CHECK foi removido do banco (migration 170, decisão jul/2026). Aceita tanto os
     * blocos do ciclo de vida (RF-05) quanto a natureza legada (continuada/pontual). Nulo = não
     * classificado.
     */
    private static final java.util.Set<String> SITUACOES_VALIDAS = java.util.Set.of(
            "encerramento", "renovacao", "plurianual", "nova_contratacao",
            "continuada", "pontual");

    private static void validarSituation(String situation) {
        if (situation != null && !situation.isBlank() && !SITUACOES_VALIDAS.contains(situation)) {
            throw new ApiException(400, "Situação (natureza) inválida: " + situation);
        }
    }

    public List<Contract> findAll(String startDate, String endDate, String contractType, String searchQuery, Boolean minhasDemandas, Long userId) {
        List<Contract> contracts = contractRepository.findAll().stream()
                .filter(c -> !c.getIsDeleted())
                .filter(c -> startDate == null || (c.getStartDate() != null && !c.getStartDate().isBefore(LocalDate.parse(startDate))))
                .filter(c -> endDate == null || (c.getEndDate() != null && !c.getEndDate().isAfter(LocalDate.parse(endDate))))
                .filter(c -> contractType == null || (c.getContractType() != null && c.getContractType().getValue().equalsIgnoreCase(contractType)))
                .filter(c -> searchQuery == null || searchQuery.isBlank() || 
                             (c.getObjectName() != null && c.getObjectName().toLowerCase().contains(searchQuery.toLowerCase())) ||
                             (c.getSupplier() != null && c.getSupplier().toLowerCase().contains(searchQuery.toLowerCase())) ||
                             (c.getNoticeNumber() != null && c.getNoticeNumber().toLowerCase().contains(searchQuery.toLowerCase())) ||
                             (String.valueOf(c.getId()).contains(searchQuery)))
                .toList();

        if (Boolean.TRUE.equals(minhasDemandas) && userId != null) {
            Long areaId = null;
            Long unidadeId = null;
            try {
                var pessoa = jdbcTemplate.queryForMap("SELECT area_id, unidade_id FROM cadastros_pessoas WHERE user_id = ?", userId);
                areaId = pessoa.get("area_id") != null ? ((Number) pessoa.get("area_id")).longValue() : null;
                unidadeId = pessoa.get("unidade_id") != null ? ((Number) pessoa.get("unidade_id")).longValue() : null;
            } catch (Exception e) {
                // Se a pessoa não existir, areaId e unidadeId ficam null
            }
            
            final Long finalAreaId = areaId;
            final Long finalUnidadeId = unidadeId;
            
            contracts = contracts.stream().filter(c -> 
                (finalAreaId != null && finalAreaId.equals(c.getCadastroAreaId())) ||
                (finalUnidadeId != null && finalUnidadeId.equals(c.getCadastroUnidadeId()))
            ).toList();
        }
        
        return contracts;
    }

    public Contract findById(Long id) {
        return contractRepository.findById(id)
                .filter(c -> !c.getIsDeleted())
                .orElseThrow(() -> new ApiException(404, "Contrato não encontrado"));
    }

    private String resolveUnidade(Long cadastroUnidadeId, Long cadastroAreaId) {
        try {
            if (cadastroUnidadeId != null) {
                return jdbcTemplate.queryForObject("SELECT nome FROM cadastros_unidades WHERE id = ?", String.class, cadastroUnidadeId);
            } else if (cadastroAreaId != null) {
                return jdbcTemplate.queryForObject("SELECT sigla FROM cadastros_areas WHERE id = ?", String.class, cadastroAreaId);
            }
        } catch (Exception e) {
            // Caso o ID não exista ou ocorra erro, faz fallback
        }
        return "externo";
    }

    @Transactional
    public Contract create(CreateContractRequest req, Long userId) {
        validarSituation(req.situation());
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

        contract.setSupplier(req.supplier());
        contract.setContractModel(req.contractModel());
        contract.setProcess(req.process());
        contract.setExpenseNature(req.expenseNature());
        contract.setStartDate(req.startDate() != null && !req.startDate().isBlank() ? LocalDate.parse(req.startDate()) : null);
        contract.setEndDate(req.endDate() != null && !req.endDate().isBlank() ? LocalDate.parse(req.endDate()) : null);
        contract.setEffectiveDate(req.effectiveDate() != null && !req.effectiveDate().isBlank() ? LocalDate.parse(req.effectiveDate()) : null);
        contract.setLimitDate(req.limitDate() != null && !req.limitDate().isBlank() ? LocalDate.parse(req.limitDate()) : null);
        contract.setContractType(req.contractType());
        contract.setSituation(req.situation());
        contract.setAdditiveTermType(req.additiveTermType());
        contract.setObjectName(req.objectName());
        contract.setDescription(req.description());
        contract.setNoticeNumber(req.noticeNumber());
        contract.setDirectory(req.directory());
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
        validarSituation(req.situation());
        Contract contract = findById(id);

        if (req.supplier() != null) contract.setSupplier(req.supplier());
        if (req.contractModel() != null) contract.setContractModel(req.contractModel());
        if (req.process() != null) contract.setProcess(req.process());
        if (req.expenseNature() != null) contract.setExpenseNature(req.expenseNature());
        if (req.startDate() != null && !req.startDate().isBlank()) contract.setStartDate(LocalDate.parse(req.startDate()));
        if (req.endDate() != null && !req.endDate().isBlank()) contract.setEndDate(LocalDate.parse(req.endDate()));
        if (req.effectiveDate() != null && !req.effectiveDate().isBlank()) contract.setEffectiveDate(LocalDate.parse(req.effectiveDate()));
        if (req.limitDate() != null && !req.limitDate().isBlank()) contract.setLimitDate(LocalDate.parse(req.limitDate()));
        if (req.contractType() != null) contract.setContractType(req.contractType());
        if (req.situation() != null) contract.setSituation(req.situation());
        if (req.additiveTermType() != null) contract.setAdditiveTermType(req.additiveTermType());
        if (req.objectName() != null) contract.setObjectName(req.objectName());
        if (req.description() != null) contract.setDescription(req.description());
        if (req.noticeNumber() != null) contract.setNoticeNumber(req.noticeNumber());
        if (req.directory() != null) contract.setDirectory(req.directory());
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

    public List<java.util.Map<String, Object>> getPcas(Long contractId) {
        String sql = "SELECT p.id, p.code as item_pca, p.object_name as objeto, p.year as ano, CAST(p.estimated_date AS TEXT) as data_estimada_contratacao " +
                     "FROM pcas p " +
                     "INNER JOIN contracts_pcas cp ON cp.pca_id = p.id " +
                     "WHERE cp.contract_id = ? AND (p.is_deleted = FALSE OR p.is_deleted IS NULL)";
        return jdbcTemplate.queryForList(sql, contractId);
    }

    @Transactional
    public void linkPcas(Long contractId, List<Long> pcaIds) {
        if (pcaIds == null || pcaIds.isEmpty()) return;
        // Verify contract exists
        findById(contractId);
        
        for (Long pcaId : pcaIds) {
            // DO NOTHING on conflict to avoid duplicates
            jdbcTemplate.update(
                "INSERT INTO contracts_pcas (contract_id, pca_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
                contractId, pcaId
            );
        }
    }

    @Transactional
    public void unlinkPca(Long contractId, Long pcaId) {
        jdbcTemplate.update("DELETE FROM contracts_pcas WHERE contract_id = ? AND pca_id = ?", contractId, pcaId);
    }
}
