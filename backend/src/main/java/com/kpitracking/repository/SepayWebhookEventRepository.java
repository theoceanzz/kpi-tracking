package com.kpitracking.repository;

import com.kpitracking.entity.SepayWebhookEvent;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * MỌI truy vấn đọc ở đây đều lọc theo tổ chức. Không có bộ lọc đó thì chairman
 * của tổ chức này nhìn thấy — và xử lý được — giao dịch chuyển khoản của tổ chức
 * khác.
 *
 * <p>Điều kiện lọc là {@code organization.id = :orgId} và KHÔNG kèm nhánh
 * {@code OR organization IS NULL}. Sự kiện chưa quy được về tổ chức nào là tiền
 * về một tài khoản chưa ai khai — mà "chưa ai khai" thường có nghĩa là tổ chức
 * chủ tài khoản đã liên kết bên SePay nhưng chưa lưu số vào Cấu hình ví, chứ
 * không phải tiền vô chủ. Cho nhánh NULL hiện ra ở mọi tổ chức tức là để tổ chức
 * B đọc được nội dung, số tiền và tên người chuyển của tổ chức A chỉ vì A chưa
 * kịp cấu hình. Rò dữ liệu giữa các tổ chức nặng hơn hẳn cái được của việc phơi
 * sớm một sự kiện chưa phân loại.
 *
 * <p>Đổi lại, nhóm NULL không hiện ở đâu cho tới khi có tổ chức khai đúng số tài
 * khoản; lúc lưu cấu hình, {@link #attachOrganizationByAccount} gán ngược chúng
 * về tổ chức đó và chúng xuất hiện đầy đủ trong hàng đợi. Đó là đường ra DUY
 * NHẤT, nên đừng nới điều kiện lọc ở đây khi thấy hàng đợi trống.
 */
@Repository
public interface SepayWebhookEventRepository extends JpaRepository<SepayWebhookEvent, UUID> {

    boolean existsBySepayId(Long sepayId);

    /**
     * Khoá dòng sự kiện trước khi đóng nó. Tiền vốn đã an toàn nhờ khoá chống ghi
     * trùng ở sổ cái, nhưng hai người cùng bấm xử lý trước khi transaction đầu
     * commit sẽ cùng đọc được {@code resolvedAt IS NULL} và cùng ghi — người thua
     * cuộc ghi đè {@code resolvedBy}/{@code resolutionNote} của người thắng, tức
     * hỏng đúng thứ mà nhóm cột này sinh ra để giữ.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT e FROM SepayWebhookEvent e WHERE e.id = :id")
    Optional<SepayWebhookEvent> findByIdForUpdate(@Param("id") UUID id);

    /**
     * HÀNG ĐỢI ĐỐI SOÁT. Điều kiện phải khớp đúng
     * {@code idx_sepay_events_queue} và {@code SepayWebhookEvent.isInReconcileQueue()}.
     */
    @Query("""
            SELECT e FROM SepayWebhookEvent e
             WHERE e.organization.id = :orgId
               AND e.resolvedAt IS NULL
               AND (e.status = com.kpitracking.enums.SepayEventStatus.UNMATCHED
                    OR e.amountMismatch = TRUE)
             ORDER BY e.receivedAt DESC
            """)
    Page<SepayWebhookEvent> findReconcileQueue(@Param("orgId") UUID orgId, Pageable pageable);

    @Query("""
            SELECT e FROM SepayWebhookEvent e
             WHERE e.organization.id = :orgId
             ORDER BY e.receivedAt DESC
            """)
    Page<SepayWebhookEvent> findHistory(@Param("orgId") UUID orgId, Pageable pageable);

    @Query("""
            SELECT COUNT(e) FROM SepayWebhookEvent e
             WHERE e.organization.id = :orgId
               AND e.resolvedAt IS NULL
               AND e.status = com.kpitracking.enums.SepayEventStatus.UNMATCHED
            """)
    long countUnresolved(@Param("orgId") UUID orgId);

    @Query("""
            SELECT COUNT(e) FROM SepayWebhookEvent e
             WHERE e.organization.id = :orgId
               AND e.resolvedAt IS NULL AND e.amountMismatch = TRUE
            """)
    long countAmountMismatch(@Param("orgId") UUID orgId);

    /**
     * Lần cuối tổ chức này nhận được một webhook. Đây là bằng chứng DUY NHẤT trong
     * hệ thống cho việc "đã nối xong với SePay": KeyGo không gọi được API nào của
     * SePay để tự kiểm tra tài khoản đã liên kết bên đó hay chưa, nên chỉ có tiền
     * về thật mới chứng minh được cả chuỗi webhook → khoá API → số tài khoản đều
     * đúng.
     */
    @Query("""
            SELECT MAX(e.receivedAt) FROM SepayWebhookEvent e
             WHERE e.organization.id = :orgId
            """)
    Instant findLastReceivedAt(@Param("orgId") UUID orgId);

    /**
     * Gán tổ chức cho những sự kiện cũ về đúng số tài khoản vừa được khai báo.
     *
     * <p>Chạy ngay sau khi lưu cấu hình ví. Không có bước này thì mọi giao dịch về
     * TRƯỚC lúc cấu hình sẽ nằm mãi ở trạng thái chưa xác định tổ chức và không ai
     * ghi có cho người chuyển được — đúng nhóm giao dịch dễ gặp nhất khi mới dựng
     * hệ thống. So sánh khớp đúng {@code SepayAccountMatch.normalize}.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE sepay_webhook_events
               SET organization_id = :orgId
             WHERE organization_id IS NULL
               AND :account IN (
                    regexp_replace(UPPER(COALESCE(account_number, '')), '[^A-Z0-9]', '', 'g'),
                    regexp_replace(UPPER(COALESCE(sub_account, '')),    '[^A-Z0-9]', '', 'g')
               )
            """, nativeQuery = true)
    int attachOrganizationByAccount(@Param("orgId") UUID orgId, @Param("account") String normalizedAccount);
}
