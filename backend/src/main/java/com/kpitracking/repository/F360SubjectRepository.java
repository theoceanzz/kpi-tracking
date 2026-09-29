package com.kpitracking.repository;

import com.kpitracking.entity.F360Subject;
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
public interface F360SubjectRepository extends JpaRepository<F360Subject, UUID> {

    @Query("SELECT s FROM F360Subject s JOIN FETCH s.user LEFT JOIN FETCH s.orgUnit WHERE s.campaign.id = :campaignId AND s.deletedAt IS NULL")
    List<F360Subject> findByCampaignIdWithUser(@Param("campaignId") UUID campaignId);

    Optional<F360Subject> findByCampaignIdAndUserId(UUID campaignId, UUID userId);

    /** Giai đoạn đề cử: các lần mình là người được đánh giá trong chiến dịch đang NOMINATING. */
    @Query("SELECT s FROM F360Subject s JOIN FETCH s.campaign c LEFT JOIN FETCH s.approver " +
           "WHERE s.user.id = :userId AND c.status = com.kpitracking.enums.F360CampaignStatus.NOMINATING " +
           "AND s.deletedAt IS NULL AND c.deletedAt IS NULL")
    List<F360Subject> findNominatingOf(@Param("userId") UUID userId);

    /** Hàng chờ duyệt đề cử của một người duyệt (không bao giờ gồm chính họ). */
    @Query("SELECT s FROM F360Subject s JOIN FETCH s.campaign c JOIN FETCH s.user u LEFT JOIN FETCH s.orgUnit " +
           "WHERE s.approver.id = :approverId AND u.id <> :approverId " +
           "AND c.status = com.kpitracking.enums.F360CampaignStatus.NOMINATING " +
           "AND s.status IN (com.kpitracking.enums.F360SubjectStatus.NOMINATING, com.kpitracking.enums.F360SubjectStatus.NOMINATION_SUBMITTED) " +
           "AND s.deletedAt IS NULL AND c.deletedAt IS NULL")
    List<F360Subject> findPendingApprovals(@Param("approverId") UUID approverId);

    /** Báo cáo của chính mình: chỉ các chiến dịch ở trạng thái cho trước (thường là RELEASED). */
    @Query("SELECT s FROM F360Subject s JOIN FETCH s.campaign c " +
           "WHERE s.user.id = :userId AND c.status IN :statuses AND s.deletedAt IS NULL AND c.deletedAt IS NULL " +
           "ORDER BY c.closedAt DESC")
    List<F360Subject> findByUserIdAndCampaignStatusIn(@Param("userId") UUID userId,
                                                     @Param("statuses") Collection<F360CampaignStatus> statuses);
}
