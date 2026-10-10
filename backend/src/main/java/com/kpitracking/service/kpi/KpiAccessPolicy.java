package com.kpitracking.service.kpi;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.KpiApprovalStepRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.PermissionChecker;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Luật DUY NHẤT "ai xem được KPI này". Dùng cho chi tiết KPI, danh sách KPI (vị từ JPQL tương đương ở
 * {@code KpiCriteriaRepository.findAllWithFilters}), KPI con, thảo luận, gợi ý @tag và kênh WebSocket.
 * Sửa luật ở đây thì phải sửa cả hai vị từ SQL ({@link #VIEWERS_SQL} và truy vấn danh sách) cho khớp.
 *
 * <p>Xem được khi KPI cùng tổ chức và người xem là:
 * <ol>
 *   <li>người tạo hoặc người thực hiện — mọi trạng thái;</li>
 *   <li>người đang giữ bước duyệt HIỆN TẠI, hoặc đã tự tay duyệt / từ chối một bước (chuỗi duyệt KPI hoặc chuỗi
 *       điều chỉnh) — kể cả sau khi KPI đã chuyển lên cấp trên. Người giữ bước phía trên còn chờ (WAITING) thì CHƯA
 *       thấy: cấp trên không thấy KPI trước khi cấp dưới duyệt xong;</li>
 *   <li>trưởng/phó (rank ≤ 1) của đơn vị KPI hoặc một đơn vị tổ tiên — chỉ KPI đã duyệt và đang chạy
 *       ({@link #APPROVED_STATES}: APPROVED, EDIT = đang xin điều chỉnh, EDITED = đã điều chỉnh);</li>
 *   <li>thành viên cùng đơn vị — chỉ khi KPI {@code APPROVED};</li>
 *   <li>quản trị viên tổ chức — mọi trạng thái trừ {@code DRAFT} (cần thấy để gán lại bước duyệt bị kẹt).</li>
 * </ol>
 * Không ai ngoài người tạo / người thực hiện thấy KPI {@code DRAFT}.
 */
@Component
@RequiredArgsConstructor
public class KpiAccessPolicy {

    private final PermissionChecker permissionChecker;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final KpiApprovalStepRepository approvalStepRepository;
    private final EntityManager entityManager;

    /** KPI đã duyệt và đang chạy — cấp trên theo cơ cấu đơn vị thấy được. */
    public static final java.util.Set<KpiStatus> APPROVED_STATES =
            java.util.EnumSet.of(KpiStatus.APPROVED, KpiStatus.EDIT, KpiStatus.EDITED);

    /** Phạm vi của một người xem, tính một lần rồi dùng cho nhiều KPI (danh sách) hoặc truyền vào truy vấn. */
    public record Viewer(UUID userId, boolean admin, List<String> managerUnitPaths, List<UUID> managerUnitIds,
                         List<UUID> memberUnitIds) {

        private static final UUID NO_MATCH = new UUID(0L, 0L);

        /** JPQL không nhận {@code IN ()} rỗng. */
        public List<UUID> managerUnitIdsForQuery() {
            return managerUnitIds.isEmpty() ? List.of(NO_MATCH) : managerUnitIds;
        }

        public List<UUID> memberUnitIdsForQuery() {
            return memberUnitIds.isEmpty() ? List.of(NO_MATCH) : memberUnitIds;
        }
    }

    public Viewer viewer(UUID userId, UUID organizationId) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        List<UserRoleOrgUnit> managerOf = assignments.stream().filter(a -> isManagerRank(a.getRole().getRank())).toList();
        return new Viewer(
                userId,
                organizationId != null && permissionChecker.isGlobalAdminOfOrganization(userId, organizationId),
                managerOf.stream().map(a -> a.getOrgUnit().getPath()).distinct().toList(),
                managerOf.stream().map(a -> a.getOrgUnit().getId()).distinct().toList(),
                assignments.stream().filter(a -> !isManagerRank(a.getRole().getRank()))
                        .map(a -> a.getOrgUnit().getId()).distinct().toList());
    }

    public boolean canView(UUID userId, KpiCriteria kpi) {
        if (kpi == null || userId == null) return false;
        return canView(viewer(userId, organizationIdOf(kpi)), kpi);
    }

    public boolean canView(Viewer v, KpiCriteria kpi) {
        if (kpi == null || v == null) return false;
        UUID uid = v.userId();
        if (kpi.getCreatedBy() != null && uid.equals(kpi.getCreatedBy().getId())) return true;
        if (kpi.getAssignees() != null && kpi.getAssignees().stream().anyMatch(a -> uid.equals(a.getId()))) return true;

        OrgUnit unit = kpi.getOrgUnit();
        KpiStatus status = kpi.getStatus();
        if (status == KpiStatus.DRAFT) return false;
        if (v.admin()) return true;
        if (APPROVED_STATES.contains(status) && unit != null && unit.getPath() != null
                && v.managerUnitPaths().stream().anyMatch(p -> unit.getPath().startsWith(p))) return true;
        if (status == KpiStatus.APPROVED && unit != null && v.memberUnitIds().contains(unit.getId())) return true;

        // Đắt nhất (một truy vấn) nên để cuối.
        return kpi.getId() != null && approvalStepRepository.isChainViewer(kpi.getId(), uid);
    }

    public void assertCanView(UUID userId, KpiCriteria kpi) {
        if (!canView(userId, kpi)) {
            throw new ForbiddenException(ErrorCode.NO_PERMISSION_VIEW_KPI);
        }
    }

    /**
     * Cùng luật như {@link #canView(Viewer, KpiCriteria)} viết bằng SQL, đảo chiều: những người (đang hoạt động)
     * xem được KPI {@code :kpiId}. Dùng cho gợi ý @tag và chọn người nhận thông báo.
     */
    private static final String VIEWERS_SQL = """
            WITH k AS (
                SELECT kc.id, kc.status, kc.created_by, kc.org_unit_id, ou.path, hl.organization_id
                  FROM kpi_criteria kc
                  JOIN org_units ou ON ou.id = kc.org_unit_id
                  JOIN org_hierarchy_levels hl ON hl.id = ou.org_hierarchy_id
                 WHERE kc.id = :kpiId AND kc.deleted_at IS NULL
            )
            SELECT u.id
              FROM users u, k
             WHERE u.deleted_at IS NULL
               AND u.status = 'ACTIVE'
               AND (
                    u.id = k.created_by
                 OR EXISTS (SELECT 1 FROM kpi_criteria_assignees a WHERE a.kpi_criteria_id = k.id AND a.user_id = u.id)
                 OR (k.status <> 'DRAFT' AND EXISTS (SELECT 1 FROM kpi_approval_steps s
                              JOIN kpi_approval_flows f ON f.id = s.flow_id
                              LEFT JOIN kpi_approval_step_approvers sa ON sa.step_id = s.id
                             WHERE f.kpi_criteria_id = k.id
                               AND (s.acted_by_id = u.id OR (s.status = 'PENDING' AND sa.user_id = u.id))))
                 OR (k.status IN ('APPROVED', 'EDIT', 'EDITED') AND EXISTS (
                        SELECT 1 FROM user_role_org_units uro
                          JOIN roles r ON r.id = uro.role_id
                          JOIN org_units su ON su.id = uro.org_unit_id
                         WHERE uro.user_id = u.id AND r.rank <= 1 AND k.path LIKE su.path || '%'))
                 OR (k.status <> 'DRAFT' AND EXISTS (
                        SELECT 1 FROM user_role_org_units uro
                          JOIN role_permissions rp ON rp.role_id = uro.role_id
                          JOIN permissions p ON p.id = rp.permission_id AND p.code = 'SYSTEM:ADMIN'
                          JOIN org_units ru ON ru.id = uro.org_unit_id AND ru.parent_id IS NULL
                          JOIN org_hierarchy_levels rhl ON rhl.id = ru.org_hierarchy_id
                         WHERE uro.user_id = u.id AND rhl.organization_id = k.organization_id))
                 OR (k.status = 'APPROVED' AND EXISTS (
                        SELECT 1 FROM user_role_org_units uro
                          JOIN roles r ON r.id = uro.role_id
                         WHERE uro.user_id = u.id AND uro.org_unit_id = k.org_unit_id
                           AND (r.rank IS NULL OR r.rank > 1)))
               )
            """;

    /**
     * Người xem được KPI và có thêm quyền {@code permissionCode} (hoặc SYSTEM:ADMIN) ở một vai trò nào đó,
     * lọc theo tên / email / mã nhân viên, tối đa {@code limit} người.
     */
    @SuppressWarnings("unchecked")
    public List<UUID> viewerIds(UUID kpiId, String permissionCode, String query, int limit) {
        String sql = VIEWERS_SQL + """
                   AND EXISTS (SELECT 1 FROM user_role_org_units pu
                                 JOIN role_permissions prp ON prp.role_id = pu.role_id
                                 JOIN permissions pp ON pp.id = prp.permission_id
                                WHERE pu.user_id = u.id AND pp.code IN (:perm, 'SYSTEM:ADMIN'))
                   AND (CAST(:q AS TEXT) IS NULL
                        OR u.full_name ILIKE '%' || CAST(:q AS TEXT) || '%'
                        OR u.email ILIKE '%' || CAST(:q AS TEXT) || '%'
                        OR u.employee_code ILIKE '%' || CAST(:q AS TEXT) || '%')
                 ORDER BY u.full_name
                 LIMIT :lim
                """;
        List<Object> rows = entityManager.createNativeQuery(sql)
                .setParameter("kpiId", kpiId)
                .setParameter("perm", permissionCode)
                .setParameter("q", query == null || query.isBlank() ? null : query.trim())
                .setParameter("lim", limit)
                .getResultList();
        return rows.stream().map(r -> r instanceof UUID u ? u : UUID.fromString(r.toString())).toList();
    }

    /** Lọc một tập người về những ai xem được KPI (kiểm @tag gửi thẳng qua API). */
    public List<UUID> filterViewers(KpiCriteria kpi, Collection<UUID> userIds) {
        UUID orgId = organizationIdOf(kpi);
        return userIds.stream().filter(Objects::nonNull).distinct()
                .filter(id -> canView(viewer(id, orgId), kpi)).toList();
    }

    public static UUID organizationIdOf(KpiCriteria kpi) {
        return kpi.getOrgUnit() == null ? null : PermissionChecker.organizationIdOf(kpi.getOrgUnit());
    }

    /** Rank rỗng là nhân viên — khớp {@code PermissionChecker.isManagerRank}. */
    private static boolean isManagerRank(Integer rank) {
        return rank != null && rank <= 1;
    }
}
