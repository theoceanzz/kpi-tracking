package com.kpitracking.repository;

import com.kpitracking.entity.F360Campaign;
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
public interface F360CampaignRepository extends JpaRepository<F360Campaign, UUID> {

    @Query("SELECT c FROM F360Campaign c LEFT JOIN FETCH c.kpiCycle WHERE c.organization.id = :orgId ORDER BY c.createdAt DESC")
    List<F360Campaign> findByOrganizationId(@Param("orgId") UUID orgId);

    Optional<F360Campaign> findByIdAndOrganizationId(UUID id, UUID organizationId);

    /** Các chiến dịch có ẢNH HƯỞNG ĐIỂM của một kỳ ở các trạng thái cho trước (guard chốt kỳ, điểm 360 vào ma trận). */
    @Query("SELECT c FROM F360Campaign c JOIN FETCH c.organization o WHERE c.kpiCycle.id = :cycleId " +
           "AND c.scoringMode <> com.kpitracking.enums.F360ScoringMode.DEVELOPMENT_ONLY AND c.status IN :statuses")
    List<F360Campaign> findScoringByCycle(@Param("cycleId") UUID cycleId,
                                          @Param("statuses") Collection<F360CampaignStatus> statuses);

    /** Lượt quét nhắc hạn / tự đóng: chỉ các chiến dịch ở trạng thái cho trước. */
    @Query("SELECT c FROM F360Campaign c JOIN FETCH c.organization WHERE c.status IN :statuses")
    List<F360Campaign> findByStatusIn(@Param("statuses") Collection<F360CampaignStatus> statuses);

    /** Nháp đã tới ngày mở dự kiến — lượt tự khởi động. */
    @Query("SELECT c FROM F360Campaign c WHERE c.status = com.kpitracking.enums.F360CampaignStatus.DRAFT "
           + "AND c.deletedAt IS NULL AND c.startAt IS NOT NULL AND c.startAt <= :now")
    List<F360Campaign> findDraftsDueToOpen(@Param("now") java.time.Instant now);
}
