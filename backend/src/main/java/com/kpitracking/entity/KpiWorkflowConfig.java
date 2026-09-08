package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Cấu hình luồng KPI của MỘT tổ chức. Mỗi tổ chức nhiều nhất một bản ghi còn hiệu lực.
 *
 * <p>Vắng bản ghi nghĩa là dùng luồng mặc định, nên bảng này rỗng sau khi triển khai và không tổ
 * chức nào đổi hành vi cho tới lúc chính họ vào bật/tắt.
 *
 * <p>{@code definition} để jsonb thay vì trải thành cột, theo đúng tiền lệ
 * {@code organizations.performance_matrix} và {@code unit_classification_rules}. Cố ý không đặt
 * CHECK constraint theo enum lên nó: {@code report_widgets.widget_type} đã cho thấy cái giá của
 * việc đó — mỗi lần thêm một loại là phải sửa đồng thời enum Java, CHECK trong SQL và union bên
 * TypeScript, tới mức frontend phải khai sai loại xuống DB để lách.
 */
@Entity
@Table(name = "kpi_workflow_configs")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiWorkflowConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    /** Dạng lưu của {@code com.kpitracking.workflow.def.WorkflowConfig}. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "definition", nullable = false, columnDefinition = "jsonb")
    private String definition;

    /** Phiên bản lược đồ của {@code definition}, để nâng cấp dần về sau. */
    @Column(name = "version", nullable = false)
    @Builder.Default
    private Integer version = 1;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by")
    private User updatedBy;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
