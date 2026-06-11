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

    @Column(name = "description", length = 100)
    private String description;

    @Column(name = "object_name", length = 50)
    private String objectName;

    @Column(name = "directory_acronym", length = 20)
    private String directoryAcronym;

    @Column(name = "estimated_value_cents")
    private Long estimatedValueCents;

    @Column(name = "priority_level")
    private Integer priorityLevel;

    @Column(name = "step")
    private Integer step;

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
