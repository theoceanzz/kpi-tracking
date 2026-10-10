package com.kpitracking.repository;

import com.kpitracking.entity.DiscussionComment;
import com.kpitracking.enums.DiscussionTargetType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Bình luận thảo luận. Phân trang keyset theo {@code (created_at, id)} giảm dần — không OFFSET, không COUNT.
 * "Chưa có con trỏ" được thay bằng mốc rất xa trong tương lai ({@link #NO_CURSOR_AT}/{@link #NO_CURSOR_ID}) để
 * tránh tham số null không suy được kiểu trong câu SQL gốc.
 */
@Repository
public interface DiscussionCommentRepository extends JpaRepository<DiscussionComment, UUID> {

    Instant NO_CURSOR_AT = Instant.parse("9999-01-01T00:00:00Z");
    UUID NO_CURSOR_ID = new UUID(-1L, -1L);

    /** Bình luận gốc (và dòng hệ thống) cũ hơn con trỏ. Gốc đã xoá chỉ hiện khi còn trả lời. */
    @Query(value = "SELECT * FROM discussion_comments " +
            "WHERE target_type = :type AND target_id = :targetId AND parent_id IS NULL " +
            "  AND (deleted_at IS NULL OR reply_count > 0) " +
            "  AND (created_at, id) < (:cursorAt, :cursorId) " +
            "ORDER BY created_at DESC, id DESC LIMIT :lim", nativeQuery = true)
    List<DiscussionComment> findRootsBefore(@Param("type") String type, @Param("targetId") UUID targetId,
                                            @Param("cursorAt") Instant cursorAt, @Param("cursorId") UUID cursorId,
                                            @Param("lim") int limit);

    /** Bình luận gốc từ mốc {@code fromAt} trở về sau (mở thông báo → nạp đúng đoạn chứa bình luận đích). */
    @Query(value = "SELECT * FROM discussion_comments " +
            "WHERE target_type = :type AND target_id = :targetId AND parent_id IS NULL " +
            "  AND (deleted_at IS NULL OR reply_count > 0) " +
            "  AND (created_at, id) >= (:fromAt, :fromId) " +
            "ORDER BY created_at DESC, id DESC LIMIT :lim", nativeQuery = true)
    List<DiscussionComment> findRootsFrom(@Param("type") String type, @Param("targetId") UUID targetId,
                                          @Param("fromAt") Instant fromAt, @Param("fromId") UUID fromId,
                                          @Param("lim") int limit);

    /** {@code n} trả lời mới nhất (chưa xoá) của từng bình luận gốc. */
    @Query(value = "SELECT c.* FROM discussion_comments c WHERE c.id IN (" +
            "  SELECT x.id FROM (SELECT r.id, row_number() OVER (PARTITION BY r.parent_id ORDER BY r.created_at DESC, r.id DESC) AS rn " +
            "                      FROM discussion_comments r WHERE r.parent_id IN (:parentIds) AND r.deleted_at IS NULL) x " +
            "  WHERE x.rn <= :n)", nativeQuery = true)
    List<DiscussionComment> findLatestReplies(@Param("parentIds") Collection<UUID> parentIds, @Param("n") int n);

    @Query(value = "SELECT * FROM discussion_comments " +
            "WHERE parent_id = :parentId AND deleted_at IS NULL AND (created_at, id) < (:cursorAt, :cursorId) " +
            "ORDER BY created_at DESC, id DESC LIMIT :lim", nativeQuery = true)
    List<DiscussionComment> findRepliesBefore(@Param("parentId") UUID parentId, @Param("cursorAt") Instant cursorAt,
                                              @Param("cursorId") UUID cursorId, @Param("lim") int limit);

    @Modifying
    @Query("UPDATE DiscussionComment c SET c.replyCount = c.replyCount + :delta WHERE c.id = :id")
    void adjustReplyCount(@Param("id") UUID id, @Param("delta") int delta);

    /** Người đã từng bình luận trên đối tượng — được báo khi có bình luận mới (theo dõi cuộc trao đổi). */
    @Query("SELECT DISTINCT c.author.id FROM DiscussionComment c WHERE c.targetType = :type AND c.targetId = :targetId " +
           "AND c.author IS NOT NULL AND c.deletedAt IS NULL")
    List<UUID> findParticipantIds(@Param("type") DiscussionTargetType type, @Param("targetId") UUID targetId);

    /**
     * Số bình luận chưa đọc của {@code userId} trên từng đối tượng. Chỉ đếm bình luận người dùng của NGƯỜI KHÁC;
     * dòng hệ thống chỉ đếm khi được đánh dấu cho đúng người này (dòng "từ chối" → người tạo KPI).
     * Trả về [target_id, count].
     */
    @Query(value = "SELECT c.target_id, COUNT(*) FROM discussion_comments c " +
            "LEFT JOIN discussion_read_states rs ON rs.user_id = :userId AND rs.target_type = c.target_type AND rs.target_id = c.target_id " +
            "WHERE c.target_type = :type AND c.target_id IN (:targetIds) AND c.deleted_at IS NULL " +
            "  AND (rs.last_read_at IS NULL OR c.created_at > rs.last_read_at) " +
            "  AND ((c.kind = 'USER' AND c.author_id <> :userId) OR (c.kind = 'SYSTEM' AND c.notify_user_id = :userId)) " +
            "GROUP BY c.target_id", nativeQuery = true)
    List<Object[]> countUnread(@Param("userId") UUID userId, @Param("type") String type,
                               @Param("targetIds") Collection<UUID> targetIds);

    /** Tổng bình luận người dùng (chưa xoá) trên từng đối tượng. Trả về [target_id, count]. */
    @Query(value = "SELECT c.target_id, COUNT(*) FROM discussion_comments c " +
            "WHERE c.target_type = :type AND c.target_id IN (:targetIds) AND c.deleted_at IS NULL AND c.kind = 'USER' " +
            "GROUP BY c.target_id", nativeQuery = true)
    List<Object[]> countComments(@Param("type") String type, @Param("targetIds") Collection<UUID> targetIds);

    /** Bình luận của người khác trên đối tượng từ mốc {@code since} — số đếm của thông báo gộp. */
    @Query(value = "SELECT COUNT(*) FROM discussion_comments c WHERE c.target_type = :type AND c.target_id = :targetId " +
            "AND c.kind = 'USER' AND c.deleted_at IS NULL AND c.created_at >= :since AND c.author_id <> :userId", nativeQuery = true)
    long countFromOthersSince(@Param("type") String type, @Param("targetId") UUID targetId,
                              @Param("userId") UUID userId, @Param("since") Instant since);
}
