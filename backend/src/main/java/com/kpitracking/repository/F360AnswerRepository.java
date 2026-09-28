package com.kpitracking.repository;

import com.kpitracking.entity.F360Answer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface F360AnswerRepository extends JpaRepository<F360Answer, UUID> {

    @Query("SELECT a FROM F360Answer a JOIN FETCH a.question WHERE a.assignment.id = :assignmentId")
    List<F360Answer> findByAssignmentId(@Param("assignmentId") UUID assignmentId);

    /**
     * Câu trả lời của các người được đánh giá, CHỈ từ phiếu đã nộp — hoặc đã tách liên kết
     * (assignment null), vốn chỉ xảy ra với phiếu đã nộp. Nháp không bao giờ vào điểm.
     */
    @Query("SELECT a FROM F360Answer a JOIN FETCH a.question LEFT JOIN a.assignment asg " +
           "WHERE a.subject.id IN :subjectIds " +
           "AND (asg IS NULL OR asg.status = com.kpitracking.enums.F360AssignmentStatus.SUBMITTED)")
    List<F360Answer> findSubmittedBySubjectIds(@Param("subjectIds") Collection<UUID> subjectIds);

    @Modifying
    @Query("DELETE FROM F360Answer a WHERE a.assignment.id = :assignmentId")
    void deleteByAssignmentId(@Param("assignmentId") UUID assignmentId);

    @Query("SELECT COUNT(a) > 0 FROM F360Answer a WHERE a.assignment.id = :assignmentId")
    boolean existsByAssignmentId(@Param("assignmentId") UUID assignmentId);

    /**
     * Tách liên kết người chấm ↔ câu trả lời (§6.3 bước 2). NATIVE SQL có chủ đích: sửa qua entity
     * thì {@code @LastModifiedDate} ghi lại {@code updated_at = now()} đúng lúc tách, và join theo
     * thời gian với {@code f360_assignments.submitted_at} lại ra người chấm.
     *
     * Idempotent nhờ chính điều kiện {@code assignment_id IS NOT NULL}: lần chạy sau chỉ gặp câu
     * trả lời mới (vd phiếu nộp sau khi mở lại chiến dịch).
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(nativeQuery = true, value =
            "UPDATE f360_answers a SET assignment_id = NULL, created_at = :closedAt, updated_at = NULL " +
            "FROM f360_assignments s JOIN f360_subjects sub ON sub.id = s.subject_id " +
            "WHERE a.assignment_id = s.id AND sub.campaign_id = :campaignId " +
            "AND s.status = 'SUBMITTED' AND s.relationship IN (:relationships)")
    int unlinkSubmitted(@Param("campaignId") UUID campaignId,
                        @Param("closedAt") java.time.Instant closedAt,
                        @Param("relationships") Collection<String> relationships);
}
