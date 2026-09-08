package com.kpitracking.analytics;

import com.kpitracking.entity.OrgHierarchyLevel;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.analytics.StatsTierResolver;
import com.kpitracking.service.analytics.StatsTierResolver.Tier;
import com.kpitracking.service.analytics.StatsTierResolver.TierScope;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Ba cấp xem thống kê: ORG → UNIT → SELF.
 *
 * <p>Điểm dễ sai nhất và là lý do lớp test này tồn tại: Giám đốc KHÔNG được cấp
 * {@code STATS:VIEW_MY} (xem {@code RolePermissionConstants.getPermissions}, nhánh loại trừ
 * archetype "director"), nên nếu xét quyền theo thứ tự ngược thì Giám đốc rơi thẳng xuống cấp thấp
 * nhất và chỉ còn nhìn thấy dữ liệu của chính mình.
 *
 * <p>Điểm thứ hai: cấp UNIT phải mở rộng hết cây con. {@code getOrgUnitsWithPermission} chỉ trả về
 * các đơn vị GỐC được gán quyền, quên nối {@code findAllInSubtrees} là trưởng phòng mất sạch dữ
 * liệu của các tổ bên dưới.
 */
class StatsTierResolverTest {

    private UserRepository userRepository;
    private OrgUnitRepository orgUnitRepository;
    private UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private PermissionChecker permissionChecker;
    private KpiPeriodRepository kpiPeriodRepository;

    private StatsTierResolver resolver;

    private final UUID orgId = UUID.randomUUID();
    private final UUID periodId = UUID.randomUUID();

    private final UUID directorId = UUID.randomUUID();
    private final UUID managerId = UUID.randomUUID();
    private final UUID staffId = UUID.randomUUID();
    private final UUID outsiderId = UUID.randomUUID();

    /** Cây: root → phongA → toA1 ; root → phongB (ngang hàng với phongA). */
    private OrgUnit root;
    private OrgUnit phongA;
    private OrgUnit toA1;
    private OrgUnit phongB;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        orgUnitRepository = mock(OrgUnitRepository.class);
        userRoleOrgUnitRepository = mock(UserRoleOrgUnitRepository.class);
        permissionChecker = mock(PermissionChecker.class);
        kpiPeriodRepository = mock(KpiPeriodRepository.class);

        resolver = new StatsTierResolver(userRepository, orgUnitRepository,
                userRoleOrgUnitRepository, permissionChecker, kpiPeriodRepository);

        Organization org = Organization.builder().id(orgId).build();
        OrgHierarchyLevel level = OrgHierarchyLevel.builder().organization(org).build();

        root = unit(level, "/root/");
        phongA = unit(level, "/root/phongA/");
        toA1 = unit(level, "/root/phongA/toA1/");
        phongB = unit(level, "/root/phongB/");

        // Ai ở đâu.
        assignedTo(directorId, root);
        assignedTo(managerId, phongA);
        assignedTo(staffId, toA1);
        when(userRoleOrgUnitRepository.findByUserId(outsiderId)).thenReturn(List.of());

        // Mặc định không ai có quyền gì — từng ca test tự bật quyền cần thiết.
        when(permissionChecker.hasPermission(any(), any())).thenReturn(false);
        when(permissionChecker.getOrgUnitsWithPermission(any(), any())).thenReturn(List.of());

        when(kpiPeriodRepository.findIdsByOrganizationId(orgId)).thenReturn(List.of(periodId));

