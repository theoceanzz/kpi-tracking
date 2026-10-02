package com.kpitracking.repository;

import com.kpitracking.entity.DocumentShare;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentShareRepository extends JpaRepository<DocumentShare, UUID> {

    List<DocumentShare> findByDocumentIdOrderByCreatedAtAsc(UUID documentId);

    Optional<DocumentShare> findByIdAndDocumentId(UUID id, UUID documentId);

    boolean existsByDocumentIdAndGranteeUserId(UUID documentId, UUID granteeUserId);

    boolean existsByDocumentIdAndGranteeUnitId(UUID documentId, UUID granteeUnitId);

    /**
     * Tài liệu (còn sống, đúng tổ chức) được chia sẻ cho người này — trực tiếp, hoặc cho một đơn vị mà người này là
     * thành viên của chính nó hay của đơn vị con ({@code unitIds} = tổ tiên-hoặc-chính các đơn vị của họ; KHÔNG được
     * rỗng — {@code IN ()} là lỗi cú pháp, bên gọi truyền một UUID không tồn tại khi không có đơn vị nào).
     */
    @Query(value = """
            SELECT DISTINCT s.document_id FROM document_shares s
              JOIN documents d ON d.id = s.document_id AND d.deleted_at IS NULL AND d.organization_id = :orgId
             WHERE s.grantee_user_id = :userId OR s.grantee_unit_id IN (:unitIds)
            """, nativeQuery = true)
    List<UUID> findSharedDocumentIds(@Param("orgId") UUID orgId, @Param("userId") UUID userId,
                                     @Param("unitIds") Collection<UUID> unitIds);

    /**
     * Số người ĐANG làm việc gắn trực tiếp vào từng đơn vị (bỏ tài khoản xoá / tạm dừng, vai trò hết hạn) — cho cây chọn
     * người chia sẻ. Mỗi dòng {@code [org_unit_id, count]}.
     */
    @Query(value = """
            SELECT uro.org_unit_id, COUNT(DISTINCT uro.user_id) FROM user_role_org_units uro
              JOIN users u ON u.id = uro.user_id
             WHERE uro.org_unit_id IN (:unitIds) AND u.deleted_at IS NULL AND u.status NOT IN ('INACTIVE', 'SUSPENDED')
               AND (uro.expires_at IS NULL OR uro.expires_at > now())
             GROUP BY uro.org_unit_id
            """, nativeQuery = true)
    List<Object[]> countMembersByUnit(@Param("unitIds") Collection<UUID> unitIds);

    /** Số lượt chia sẻ theo tài liệu — để danh sách hiện biểu tượng "đã chia sẻ". */
    @Query("SELECT s.documentId, COUNT(s) FROM DocumentShare s WHERE s.documentId IN :ids GROUP BY s.documentId")
    List<Object[]> countByDocumentIds(@Param("ids") Collection<UUID> ids);
}
