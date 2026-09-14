package com.kpitracking.security;

import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.OrgUnitDelegation;
import com.kpitracking.entity.RolePermission;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.repository.OrgUnitDelegationRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.RolePermissionRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Centralized permission checker for service-level authorization.
 * 100% permission-based — NO hardcoded role names.
 * 
 * Key design:
 * - isGlobalAdmin() checks for SYSTEM:ADMIN permission at the root unit.
 * - hasPermissionInOrgUnit() supports hierarchy inheritance and scope-aware SYSTEM:ADMIN.
 * - All role names are user-defined and dynamic.
 */
@Component
@RequiredArgsConstructor
public class PermissionChecker {

    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRepository userRepository;
    private final OrgUnitDelegationRepository delegationRepository;

    // ────────────────────────────────────────────────────────────────────────
    // UỶ QUYỀN CHÉO ĐƠN VỊ
    //
    // Quyền vốn chỉ chảy XUỐNG theo cây (target.path bắt đầu bằng assignment.path), nên
    // đơn vị anh em nằm ngoài tầm với. Uỷ quyền nới PHẠM VI của bộ quyền sẵn có sang đơn
    // vị đích — không cấp quyền mới: người không có CYCLE_EVAL:FINALIZE ở đâu cả thì được
    // uỷ quyền cũng vẫn không chốt được.
    //
    // Mọi chỗ dưới đây chỉ hỏi tới bảng uỷ quyền KHI đường trực tiếp đã tắc, để người dùng
    // bình thường không phải gánh thêm một truy vấn ở mỗi lần kiểm tra quyền.
    // ────────────────────────────────────────────────────────────────────────

    /**
     * Đơn vị đích có nằm trong phạm vi được uỷ quyền của người này không.
     *
     * @param requireLeader chỉ tính những uỷ quyền có cờ "ký thay trưởng đơn vị"
     */
    private boolean isDelegatedTo(UUID userId, OrgUnit targetUnit, boolean requireLeader) {
        if (targetUnit == null) return false;
        for (OrgUnitDelegation d : delegationRepository.findActiveByDelegate(userId)) {
            if (requireLeader && !Boolean.TRUE.equals(d.getCanActAsLeader())) continue;
            OrgUnit scope = d.getOrgUnit();
            if (scope == null) continue;
            boolean covered = Boolean.TRUE.equals(d.getIncludeSubtree())
                    ? targetUnit.getPath().startsWith(scope.getPath())
                    : targetUnit.getId().equals(scope.getId());
            if (covered) return true;
        }
        return false;
    }

    /** Các đơn vị đích đang được uỷ quyền cho người này. */
    private List<UUID> delegatedUnitIds(UUID userId, boolean requireLeader) {
        return delegationRepository.findActiveByDelegate(userId).stream()
                .filter(d -> !requireLeader || Boolean.TRUE.equals(d.getCanActAsLeader()))
                .map(OrgUnitDelegation::getOrgUnit)
                .filter(Objects::nonNull)
                .map(OrgUnit::getId)
                .distinct()
                .toList();
    }

    /**
     * Internal helper to fetch assignments and their associated permission codes.
     */
    private Map<UUID, Set<String>> getPermissionsByRole(List<UserRoleOrgUnit> assignments) {
        Set<UUID> roleIds = assignments.stream()
                .map(a -> a.getRole().getId())
                .collect(Collectors.toSet());
        
        if (roleIds.isEmpty()) return Collections.emptyMap();
        
        List<RolePermission> rolePermissions = rolePermissionRepository.findByRoleIdIn(roleIds);
        
        return rolePermissions.stream()
                .collect(Collectors.groupingBy(
                        rp -> rp.getRole().getId(),
                        Collectors.mapping(rp -> rp.getPermission().getCode(), Collectors.toSet())
                ));
    }

    /**
     * Check if a user has a specific permission code (e.g. "KPI:APPROVE") globally.
     * This checks if ANY assigned role has the permission.
     */
    public boolean hasPermission(UUID userId, String permissionCode) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        Map<UUID, Set<String>> rolePerms = getPermissionsByRole(assignments);

