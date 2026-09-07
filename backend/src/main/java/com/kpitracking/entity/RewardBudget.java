package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Hạn mức điểm mà một người được phép tự trao trong một khoảng thời gian.
 *
 * <p>CỐ Ý không có cột {@code usedPoints}. Hạn mức đã dùng được suy ra bằng tổng
 * {@code totalPoints} của các đề nghị đang PENDING_APPROVAL hoặc APPROVED trỏ về
 * ngân sách này. Một cột đếm sẽ phải hoàn lại ở ba đường (từ chối, huỷ, thu hồi);
 * mỗi đường là một chỗ có thể quên hoặc lệch, mà đã lệch thì không có cách nào biết.
 * Cách suy ra thì các trạng thái đó tự rơi khỏi tổng — không cần logic hoàn trả nào.
 *
 * <p>{@link #periodStart}/{@link #periodEnd} LUÔN có giá trị và là khoảng hiệu lực
 * duy nhất. {@link #kpiCycle} chỉ là nhãn liên kết cho người đọc dễ hiểu: khi tạo
 * ngân sách theo kỳ, service copy ngày của kỳ xuống hai cột này. Nhờ vậy tra cứu
 * chỉ cần so ngày, và một exclusion constraint ở tầng DB bảo đảm mỗi người tại một
 * thời điểm có tối đa MỘT ngân sách ⇒ không bao giờ phải đặt luật ưu tiên
 * "nhiều ngân sách cùng khớp thì lấy cái nào".
 *
 * <p>Đánh đổi: nếu ngày của kỳ đổi sau khi ngân sách đã cấp thì khoảng hiệu lực
 * không tự chạy theo — ngân sách đã cấp là một cam kết, không nên tự dịch chuyển.
 * Giao diện hiện cảnh báo lệch kèm nút đồng bộ lại.
 */
@Entity
@Table(name = "reward_budgets")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RewardBudget {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "grantor_user_id", nullable = false)
    private User grantor;

    /**
     * Chỉ là nhãn liên kết, KHÔNG tham gia tra cứu. Xem javadoc của class.
     * Ràng buộc ở DB: không được gắn đồng thời cả {@link #kpiCycle} và {@link #kpiPeriod} —
     * gắn cả hai thì không rõ nên đồng bộ ngày theo cái nào khi chúng lệch nhau.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_cycle_id")
    private KpiCycle kpiCycle;

    /** Nhãn liên kết khi hạn mức được cấp theo đợt thay vì theo kỳ. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_period_id")
    private KpiPeriod kpiPeriod;

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    @Column(name = "allocated_points", nullable = false)
    private Integer allocatedPoints;

    /** Trần cho MỖI người nhận trong một lần thưởng. Null = không giới hạn. */
    @Column(name = "max_per_award")
    private Integer maxPerAward;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
