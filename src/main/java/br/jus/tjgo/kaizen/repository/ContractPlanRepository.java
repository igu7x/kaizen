package br.jus.tjgo.kaizen.repository;

import br.jus.tjgo.kaizen.domain.ContractPlan;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ContractPlanRepository extends JpaRepository<ContractPlan, Long> {
    @EntityGraph(attributePaths = {"pca"})
    List<ContractPlan> findByPcaIdAndIsDeletedFalse(Long pcaId);
    
    @EntityGraph(attributePaths = {"pca"})
    List<ContractPlan> findByIsDeletedFalse();
    
    boolean existsByProadNumberAndIsDeletedFalse(String proadNumber);
    
    boolean existsByProadNumberAndIdNotAndIsDeletedFalse(String proadNumber, Long id);
}
