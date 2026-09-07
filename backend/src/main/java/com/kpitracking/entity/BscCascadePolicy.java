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
 * Chính sách quy kết quả BSC của phòng/công ty thành HỆ SỐ nhân vào điểm cá nhân
 * (docs/bsc-cascade-design.md — QĐ-4).
 *
 * <p>Điểm dễ hiểu sai nhất của mô hình: "nhân viên × phòng × công ty" KHÔNG phải nhân thẳng tỉ lệ
 * đạt. Tỉ lệ đạt được TRA vào {@link BscFactorBand} để ra một hệ số gần 1, rồi mới nhân:
 * <pre>recognized = MIN(điểm gốc, recognizedCapPercent) × f_phòng × f_công_ty</pre>
 * Ví dụ chuẩn: gốc 112, phòng 92% (⇒ 0.95), công ty 97% (⇒ 1.00) = 106.4 — không phải 99.96.
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

    /** Kỳ áp dụng. NULL = chính sách MẶC ĐỊNH của tổ chức, dùng cho mọi kỳ chưa có chính sách riêng. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_cycle_id")
    private KpiCycle kpiCycle;

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
