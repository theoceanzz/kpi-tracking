package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Dấu vết đã nhắc hạn đánh giá một đợt/kỳ cho một người ở một đơn vị.
 *
 * <p>Lượt quét chạy mỗi giờ và tính lại từ đầu, nên không có bảng này thì mỗi giờ người
 * nhận lại một lá thư y hệt — đúng lỗi mà {@link KpiReminder} đã sinh ra để tránh ở phía
 * nhắc nộp báo cáo.
 */
@Entity
@Table(name = "evaluation_reminders")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class EvaluationReminder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** PERIOD (đợt) hoặc CYCLE (kỳ). */
    @Column(name = "scope", nullable = false, length = 16)
    private String scope;

    /** Id của đợt hoặc kỳ — trỏ sang hai bảng khác nhau tuỳ scope nên không đặt khoá ngoại. */
    @Column(name = "target_id", nullable = false)
    private UUID targetId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "org_unit_id", nullable = false)
    private OrgUnit orgUnit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** BEFORE_DUE (sắp đóng) hoặc OVERDUE (quá hạn mà chưa xong). */
    @Column(name = "milestone", nullable = false, length = 16)
    private String milestone;

    /** Còn bao nhiêu người/đơn vị chưa xong lúc gửi — để đối chiếu khi cần truy vết. */
    @Column(name = "pending_count")
    private Integer pendingCount;

    @Column(name = "sent_at", nullable = false)
    @Builder.Default
    private Instant sentAt = Instant.now();
}
