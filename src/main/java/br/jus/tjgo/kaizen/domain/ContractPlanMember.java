package br.jus.tjgo.kaizen.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

/**
 * Membro/assinante de um Planejamento de Contratação (DOD).
 * Segue o padrão de {@link ContractMember} (contracts_members).
 *
 * <p>Papéis (role): INTEGRANTE_DEMANDANTE, INTEGRANTE_TECNICO,
 * INTEGRANTE_ADMINISTRATIVO, AUTORIDADE_TI.
 *
 * <p>Status de assinatura: PENDING, SIGNED, REJECTED.
 */
@Entity
@Table(name = "contract_plans_members")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContractPlanMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contract_plan_id", nullable = false)
    private ContractPlan contractPlan;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "role", length = 50, nullable = false)
    private String role;

    @Column(name = "signed_at")
    private LocalDateTime signedAt;

    @Column(name = "signature_status", length = 20)
    @Builder.Default
    private String signatureStatus = "PENDING";

    @Column(name = "reject_reason", columnDefinition = "TEXT")
    private String rejectReason;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "created_by")
    private Long createdBy;
}
