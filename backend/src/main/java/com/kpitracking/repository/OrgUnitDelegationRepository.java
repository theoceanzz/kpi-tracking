package com.kpitracking.repository;

import com.kpitracking.entity.OrgUnitDelegation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrgUnitDelegationRepository extends JpaRepository<OrgUnitDelegation, UUID> {

    /**
     * Uỷ quyền của một người. Gọi ở MỌI lần kiểm tra quyền nên chỉ lấy đúng những dòng
     * còn hạn, và fetch sẵn đơn vị đích — path của nó là thứ dùng để so phạm vi.
     */
    @Query("SELECT d FROM OrgUnitDelegation d JOIN FETCH d.orgUnit "
            + "WHERE d.delegateUser.id = :userId "
            + "AND (d.startsAt IS NULL OR d.startsAt <= CURRENT_TIMESTAMP) "
            + "AND (d.expiresAt IS NULL OR d.expiresAt > CURRENT_TIMESTAMP)")
    List<OrgUnitDelegation> findActiveByDelegate(@Param("userId") UUID userId);

    @Query("SELECT d FROM OrgUnitDelegation d WHERE d.organization.id = :orgId ORDER BY d.createdAt DESC")
    List<OrgUnitDelegation> findByOrganization(@Param("orgId") UUID orgId);

    Optional<OrgUnitDelegation> findByDelegateUserIdAndOrgUnitId(UUID delegateUserId, UUID orgUnitId);

    /** Mọi uỷ quyền còn hiệu lực — lượt quét nhắc hạn cần biết ai đang gánh đơn vị không có trưởng. */
    @Query("SELECT d FROM OrgUnitDelegation d JOIN FETCH d.orgUnit JOIN FETCH d.delegateUser "
            + "WHERE (d.startsAt IS NULL OR d.startsAt <= CURRENT_TIMESTAMP) "
            + "AND (d.expiresAt IS NULL OR d.expiresAt > CURRENT_TIMESTAMP)")
    List<OrgUnitDelegation> findAllActive();
}
