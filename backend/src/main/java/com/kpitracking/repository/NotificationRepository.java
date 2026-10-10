package com.kpitracking.repository;

import com.kpitracking.entity.Notification;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    /**
     * Trang đầu (keyset): mới nhất trước, id làm tie-breaker để thứ tự ổn định khi trùng
     * created_at. Dùng index idx_notifications_user_created (user_id, created_at DESC, id DESC).
     * Không dùng Page<> để tránh câu COUNT(*) toàn bộ thông báo của user mỗi lần gọi.
     */
    List<Notification> findByUserIdOrderByCreatedAtDescIdDesc(UUID userId, Pageable pageable);

    /**
     * Trang kế tiếp (keyset): các dòng "cũ hơn" con trỏ (created_at, id). Native để dùng phép so
     * sánh bộ (row comparison) — Postgres biến nó thành điều kiện range trên index, nhảy thẳng tới
     * vị trí con trỏ thay vì quét rồi lọc như dạng OR trong JPQL.
     */
    @org.springframework.data.jpa.repository.Query(value = """
            SELECT * FROM notifications n
             WHERE n.user_id = :userId
               AND (n.created_at, n.id) < (CAST(:createdAt AS timestamptz), CAST(:id AS uuid))
             ORDER BY n.created_at DESC, n.id DESC
             LIMIT :limit
            """, nativeQuery = true)
    List<Notification> findPageBefore(@Param("userId") UUID userId,
                                      @Param("createdAt") java.time.Instant createdAt,
                                      @Param("id") UUID id,
                                      @Param("limit") int limit);

    long countByUserIdAndIsReadFalse(UUID userId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("UPDATE Notification n SET n.isRead = true, n.readAt = :readAt WHERE n.user.id = :userId AND n.isRead = false")
    void markAllAsReadForUser(UUID userId, java.time.Instant readAt);

    @Deprecated
    long countByIsReadTrue();

    @Deprecated
    long countByIsReadFalse();
    /**
     * Thông báo "bình luận mới" CHƯA ĐỌC gần nhất của người này trên cùng một đối tượng thảo luận, tạo sau
     * {@code since} — để gộp nhiều bình luận liên tiếp vào một thông báo thay vì rải chuông. reference_id của
     * thông báo bình luận là id bình luận, nên phải nối sang discussion_comments để biết đối tượng.
     */
    @org.springframework.data.jpa.repository.Query(value = """
            SELECT n.* FROM notifications n
              JOIN discussion_comments c ON c.id = n.reference_id
             WHERE n.user_id = :userId AND n.type = :type AND n.is_read = false AND n.created_at >= :since
               AND c.target_type = :targetType AND c.target_id = :targetId
             ORDER BY n.created_at DESC LIMIT 1
            """, nativeQuery = true)
    java.util.Optional<Notification> findGroupableDiscussion(@Param("userId") UUID userId, @Param("type") String type,
                                                             @Param("targetType") String targetType,
                                                             @Param("targetId") UUID targetId,
                                                             @Param("since") java.time.Instant since);
    /** Thông báo chưa đọc gần nhất cùng loại và cùng đối tượng, tạo sau {@code since} — để gộp thay đổi liên tiếp. */
    @org.springframework.data.jpa.repository.Query(value = """
            SELECT * FROM notifications
             WHERE user_id = :userId AND type = :type AND reference_id = :referenceId AND is_read = false AND created_at >= :since
             ORDER BY created_at DESC LIMIT 1
            """, nativeQuery = true)
    java.util.Optional<Notification> findRecentUnread(@Param("userId") UUID userId, @Param("type") String type,
                                                      @Param("referenceId") UUID referenceId,
                                                      @Param("since") java.time.Instant since);
}
