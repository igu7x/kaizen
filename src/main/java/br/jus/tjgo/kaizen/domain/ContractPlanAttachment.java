package br.jus.tjgo.kaizen.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import org.hibernate.annotations.SQLRestriction;

import java.time.LocalDateTime;

/**
 * Anexo categorizado de um Planejamento de Contratação.
 *
 * <p>Tipos de documento (document_type): dod, etp, tr, mgr, am.
 *
 * <p>O arquivo físico é armazenado no Storage S3 (ECS/OpenShift);
 * esta entidade persiste apenas metadados e a {@code fileKey}.
 */
@Entity
@Table(name = "contract_plans_attachments")
@SQLRestriction("is_deleted = false")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContractPlanAttachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contract_plan_id", nullable = false)
    private ContractPlan contractPlan;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "file_key", columnDefinition = "TEXT", nullable = false)
    private String fileKey;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "content_type", length = 100)
    private String contentType;

    @Column(name = "document_type", length = 10, nullable = false)
    private String documentType;

    @Column(name = "uploaded_by")
    private Long uploadedBy;

    @Column(name = "uploaded_at")
    private LocalDateTime uploadedAt;

    @Column(name = "is_deleted")
    @Builder.Default
    private Boolean isDeleted = false;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "deleted_by")
    private Long deletedBy;
}
