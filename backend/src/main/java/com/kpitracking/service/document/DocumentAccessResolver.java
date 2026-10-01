package com.kpitracking.service.document;

import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.RolePermissionRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.PermissionChecker;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Chỗ DUY NHẤT tính quyền đọc/sửa tài liệu (docs/DOCUMENTS_DESIGN.md §3.3, §6.1). Màn danh sách, API tải về
 * và cả hai bộ truy hồi của K.AI ({@code HelpAgentFactory}, {@code OrgDocumentSearchTool}) đều đi qua đây.
 *
 * <p>Tính lại MỖI request / mỗi lượt hỏi, không cache chéo: người bị chuyển đơn vị hay thu quyền phải mất
 * quyền đọc ngay lượt tiếp theo, mà không cần nạp lại vector nào.
 *
 * <p>Cố ý KHÔNG đi qua uỷ quyền chéo đơn vị ({@code OrgUnitDelegation}): uỷ quyền để làm việc thay có thời
 * hạn, không phải để đọc kho tài liệu của đơn vị khác. {@code SYSTEM:ADMIN} vẫn tính là có mọi quyền tài liệu
 * (như mọi chỗ khác), trừ tài liệu CÁ NHÂN — không ai ngoài chính chủ đọc được.
 */
@Component
@RequiredArgsConstructor
public class DocumentAccessResolver {

    public static final String UPLOAD_PERSONAL = "DOCUMENT:UPLOAD_PERSONAL";
    public static final String MANAGE_UNIT = "DOCUMENT:MANAGE_UNIT";
    public static final String MANAGE_COMPANY = "DOCUMENT:MANAGE_COMPANY";
    private static final String SYSTEM_ADMIN = "SYSTEM:ADMIN";

    private final UserRoleOrgUnitRepository assignments;
    private final RolePermissionRepository rolePermissions;
    private final OrgUnitRepository orgUnits;

    @Transactional(readOnly = true)
    public DocumentAccess resolve(UUID userId, UUID orgId) {
        if (userId == null || orgId == null) return DocumentAccess.none(orgId, userId);

        Instant now = Instant.now();
        List<UserRoleOrgUnit> inOrg = assignments.findByUserId(userId).stream()
                .filter(a -> a.getExpiresAt() == null || a.getExpiresAt().isAfter(now))
                .filter(a -> orgId.equals(PermissionChecker.organizationIdOf(a.getOrgUnit())))
                .toList();
        if (inOrg.isEmpty()) return DocumentAccess.none(orgId, userId);

        Set<UUID> roleIds = inOrg.stream().map(a -> a.getRole().getId()).collect(Collectors.toSet());
        Map<UUID, Set<String>> permsByRole = rolePermissions.findByRoleIdIn(roleIds).stream()
                .collect(Collectors.groupingBy(rp -> rp.getRole().getId(),
                        Collectors.mapping(rp -> rp.getPermission().getCode(), Collectors.toSet())));

        List<Membership> memberships = inOrg.stream()
                .map(a -> new Membership(a.getOrgUnit().getPath(),
                        permsByRole.getOrDefault(a.getRole().getId(), Set.of())))
                .toList();
        // Đơn vị còn sống của tổ chức. Tổ chức vài trăm đơn vị — nạp một lần rồi so tiền tố path trong bộ nhớ
        // rẻ hơn một truy vấn LIKE cho mỗi membership.
        Map<UUID, String> units = orgUnits.findSubtree("/", orgId).stream()
                .collect(Collectors.toMap(OrgUnit::getId, OrgUnit::getPath, (x, y) -> x));

        return compute(orgId, userId, memberships, units);
    }

    /** Một vai trò của người dùng tại một đơn vị: path của đơn vị + tập mã quyền của vai trò. */
    public record Membership(String unitPath, Set<String> permissions) {
        boolean has(String code) {
            return permissions.contains(code) || permissions.contains(SYSTEM_ADMIN);
        }
    }

    /**
     * Phần tính toán thuần — tách ra để test trên cây đơn vị giả, không cần DB.
     *
     * <p>Path đơn vị có dạng {@code /KPC/<id>/<id>/}: đơn vị A là tổ tiên-hoặc-chính B khi
     * {@code B.path.startsWith(A.path)}.
     */
    static DocumentAccess compute(UUID orgId, UUID userId, List<Membership> memberships, Map<UUID, String> unitPaths) {
        if (memberships.isEmpty()) return DocumentAccess.none(orgId, userId);

        Set<UUID> visible = new HashSet<>();
        Set<UUID> manageable = new HashSet<>();
        for (Membership m : memberships) {
            boolean manages = m.has(MANAGE_UNIT);
            for (Map.Entry<UUID, String> u : unitPaths.entrySet()) {
                String path = u.getValue();
                // Tài liệu truyền XUỐNG: thấy tài liệu của đơn vị mình và mọi đơn vị cha.
                if (m.unitPath().startsWith(path)) visible.add(u.getKey());
                // Người quản lý thấy và sửa được cả cây con.
                if (manages && path.startsWith(m.unitPath())) {
                    visible.add(u.getKey());
                    manageable.add(u.getKey());
                }
            }
        }
        boolean manageCompany = memberships.stream().anyMatch(m -> m.has(MANAGE_COMPANY));
        boolean uploadPersonal = memberships.stream().anyMatch(m -> m.has(UPLOAD_PERSONAL));

        return new DocumentAccess(orgId, userId, true,
                Set.copyOf(visible), Set.copyOf(manageable), Set.copyOf(unitPaths.keySet()),
                manageCompany, uploadPersonal);
    }
}
