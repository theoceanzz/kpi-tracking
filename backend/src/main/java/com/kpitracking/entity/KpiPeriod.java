package com.kpitracking.entity;

import com.kpitracking.enums.KpiFrequency;
import com.kpitracking.enums.KpiPeriodStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "kpi_periods")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiPeriod {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    /** Kỳ đánh giá tổng hợp chứa đợt này (tuỳ chọn — đợt có thể không thuộc kỳ nào). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_cycle_id")
    private KpiCycle kpiCycle;

    @Column(name = "name", nullable = false)
    private String name; // e.g. "Quý 1/2026"

    @Enumerated(EnumType.STRING)
    @Column(name = "period_type", nullable = false)
    private KpiFrequency periodType;

    @Column(name = "start_date")
    private Instant startDate;

    @Column(name = "end_date")
    private Instant endDate;

    @Column(name = "notification_date")
    private Instant notificationDate;

    /** Trạng thái lưu (đóng/chuyển/huỷ khi khoá kỳ). Tiến độ Hoàn thành/Đang dở thì tính, không lưu. */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private KpiPeriodStatus status = KpiPeriodStatus.ACTIVE;

    /** Đợt bị tách khi khoá kỳ: kỳ nhận phần KPI dở. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transferred_to_cycle_id")
    private KpiCycle transferredToCycle;

    /** Đợt sinh ra khi tách: đợt gốc ở kỳ cũ. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_period_id")
    private KpiPeriod sourcePeriod;

    /** Đợt được chuyển nguyên sang kỳ khác: kỳ trước lần chuyển gần nhất. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "original_cycle_id")
    private KpiCycle originalCycle;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
