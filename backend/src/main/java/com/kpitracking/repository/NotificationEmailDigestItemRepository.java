package com.kpitracking.repository;

import com.kpitracking.entity.NotificationEmailDigestItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface NotificationEmailDigestItemRepository extends JpaRepository<NotificationEmailDigestItem, UUID> {

    /**
     * Những người nhận đã "chín" để gửi thư gộp:
     * <ul>
     *   <li>mục mới nhất của họ đã cũ hơn {@code quietBefore} — luồng sự kiện đã lắng xuống,
     *       gửi lúc này là gom được trọn vẹn cả đợt; hoặc</li>
     *   <li>mục cũ nhất đã cũ hơn {@code maxAgeBefore} — sự kiện cứ dồn về liên tục thì
     *       không được chờ mãi, phải chốt gửi.</li>
     * </ul>
     */
    @Query("SELECT i.userId FROM NotificationEmailDigestItem i WHERE i.sentAt IS NULL " +
           "GROUP BY i.userId " +
           "HAVING MAX(i.createdAt) <= :quietBefore OR MIN(i.createdAt) <= :maxAgeBefore")
    List<UUID> findRecipientsReadyToSend(@Param("quietBefore") Instant quietBefore,
                                         @Param("maxAgeBefore") Instant maxAgeBefore);

    @Query("SELECT i FROM NotificationEmailDigestItem i WHERE i.sentAt IS NULL AND i.userId = :userId " +
           "ORDER BY i.createdAt ASC")
    List<NotificationEmailDigestItem> findPendingByUser(@Param("userId") UUID userId);

    @Modifying
    @Query("UPDATE NotificationEmailDigestItem i SET i.sentAt = :sentAt WHERE i.id IN :ids AND i.sentAt IS NULL")
    int markSent(@Param("ids") List<UUID> ids, @Param("sentAt") Instant sentAt);

    /** Dọn lịch sử đã gửi. */
    @Modifying
    @Query("DELETE FROM NotificationEmailDigestItem i WHERE i.sentAt IS NOT NULL AND i.sentAt < :before")
    int deleteSentBefore(@Param("before") Instant before);
}
