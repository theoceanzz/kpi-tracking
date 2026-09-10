package com.kpitracking.entity;

import com.kpitracking.enums.BscFactorBasis;
import com.kpitracking.enums.BscFactorMode;
import com.kpitracking.enums.BscLinkedWeightEnforce;
import com.kpitracking.enums.BscPolicyStatus;
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
 * Chính sách điểm BSC của một tổ chức (docs/bsc-cascade-design.md — QĐ-8).
 *
 * <p>Chỉ còn hai con số có tác dụng: {@code recognizedCapPercent} (điểm công nhận =
 * MIN(điểm gốc, trần)) và {@code minBscLinkedWeight} + {@code linkedWeightEnforce} (KPI của một
 * người phải bám vào cây BSC tối thiểu bao nhiêu %, cảnh báo hay chặn hẳn).
 *
 * <p>Các cột hệ số và bảng dải bên dưới là DI SẢN của mô hình cũ ("nhân viên × phòng × công ty"),
 * giữ lại để đọc dữ liệu các kỳ đã chốt — không code nào còn đọc chúng để tính điểm.
 */
@Entity
@Table(name = "bsc_cascade_policies")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BscCascadePolicy {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Column(name = "name", nullable = false)
    private String name;

    /**
     * Kỳ áp dụng. NULL = chính sách MẶC ĐỊNH của tổ chức, dùng cho mọi kỳ chưa có chính sách riêng.
     *
     * <p>Loại trừ nhau với {@link #kpiPeriods}: một chính sách gắn theo KỲ hoặc theo ĐỢT, không cả hai.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_cycle_id")
    private KpiCycle kpiCycle;

    /**
     * Các ĐỢT áp dụng riêng — hẹp hơn kỳ, dùng khi chỉ muốn đổi trần điểm cho đúng một vài đợt.
     * Rỗng nghĩa là chính sách này không gắn đợt nào (gắn theo kỳ, hoặc là bản mặc định).
     */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "bsc_cascade_policy_periods",
        joinColumns = @JoinColumn(name = "policy_id"),
        inverseJoinColumns = @JoinColumn(name = "kpi_period_id"))
    @Builder.Default
    private List<KpiPeriod> kpiPeriods = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "unit_factor_mode", nullable = false, length = 20)
    @Builder.Default
    private BscFactorMode unitFactorMode = BscFactorMode.BAND_TABLE;

    @Enumerated(EnumType.STRING)
    @Column(name = "company_factor_mode", nullable = false, length = 20)
    @Builder.Default
    private BscFactorMode companyFactorMode = BscFactorMode.BAND_TABLE;

    @Enumerated(EnumType.STRING)
    @Column(name = "factor_basis", nullable = false, length = 20)
    @Builder.Default
    private BscFactorBasis factorBasis = BscFactorBasis.OVERALL;

    /** Sàn hệ số — không ai bị mất quá (1 − floor) vì kết quả của cấp trên. */
    @Column(name = "factor_floor", nullable = false)
    @Builder.Default
    private Double factorFloor = 0.85;

    @Column(name = "factor_cap", nullable = false)
    @Builder.Default
    private Double factorCap = 1.15;

    /** Trần điểm gốc TRƯỚC khi nhân hệ số (bước B1 của mục 5.3). */
    @Column(name = "recognized_cap_percent", nullable = false)
    @Builder.Default
    private Double recognizedCapPercent = 120.0;

    /** Tối thiểu bao nhiêu % tổng trọng số KPI của một người phải liên kết BSC (QĐ-8). */
    @Column(name = "min_bsc_linked_weight", nullable = false)
    @Builder.Default
    private Double minBscLinkedWeight = 60.0;

    @Enumerated(EnumType.STRING)
    @Column(name = "linked_weight_enforce", nullable = false, length = 10)
    @Builder.Default
    private BscLinkedWeightEnforce linkedWeightEnforce = BscLinkedWeightEnforce.WARN;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private BscPolicyStatus status = BscPolicyStatus.ACTIVE;

    @Column(name = "version", nullable = false)
    @Builder.Default
    private Integer version = 1;

    @OneToMany(mappedBy = "policy", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("displayOrder ASC")
    @Builder.Default
    private List<BscFactorBand> bands = new ArrayList<>();

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
