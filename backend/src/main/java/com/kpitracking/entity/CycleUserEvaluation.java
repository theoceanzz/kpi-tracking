package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Điểm CHỐT KỲ của một nhân viên (người đánh giá nhập/chỉnh tay).
 * Mặc định gợi ý = trung bình điểm QLTT các đợt trong kỳ.
 */
@Entity
@Table(name = "cycle_user_evaluations")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CycleUserEvaluation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_cycle_id", nullable = false)
    private KpiCycle kpiCycle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "final_score")
    private Double finalScore;

    /** Mức định tính chấm ở cấp kỳ (thang 0..5) — trục hàng của ma trận hiệu suất. */
    @Column(name = "qual_score")
    private Double qualScore;

    /** Xếp loại 1..5 suy ra từ ma trận: (qualScore) × (TB % hoàn thành định lượng). */
    @Column(name = "matrix_rating")
    private Integer matrixRating;

    @Column(name = "comment")
    private String comment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "evaluated_by")
    private User evaluatedBy;

    @Column(name = "evaluated_at")
    private Instant evaluatedAt;


    // ── Cascade BSC: điểm công nhận và ghi đè (docs/bsc-cascade-design.md — mục 5.3) ──
    //
    // Toàn bộ nhóm này là SNAPSHOT lúc chốt. Chính sách sửa về sau không được làm đổi
    // kết quả đã công bố; muốn đổi thì mở khoá và tái tính có phiên bản.

    /** Điểm BSC GỐC, trước khi chặn trần. */
    @Column(name = "raw_bsc_score")
    private Double rawBscScore;

    /**
     * KHÔNG CÒN DÙNG — điểm cá nhân không bị nhân hệ số của phòng/công ty nữa. Cột giữ lại để đọc
     * được các kỳ đã chốt trước đây; luồng chấm điểm hiện tại không ghi vào đây.
     */
    @Deprecated
    @Column(name = "unit_factor")
    private Double unitFactor;

    /** KHÔNG CÒN DÙNG — xem {@link #unitFactor}. */
    @Deprecated
    @Column(name = "company_factor")
    private Double companyFactor;

    /** MIN(điểm gốc, trần). */
    @Column(name = "recognized_score")
    private Double recognizedScore;

    // Cơ chế THỦ CÔNG (QĐ-6). Bắt buộc có lý do và dấu vết
    // vì đây là hành vi ngoại lệ, phải giải trình được về sau.

    @Column(name = "override_score")
    private Double overrideScore;

    @Column(name = "override_reason_code", length = 50)
    private String overrideReasonCode;

    @Column(name = "override_comment", columnDefinition = "TEXT")
    private String overrideComment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "overridden_by")
    private User overriddenBy;

    @Column(name = "overridden_at")
    private Instant overriddenAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cascade_policy_id")
    private BscCascadePolicy cascadePolicy;

    // ── Hạng mục chặn (QĐ-7): áp TRẦN XẾP LOẠI, không đụng vào điểm ──

    @Column(name = "gate_passed")
    private Boolean gatePassed;

    /** Trần xếp loại đã tính. Xếp loại cuối = MIN(xếp loại theo điểm, trần này). */
    @Column(name = "gate_cap_rating")
    private Integer gateCapRating;

    /** Tên các hạng mục chặn không đạt — để màn hình kết quả nói được lý do. */
    @Column(name = "gate_failed_items", columnDefinition = "TEXT")
    private String gateFailedItems;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
