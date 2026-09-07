package com.kpitracking.repository;

import com.kpitracking.entity.CashWallet;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CashWalletRepository extends JpaRepository<CashWallet, UUID> {

    Optional<CashWallet> findByOrganizationIdAndUserId(UUID organizationId, UUID userId);

    /**
     * Nạp ví kèm KHOÁ BI QUAN dòng — cơ chế chính chống đua ghi, không phải cột
     * {@code version}. Khoá lạc quan trên một dòng chắc chắn bị tranh chấp chỉ
     * đẩy mọi caller vào vòng retry.
     *
     * <p>CHỈ {@code CashWalletService.applyTransaction} được gọi hàm này.
     *
     * <p><b>Bất biến thứ tự khoá:</b> luồng nào chạm cả ví tiền lẫn ví điểm thì
     * khoá ví tiền TRƯỚC. Đảo thứ tự ở một luồng mới sẽ ôm chéo khoá với luồng
     * quy đổi và treo cả hai tới timeout.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT w FROM CashWallet w WHERE w.id = :id")
    Optional<CashWallet> findByIdForUpdate(@Param("id") UUID id);

    /**
     * @param unitPath lọc theo đơn vị bằng TIỀN TỐ của {@code path}, nên tự bao
     *                 trọn cả cây con. Truyền id đơn vị rồi so bằng {@code =} sẽ
     *                 bỏ sót nhân sự thuộc các đơn vị con — đúng cái bẫy mà
     *                 {@code EmployeePicker} phải né bằng cách tự gom id cây con
     *                 ở phía giao diện. Làm ở đây thì phía gọi chỉ cần gửi một id.
     */
    @Query("""
            SELECT w FROM CashWallet w
             WHERE w.organization.id = :orgId
               AND (CAST(:keyword AS string) IS NULL
                    OR LOWER(CAST(w.user.fullName AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%'))
                    OR LOWER(CAST(w.user.email AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')))
               AND (CAST(:unitPath AS string) IS NULL OR EXISTS (
                        SELECT 1 FROM UserRoleOrgUnit uro
                         WHERE uro.user.id = w.user.id
                           AND uro.orgUnit.path LIKE CONCAT(CAST(:unitPath AS string), '%')))
            """)
    Page<CashWallet> searchByOrg(@Param("orgId") UUID orgId,
                                 @Param("keyword") String keyword,
                                 @Param("unitPath") String unitPath,
                                 Pageable pageable);

    Page<CashWallet> findByIdIn(List<UUID> ids, Pageable pageable);

    /**
     * Đối soát: các ví có số dư lệch so với tổng sổ cái. Phải luôn rỗng — đây là
     * phép kiểm giá trị nhất với dữ liệu kiểu tiền tệ.
     *
     * <p>Có lọc theo tổ chức chứ không quét toàn hệ thống: kết quả được trả thẳng
     * ra endpoint đối soát của từng tổ chức, nên bản toàn cục sẽ để quản trị công
     * ty này nhìn thấy id ví của công ty khác.
     */
    @Query(value = """
            SELECT w.id
              FROM cash_wallets w
              LEFT JOIN cash_transactions t ON t.wallet_id = w.id
             WHERE w.deleted_at IS NULL
               AND w.organization_id = :orgId
             GROUP BY w.id, w.balance, w.lifetime_topup, w.lifetime_converted
            HAVING w.balance <> COALESCE(SUM(t.amount), 0)
                OR w.balance <> w.lifetime_topup - w.lifetime_converted
            """, nativeQuery = true)
    List<UUID> findInconsistentWalletIds(@Param("orgId") UUID orgId);

    /** Tổng hợp toàn tổ chức. Dùng cho dòng chỉ số ở đầu màn hình ví nhân sự. */
    @Query("""
            SELECT COUNT(w)                              AS walletCount,
                   COALESCE(SUM(w.balance), 0)           AS totalBalance,
                   COALESCE(SUM(w.lifetimeTopup), 0)     AS totalTopup,
                   COALESCE(SUM(w.lifetimeConverted), 0) AS totalConverted
              FROM CashWallet w
             WHERE w.organization.id = :orgId
            """)
    WalletTotals sumByOrg(@Param("orgId") UUID orgId);

    interface WalletTotals {
        long getWalletCount();
        long getTotalBalance();
        long getTotalTopup();
        long getTotalConverted();
    }
}
