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

    // ── Thùng rác (native: @SQLRestriction ẩn dòng đã xoá mềm khỏi JPQL) ─────────────────────────────

    /** Tài liệu trong thùng rác của tổ chức, xoá sau {@code since} (còn khôi phục được), mới nhất trước. */
    @Query(value = """
            SELECT * FROM documents
             WHERE organization_id = :orgId AND deleted_at IS NOT NULL AND deleted_at >= :since
             ORDER BY deleted_at DESC LIMIT 500
            """, nativeQuery = true)
    List<Document> findTrash(@Param("orgId") UUID orgId, @Param("since") Instant since);

    @Query(value = "SELECT * FROM documents WHERE id = :id AND organization_id = :orgId AND deleted_at IS NOT NULL",
            nativeQuery = true)
    Optional<Document> findDeletedById(@Param("id") UUID id, @Param("orgId") UUID orgId);

    /**
     * Lấy ra khỏi thùng rác. Thư mục cũ đã bị xoá thì về gốc của phạm vi. {@code clearAutomatically}: bản entity đã
     * nạp trước câu UPDATE (cùng persistence context của request) còn giữ {@code deletedAt}/{@code folderId} cũ.
     */
    @Modifying(clearAutomatically = true)
    @Query(value = """
            UPDATE documents d
               SET deleted_at = NULL, deleted_by = NULL, updated_at = :now, ai_status = :aiStatus,
                   folder_id = CASE WHEN EXISTS (SELECT 1 FROM document_folders f WHERE f.id = d.folder_id AND f.deleted_at IS NULL)
                                    THEN d.folder_id ELSE NULL END
             WHERE d.id = :id AND d.deleted_at IS NOT NULL
            """, nativeQuery = true)
    int restore(@Param("id") UUID id, @Param("aiStatus") String aiStatus, @Param("now") Instant now);

    // ── Thống kê dung lượng cho quản trị (§16.5). Mỗi dòng Object[]. ─────────────────────────────────

    /** [scope, số tài liệu, tổng byte, tổng đoạn AI] theo phạm vi, chỉ tài liệu còn sống. */
    @Query(value = """
            SELECT scope, COUNT(*), COALESCE(SUM(file_size), 0), COALESCE(SUM(ai_chunk_count), 0)
              FROM documents WHERE organization_id = :orgId AND deleted_at IS NULL GROUP BY scope
            """, nativeQuery = true)
    List<Object[]> statsByScope(@Param("orgId") UUID orgId);

    /** [số tài liệu, tổng byte] trong thùng rác (chưa xoá hẳn). */
    @Query(value = """
            SELECT COUNT(*), COALESCE(SUM(file_size), 0) FROM documents
             WHERE organization_id = :orgId AND deleted_at IS NOT NULL
            """, nativeQuery = true)
    List<Object[]> statsTrash(@Param("orgId") UUID orgId);

    /** [số phiên bản cũ, tổng byte] — tệp cũ giữ lại khi thay tệp. */
    @Query(value = """
            SELECT COUNT(*), COALESCE(SUM(v.file_size), 0) FROM document_versions v
              JOIN documents d ON d.id = v.document_id WHERE d.organization_id = :orgId
            """, nativeQuery = true)
    List<Object[]> statsVersions(@Param("orgId") UUID orgId);

    /** [org_unit_id, số tài liệu, tổng byte, tổng đoạn] theo đơn vị, nhiều nhất trước. */
    @Query(value = """
            SELECT org_unit_id, COUNT(*), COALESCE(SUM(file_size), 0), COALESCE(SUM(ai_chunk_count), 0)
              FROM documents WHERE organization_id = :orgId AND scope = 'UNIT' AND deleted_at IS NULL
             GROUP BY org_unit_id ORDER BY 3 DESC LIMIT :limit
            """, nativeQuery = true)
    List<Object[]> statsTopUnits(@Param("orgId") UUID orgId, @Param("limit") int limit);

    /** [owner_user_id, số tài liệu, tổng byte, tổng đoạn] của kho cá nhân theo người, nhiều nhất trước. */
    @Query(value = """
            SELECT owner_user_id, COUNT(*), COALESCE(SUM(file_size), 0), COALESCE(SUM(ai_chunk_count), 0)
              FROM documents WHERE organization_id = :orgId AND scope = 'PERSONAL' AND deleted_at IS NULL
             GROUP BY owner_user_id ORDER BY 3 DESC LIMIT :limit
            """, nativeQuery = true)
    List<Object[]> statsTopOwners(@Param("orgId") UUID orgId, @Param("limit") int limit);

    /** Tài liệu còn sống cần nhắc rà soát hoặc sắp / đã hết hiệu lực (job hằng ngày, §16.3). */
    @Query(value = """
            SELECT * FROM documents
             WHERE deleted_at IS NULL
               AND ((review_date IS NOT NULL AND review_date <= :today
                     AND (review_notified_for IS NULL OR review_notified_for <> review_date))
                 OR (expiry_date IS NOT NULL AND expiry_date <= :warnUntil
                     AND (expiry_notified_for IS NULL OR expiry_notified_for <> expiry_date)))
             LIMIT :limit
            """, nativeQuery = true)
    List<Document> findDueForReminder(@Param("today") java.time.LocalDate today,
                                      @Param("warnUntil") java.time.LocalDate warnUntil, @Param("limit") int limit);

    /** Tài liệu đã hết hiệu lực còn đang dùng cho AI — để job gắn ghi chú hiệu lực vào vector (idempotent). */
    @Query(value = """
            SELECT * FROM documents
             WHERE deleted_at IS NULL AND ai_enabled = TRUE AND ai_status = 'READY'
               AND expiry_date IS NOT NULL AND expiry_date <= :today AND expiry_date > :since
            """, nativeQuery = true)
    List<Document> findRecentlyExpired(@Param("today") java.time.LocalDate today, @Param("since") java.time.LocalDate since);

    /** Tài liệu còn sống trong các thư mục này — để xoá thư mục thì đưa chúng vào thùng rác. */
    List<Document> findByFolderIdIn(java.util.Collection<UUID> folderIds);
}
