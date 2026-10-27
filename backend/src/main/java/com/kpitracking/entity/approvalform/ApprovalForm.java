package com.kpitracking.entity.approvalform;

import com.kpitracking.entity.form.FormAdmin;
import com.kpitracking.entity.form.FormSchema;
import com.kpitracking.entity.form.FormSubmitters;
import com.kpitracking.enums.approvalform.FormSubmitterScope;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.*;

import com.kpitracking.entity.user.User;
/**
 * Một đơn từ (mẫu đơn): thông tin, ai được nộp, người quản lý đơn, form và quy trình duyệt riêng của đơn
 * ({@link #processDefinition}, cùng định dạng {@code ProcessGraph} như {@code approval_processes.definition}).
 * Cột jsonb ánh xạ sang record nên so bằng {@code equals} — Hibernate không tưởng cột đổi ở mỗi lần flush.
 */
@Entity
@Table(name = "approval_forms")
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ApprovalForm {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "group_id", nullable = false)
    private UUID groupId;

    @Column(name = "template_code", length = 60)
    private String templateCode;

    @Column(name = "icon", nullable = false, length = 40)
    private String icon;

    @Column(name = "color", nullable = false, length = 20)
    private String color;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "name", nullable = false, columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, String> name = new LinkedHashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "description", nullable = false, columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, String> description = new LinkedHashMap<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "submitter_scope", nullable = false, length = 20)
    @Builder.Default
    private FormSubmitterScope submitterScope = FormSubmitterScope.ALL;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "submitters", nullable = false, columnDefinition = "jsonb")
    @Builder.Default
    private FormSubmitters submitters = FormSubmitters.none();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "admins", nullable = false, columnDefinition = "jsonb")
    @Builder.Default
    private List<FormAdmin> admins = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "form_schema", nullable = false, columnDefinition = "jsonb")
    @Builder.Default
    private FormSchema formSchema = FormSchema.empty();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "process_definition", nullable = false, columnDefinition = "jsonb")
    private String processDefinition;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    private User createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by_id")
    private User updatedBy;

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

    public List<FormAdmin> adminsOrEmpty() {
        return admins == null ? List.of() : admins;
    }
}
