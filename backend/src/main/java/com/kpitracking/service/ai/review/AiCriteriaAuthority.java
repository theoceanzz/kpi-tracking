package com.kpitracking.service.ai.review;

import com.kpitracking.entity.AiCriteriaSet;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.security.PermissionChecker;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Ai được áp quy chế chấm AI ở đâu, và ai thay được tài liệu của ai — MỘT chỗ cho mọi thao tác trên bộ tiêu chí.
 * <ul>
 *   <li><b>Phạm vi</b>: có {@value #MANAGE} hoặc {@value #CONFIG} ở đơn vị đó hoặc đơn vị cha (quyền đi xuống đơn
 *       vị con). "Cả tổ chức" chỉ {@value #CONFIG}. Quản trị tổ chức đi thẳng.</li>
 *   <li><b>Khoá</b>: tài liệu đang áp ở đơn vị U do người khác áp thì chỉ người đó, người CAO HƠN họ tại U
 *       ({@link PermissionChecker#isSuperiorTo}, luật dùng cho duyệt KPI) hoặc quản trị mới thay / ngừng được.
 *       Cùng cấp không vượt qua. Người áp không còn trong tổ chức thì không khoá ai.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
public class AiCriteriaAuthority {

    static final String MANAGE = "AI_CRITERIA:MANAGE";
    static final String CONFIG = "AI_REVIEW:CONFIG";

    private final PermissionChecker permissions;
    private final UserRepository userRepository;

    /** Đơn vị người này áp được: {@code orgWide} = được áp cho "Cả tổ chức". */
    public record Scope(boolean orgWide, Set<UUID> unitIds) {
        public boolean covers(UUID unitId) {
            return unitId == null ? orgWide : unitIds.contains(unitId);
        }
    }

    /** Phạm vi của một người trong tổ chức; {@code orgUnits} = mọi đơn vị của tổ chức (có path). */
    public Scope scopeOf(UUID userId, UUID orgId, Collection<OrgUnit> orgUnits) {
        if (permissions.isGlobalAdminOfOrganization(userId, orgId)) {
            return new Scope(true, orgUnits.stream().map(OrgUnit::getId).collect(Collectors.toSet()));
        }
        Set<UUID> bases = Set.copyOf(permissions.getOrgUnitsWithAnyPermission(userId, MANAGE, CONFIG));
        List<String> basePaths = orgUnits.stream().filter(u -> bases.contains(u.getId()) && u.getPath() != null)
                .map(OrgUnit::getPath).toList();
        Set<UUID> units = orgUnits.stream()
                .filter(u -> u.getPath() != null && basePaths.stream().anyMatch(p -> u.getPath().startsWith(p)))
                .map(OrgUnit::getId).collect(Collectors.toSet());
        return new Scope(permissions.hasPermissionInOrganization(userId, CONFIG, orgId), units);
    }

    public boolean canManageUnit(UUID userId, UUID orgId, UUID unitId) {
        if (unitId == null) {
            return permissions.isGlobalAdminOfOrganization(userId, orgId)
                    || permissions.hasPermissionInOrganization(userId, CONFIG, orgId);
        }
        return permissions.isGlobalAdminIn(userId, unitId)
                || permissions.hasAnyPermissionInOrgUnit(userId, unitId, MANAGE, CONFIG);
    }

    /** Tài liệu ĐANG ÁP {@code applied} có khoá người này không (true = không tự thay / ngừng được). */
    public boolean lockedFor(UUID actorId, AiCriteriaSet applied) {
        UUID applier = applied.getConfirmedBy();
        if (applier == null || applier.equals(actorId)) return false;
        if (!permissions.isMemberOfOrganization(applier, applied.getOrganizationId())) return false;
        UUID unitId = applied.getOrgUnitId();
        if (unitId == null) return !canManageUnit(actorId, applied.getOrganizationId(), null);
        if (permissions.isGlobalAdminIn(actorId, unitId)) return false;
        return !permissions.isSuperiorTo(actorId, applier, unitId);
    }

    /** Người áp một tài liệu: tên + chức vụ tại đơn vị đó (chức vụ trống khi áp cả tổ chức). */
    public record Applier(UUID id, String name, String role) {}

    public Applier applierOf(AiCriteriaSet set) {
        UUID id = set.getConfirmedBy();
        if (id == null) return null;
        String name = userRepository.findById(id).map(User::getFullName).orElse("người đã áp");
        String role = set.getOrgUnitId() == null ? null : permissions.getBestRoleNameInOrgUnit(id, set.getOrgUnitId());
        return new Applier(id, name, role);
    }

    /** Vì sao bị khoá — câu hiện thẳng cho người dùng. */
    public String lockReason(AiCriteriaSet applied, String unitLabel) {
        Applier a = applierOf(applied);
        String by = a == null ? "cấp trên" : a.name() + (a.role() == null ? "" : " (" + a.role() + ")");
        return unitLabel + " đang áp «" + applied.getTitle() + "» do " + by
                + " áp dụng — bạn không tự thay được tài liệu của cấp trên. Hãy gửi đề nghị đổi sang tài liệu của bạn.";
    }
}
