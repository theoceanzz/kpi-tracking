package com.kpitracking.entity;

import com.kpitracking.enums.OrganizationStatus;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "organizations")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Organization {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "code", nullable = false, unique = true)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private OrganizationStatus status = OrganizationStatus.ACTIVE;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "organization", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("levelOrder ASC")
    private java.util.List<OrgHierarchyLevel> hierarchyLevels;

    @Column(name = "evaluation_max_score")
    @Builder.Default
    private Double evaluationMaxScore = 100.0;

    @Column(name = "excellent_threshold")
    @Builder.Default
    private Double excellentThreshold = 90.0;

    @Column(name = "good_threshold")
    @Builder.Default
    private Double goodThreshold = 80.0;

    @Column(name = "fair_threshold")
    @Builder.Default
    private Double fairThreshold = 70.0;

    @Column(name = "average_threshold")
    @Builder.Default
    private Double averageThreshold = 50.0;

    @Column(name = "kpi_reminder_percentage")
    @Builder.Default
    private Integer kpiReminderPercentage = 50;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;
}
