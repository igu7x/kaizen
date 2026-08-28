package br.jus.tjgo.kaizen.repository;

import br.jus.tjgo.kaizen.domain.ContractPlanNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ContractPlanNoteRepository extends JpaRepository<ContractPlanNote, Long> {
    List<ContractPlanNote> findByContractPlanIdOrderByCreatedAtAsc(Long contractPlanId);
    List<ContractPlanNote> findByContractPlanIdInAndIsSystemEventFalseOrderByCreatedAtAsc(List<Long> contractPlanIds);
}
