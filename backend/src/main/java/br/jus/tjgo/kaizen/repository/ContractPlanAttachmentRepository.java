package br.jus.tjgo.kaizen.repository;

import br.jus.tjgo.kaizen.domain.ContractPlanAttachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ContractPlanAttachmentRepository extends JpaRepository<ContractPlanAttachment, Long> {

    List<ContractPlanAttachment> findByContractPlanIdAndIsDeletedFalse(Long contractPlanId);

    List<ContractPlanAttachment> findByContractPlanIdAndDocumentTypeAndIsDeletedFalse(Long contractPlanId, String documentType);
}
