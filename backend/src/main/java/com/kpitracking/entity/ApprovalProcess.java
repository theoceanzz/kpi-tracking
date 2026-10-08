package com.kpitracking.entity;

import com.kpitracking.enums.ApprovalObjectType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.*;

/**
 * Quy trình duyệt của một tổ chức cho một đối tượng (xem {@code V33__approval_processes.sql}).
 * Sơ đồ ở {@link #definition} là dạng lưu của {@code ProcessGraph}; để jsonb thay vì trải thành
 * bảng node/cạnh vì luôn đọc/ghi nguyên khối và chỉ cần kiểm ở một chỗ.
 */
@Entity
@Table(name = "approval_processes")
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ApprovalProcess {

    public static final String TYPE_PROCESS = "PROCESS";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "title", nullable = false)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "object_type", nullable = false, length = 30)
    private ApprovalObjectType objectType;

    /** Mã đối tượng con áp dụng; rỗng = tất cả. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "sub_object_types", nullable = false, columnDefinition = "jsonb")
    @Builder.Default
    private List<String> subObjectTypes = new ArrayList<>();

    @Column(name = "approval_type", nullable = false, length = 20)
    @Builder.Default
    private String approvalType = TYPE_PROCESS;

    @Column(name = "show_in_object", nullable = false)
    @Builder.Default
    private boolean showInObject = false;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "definition", nullable = false, columnDefinition = "jsonb")
    private String definition;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "approval_process_followers", joinColumns = @JoinColumn(name = "process_id"))
    @Column(name = "user_id", nullable = false)
    @Builder.Default
    private Set<UUID> followerIds = new LinkedHashSet<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    private User createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by_id")
    private User updatedBy;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

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

    public List<String> subObjectsOrEmpty() {
        return subObjectTypes == null ? List.of() : subObjectTypes;
    }
}
