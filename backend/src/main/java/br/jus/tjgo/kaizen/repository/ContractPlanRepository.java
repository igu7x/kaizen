package br.jus.tjgo.kaizen.repository;

import br.jus.tjgo.kaizen.domain.ContractPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ContractPlanRepository extends JpaRepository<ContractPlan, Long> {
    List<ContractPlan> findByPcaIdAndIsDeletedFalse(Long pcaId);
    List<ContractPlan> findByIsDeletedFalse();
}
