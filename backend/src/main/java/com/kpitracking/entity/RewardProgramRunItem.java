package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Một dòng trong bảng xếp hạng của lần chạy: ai, hạng mấy, được bao nhiêu điểm.
 */
@Entity
@Table(name = "reward_program_run_items")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RewardProgramRunItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "run_id", nullable = false)
    private RewardProgramRun run;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "org_unit_id")
    private OrgUnit orgUnit;

    /**
     * Hạng thi đấu: người đồng điểm dùng CHUNG một số. Đây là số dùng để tra bậc thưởng,
     * nên với {@code tiePolicy = SHARE_ALL} thì "Top 3" có thể trả cho 4 người.
     */
    @Column(name = "rank", nullable = false)
    private Integer rank;

    /**
     * Thứ tự tuyệt đối sau khi đã phá hoà. Giữ riêng khỏi {@link #rank} để lần chạy
     * tái lập được y hệt, và để {@code tiePolicy = STRICT} cắt đúng N người.
     */
    @Column(name = "order_index", nullable = false)
    private Integer orderIndex;

    @Column(name = "metric_value")
    private Double metricValue;

    @Column(name = "points", nullable = false)
    private Integer points;

    /** Giao dịch sổ cái sinh ra khi phát. Null khi lần chạy còn ở trạng thái xem trước. */
    @Column(name = "transaction_id")
    private UUID transactionId;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
