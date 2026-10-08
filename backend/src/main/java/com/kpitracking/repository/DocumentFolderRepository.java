package com.kpitracking.repository;

import com.kpitracking.entity.DocumentFolder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentFolderRepository extends JpaRepository<DocumentFolder, UUID>, JpaSpecificationExecutor<DocumentFolder> {

    Optional<DocumentFolder> findByIdAndOrganizationId(UUID id, UUID organizationId);

    /** Thư mục và mọi thư mục con cháu (còn sống) — để xoá cả cây. */
    @Query(value = """
            WITH RECURSIVE tree AS (
                SELECT id FROM document_folders WHERE id = :rootId AND deleted_at IS NULL
                UNION ALL
                SELECT f.id FROM document_folders f JOIN tree t ON f.parent_id = t.id WHERE f.deleted_at IS NULL
            )
            SELECT id FROM tree
            """, nativeQuery = true)
    List<UUID> findSubtreeIds(@Param("rootId") UUID rootId);

    @Modifying
    @Query("UPDATE DocumentFolder f SET f.deletedAt = :now WHERE f.id IN :ids")
    int softDeleteAll(@Param("ids") List<UUID> ids, @Param("now") Instant now);

    /** Thư mục đã xoá mềm quá hạn, không còn tài liệu hay thư mục con nào trỏ tới — xoá hẳn được. */
    @Modifying
    @Query(value = """
            DELETE FROM document_folders f
             WHERE f.deleted_at IS NOT NULL AND f.deleted_at < :cutoff
               AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.folder_id = f.id)
               AND NOT EXISTS (SELECT 1 FROM document_folders c WHERE c.parent_id = f.id)
            """, nativeQuery = true)
    int purgeEmptyDeleted(@Param("cutoff") Instant cutoff);
}
