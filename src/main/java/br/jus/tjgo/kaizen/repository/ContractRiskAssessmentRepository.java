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
           "(is_deleted IS NULL OR is_deleted = false) AND " +
           "(:hasCrudPermission = true OR validated_at IS NOT NULL) AND " +
           "(:search IS NULL OR :search = '' OR body->>'titulo' ILIKE CONCAT('%', :search, '%')) " +
           "ORDER BY created_at DESC",
           countQuery = "SELECT count(*) FROM contract_risk_assessments WHERE " +
           "(is_deleted IS NULL OR is_deleted = false) AND " +
           "(:hasCrudPermission = true OR validated_at IS NOT NULL) AND " +
           "(:search IS NULL OR :search = '' OR body->>'titulo' ILIKE CONCAT('%', :search, '%'))",
           nativeQuery = true)
    Page<ContractRiskAssessment> findBySearchOrderByCreatedAtDesc(@Param("search") String search, @Param("hasCrudPermission") boolean hasCrudPermission, Pageable pageable);
    
    @Query("SELECT CASE WHEN COUNT(c) > 0 THEN true ELSE false END FROM ContractRiskAssessment c WHERE c.createdById = :createdById AND c.status = :status AND (c.isDeleted IS NULL OR c.isDeleted = false)")
    boolean existsByCreatedByIdAndStatus(@Param("createdById") Long createdById, @Param("status") ContractRiskAssessmentStatus status);
}
