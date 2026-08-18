package br.jus.tjgo.kaizen.repository;

import br.jus.tjgo.kaizen.domain.ContractRiskAssessmentValidation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ContractRiskAssessmentValidationRepository extends JpaRepository<ContractRiskAssessmentValidation, Long> {
    Optional<ContractRiskAssessmentValidation> findFirstByAssessmentIdOrderByValidatedAtDesc(Long assessmentId);
    boolean existsByAssessmentId(Long assessmentId);
}
