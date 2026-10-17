package com.kpitracking.entity.approvalform;

import com.kpitracking.entity.form.FormSchema;
import com.kpitracking.enums.approvalform.ApprovalRequestStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import com.kpitracking.entity.organization.OrgUnit;
import com.kpitracking.entity.user.User;
/**
 * Một đơn đã nộp. Tên / icon / form của đơn được chụp lúc nộp để đơn hiện đúng như lúc nộp dù đơn mẫu bị sửa
 * hay xoá sau đó. Chuỗi duyệt: {@code kpi_approval_flows} với {@code subject_type = FORM_REQUEST}, {@code subject_id = id}.
 */
@Entity
@Table(name = "approval_requests")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ApprovalRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "form_id", nullable = false)
    private UUID formId;

    @Column(name = "code", nullable = false, unique = true, length = 30)
    private String code;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requester_id", nullable = false)
    private User requester;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "org_unit_id", nullable = false)
    private OrgUnit orgUnit;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "form_name", nullable = false, columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, String> formName = new LinkedHashMap<>();

    @Column(name = "form_icon", nullable = false, length = 40)
    private String formIcon;

    @Column(name = "form_color", nullable = false, length = 20)
    private String formColor;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "form_snapshot", nullable = false, columnDefinition = "jsonb")
    private FormSchema formSnapshot;

    /** Giá trị đã chuẩn hoá theo widget (công thức, thời lượng do backend tính; người / đơn vị kèm tên). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "form_values", nullable = false, columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> values = new LinkedHashMap<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ApprovalRequestStatus status;

    @Column(name = "reject_reason", columnDefinition = "TEXT")
    private String rejectReason;

    @Column(name = "submitted_at", nullable = false)
    @Builder.Default
    private Instant submittedAt = Instant.now();

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }
}