        // Toàn tổ chức.
        when(orgUnitRepository.findByOrgHierarchyLevel_Organization_IdAndDeletedAtIsNull(orgId))
                .thenReturn(List.of(root, phongA, toA1, phongB));
        // Cây con.
        when(orgUnitRepository.findAllInSubtrees(List.of(phongA.getId()), orgId))
                .thenReturn(List.of(phongA, toA1));
        when(orgUnitRepository.findSubtree("/root/phongA/toA1/", orgId)).thenReturn(List.of(toA1));
        when(orgUnitRepository.findSubtree("/root/phongB/", orgId)).thenReturn(List.of(phongB));
        when(orgUnitRepository.findById(toA1.getId())).thenReturn(java.util.Optional.of(toA1));
        when(orgUnitRepository.findById(phongB.getId())).thenReturn(java.util.Optional.of(phongB));
    }

    // ============================================================
    // Phân cấp
    // ============================================================

    @Test
    @DisplayName("Giám đốc có VIEW_ORG nhưng không có VIEW_MY → vẫn phải là cấp ORG")
    void directorWithoutViewMyStillResolvesToOrg() {
        grant(directorId, StatsTierResolver.PERM_ORG);
        grant(directorId, StatsTierResolver.PERM_EMPLOYEE);
        // Cố ý KHÔNG cấp PERM_MY — đúng như RolePermissionConstants làm với archetype "director".

        TierScope scope = resolver.resolveFor(directorId, null, null);

        assertThat(scope.tier()).isEqualTo(Tier.ORG);
        assertThat(scope.canSeeNames()).isTrue();
        assertThat(scope.anonymize()).isFalse();
        assertThat(scope.unitIds())
                .containsExactlyInAnyOrder(root.getId(), phongA.getId(), toA1.getId(), phongB.getId());
    }

    @Test
    @DisplayName("Trưởng phòng có VIEW_EMPLOYEE + VIEW_MY → lấy cấp cao hơn là UNIT")
    void managerResolvesToUnit() {
        grantManager();

        TierScope scope = resolver.resolveFor(managerId, null, null);

        assertThat(scope.tier()).isEqualTo(Tier.UNIT);
        assertThat(scope.canSeeNames()).isTrue();
    }

    @Test
    @DisplayName("Nhân viên chỉ có VIEW_MY → cấp SELF và phải ẩn danh người khác")
    void staffResolvesToSelf() {
        grant(staffId, StatsTierResolver.PERM_MY);

        TierScope scope = resolver.resolveFor(staffId, null, null);

        assertThat(scope.tier()).isEqualTo(Tier.SELF);
        assertThat(scope.anonymize()).isTrue();
        assertThat(scope.canSeeNames()).isFalse();
        assertThat(scope.userId()).isEqualTo(staffId);
    }

    @Test
    @DisplayName("Không có quyền thống kê nào → 403")
    void noStatsPermissionIsForbidden() {
        assertThatThrownBy(() -> resolver.resolveFor(outsiderId, null, null))
                .isInstanceOf(ForbiddenException.class);
    }

    // ============================================================
    // Phạm vi cây đơn vị
    // ============================================================

    @Test
    @DisplayName("Cấp UNIT phải trả về TOÀN BỘ cây con, không chỉ đơn vị gốc được gán quyền")
    void unitTierExpandsWholeSubtree() {
        grantManager();

        TierScope scope = resolver.resolveFor(managerId, null, null);

        assertThat(scope.unitIds()).containsExactlyInAnyOrder(phongA.getId(), toA1.getId());
    }

    @Test
    @DisplayName("Cấp UNIT chọn đơn vị NGANG HÀNG → không trả về gì")
    void unitTierCannotReachSiblingUnit() {
        grantManager();

        TierScope scope = resolver.resolveFor(managerId, phongB.getId(), null);

        assertThat(scope.unitIds()).isEmpty();
        assertThat(scope.isEmpty()).isTrue();
    }

    @Test
    @DisplayName("Cấp UNIT chọn đơn vị trong cây của mình → thu hẹp đúng vào cây con đó")
    void unitTierNarrowsToChosenUnitInsideOwnSubtree() {
        grantManager();

        TierScope scope = resolver.resolveFor(managerId, toA1.getId(), null);

        assertThat(scope.unitIds()).containsExactly(toA1.getId());
    }

    @Test
    @DisplayName("Cấp SELF bỏ qua orgUnitId do client truyền, luôn chỉ còn đơn vị của chính mình")
    void selfTierIgnoresClientSuppliedOrgUnit() {
        grant(staffId, StatsTierResolver.PERM_MY);

        TierScope scope = resolver.resolveFor(staffId, phongB.getId(), null);

        assertThat(scope.unitIds()).containsExactly(toA1.getId());
    }

    @Test
    @DisplayName("Không chọn đợt → lấy toàn bộ đợt của tổ chức")
    void periodsDefaultToWholeOrganization() {
        grantManager();

        assertThat(resolver.resolveFor(managerId, null, null).periodIds()).containsExactly(periodId);
        assertThat(resolver.resolveFor(managerId, null, List.of(periodId)).periodIds())
                .containsExactly(periodId);
    }

    // ============================================================
    // Helpers
    // ============================================================

    private OrgUnit unit(OrgHierarchyLevel level, String path) {
        return OrgUnit.builder()
                .id(UUID.randomUUID())
                .path(path)
                .orgHierarchyLevel(level)
                .build();
    }

    private void assignedTo(UUID userId, OrgUnit orgUnit) {
        User user = User.builder().id(userId).build();
        when(userRoleOrgUnitRepository.findByUserId(userId))
                .thenReturn(List.of(UserRoleOrgUnit.builder().user(user).orgUnit(orgUnit).build()));
    }

    private void grant(UUID userId, String permission) {
        when(permissionChecker.hasPermission(userId, permission)).thenReturn(true);
    }

    private void grantManager() {
        grant(managerId, StatsTierResolver.PERM_EMPLOYEE);
        grant(managerId, StatsTierResolver.PERM_MY);
        when(permissionChecker.getOrgUnitsWithPermission(managerId, StatsTierResolver.PERM_EMPLOYEE))
                .thenReturn(List.of(phongA.getId()));
    }
}
