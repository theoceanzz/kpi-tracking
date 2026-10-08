package com.kpitracking.repository;

import com.kpitracking.entity.AiSubmissionReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface AiSubmissionReviewRepository extends JpaRepository<AiSubmissionReview, UUID> {

    /** Lượt mới nhất cho một nhân viên trong một đợt. */
    Optional<AiSubmissionReview> findFirstByKpiPeriodIdAndUserIdOrderByCreatedAtDesc(UUID kpiPeriodId, UUID userId);

    /** Mọi lượt của một nhân viên trong một đợt, mới nhất trước — để gộp kết quả hiện hành từng chỉ tiêu. */
    java.util.List<AiSubmissionReview> findByKpiPeriodIdAndUserIdOrderByCreatedAtDesc(UUID kpiPeriodId, UUID userId);

    /** Các lượt đã xong của một đợt trong tổ chức, mới nhất trước — cho báo cáo lệch AI – quản lý. */
    java.util.List<AiSubmissionReview> findByOrganizationIdAndKpiPeriodIdAndStatusOrderByCreatedAtDesc(
            UUID organizationId, UUID kpiPeriodId, com.kpitracking.enums.AiReviewStatus status);

    /** Bỏ liên kết tới một bộ tiêu chí sắp xoá — lượt vẫn giữ {@code criteria_set_version}. */
    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE AiSubmissionReview r SET r.criteriaSetId = NULL WHERE r.criteriaSetId = :setId")
    int detachCriteriaSet(@Param("setId") UUID setId);

    /** Lọc theo tổ chức ngay trong truy vấn — id của tổ chức khác coi như không tồn tại. */
    Optional<AiSubmissionReview> findByIdAndOrganizationId(UUID id, UUID organizationId);

    /**
     * Số bài nộp của người đó cho MỘT chỉ tiêu được tạo / sửa SAU mốc {@code since} — khác 0 thì kết quả AI cũ của chỉ
     * tiêu đã lỗi thời và phải chấm lại. (Bài bị xoá mềm không đếm được: {@code KpiSubmission} có
     * {@code @SQLRestriction} lọc chúng khỏi mọi truy vấn — quản lý bấm "Chấm lại bài này" nếu cần.)
     */
    @Query("SELECT COUNT(s) FROM KpiSubmission s WHERE s.submittedBy.id = :userId "
            + "AND s.kpiCriteria.id = :criteriaId "
            + "AND (s.createdAt > :since OR s.updatedAt > :since)")
    long countCriterionSubmissionsChangedSince(@Param("userId") UUID userId, @Param("criteriaId") UUID criteriaId,
                                               @Param("since") Instant since);
}
