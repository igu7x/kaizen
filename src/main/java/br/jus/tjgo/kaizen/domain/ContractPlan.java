package br.jus.tjgo.kaizen.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "contract_plans")
@Getter
@Setter
public class ContractPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pca_id", nullable = false)
    private Pca pca;

    @Column(name = "object_name", columnDefinition = "TEXT", nullable = false)
    private String objectName;

    @Column(name = "cadastros_areas_id")
    private Long cadastrosAreasId;

    @Column(name = "cadastros_unidades_id")
    private Long cadastrosUnidadesId;

    @Transient
    private String areaSigla;

    @Transient
    private String unidadeNome;

    @Column(name = "description", length = 100, nullable = false)
    private String description;

    @Column(name = "justification", length = 500, nullable = false)
    private String justification;

    @Column(name = "estimated_value_cents")
    private Long estimatedValueCents = 0L;

    @Column(name = "estimated_value_currency", length = 3)
    private String estimatedValueCurrency = "BRL";

    @Column(name = "priority_level")
    private Integer priorityLevel;

    @Column(name = "estimated_date", nullable = false)
    private LocalDate estimatedDate;

    @Column(name = "pendency_description", length = 128)
    private String pendencyDescription;

    @Column(name = "local_description", length = 128)
    private String localDescription;

    @Column(name = "contract_type_id")
    private Long contractTypeId;

    @Column(name = "registration_date")
    private LocalDate registrationDate;

    @Column(name = "status")
    private Integer status;

    @Column(name = "step")
    private Integer step;

    @Column(name = "proad_number", length = 17)
    private String proadNumber;

    @Column(name = "ipc_code", length = 20)
    private String ipcCode;

    @Column(name = "financial_resource_type")
    private Integer financialResourceType;

    @Column(name = "loa_reference", length = 64, nullable = false)
    private String loaReference;



    @Column(name = "step_updated_at")
    private LocalDateTime stepUpdatedAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "updated_by")
    private Long updatedBy;

    @Column(name = "is_deleted")
    private Boolean isDeleted = false;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "deleted_by")
    private Long deletedBy;

    @OneToMany(mappedBy = "contractPlan", cascade = CascadeType.ALL)
    private List<Contract> contracts = new ArrayList<>();

    @OneToMany(mappedBy = "contractPlan", cascade = CascadeType.ALL)
    private List<ContractPlanMember> members = new ArrayList<>();

    @OneToMany(mappedBy = "contractPlan", cascade = CascadeType.ALL)
    private List<ContractPlanAttachment> attachments = new ArrayList<>();
}
