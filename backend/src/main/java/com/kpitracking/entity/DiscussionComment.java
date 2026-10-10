package com.kpitracking.entity;

import com.kpitracking.enums.DiscussionCommentKind;
import com.kpitracking.enums.DiscussionTargetType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Một bình luận (hoặc dòng hệ thống) trong khung thảo luận của một KPI / công việc.
 * Trả lời chỉ lồng một cấp: {@link #parentId} luôn trỏ tới bình luận gốc. Xem V37__kpi_discussion_tasks.sql.
 *
 * <p>Không gắn {@code @SQLRestriction("deleted_at IS NULL")}: bình luận đã xoá mà còn trả lời vẫn phải đọc ra
 * để hiện "Bình luận đã bị xoá"; các truy vấn tự lọc khi cần.
 */
@Entity
@Table(name = "discussion_comments")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DiscussionComment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 20)
    private DiscussionTargetType targetType;

    @Column(name = "target_id", nullable = false)
    private UUID targetId;

    @Column(name = "parent_id")
    private UUID parentId;

    /** Null với dòng hệ thống. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id")
    private User author;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, length = 10)
    @Builder.Default
    private DiscussionCommentKind kind = DiscussionCommentKind.USER;

    @Column(name = "body", columnDefinition = "TEXT")
    private String body;

    /** Chữ của dòng hệ thống ({@code LocalizedText} JSON), dịch lúc đọc. */
    @Column(name = "system_i18n", columnDefinition = "TEXT")
    private String systemI18n;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "system_meta", columnDefinition = "jsonb")
    private Map<String, Object> systemMeta;

    /** Dòng hệ thống chỉ tính vào số chưa đọc của đúng người này (vd. dòng "từ chối" → người tạo KPI). */
    @Column(name = "notify_user_id")
    private UUID notifyUserId;

    @Column(name = "reply_count", nullable = false)
    @Builder.Default
    private Integer replyCount = 0;

    @Column(name = "edited_at")
    private Instant editedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "deleted_by")
    private UUID deletedBy;

    public boolean isDeleted() {
        return deletedAt != null;
    }

    public boolean isSystem() {
        return kind == DiscussionCommentKind.SYSTEM;
    }
}
