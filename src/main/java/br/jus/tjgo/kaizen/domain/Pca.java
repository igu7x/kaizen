package br.jus.tjgo.kaizen.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "pcas")
@Getter
@Setter
public class Pca {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code", length = 4, nullable = false)
    private String code;

    @Column(name = "year", length = 4, nullable = false)
    private String year;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "justification", columnDefinition = "TEXT")
    private String justification;

    @Column(name = "process", length = 255)
    private String process;

    @Column(name = "financial_resource_type", length = 50)
    private FinancialResourceTypeEnum financialResourceType;

    @Column(name = "contract_type", length = 50)
    private PcaContractTypeEnum contractType;

    public enum FinancialResourceTypeEnum {
        INVESTIMENTO("Investimento"),
        CUSTEIO("Custeio");

        private final String value;
        FinancialResourceTypeEnum(String value) { this.value = value; }
        public String getValue() { return value; }
    }

    public enum PcaContractTypeEnum {
        RENOVACAO("Renovação"),
        NOVA_CONTRATACAO("Nova Contratação");

        private final String value;
        PcaContractTypeEnum(String value) { this.value = value; }
        public String getValue() { return value; }
    }

    @Column(name = "object_name", columnDefinition = "TEXT")
    private String objectName;

    @Column(name = "directory_acronym", length = 20)
    private String directoryAcronym;

    @Column(name = "estimated_value_cents")
    private Long estimatedValueCents;

    @Column(name = "priority_level")
    private Integer priorityLevel;

    @Column(name = "step", length = 100)
    private PcaStepEnum step;

    public enum PcaStepEnum {
        PLANEJAMENTO_DA_CONTRATACAO("Planejamento da Contratação"),
        SELECAO_DE_FORNECEDOR("Seleção de Fornecedor"),
        GESTAO_DO_CONTRATO("Gestão do Contrato");

        private final String value;
        PcaStepEnum(String value) { this.value = value; }
        public String getValue() { return value; }
    }

    @Column(name = "status")
    private Integer status;

    @Column(name = "estimated_date")
    private LocalDate estimatedDate;

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

    @OneToMany(mappedBy = "pca", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ContractPlan> contractPlans = new ArrayList<>();

    @ManyToMany(mappedBy = "pcas")
    private List<Contract> contracts = new ArrayList<>();
}
