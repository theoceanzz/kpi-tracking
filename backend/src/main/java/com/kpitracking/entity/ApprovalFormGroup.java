package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Nhóm đơn từ (Nhân sự, Chấm công…). Tên theo ngôn ngữ ({@code {"vi": …, "en": …}}). Xem V55. */
@Entity
@Table(name = "approval_form_groups")
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ApprovalFormGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "name", nullable = false, columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, String> name = new LinkedHashMap<>();

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    /** Mã nhóm dựng sẵn; null = nhóm người dùng tạo. */
    @Column(name = "code", length = 40)
    private String code;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }
}
