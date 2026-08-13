package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Sổ cái tiêu thụ token AI — chỉ ghi thêm, mỗi lượt gọi LLM một dòng.
 *
 * <p>Không gắn vào bảng {@code messages} vì {@code DatabaseChatMemoryRepository} xoá sạch rồi
 * chèn lại toàn bộ tin nhắn mỗi lượt, và hai luồng suggest-kpi / followups không có hội thoại.
 */
@Entity
@Table(name = "ai_token_usage")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AiTokenUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "feature", nullable = false, length = 40)
    private AiFeature feature;

    @Column(name = "model", length = 100)
    private String model;

    @Column(name = "prompt_tokens", nullable = false)
    @Builder.Default
    private Integer promptTokens = 0;

    @Column(name = "completion_tokens", nullable = false)
    @Builder.Default
    private Integer completionTokens = 0;

    @Column(name = "total_tokens", nullable = false)
    @Builder.Default
    private Integer totalTokens = 0;

    /** Ngày 1 của tháng — cho phép cộng theo tháng bằng so sánh bằng có index. */
    @Column(name = "period_month", nullable = false)
    private LocalDate periodMonth;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    public enum AiFeature {
        CHAT,
        KPI_SUGGESTION,
        FOLLOWUP
    }

    /** Ngày 1 của tháng hiện tại — khoá gộp dùng chung cho cả ghi lẫn đọc. */
    public static LocalDate currentPeriod() {
        return LocalDate.now().withDayOfMonth(1);
    }
}