        return assignments.stream()
                .map(a -> a.getRole().getId())
                .distinct()
                .anyMatch(roleId -> {
                    Set<String> perms = rolePerms.getOrDefault(roleId, Collections.emptySet());
                    return perms.contains(permissionCode) || perms.contains("SYSTEM:ADMIN");
                });
    }

    /**
     * Check if a user has any of the given permission codes globally.
     */
    public boolean hasAnyPermission(UUID userId, String... permissionCodes) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        if (assignments.isEmpty()) return false;

        Map<UUID, Set<String>> rolePerms = getPermissionsByRole(assignments);
        Set<String> targetCodes = Set.of(permissionCodes);

        return assignments.stream()
                .map(a -> a.getRole().getId())
                .distinct()
                .anyMatch(roleId -> {
                    Set<String> perms = rolePerms.getOrDefault(roleId, Collections.emptySet());
                    if (perms.contains("SYSTEM:ADMIN")) return true;
                    return perms.stream().anyMatch(targetCodes::contains);
                });
    }

    /**
     * Check if a user has a specific permission code for a specific OrgUnit.
     * Supports inheritance: permission in a parent unit applies to all child units.
     * SYSTEM:ADMIN permission acts as a super-permission within its scope (unit + children).
     */
    public boolean hasPermissionInOrgUnit(UUID userId, String permissionCode, UUID orgUnitId) {
        return hasAnyPermissionInOrgUnit(userId, orgUnitId, permissionCode);
    }

    /**
     * Như {@link #hasPermissionInOrgUnit} nhưng đòi thêm người đó phải là TRƯỞNG (rank 0)
     * của đơn vị đó hoặc của một đơn vị cha — phó (rank 1) không tính.
     *
     * Dành cho những việc mà quyền thôi chưa đủ, phải đúng người đứng đầu ký: chấm hạnh
     * kiểm là một. SYSTEM:ADMIN vẫn đi qua như mọi chỗ khác, nếu không thì quản trị viên
     * không có vai trò trong cây tổ chức sẽ tự khoá mình ra ngoài.
     */
    public boolean hasLeaderPermissionInOrgUnit(UUID userId, String permissionCode, UUID orgUnitId) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        if (assignments.isEmpty()) return false;

        OrgUnit targetUnit = orgUnitRepository.findById(orgUnitId).orElse(null);
        if (targetUnit == null) return false;

        Map<UUID, Set<String>> rolePerms = getPermissionsByRole(assignments);

        java.util.function.Predicate<UserRoleOrgUnit> isLeaderWithCode = a -> {
            Set<String> perms = rolePerms.getOrDefault(a.getRole().getId(), Collections.emptySet());
            if (perms.contains("SYSTEM:ADMIN")) return true;
            Integer rank = a.getRole().getRank();
            return rank != null && rank == 0 && perms.contains(permissionCode);
        };

        boolean direct = assignments.stream()
                .filter(a -> targetUnit.getPath().startsWith(a.getOrgUnit().getPath()))
                .anyMatch(isLeaderWithCode);
        if (direct) return true;

        // Uỷ quyền có cờ "ký thay trưởng đơn vị" mới đi qua cửa này: người được uỷ quyền
        // phải đang là TRƯỞNG ở đơn vị gốc của họ, không phải ai cũng ký thay được.
        return isDelegatedTo(userId, targetUnit, true) && assignments.stream().anyMatch(isLeaderWithCode);
    }

    /**
     * Check if a user has any of the specific permission codes for a specific OrgUnit.
     */
    public boolean hasAnyPermissionInOrgUnit(UUID userId, UUID orgUnitId, String... permissionCodes) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        if (assignments.isEmpty()) return false;

        OrgUnit targetUnit = orgUnitRepository.findById(orgUnitId).orElse(null);
        if (targetUnit == null) return false;

        Map<UUID, Set<String>> rolePerms = getPermissionsByRole(assignments);
        Set<String> targetCodes = Set.of(permissionCodes);

        java.util.function.Predicate<UserRoleOrgUnit> hasCode = a -> {
            Set<String> perms = rolePerms.getOrDefault(a.getRole().getId(), Collections.emptySet());
            return perms.contains("SYSTEM:ADMIN") || perms.stream().anyMatch(targetCodes::contains);
        };

        boolean direct = assignments.stream()
                .filter(a -> targetUnit.getPath().startsWith(a.getOrgUnit().getPath()))
                .anyMatch(hasCode);
        if (direct) return true;

        // Ngoài cây của mình: chỉ đi tiếp khi đơn vị đích được uỷ quyền, và vẫn phải tự có
        // quyền đó ở đâu đó — uỷ quyền nới chỗ dùng, không phát quyền.
        return isDelegatedTo(userId, targetUnit, false) && assignments.stream().anyMatch(hasCode);
    }

    /**
     * Check if user has global admin access (SYSTEM:ADMIN permission at the root unit).
     *
     * <p><b>Không gắn tenant.</b> Chỉ dùng để trả lời "người này có phải quản trị viên
     * tổ chức của họ không" (ẩn/hiện menu, chọn phạm vi truy vấn của chính họ). Khi đang
     * kiểm tra quyền trên MỘT resource cụ thể (user, bản nộp, đơn vị… lấy theo id do client
     * gửi) thì phải dùng {@link #isGlobalAdminIn}, {@link #isGlobalAdminOfOrganization} hoặc
     * {@link #isGlobalAdminOverUser} — nếu không, admin của công ty A đi qua được dữ liệu
     * của công ty B.
     */
    public boolean isGlobalAdmin(UUID userId) {
        return !adminOrganizationIds(userId).isEmpty();
    }

    /** Các tổ chức mà người này giữ SYSTEM:ADMIN ở đơn vị gốc. */
    private Set<UUID> adminOrganizationIds(UUID userId) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        if (assignments.isEmpty()) return Collections.emptySet();

        Map<UUID, Set<String>> rolePerms = getPermissionsByRole(assignments);

        return assignments.stream()
                .filter(a -> a.getOrgUnit().getParent() == null) // Root unit only
                .filter(a -> rolePerms.getOrDefault(a.getRole().getId(), Collections.emptySet())
                        .contains("SYSTEM:ADMIN"))
                .map(a -> organizationIdOf(a.getOrgUnit()))
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
    }

    /** Tổ chức sở hữu một đơn vị; {@code null} nếu đơn vị không có cấp/tổ chức. */
    public static UUID organizationIdOf(OrgUnit unit) {
        if (unit == null || unit.getOrgHierarchyLevel() == null
                || unit.getOrgHierarchyLevel().getOrganization() == null) {
            return null;
        }
        return unit.getOrgHierarchyLevel().getOrganization().getId();
    }

    /** Quản trị viên (SYSTEM:ADMIN ở đơn vị gốc) của đúng tổ chức {@code organizationId}. */
    public boolean isGlobalAdminOfOrganization(UUID userId, UUID organizationId) {
        if (organizationId == null) return false;
        return adminOrganizationIds(userId).contains(organizationId);
    }

    /** Quản trị viên của tổ chức đang sở hữu đơn vị {@code orgUnitId}. */
    public boolean isGlobalAdminIn(UUID userId, UUID orgUnitId) {
        if (orgUnitId == null) return false;
        OrgUnit unit = orgUnitRepository.findById(orgUnitId).orElse(null);
        return unit != null && isGlobalAdminOfOrganization(userId, organizationIdOf(unit));
    }

    /**
     * Quản trị viên của (ít nhất) một tổ chức mà {@code targetUserId} đang là thành viên.
     *
     * <p>Người chưa được gán vào đơn vị nào (vừa tạo, chờ xếp chỗ) không thuộc tenant nào
     * để đối chiếu; giữ hành vi cũ — admin bất kỳ vẫn quản lý được — vì họ chưa nắm dữ liệu
     * của tổ chức nào.
     */
    public boolean isGlobalAdminOverUser(UUID userId, UUID targetUserId) {
        Set<UUID> myOrgs = adminOrganizationIds(userId);
        if (myOrgs.isEmpty()) return false;

        Set<UUID> targetOrgs = organizationIdsOf(targetUserId);
        if (targetOrgs.isEmpty()) return true;

        return targetOrgs.stream().anyMatch(myOrgs::contains);
    }

    /** Các tổ chức mà người này có ít nhất một vai trò. */
    public Set<UUID> organizationIdsOf(UUID userId) {
        return userRoleOrgUnitRepository.findByUserId(userId).stream()
                .map(a -> organizationIdOf(a.getOrgUnit()))
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
    }

    /** Người này có vai trò nào trong tổ chức {@code organizationId} không. */
    public boolean isMemberOfOrganization(UUID userId, UUID organizationId) {
        return organizationId != null && organizationIdsOf(userId).contains(organizationId);
    }

    /**
     * Như {@link #hasPermission} nhưng chỉ tính những vai trò nằm trong tổ chức
     * {@code organizationId}. Dùng khi resource được định danh bằng orgId do client gửi
     * (sơ đồ tổ chức, cấu hình tổ chức…) — quyền ở công ty khác không được tính.
     */
    public boolean hasPermissionInOrganization(UUID userId, String permissionCode, UUID organizationId) {
        if (organizationId == null) return false;
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId).stream()
                .filter(a -> organizationId.equals(organizationIdOf(a.getOrgUnit())))
                .toList();
        if (assignments.isEmpty()) return false;

        Map<UUID, Set<String>> rolePerms = getPermissionsByRole(assignments);
        return assignments.stream()
                .map(a -> a.getRole().getId())
                .distinct()
                .anyMatch(roleId -> {
                    Set<String> perms = rolePerms.getOrDefault(roleId, Collections.emptySet());
                    return perms.contains(permissionCode) || perms.contains("SYSTEM:ADMIN");
                });
    }

    /**
     * Check if a user is a platform-level super admin (cross-org access).
     */
    public boolean isPlatformAdmin(String email) {
        return userRepository.findByEmail(email)
                .map(u -> Boolean.TRUE.equals(u.getIsPlatformAdmin()))
                .orElse(false);
    }

    /**
     * Get list of all OrgUnit IDs where the user has a specific permission.
     * This returns the "base" units where the permission is explicitly assigned.
     * Callers should handle sub-unit logic (e.g. via path LIKE) if needed.
     */
    public List<UUID> getEffectiveOrgUnitsWithPermission(UUID userId, String permissionCode) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        if (assignments.isEmpty()) return Collections.emptyList();

        Map<UUID, Set<String>> rolePerms = getPermissionsByRole(assignments);

        boolean hasAnywhere = assignments.stream().anyMatch(a -> {
            Set<String> perms = rolePerms.getOrDefault(a.getRole().getId(), Collections.emptySet());
            return perms.contains(permissionCode) || perms.contains("SYSTEM:ADMIN");
        });

        return java.util.stream.Stream.concat(
                assignments.stream()
                        .filter(a -> {
                            Set<String> perms = rolePerms.getOrDefault(a.getRole().getId(), Collections.emptySet());
                            return perms.contains(permissionCode) || perms.contains("SYSTEM:ADMIN");
                        })
                        .map(a -> a.getOrgUnit().getId()),
                // Đơn vị được uỷ quyền cũng phải có mặt, nếu không thì màn hình danh sách
                // vẫn lọc mất đơn vị mà người này vừa được trao quyền quản lý.
                hasAnywhere ? delegatedUnitIds(userId, false).stream() : java.util.stream.Stream.<UUID>empty())
                .distinct()
                .toList();
    }

    public List<UUID> getOrgUnitsWithPermission(UUID userId, String permissionCode) {
        return getEffectiveOrgUnitsWithPermission(userId, permissionCode);
    }

    /**
     * Get list of all OrgUnit IDs where the user has any of the specific permissions.
     */
    public List<UUID> getOrgUnitsWithAnyPermission(UUID userId, String... permissionCodes) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        if (assignments.isEmpty()) return Collections.emptyList();

        Map<UUID, Set<String>> rolePerms = getPermissionsByRole(assignments);
        Set<String> targetCodes = Set.of(permissionCodes);

        java.util.function.Predicate<UserRoleOrgUnit> hasCode = a -> {
            Set<String> perms = rolePerms.getOrDefault(a.getRole().getId(), Collections.emptySet());
            return perms.contains("SYSTEM:ADMIN") || perms.stream().anyMatch(targetCodes::contains);
        };

        return java.util.stream.Stream.concat(
                assignments.stream().filter(hasCode).map(a -> a.getOrgUnit().getId()),
                assignments.stream().anyMatch(hasCode)
                        ? delegatedUnitIds(userId, false).stream()
                        : java.util.stream.Stream.<UUID>empty())
                .distinct()
                .toList();
    }

    /**
     * Phạm vi xem KPI suy ra từ membership của một user, tách theo rank.
     * <p>
     * Vai trò quản lý (rank 0/1) nhìn được cả cây con của đơn vị được gán; nhân viên
     * (rank 2 hoặc chưa đặt) chỉ nhìn đúng đơn vị đó. Việc tách này là cần thiết vì
     * {@code UserService.assignToUnitAndImmediateParent} tự sinh thêm một membership
     * nhân viên ở đơn vị CHA — với tổ chức hai cấp, đơn vị cha chính là gốc công ty,
     * nên nếu mở rộng cây con cho cả membership nhân viên thì mọi người sẽ thấy KPI
     * của tất cả đơn vị anh em.
     */
    public record KpiVisibilityScope(List<UUID> managerUnitIds, List<UUID> memberUnitIds) {

        /** UUID không trỏ tới bản ghi nào, dùng để giữ mệnh đề IN hợp lệ khi danh sách rỗng. */
        private static final UUID NO_MATCH = new UUID(0L, 0L);

        public boolean isEmpty() {
            return managerUnitIds.isEmpty() && memberUnitIds.isEmpty();
        }

        /** JPQL không nhận {@code IN ()} rỗng — thay bằng UUID không khớp gì. */
        public List<UUID> managerUnitIdsForQuery() {
            return managerUnitIds.isEmpty() ? List.of(NO_MATCH) : managerUnitIds;
        }

        public List<UUID> memberUnitIdsForQuery() {
            return memberUnitIds.isEmpty() ? List.of(NO_MATCH) : memberUnitIds;
        }
    }

    /**
     * Split a user's memberships into manager scope (subtree-wide) and member scope (exact unit).
     */
    public KpiVisibilityScope getKpiVisibilityScope(UUID userId) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);

        List<UUID> managerUnitIds = assignments.stream()
                .filter(a -> isManagerRank(a.getRole().getRank()))
                .map(a -> a.getOrgUnit().getId())
                .distinct()
                .toList();

        List<UUID> memberUnitIds = assignments.stream()
                .filter(a -> !isManagerRank(a.getRole().getRank()))
                .map(a -> a.getOrgUnit().getId())
                .distinct()
                .toList();

        return new KpiVisibilityScope(managerUnitIds, memberUnitIds);
    }

    /** Rank rỗng được coi là nhân viên, khớp mặc định của {@link #getMinRankInOrgUnit}. */
    private static boolean isManagerRank(Integer rank) {
        return rank != null && rank <= 1;
    }

    /**
     * Get the minimum (best/highest) rank of a user in a specific OrgUnit.
     * Considers inheritance: rank in a parent unit applies to all child units.
     * Ranks: 0 (Head), 1 (Deputy), 2 (Staff).
     */
    public int getMinRankInOrgUnit(UUID userId, UUID orgUnitId) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        if (assignments.isEmpty()) return 2; // Default to staff rank

        OrgUnit targetUnit = orgUnitRepository.findById(orgUnitId).orElse(null);
        if (targetUnit == null) return 2;

        // Người được uỷ quyền ký thay mang theo thâm niên của chính họ sang đơn vị đích —
        // nếu không, mọi luật "ai trên ai" (mở khoá bản chốt của cấp dưới) sẽ coi họ là
        // nhân viên và chặn đúng việc vừa được trao.
        //
        // Chỉ mang theo thâm niên của vai trò QUẢN LÝ. UserService
        // .assignToUnitAndImmediateParent tự sinh cho mỗi người một membership nhân viên ở
        // đơn vị CHA; tính cả nó thì thâm niên "mang sang" lại lấy từ một vai trò mà người
        // đó chưa từng quản lý ai.
        boolean asLeader = isDelegatedTo(userId, targetUnit, true);

        return assignments.stream()
                .filter(a -> targetUnit.getPath().startsWith(a.getOrgUnit().getPath())
                        || (asLeader && isManagerRank(a.getRole().getRank())))
                .map(a -> a.getRole().getRank())
                .filter(Objects::nonNull)
                .min(Integer::compare)
                .orElse(2);
    }

    /**
     * Người thao tác có đứng CAO HƠN người sở hữu việc trong đơn vị này không?
     *
     * <p>Luật: cấp tốt hơn thắng; cùng cấp thì chức vụ tốt hơn thắng. Số NHỎ hơn là cao hơn ở cả
     * hai trục. Ngang bằng thì KHÔNG vượt qua — hệ quả là không ai tự duyệt việc của chính mình,
     * vì với chính mình hai trục luôn bằng nhau.
     *
     * <p>Khối này trước đây được chép nguyên văn năm lần: ba lần trong {@code KpiCriteriaService}
     * (duyệt / từ chối / hoàn duyệt), một lần trong {@code KpiSubmissionService.requireCanReview}
     * và một lần trong {@code KpiAdjustmentService.reviewRequest}. Gom về một chỗ để sửa luật là
     * sửa một nơi, và để kiểm thử được nó độc lập.
     */
    public boolean isSuperiorTo(UUID actorId, UUID targetUserId, UUID orgUnitId) {
        int targetLevel = getMinLevelInOrgUnit(targetUserId, orgUnitId);
        int targetRank = getMinRankInOrgUnit(targetUserId, orgUnitId);
        int actorLevel = getMinLevelInOrgUnit(actorId, orgUnitId);
        int actorRank = getMinRankInOrgUnit(actorId, orgUnitId);

        return actorLevel < targetLevel || (actorLevel == targetLevel && actorRank < targetRank);
    }

    /**
     * Get the minimum (best/highest) level of a user in a specific OrgUnit.
     * Levels: 0 (Group), 1 (Region), 2 (Company), 3 (Department), 4 (Team).
     */
    public int getMinLevelInOrgUnit(UUID userId, UUID orgUnitId) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        if (assignments.isEmpty()) return 4; // Default to lowest level

        OrgUnit targetUnit = orgUnitRepository.findById(orgUnitId).orElse(null);
        if (targetUnit == null) return 4;

        // Cùng lý do với getMinRankInOrgUnit: chỉ vai trò quản lý mới mang thâm niên sang
        // đơn vị được uỷ quyền.
        boolean asLeader = isDelegatedTo(userId, targetUnit, true);

        return assignments.stream()
                .filter(a -> targetUnit.getPath().startsWith(a.getOrgUnit().getPath())
                        || (asLeader && isManagerRank(a.getRole().getRank())))
                .map(a -> a.getRole().getLevel())
                .filter(Objects::nonNull)
                .min(Integer::compare)
                .orElse(4);
    }

    /**
     * Khoá sắp xếp thâm niên trong một OrgUnit: {@code level * 1000 + rank}.
     * NHỎ hơn = cấp cao hơn. Gộp 2 trục (level, rank) thành 1 số để so sánh
     * "ai trên ai" chỉ bằng một phép so sánh thay vì lặp lại biểu thức lexicographic.
     */
    public int seniorityKeyInOrgUnit(UUID userId, UUID orgUnitId) {
        return getMinLevelInOrgUnit(userId, orgUnitId) * 1000 + getMinRankInOrgUnit(userId, orgUnitId);
    }

    /** Tên vai trò tốt nhất (cấp cao nhất) của user áp dụng cho OrgUnit này. */
    public String getBestRoleNameInOrgUnit(UUID userId, UUID orgUnitId) {
        OrgUnit targetUnit = orgUnitRepository.findById(orgUnitId).orElse(null);
        if (targetUnit == null) return null;

        return userRoleOrgUnitRepository.findByUserId(userId).stream()
                .filter(a -> targetUnit.getPath().startsWith(a.getOrgUnit().getPath()))
                .min(Comparator
                        .comparingInt((UserRoleOrgUnit a) -> a.getRole().getLevel() != null ? a.getRole().getLevel() : 4)
                        .thenComparingInt(a -> a.getRole().getRank() != null ? a.getRole().getRank() : 2))
                .map(a -> a.getRole().getName())
                .orElse(null);
    }
}
