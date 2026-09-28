package com.kpitracking.repository;

import com.kpitracking.entity.F360Assignment;
import com.kpitracking.enums.F360AssignmentStatus;
import com.kpitracking.enums.F360CampaignStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface F360AssignmentRepository extends JpaRepository<F360Assignment, UUID> {

    @Query("SELECT a FROM F360Assignment a JOIN FETCH a.rater JOIN FETCH a.subject s " +
           "WHERE s.campaign.id = :campaignId AND s.deletedAt IS NULL")
    List<F360Assignment> findByCampaignId(@Param("campaignId") UUID campaignId);

    @Query("SELECT a FROM F360Assignment a JOIN FETCH a.rater WHERE a.subject.id = :subjectId")
    List<F360Assignment> findBySubjectId(@Param("subjectId") UUID subjectId);

    Optional<F360Assignment> findBySubjectIdAndRaterId(UUID subjectId, UUID raterId);

    /**
     * Làm mờ dấu thời gian của phiếu ẩn danh đã nộp (§6.3 bước 3) — native để auditing không ghi
     * đè. Giữ {@code rater_id} + {@code status} (tỷ lệ phản hồi, người chấm biết mình đã nộp).
     */
    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(nativeQuery = true, value =
            "UPDATE f360_assignments s SET submitted_at = :day, started_at = :day, updated_at = :closedAt, " +
            "last_reminded_at = NULL " +
            "FROM f360_subjects sub WHERE sub.id = s.subject_id AND sub.campaign_id = :campaignId " +
            "AND s.status = 'SUBMITTED' AND s.relationship IN (:relationships)")
    int blurSubmittedTimestamps(@Param("campaignId") UUID campaignId,
                                @Param("day") java.time.Instant day,
                                @Param("closedAt") java.time.Instant closedAt,
                                @Param("relationships") Collection<String> relationships);

    /** Hộp việc của một người chấm: phiếu ở các chiến dịch đang có trạng thái cho trước. */
    @Query("SELECT a FROM F360Assignment a JOIN FETCH a.subject s JOIN FETCH s.user JOIN FETCH s.campaign c " +
           "WHERE a.rater.id = :raterId AND c.status IN :campaignStatuses AND a.status IN :statuses " +
           "AND s.deletedAt IS NULL AND c.deletedAt IS NULL")
    List<F360Assignment> findRaterTasks(@Param("raterId") UUID raterId,
                                        @Param("campaignStatuses") Collection<F360CampaignStatus> campaignStatuses,
                                        @Param("statuses") Collection<F360AssignmentStatus> statuses);
}
