package com.kpitracking.repository;

import com.kpitracking.entity.Document;
import com.kpitracking.enums.DocumentAiStatus;
import com.kpitracking.enums.DocumentScope;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentRepository extends JpaRepository<Document, UUID>, JpaSpecificationExecutor<Document> {

    Optional<Document> findByIdAndOrganizationId(UUID id, UUID organizationId);

    /** Khoá dòng khi đổi trạng thái AI — để lượt sửa của người dùng và luồng nạp không ghi đè nhau. */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT d FROM Document d WHERE d.id = :id")
    Optional<Document> findByIdForUpdate(@Param("id") UUID id);

    // ── Hạn mức dung lượng (§9) ──────────────────────────────────────────────────────────────────

    @Query("SELECT COALESCE(SUM(d.fileSize), 0) FROM Document d WHERE d.scope = com.kpitracking.enums.DocumentScope.PERSONAL AND d.ownerUserId = :ownerId")
    long sumPersonalBytes(@Param("ownerId") UUID ownerId);

    @Query("SELECT COALESCE(SUM(d.fileSize), 0) FROM Document d WHERE d.scope = com.kpitracking.enums.DocumentScope.UNIT AND d.orgUnitId = :unitId")
    long sumUnitBytes(@Param("unitId") UUID unitId);

    @Query("SELECT COALESCE(SUM(d.fileSize), 0) FROM Document d WHERE d.scope = com.kpitracking.enums.DocumentScope.COMPANY AND d.organizationId = :orgId")
    long sumCompanyBytes(@Param("orgId") UUID orgId);

    /** Số đoạn vector của tổ chức, cho hạn mức số đoạn. Đếm theo bản ghi, không đếm trong kho vector. */
    @Query("SELECT COALESCE(SUM(d.aiChunkCount), 0) FROM Document d WHERE d.organizationId = :orgId")
    long sumChunks(@Param("orgId") UUID orgId);

    // ── Trùng lặp: cùng nội dung, cùng chỗ ───────────────────────────────────────────────────────

    /** Cùng nội dung trong cùng phạm vi của tổ chức; tầng service lọc tiếp theo chủ / đơn vị. */
    List<Document> findByOrganizationIdAndScopeAndContentSha256(UUID organizationId, DocumentScope scope, String contentSha256);

    // ── Nạp nền ──────────────────────────────────────────────────────────────────────────────────

    /**
     * Giành quyền nạp một tài liệu. Trả 0 khi job khác đang nạp, tài liệu đã xong, đã bị tắt AI hay đã xoá —
     * nhờ vậy event trùng hoặc job khôi phục chạy đè không nạp hai lần song song.
     */
    @Modifying
    @Query("""
            UPDATE Document d SET d.aiStatus = com.kpitracking.enums.DocumentAiStatus.INDEXING, d.updatedAt = :now
             WHERE d.id = :id AND d.aiEnabled = true AND d.aiStatus IN :from
            """)
    int claimForIndexing(@Param("id") UUID id, @Param("from") List<DocumentAiStatus> from, @Param("now") Instant now);

    /** Tài liệu kẹt: PENDING lâu hơn {@code pendingBefore} (event mất khi khởi động lại) hoặc INDEXING lâu hơn {@code indexingBefore} (job chết). */
    @Query("""
            SELECT d.id FROM Document d
             WHERE d.aiEnabled = true
               AND ((d.aiStatus = com.kpitracking.enums.DocumentAiStatus.PENDING  AND d.updatedAt < :pendingBefore)
                 OR (d.aiStatus = com.kpitracking.enums.DocumentAiStatus.INDEXING AND d.updatedAt < :indexingBefore))
            """)
    List<UUID> findStuck(@Param("pendingBefore") Instant pendingBefore, @Param("indexingBefore") Instant indexingBefore);

    @Modifying
    @Query("""
            UPDATE Document d SET d.aiStatus = com.kpitracking.enums.DocumentAiStatus.PENDING, d.updatedAt = :now
             WHERE d.id IN :ids AND d.aiStatus = com.kpitracking.enums.DocumentAiStatus.INDEXING
            """)
    int resetStuckIndexing(@Param("ids") List<UUID> ids, @Param("now") Instant now);

    // ── Dọn dẹp (§5.5). Native vì @SQLRestriction ẩn dòng đã xoá mềm khỏi JPQL. ──────────────────

    @Query(value = "SELECT * FROM documents WHERE deleted_at IS NOT NULL AND deleted_at < :cutoff LIMIT :limit", nativeQuery = true)
    List<Document> findPurgeable(@Param("cutoff") Instant cutoff, @Param("limit") int limit);

    @Modifying
    @Query(value = "DELETE FROM documents WHERE id = :id AND deleted_at IS NOT NULL", nativeQuery = true)
    int hardDelete(@Param("id") UUID id);

    /** Tài liệu cá nhân còn sống của những người đã vô hiệu hoá trước {@code cutoff}. */
    @Query(value = """
            SELECT d.* FROM documents d
              JOIN users u ON u.id = d.owner_user_id
             WHERE d.scope = 'PERSONAL' AND d.deleted_at IS NULL
               AND u.deactivated_at IS NOT NULL AND u.deactivated_at < :cutoff
             LIMIT :limit
            """, nativeQuery = true)
    List<Document> findPersonalOfUsersDeactivatedBefore(@Param("cutoff") Instant cutoff, @Param("limit") int limit);

    List<Document> findByScopeAndOwnerUserIdAndOrganizationId(DocumentScope scope, UUID ownerUserId, UUID organizationId);

    /** Người này đang bị vô hiệu hoá (tạm dừng, tạm khoá hoặc đã xoá mềm)? Native vì User ẩn dòng đã xoá. */
    @Query(value = """
            SELECT COUNT(*) > 0 FROM users u
             WHERE u.id = :userId
               AND (u.deleted_at IS NOT NULL OR u.status IN ('INACTIVE', 'SUSPENDED'))
            """, nativeQuery = true)
    boolean isUserDeactivated(@Param("userId") UUID userId);
}
