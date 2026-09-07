package com.kpitracking.repository;

import com.kpitracking.entity.RewardGiftItem;
import com.kpitracking.enums.GiftItemStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RewardGiftItemRepository extends JpaRepository<RewardGiftItem, UUID> {

    List<RewardGiftItem> findByOrganizationIdOrderByDisplayOrderAscNameAsc(UUID organizationId);

    List<RewardGiftItem> findByOrganizationIdAndStatusOrderByDisplayOrderAscNameAsc(
            UUID organizationId, GiftItemStatus status);

    /** Quà đã nhập từ một nhà cung cấp ngoài — dùng để đánh dấu "đã nhập" khi duyệt kho. */
    List<RewardGiftItem> findByOrganizationIdAndExternalProvider(
            UUID organizationId, String externalProvider);

    /**
     * Chặn nhập trùng ở tầng nghiệp vụ để báo lỗi cho người dùng bằng tiếng người.
     * Ràng buộc thật nằm ở partial unique index {@code uq_reward_gift_items_external} —
     * kiểm tra ở đây không thay thế được nó khi hai người bấm nhập cùng lúc.
     */
    boolean existsByOrganizationIdAndExternalProviderAndExternalSku(
            UUID organizationId, String externalProvider, String externalSku);

    /**
     * Giữ tồn kho theo kiểu KIỂM-VÀ-TRỪ TRONG MỘT CÂU LỆNH.
     *
     * <p>Tuyệt đối không đọc tồn kho lên Java rồi trừ rồi lưu: hai người đổi món cuối
     * cùng cùng lúc sẽ cùng đọc thấy "còn 1" và cùng thành công. Điều kiện
     * {@code stock_quantity >= :qty} nằm ngay trong mệnh đề WHERE nên PostgreSQL
     * bảo đảm chỉ một trong hai câu UPDATE khớp dòng.
     *
     * @return số dòng bị ảnh hưởng — 0 nghĩa là hết hàng hoặc quà đã bị tắt/xoá,
     *         service phải ném lỗi "Quà đã hết hàng" khi gặp 0.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE reward_gift_items
               SET stock_quantity = stock_quantity - :qty,
                   updated_at = NOW()
             WHERE id = :id
               AND deleted_at IS NULL
               AND status = 'ACTIVE'
               AND (unlimited_stock = TRUE OR stock_quantity >= :qty)
            """, nativeQuery = true)
    int tryReserveStock(@Param("id") UUID id, @Param("qty") int qty);

    /**
     * Trả tồn kho khi yêu cầu đổi bị từ chối hoặc bị huỷ.
     *
     * <p>Cố ý KHÔNG kiểm tra {@code status = 'ACTIVE'}: quà có thể đã bị tắt trong lúc
     * yêu cầu còn treo, nhưng số tồn vẫn phải được trả về đúng.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE reward_gift_items
               SET stock_quantity = stock_quantity + :qty,
                   updated_at = NOW()
             WHERE id = :id
               AND deleted_at IS NULL
               AND unlimited_stock = FALSE
            """, nativeQuery = true)
    int restoreStock(@Param("id") UUID id, @Param("qty") int qty);
}
