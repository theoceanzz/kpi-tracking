package com.kpitracking.entity;

import com.kpitracking.enums.RewardProgramScope;
import com.kpitracking.enums.RewardRankWithin;
import com.kpitracking.enums.RewardRankingMetric;
import com.kpitracking.enums.RewardTiePolicy;
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
 * Luật thưởng tự động theo thứ hạng: ai lọt top mấy thì được bao nhiêu điểm.
 *
 * <p>Chương trình chỉ là CẤU HÌNH — nó không tự chạy. Vì {@code kpi_periods} và
 * {@code kpi_cycles} không có cột trạng thái nên hệ thống không có sự kiện "đóng đợt"
 * để bám vào; thay vào đó quản trị viên chủ động xem trước rồi phát, xem
 * {@link RewardProgramRun}.
 */
@Entity
@Table(name = "reward_programs")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RewardProgram {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "scope", nullable = false, length = 20)
    private RewardProgramScope scope;

    /** Gốc phạm vi xếp hạng. Null = toàn tổ chức. Lọc theo cây con qua {@code OrgUnit.path}. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "org_unit_id")
    private OrgUnit orgUnit;

    /**
     * Kỳ gắn cứng. Null nghĩa là chương trình dùng cho MỌI kỳ, mục tiêu chọn lúc chạy.
     *
     * <p>Ràng buộc ở DB bảo đảm chỉ một trong hai cột này có giá trị, và phải khớp với
     * {@link #scope}.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_cycle_id")
    private KpiCycle kpiCycle;

    /** Đợt gắn cứng. Xem javadoc của {@link #kpiCycle}. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_period_id")
    private KpiPeriod kpiPeriod;

    /** Chương trình này chỉ dành cho một kỳ/đợt cụ thể hay dùng chung cho mọi kỳ/đợt. */
    public boolean hasFixedTarget() {
        return kpiCycle != null || kpiPeriod != null;
    }

    public java.util.UUID fixedTargetId() {
        if (kpiCycle != null) return kpiCycle.getId();
        if (kpiPeriod != null) return kpiPeriod.getId();
        return null;
    }

    @Enumerated(EnumType.STRING)
    @Column(name = "rank_within", nullable = false, length = 20)
    @Builder.Default
    private RewardRankWithin rankWithin = RewardRankWithin.SCOPE;

    @Enumerated(EnumType.STRING)
    @Column(name = "metric", nullable = false, length = 30)
    @Builder.Default
    private RewardRankingMetric metric = RewardRankingMetric.FINAL_SCORE;

    @Enumerated(EnumType.STRING)
    @Column(name = "tie_policy", nullable = false, length = 10)
    @Builder.Default
    private RewardTiePolicy tiePolicy = RewardTiePolicy.SHARE_ALL;

    /** Sàn điểm: tránh trao "hạng nhất" cho người dẫn đầu một nhóm toàn điểm thấp. */
    @Column(name = "min_metric_value")
    private Double minMetricValue;

    /**
     * Trần an toàn cho một lần phát. Thưởng tự động lấy từ quỹ cấp tổ chức chứ không
     * trừ ngân sách cá nhân của ai, nên đây là rào chắn duy nhất chống một cấu hình
     * sai làm phát ra lượng điểm khổng lồ.
     */
    @Column(name = "max_points_per_run")
    private Integer maxPointsPerRun;

    @Column(name = "include_unit_heads", nullable = false)
    @Builder.Default
    private Boolean includeUnitHeads = true;

    /**
     * {@code {"mode":"RANK","items":[{"fromRank":1,"toRank":1,"points":500}, ...]}}
     * <p>{@code mode} có chừa giá trị {@code PERCENT} cho "top N%" nhưng v1 chưa hỗ trợ —
     * service từ chối khi gặp.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tiers", columnDefinition = "jsonb", nullable = false)
    private String tiers;

    /** Chừa sẵn cho việc tự phát khi chốt kỳ. Chưa nối ở v1. */
    @Column(name = "auto_trigger", nullable = false)
    @Builder.Default
    private Boolean autoTrigger = false;

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private Boolean enabled = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
