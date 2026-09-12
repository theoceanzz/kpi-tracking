package com.kpitracking.entity;

import com.kpitracking.enums.BscUnitResultStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Kết quả BSC của MỘT ĐƠN VỊ trong MỘT ĐỢT — con số "BSC phòng đạt 92%".
 *
 * <p>Khác {@link CycleUnitEvaluation}: bảng kia gộp NGƯỢC LÊN từ điểm của nhân sự trong phòng,
 * bảng này đo chỉ tiêu của chính đơn vị theo hướng TỪ TRÊN XUỐNG. Hai con số song song và được
 * đối chiếu trên dashboard — lệch nhau nhiều là tín hiệu chỉ tiêu chưa phân rã đúng.
 *
 * <p>Con số này chỉ để ĐỌC kết quả của đơn vị — nó KHÔNG nhân vào điểm của nhân viên.
 */
@Entity
@Table(name = "bsc_unit_results")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BscUnitResult {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "scorecard_id", nullable = false)
    private BscScorecard scorecard;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_period_id")
    private KpiPeriod kpiPeriod;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_cycle_id")
    private KpiCycle kpiCycle;

    @Column(name = "achievement_percent")
    private Double achievementPercent;

    /**
     * KHÔNG CÒN DÙNG — nhãn dải đã bỏ cùng với màn cấu hình chính sách. Cột giữ lại để đọc các
     * đợt đã chốt trước đây; luồng tính hiện tại không ghi vào đây nữa.
     */
    @Deprecated
    @Column(name = "band_code", length = 100)
    private String bandCode;

    /**
     * KHÔNG CÒN DÙNG — kết quả BSC của đơn vị không còn quy thành hệ số nhân vào điểm cá nhân.
     * Cột giữ lại để đọc các đợt đã chốt trước đây.
     */
    @Deprecated
    @Column(name = "factor")
    private Double factor;

    @Column(name = "gate_passed")
    private Boolean gatePassed;

    @Column(name = "gate_failed_items", columnDefinition = "TEXT")
    private String gateFailedItems;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private BscUnitResultStatus status = BscUnitResultStatus.DRAFT;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "finalized_by")
    private User finalizedBy;

    @Column(name = "finalized_at")
    private Instant finalizedAt;

    @OneToMany(mappedBy = "unitResult", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<BscUnitResultItem> items = new ArrayList<>();

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
