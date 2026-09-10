package com.kpitracking.service.analytics;

import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.PermissionChecker;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Phân giải PHẠM VI THỐNG KÊ theo ba cấp vai trò — dùng cho các biểu đồ chuyên sâu ở tab "Chuyên sâu".
 *
 * <p>Ba quyền {@code STATS:VIEW_ORG / STATS:VIEW_EMPLOYEE / STATS:VIEW_MY} đã được seed sẵn và cấp
 * đúng theo archetype trong {@code RolePermissionConstants}, nhưng trước lớp này thì không nơi nào
 * kiểm tra chúng — toàn bộ thống kê gác chung bằng {@code DASHBOARD:VIEW}, nên Giám đốc và Trưởng
 * phòng không phân biệt được. Bảng cấp quyền hiện hành:
 *
 * <pre>
 *   director / deputy_director → VIEW_ORG + VIEW_EMPLOYEE           (KHÔNG có VIEW_MY)
 *   manager  / deputy          → VIEW_EMPLOYEE + VIEW_MY
 *   staff                      → VIEW_MY
 * </pre>
 *
 * <p>Vì Giám đốc không có {@code VIEW_MY}, thứ tự xét bắt buộc là ORG → UNIT → SELF; xét ngược lại
 * sẽ đẩy Giám đốc xuống cấp thấp nhất.
 *
 * <p><b>Hiệu năng:</b> {@link PermissionChecker} không cache, mỗi lần hỏi là hai truy vấn. Hãy gọi
 * {@link #resolve} ĐÚNG MỘT LẦN ở đầu request rồi truyền {@link TierScope} xuống dưới — tuyệt đối
 * không gọi trong vòng lặp hay trong comparator.
 */
@Component
@RequiredArgsConstructor
public class StatsTierResolver {

    public static final String PERM_ORG = "STATS:VIEW_ORG";
    public static final String PERM_EMPLOYEE = "STATS:VIEW_EMPLOYEE";
    public static final String PERM_MY = "STATS:VIEW_MY";

    /** Cấp dữ liệu người dùng được nhìn thấy. */
    public enum Tier {
        /** Toàn tổ chức, hiển thị đầy đủ danh tính. */
        ORG,
        /** Cây đơn vị do mình quản lý, hiển thị đầy đủ danh tính trong phạm vi đó. */
        UNIT,
        /** Chỉ dữ liệu của chính mình; dữ liệu tham chiếu của người khác phải ẩn danh. */
        SELF
    }

    private final UserRepository userRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final PermissionChecker permissionChecker;
    private final KpiPeriodRepository kpiPeriodRepository;

    /**
     * Phạm vi đã phân giải cho một request thống kê.
     *
     * @param unitIds đơn vị được phép đọc — đã mở rộng hết cây con, dùng thẳng cho {@code IN :unitIds}
     * @param userId  người đang xem; ở cấp {@link Tier#SELF} đây là bộ lọc bắt buộc
     */
    public record TierScope(Tier tier, UUID orgId, UUID userId, List<UUID> unitIds, List<UUID> periodIds) {

        public boolean isEmpty() {
            return unitIds.isEmpty() || periodIds.isEmpty();
        }

        /** Cấp SELF: mọi bản ghi của người khác phải bỏ tên/email trước khi rời service. */
        public boolean anonymize() {
            return tier == Tier.SELF;
        }

        public boolean canSeeNames() {
            return tier != Tier.SELF;
        }
    }

    // ============================================================
    // API chính
    // ============================================================

    /** Phân giải cho người dùng đang đăng nhập. */
    public TierScope resolve(UUID orgUnitId, Collection<UUID> periodIds) {
        return resolveFor(currentUser().getId(), orgUnitId, periodIds);
    }

    /** Bản nhận userId tường minh — để kiểm thử được mà không cần SecurityContext. */
    public TierScope resolveFor(UUID userId, UUID orgUnitId, Collection<UUID> periodIds) {
        Tier tier = resolveTier(userId);
        UUID orgId = organizationIdOf(userId);
        List<UUID> unitIds = resolveUnitIds(tier, userId, orgId, orgUnitId);
        List<UUID> effPeriods = (periodIds != null && !periodIds.isEmpty())
                ? new ArrayList<>(periodIds)
                : (orgId != null ? kpiPeriodRepository.findIdsByOrganizationId(orgId) : List.of());
        return new TierScope(tier, orgId, userId, unitIds, effPeriods);
    }

    /**
     * Cấp cao nhất mà người dùng đạt được. Ném {@link ForbiddenException} nếu không có quyền
     * thống kê nào — endpoint đã gác bằng {@code hasAnyAuthority} nên đây là chốt chặn thứ hai.
     */
    public Tier resolveTier(UUID userId) {
        if (permissionChecker.hasPermission(userId, PERM_ORG)) return Tier.ORG;
        if (permissionChecker.hasPermission(userId, PERM_EMPLOYEE)) return Tier.UNIT;
        if (permissionChecker.hasPermission(userId, PERM_MY)) return Tier.SELF;
        throw new ForbiddenException("Bạn không có quyền xem thống kê");
    }

    // ============================================================
    // Phân giải cây đơn vị
    // ============================================================

    private List<UUID> resolveUnitIds(Tier tier, UUID userId, UUID orgId, UUID orgUnitId) {
        if (orgId == null) return List.of();

        // Cấp SELF không bao giờ mở rộng ra ngoài đơn vị được phân công, kể cả khi client tự truyền
        // orgUnitId của đơn vị khác.
        if (tier == Tier.SELF) return assignedUnitIds(userId);

        List<OrgUnit> allowed = allowedSubtree(tier, userId, orgId);
        if (orgUnitId == null) {
            return allowed.stream().map(OrgUnit::getId).toList();
        }

        // Thu hẹp theo đơn vị người dùng chọn — nhưng chỉ khi nó NẰM TRONG phạm vi được phép.
        // AnalyticsScopeResolver.resolveOrgUnitSubtree chỉ kiểm tra "cùng tổ chức", nên một trưởng
        // phòng truyền id của phòng ngang hàng vẫn đọc được dữ liệu phòng đó. Ở đây kiểm tra bao
        // hàm thực sự để bịt đúng chỗ hở ấy.
        OrgUnit root = orgUnitRepository.findById(orgUnitId).orElse(null);
        if (root == null
                || root.getOrgHierarchyLevel() == null
                || root.getOrgHierarchyLevel().getOrganization() == null
                || !orgId.equals(root.getOrgHierarchyLevel().getOrganization().getId())) {
            return List.of();
        }
        Set<UUID> allowedIds = allowed.stream().map(OrgUnit::getId).collect(Collectors.toSet());
        if (!allowedIds.contains(orgUnitId)) return List.of();

        return orgUnitRepository.findSubtree(root.getPath(), orgId).stream().map(OrgUnit::getId).toList();
    }

    private List<OrgUnit> allowedSubtree(Tier tier, UUID userId, UUID orgId) {
        if (tier == Tier.ORG) {
            return orgUnitRepository.findByOrgHierarchyLevel_Organization_IdAndDeletedAtIsNull(orgId);
        }
        List<UUID> rootIds = permissionChecker.getOrgUnitsWithPermission(userId, PERM_EMPLOYEE);
        if (rootIds.isEmpty()) rootIds = assignedUnitIds(userId);
        if (rootIds.isEmpty()) return List.of();
        // getOrgUnitsWithPermission trả về các gốc được gán quyền và KHÔNG tự mở rộng xuống cây con
        // (JavaDoc của PermissionChecker có cảnh báo) — bắt buộc nối findAllInSubtrees.
        return orgUnitRepository.findAllInSubtrees(rootIds, orgId);
    }

    private List<UUID> assignedUnitIds(UUID userId) {
        return userRoleOrgUnitRepository.findByUserId(userId).stream()
                .map(a -> a.getOrgUnit().getId())
                .distinct()
                .toList();
    }

    private UUID organizationIdOf(UUID userId) {
        List<UserRoleOrgUnit> roles = userRoleOrgUnitRepository.findByUserId(userId);
        if (roles.isEmpty()) return null;
        return roles.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ForbiddenException("Không xác định được người dùng hiện tại"));
    }
}
