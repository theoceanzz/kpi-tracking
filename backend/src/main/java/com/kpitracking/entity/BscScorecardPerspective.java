package com.kpitracking.entity;

import com.kpitracking.enums.BscGateEffect;
import com.kpitracking.enums.BscGateScope;
import com.kpitracking.enums.BscItemOrigin;
import com.kpitracking.enums.BscLinkType;
import com.kpitracking.enums.BscMeasurementSource;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Một DÒNG CHỈ TIÊU của bộ tiêu chí: hạng mục + trọng số (%) + mục tiêu riêng của cấp này.
 * Tổng trọng số = 100 mỗi scorecard. Đây là nơi trọng số "sống" và tham gia công thức chấm điểm BSC.
 *
 * <p>Mục tiêu nằm ở ĐÂY chứ không ở {@link BscPerspective} (xem docs/bsc-cascade-design.md — QĐ-2):
 * "Doanh thu" là một hạng mục dùng chung, nhưng công ty đặt 100 tỷ còn phòng Kinh doanh 60 tỷ và
 * phòng Dự án 40 tỷ. Giá trị trên hạng mục chỉ còn là mặc định gợi ý lúc thêm vào bộ tiêu chí.
 */
@Entity
@Table(name = "bsc_scorecard_perspectives")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BscScorecardPerspective {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "scorecard_id", nullable = false)
    private BscScorecard scorecard;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "perspective_id", nullable = false)
    private BscPerspective perspective;

    @Column(name = "weight_percentage", nullable = false)
    @Builder.Default
    private Double weightPercentage = 0.0;

    /**
     * Mục tiêu của hạng mục TRONG bộ tiêu chí này. NULL = chưa đặt riêng ⇒ rơi về giá trị mặc định
     * trên hạng mục. Có giá trị > 0 ⇒ hạng mục tự chấm theo mục tiêu của chính nó (kiểu OKR).
     */
    @Column(name = "target_value")
    private Double targetValue;

    /** Ngưỡng sàn của cấp này; phải ≤ {@link #targetValue} khi cả hai được đặt. */
    @Column(name = "minimum_value")
    private Double minimumValue;

    /** Đơn vị tính của mục tiêu/tối thiểu ở cấp này (VD: VNĐ, %, buổi). */
    @Column(name = "unit", length = 50)
    private String unit;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private Integer displayOrder = 0;

    // ── Liên kết cascade lên bộ tiêu chí cha (QĐ-1, mục 4.3) ──

    /** Dòng chỉ tiêu của bộ tiêu chí CHA mà dòng này nhận phân rã. Null = chỉ tiêu tự có. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_item_id")
    private BscScorecardPerspective parentItem;

    /** Quan hệ với chỉ tiêu cha. Chỉ {@code SUM} tham gia phép cộng khi tính độ phủ. */
    @Enumerated(EnumType.STRING)
    @Column(name = "link_type", length = 20)
    private BscLinkType linkType;

    /** Mức đóng góp tuyệt đối vào mục tiêu của chỉ tiêu cha (VD phòng KD gánh 60 tỷ trong 100 tỷ). */
    @Column(name = "contribution_value")
    private Double contributionValue;

    /** Hoặc đóng góp theo % mục tiêu cha — dùng khi chỉ tiêu cha không có con số tuyệt đối. */
    @Column(name = "contribution_percent")
    private Double contributionPercent;

    // ── Quyền biên tập (QĐ-3) ──────────────────────────

    /**
     * ASSIGNED = cấp trên giao xuống, SELF = đơn vị tự thêm. Đây là thứ quyết định ai sửa được gì,
     * thay cho việc gắn cứng vào vai trò người dùng.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "origin", nullable = false, length = 20)
    @Builder.Default
    private BscItemOrigin origin = BscItemOrigin.SELF;

    /** Khoá mục tiêu/trọng số. Dòng ASSIGNED mặc định khoá — cấp dưới chỉ gắn KPI con vào. */
    @Column(name = "locked", nullable = false)
    @Builder.Default
    private Boolean locked = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    // ── Nguồn số liệu (mục 5.2) ────────────────────────

    @Enumerated(EnumType.STRING)
    @Column(name = "measurement_source", nullable = false, length = 20)
    @Builder.Default
    private BscMeasurementSource measurementSource = BscMeasurementSource.ROLLUP;

    // ── Hạng mục chặn — "câu chặn 10" (QĐ-7) ───────────

    /** Bật = không đạt ngưỡng thì bị áp trần xếp loại. KHÔNG trừ điểm. */
    @Column(name = "is_gate", nullable = false)
    @Builder.Default
    private Boolean isGate = false;

    /** Ngưỡng %đạt tối thiểu để coi là qua chặn (VD 100). */
    @Column(name = "gate_min_percent")
    private Double gateMinPercent;

    @Enumerated(EnumType.STRING)
    @Column(name = "gate_effect", length = 24)
    private BscGateEffect gateEffect;

    /** Mức trần khi {@code gateEffect = CAP_AT_RATING}. */
    @Column(name = "gate_cap_rating")
    private Integer gateCapRating;

    @Enumerated(EnumType.STRING)
    @Column(name = "gate_applies_to", nullable = false, length = 16)
    @Builder.Default
    private BscGateScope gateAppliesTo = BscGateScope.BOTH;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;
}
