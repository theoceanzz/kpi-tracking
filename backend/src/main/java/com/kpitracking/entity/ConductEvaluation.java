package com.kpitracking.entity;

import com.kpitracking.enums.ConductScope;
import com.kpitracking.enums.ConductStatus;
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
 * Phiếu chấm hạnh kiểm của MỘT người trong MỘT đợt hoặc MỘT kỳ.
 *
 * Điểm tổng = Σ(điểm tiêu chí × trọng số) nên vẫn nằm trong 0..{@link #maxScore}.
 * Điểm này lấp trục còn thiếu của ma trận xếp loại hiệu quả — xem
 * {@link com.kpitracking.util.ConductAxisResolver}.
 */
@Entity
@Table(name = "conduct_evaluations")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ConductEvaluation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Có giá trị khi {@code scope = PERIOD}. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_period_id")
    private KpiPeriod kpiPeriod;

    /** Có giá trị khi {@code scope = CYCLE}. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_cycle_id")
    private KpiCycle kpiCycle;

    /**
     * Bộ tiêu chí đã dùng để dựng phiếu. Chỉ để truy vết: điểm tính từ bản chụp tiêu chí
     * trong {@link #items}, nên xoá bộ đi cũng không làm sai điểm đã chấm.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conduct_criteria_set_id")
    private ConductCriteriaSet criteriaSet;

    @Enumerated(EnumType.STRING)
    @Column(name = "scope", nullable = false)
    private ConductScope scope;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private ConductStatus status = ConductStatus.DRAFT;

    @Column(name = "self_score")
    private Double selfScore;

    @Column(name = "manager_score")
    private Double managerScore;

    /**
     * Thang điểm mỗi tiêu chí, CHỤP LẠI lúc mở phiếu. Đổi thang ở cấu hình tổ chức
     * không được làm đổi ý nghĩa điểm đã chấm của các đợt cũ.
     */
    @Column(name = "max_score", nullable = false)
    @Builder.Default
    private Double maxScore = 4.0;

    @Column(name = "comment", columnDefinition = "TEXT")
    private String comment;

    @Column(name = "self_submitted_at")
    private Instant selfSubmittedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "evaluator_id")
    private User evaluator;

    @Column(name = "evaluated_at")
    private Instant evaluatedAt;

    @OneToMany(mappedBy = "conductEvaluation", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("position ASC")
    @Builder.Default
    private List<ConductEvaluationItem> items = new ArrayList<>();

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
