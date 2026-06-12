package br.jus.tjgo.kaizen.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import com.fasterxml.jackson.annotation.JsonValue;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "contracts")
@Getter
@Setter
public class Contract {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contract_plan_id")
    private ContractPlan contractPlan;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "base_contract_id")
    private Contract baseContract;

    @Column(name = "supplier")
    private String supplier;

    @Column(name = "contract_model", length = 255)
    private String contractModel;

    @Column(name = "process", length = 255)
    private String process;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "effective_date")
    private LocalDate effectiveDate;

    @Column(name = "limit_date")
    private LocalDate limitDate;

    @Column(name = "contract_type", length = 50)
    private ContractTypeEnum contractType;

    public enum ContractTypeEnum {
        ARMAZENAMENTO("Armazenamento"),
        AUTENTICACAO("Autenticação"),
        BACKUP("Backup"),
        BANCO_DE_DADOS("Banco de Dados"),
        COLABORACAO("Colaboração"),
        COMPLIANCE("Compliance"),
        DESENVOLVIMENTO("Desenvolvimento"),
        EMAIL("Email"),
        FABRICA_DE_SOFTWARE("Fábrica de Software"),
        GESTAO("Gestão"),
        HELP_DESK("Help Desk"),
        IMPRESSAO("Impressão"),
        LINKS_DE_DADOS("Links de Dados"),
        MATERIAL("Material"),
        NUVEM("Nuvem"),
        PARQUE_COMPUTACIONAL("Parque Computacior"),
        PROCESSAMENTO("Processamento"),
        REDES("Redes"),
        RESIDENCIA("Residência"),
        SOFTWARE_PRATELEIRA("Software Prateleira"),
        SEGURANCA("Segurança"),
        TELEFONIA_FIXA("Telefonia fixa"),
        TELEFONIA_MOVEL("Telefonia móvel"),
        VIDEOCONFERENCIA("Videoconferência"),
        VOIP("Voip");

        private final String value;

        ContractTypeEnum(String value) {
            this.value = value;
        }

        @JsonValue
        public String getValue() {
            return value;
        }
    }

    @Column(name = "additive_term_type")
    private Integer additiveTermType;

    @Column(name = "object_name", columnDefinition = "TEXT")
    private String objectName;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "notice_number", length = 16)
    private String noticeNumber;

    @Column(name = "effective_additive_term")
    private Integer effectiveAdditiveTerm;

    @Column(name = "total_value_cents")
    private Long totalValueCents = 0L;

    @Column(name = "total_value_currency", length = 3)
    private String totalValueCurrency = "BRL";

    @Column(name = "monthly_value_cents")
    private Long monthlyValueCents = 0L;

    @Column(name = "monthly_value_currency", length = 3)
    private String monthlyValueCurrency = "BRL";

    @Column(name = "year_value")
    private Long yearValue;

    @Column(name = "directory", length = 50)
    private String directory;


    @Column(name = "cadastro_area_id")
    private Long cadastroAreaId;

    @Column(name = "cadastro_unidade_id")
    private Long cadastroUnidadeId;

    @Column(name = "unidade", length = 255)
    private String unidade;

    @Column(name = "contract_members_id")
    private Long contractMembersId;

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

    @ManyToMany
    @JoinTable(
            name = "contracts_pcas",
            joinColumns = @JoinColumn(name = "contract_id"),
            inverseJoinColumns = @JoinColumn(name = "pca_id")
    )
    private List<Pca> pcas = new ArrayList<>();

    @OneToMany(mappedBy = "contract", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ContractMember> members = new ArrayList<>();
}
