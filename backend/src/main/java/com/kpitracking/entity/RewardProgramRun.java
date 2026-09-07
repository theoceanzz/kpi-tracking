package com.kpitracking.entity;

import com.kpitracking.enums.RewardRunStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Một lần áp chương trình thưởng lên một đợt hoặc một kỳ cụ thể.
 *
 * <p>Luôn hai bước: xem trước (PREVIEW) rồi mới phát (ISSUED). Quản trị viên phải
 * nhìn thấy chính xác ai được bao nhiêu điểm trước khi điểm vào ví thật.
 *
 * <p>Ba lớp chống phát trùng:
 * <ol>
 *   <li>Unique index một phần trên {@code (program_id, kpi_cycle_id) WHERE status='ISSUED'} —
 *       lớp duy nhất sống sót trước hai cú bấm đồng thời.</li>
 *   <li>Kiểm trạng thái ở tầng service, để báo lỗi cho đẹp.</li>
 *   <li>{@link #snapshotHash} — lúc phát, service tính lại bảng xếp hạng và so hash.
 *       Lệch nghĩa là dữ liệu nguồn đã đổi từ lúc xem trước ⇒ từ chối phát. Đây là
 *       thứ khiến câu "tôi đã duyệt đúng danh sách đó" là sự thật chứ không phải niềm tin.</li>
 * </ol>
 */
@Entity
@Table(name = "reward_program_runs")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RewardProgramRun {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "program_id", nullable = false)
    private RewardProgram program;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    /** Đúng một trong hai cột đợt/kỳ có giá trị — ràng buộc CHECK ở DB bảo đảm điều này. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_period_id")
    private KpiPeriod kpiPeriod;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_cycle_id")
    private KpiCycle kpiCycle;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private RewardRunStatus status = RewardRunStatus.PREVIEW;

    @Column(name = "total_points", nullable = false)
    @Builder.Default
    private Integer totalPoints = 0;

    @Column(name = "recipient_count", nullable = false)
    @Builder.Default
    private Integer recipientCount = 0;

    /** sha256 của danh sách {@code (userId:points)} đã sắp xếp. Xem javadoc của class. */
    @Column(name = "snapshot_hash", length = 64)
    private String snapshotHash;

    /**
     * Bậc thưởng THỰC SỰ dùng cho lần chạy này, chụp lại lúc xem trước.
     *
     * <p>Mặc định lấy từ chương trình nhưng người quản trị sửa được cho riêng lần chạy —
     * ví dụ thưởng cuối năm hậu hĩnh hơn các quý khác. Chụp lại là bắt buộc: nếu đọc
     * bậc từ chương trình lúc xem lại lịch sử thì một lần sửa cấu hình sẽ làm sai toàn
     * bộ các lần phát trước đó.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tiers", columnDefinition = "jsonb")
    private String tiers;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "executed_by")
    private User executedBy;

    @Column(name = "executed_at")
    private Instant executedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reverted_by")
    private User revertedBy;

    @Column(name = "reverted_at")
    private Instant revertedAt;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    @OneToMany(mappedBy = "run", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<RewardProgramRunItem> items = new ArrayList<>();

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;
}
