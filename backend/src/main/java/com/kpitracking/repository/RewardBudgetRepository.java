package com.kpitracking.repository;

import com.kpitracking.entity.RewardBudget;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RewardBudgetRepository extends JpaRepository<RewardBudget, UUID> {

    /**
     * Ngân sách đang hiệu lực của một người, kèm KHOÁ BI QUAN.
     *
     * <p>Đây là điểm tuần tự hoá đóng race condition khi tạo đề nghị thưởng: hai
     * request đồng thời (hoặc một cú double-click) đều phải xếp hàng ở đây, nên
     * request thứ hai luôn nhìn thấy đề nghị mà request thứ nhất vừa ghi khi tính
     * hạn mức đã dùng.
     *
     * <p>Trả về TỐI ĐA MỘT dòng — exclusion constraint {@code ex_reward_budgets_no_overlap}
     * ở tầng DB cấm hai ngân sách chồng lấn ngày cho cùng một người. Nhờ vậy không
     * bao giờ phải đặt luật ưu tiên "nhiều ngân sách cùng khớp thì lấy cái nào".
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT b FROM RewardBudget b
             WHERE b.organization.id = :orgId
               AND b.grantor.id = :grantorId
               AND :today BETWEEN b.periodStart AND b.periodEnd
            """)
    Optional<RewardBudget> findActiveForUpdate(@Param("orgId") UUID orgId,
                                               @Param("grantorId") UUID grantorId,
                                               @Param("today") LocalDate today);

    /** Bản không khoá, dùng cho màn hình đọc ("hạn mức còn lại của tôi"). */
    @Query("""
            SELECT b FROM RewardBudget b
             WHERE b.organization.id = :orgId
               AND b.grantor.id = :grantorId
               AND :today BETWEEN b.periodStart AND b.periodEnd
            """)
    Optional<RewardBudget> findActive(@Param("orgId") UUID orgId,
                                      @Param("grantorId") UUID grantorId,
                                      @Param("today") LocalDate today);

    List<RewardBudget> findByOrganizationIdOrderByPeriodStartDesc(UUID organizationId);

    List<RewardBudget> findByOrganizationIdAndGrantorIdOrderByPeriodStartDesc(UUID organizationId, UUID grantorId);
}
