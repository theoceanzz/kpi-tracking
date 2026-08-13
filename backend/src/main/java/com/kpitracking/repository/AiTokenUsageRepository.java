package com.kpitracking.repository;

import com.kpitracking.entity.AiTokenUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface AiTokenUsageRepository extends JpaRepository<AiTokenUsage, UUID> {

    /** Tổng token một người đã tiêu trong tháng. COALESCE để tháng chưa dùng gì trả 0 thay vì null. */
    @Query("SELECT COALESCE(SUM(u.totalTokens), 0) FROM AiTokenUsage u " +
           "WHERE u.userId = :userId AND u.periodMonth = :periodMonth")
    long sumTotalTokensByUser(@Param("userId") UUID userId, @Param("periodMonth") LocalDate periodMonth);

    /** Tiêu thụ của nhiều người trong tháng — dùng cho bảng phân bổ, tránh N+1. */
    @Query("SELECT u.userId, COALESCE(SUM(u.totalTokens), 0) FROM AiTokenUsage u " +
           "WHERE u.periodMonth = :periodMonth AND u.userId IN :userIds GROUP BY u.userId")
    List<Object[]> sumTotalTokensByUsers(@Param("userIds") List<UUID> userIds,
                                         @Param("periodMonth") LocalDate periodMonth);

    /** Tiêu thụ theo từng công ty trong tháng — cho thống kê của quản trị nền tảng. */
    @Query("SELECT u.organizationId, COALESCE(SUM(u.totalTokens), 0), COUNT(u) FROM AiTokenUsage u " +
           "WHERE u.periodMonth = :periodMonth GROUP BY u.organizationId")
    List<Object[]> sumTotalTokensByOrganization(@Param("periodMonth") LocalDate periodMonth);
}
