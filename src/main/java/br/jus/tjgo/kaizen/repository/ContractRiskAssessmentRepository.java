package br.jus.tjgo.kaizen.repository;

import br.jus.tjgo.kaizen.domain.ContractRiskAssessment;
import br.jus.tjgo.kaizen.domain.ContractRiskAssessmentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ContractRiskAssessmentRepository extends JpaRepository<ContractRiskAssessment, Long> {
    
    @Query(value = "SELECT * FROM contract_risk_assessments WHERE " +
           "(:search IS NULL OR :search = '' OR body->>'titulo' ILIKE CONCAT('%', :search, '%')) " +
           "ORDER BY created_at DESC",
           countQuery = "SELECT count(*) FROM contract_risk_assessments WHERE " +
           "(:search IS NULL OR :search = '' OR body->>'titulo' ILIKE CONCAT('%', :search, '%'))",
           nativeQuery = true)
    Page<ContractRiskAssessment> findBySearchOrderByCreatedAtDesc(@Param("search") String search, Pageable pageable);
    
    boolean existsByCreatedByIdAndStatus(Long createdById, ContractRiskAssessmentStatus status);
}
