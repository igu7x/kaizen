package br.jus.tjgo.kaizen.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

@Entity
@Table(name = "contract_risk_assessment_validations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContractRiskAssessmentValidation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "body", columnDefinition = "jsonb", nullable = false)
    private String body;

    @Column(name = "validated_by_id", nullable = false)
    private Long validatedById;

    @Column(name = "validated_at", nullable = false)
    private OffsetDateTime validatedAt;
}
