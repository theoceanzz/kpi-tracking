package com.kpitracking.repository;

import com.kpitracking.entity.RewardCheckin;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RewardCheckinRepository extends JpaRepository<RewardCheckin, UUID> {

    Optional<RewardCheckin> findByOrganizationIdAndUserIdAndCheckinDate(UUID organizationId,
                                                                       UUID userId,
                                                                       LocalDate checkinDate);

    /**
     * Lần điểm danh gần nhất TRƯỚC một ngày — nguồn duy nhất để tính chuỗi hiện tại.
     *
     * <p>Loại bỏ chính ngày đang xét thay vì lấy "gần nhất" nói chung: khi đã điểm danh
     * hôm nay rồi, dòng của hôm nay mới là cái phải đọc, còn lúc tính chuỗi cho hôm nay
     * thì phải nhìn dòng liền trước. Hai câu hỏi khác nhau nên tách hẳn ra.
     */
    Optional<RewardCheckin> findFirstByOrganizationIdAndUserIdAndCheckinDateLessThanOrderByCheckinDateDesc(
            UUID organizationId, UUID userId, LocalDate checkinDate);

    @Query("""
            SELECT c FROM RewardCheckin c
             WHERE c.organization.id = :orgId
               AND c.user.id = :userId
               AND c.checkinDate BETWEEN :from AND :to
             ORDER BY c.checkinDate
            """)
    List<RewardCheckin> findInRange(@Param("orgId") UUID orgId,
                                    @Param("userId") UUID userId,
                                    @Param("from") LocalDate from,
                                    @Param("to") LocalDate to);

    Page<RewardCheckin> findByOrganizationIdAndUserIdOrderByCheckinDateDesc(UUID organizationId,
                                                                           UUID userId,
                                                                           Pageable pageable);

    /** Bao nhiêu người đã điểm danh trong một ngày — số liệu cho màn hình quản trị. */
    long countByOrganizationIdAndCheckinDate(UUID organizationId, LocalDate checkinDate);

    @Query("""
            SELECT COALESCE(SUM(c.totalPoints), 0) FROM RewardCheckin c
             WHERE c.organization.id = :orgId
               AND c.checkinDate BETWEEN :from AND :to
            """)
    int sumPointsInRange(@Param("orgId") UUID orgId,
                         @Param("from") LocalDate from,
                         @Param("to") LocalDate to);

    @Query("""
            SELECT COALESCE(SUM(c.totalPoints), 0) FROM RewardCheckin c
             WHERE c.organization.id = :orgId
               AND c.user.id = :userId
               AND c.checkinDate BETWEEN :from AND :to
            """)
    int sumPointsForUserInRange(@Param("orgId") UUID orgId,
                                @Param("userId") UUID userId,
                                @Param("from") LocalDate from,
                                @Param("to") LocalDate to);
}
