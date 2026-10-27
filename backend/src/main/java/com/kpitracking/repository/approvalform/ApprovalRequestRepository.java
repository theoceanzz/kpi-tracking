package com.kpitracking.repository.approvalform;

import com.kpitracking.entity.approvalform.ApprovalRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface ApprovalRequestRepository extends JpaRepository<ApprovalRequest, UUID> {

    Optional<ApprovalRequest> findByIdAndOrganizationId(UUID id, UUID organizationId);

    @Query(value = "SELECT nextval('approval_request_no_seq')", nativeQuery = true)
    long nextNumber();

    /**
     * Đơn theo mục của trang "Trạng thái đơn":
     * TODO = tôi đang giữ bước hiện tại; DONE = tôi đã duyệt / từ chối một bước; SUBMITTED = tôi nộp;
     * IN_REVIEW = tôi nộp và còn chờ duyệt. {@code q} rỗng hoặc {@code %từ khoá%} viết thường (mã, tên đơn, người nộp).
     */
    @Query(value = BOX_QUERY + " ORDER BY r.submitted_at DESC",
           countQuery = "SELECT COUNT(*) FROM (" + BOX_QUERY + ") x",
           nativeQuery = true)
    Page<ApprovalRequest> findBox(@Param("orgId") UUID orgId, @Param("me") UUID me, @Param("box") String box,
                                  @Param("q") String q, Pageable pageable);

    @Query(value = "SELECT COUNT(*) FROM (" + BOX_QUERY + ") x", nativeQuery = true)
    long countBox(@Param("orgId") UUID orgId, @Param("me") UUID me, @Param("box") String box, @Param("q") String q);

    String BOX_QUERY = "SELECT r.* FROM approval_requests r " +
            "WHERE r.organization_id = :orgId AND (" +
            "  (:box = 'SUBMITTED' AND r.requester_id = :me) " +
            "  OR (:box = 'IN_REVIEW' AND r.requester_id = :me AND r.status = 'PENDING') " +
            "  OR (:box = 'TODO' AND r.status = 'PENDING' AND r.id IN (" +
            "      SELECT f.subject_id FROM kpi_approval_flows f " +
            "        JOIN kpi_approval_steps s ON s.flow_id = f.id " +
            "        JOIN kpi_approval_step_approvers a ON a.step_id = s.id " +
            "       WHERE f.subject_type = 'FORM_REQUEST' AND f.status = 'IN_PROGRESS' " +
            "         AND s.step_order = f.current_step_order AND s.status = 'PENDING' AND a.user_id = :me)) " +
            "  OR (:box = 'DONE' AND r.id IN (" +
            "      SELECT f.subject_id FROM kpi_approval_flows f " +
            "        JOIN kpi_approval_steps s ON s.flow_id = f.id " +
            "       WHERE f.subject_type = 'FORM_REQUEST' AND s.acted_by_id = :me))" +
            ") AND (:q = '' OR lower(r.code) LIKE :q OR lower(CAST(r.form_name AS TEXT)) LIKE :q " +
            "  OR EXISTS (SELECT 1 FROM users u WHERE u.id = r.requester_id AND lower(u.full_name) LIKE :q))";
}
