package com.kpitracking.service.ai.review;

import com.kpitracking.entity.AiCriteriaSet;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.security.PermissionChecker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Luật phân cấp áp quy chế chấm: quyền đi từ đơn vị cha xuống đơn vị con; tài liệu do cấp trên áp thì cấp dưới
 * (và người cùng cấp) không thay được; người áp đã rời tổ chức thì không khoá ai.
 */
class AiCriteriaAuthorityTest {

    private final UUID org = UUID.randomUUID();
    private final UUID director = UUID.randomUUID();
    private final UUID head = UUID.randomUUID();
    private final UUID unitIt = UUID.randomUUID();

    private PermissionChecker permissions;
    private AiCriteriaAuthority authority;

    @BeforeEach
    void setUp() {
        permissions = mock(PermissionChecker.class);
        UserRepository users = mock(UserRepository.class);
        User d = new User();
        d.setId(director);
        d.setFullName("Nguyễn Văn Director");
        when(users.findById(director)).thenReturn(Optional.of(d));
        authority = new AiCriteriaAuthority(permissions, users);
        when(permissions.isMemberOfOrganization(director, org)).thenReturn(true);
        when(permissions.isMemberOfOrganization(head, org)).thenReturn(true);
    }

    private AiCriteriaSet appliedBy(UUID userId, UUID unitId) {
        return AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org).orgUnitId(unitId)
                .title("Quy chế vận hành").status(AiCriteriaSet.CONFIRMED).confirmedBy(userId).build();
    }

    @Test
    @DisplayName("khoá: cấp dưới / cùng cấp bị khoá; chính người áp, cấp trên, quản trị thì không")
    void lockFollowsSeniority() {
        AiCriteriaSet byDirector = appliedBy(director, unitIt);
        when(permissions.isSuperiorTo(head, director, unitIt)).thenReturn(false);
        when(permissions.isSuperiorTo(director, head, unitIt)).thenReturn(true);

        assertThat(authority.lockedFor(head, byDirector)).isTrue();
        assertThat(authority.lockedFor(director, byDirector)).isFalse();
        assertThat(authority.lockedFor(director, appliedBy(head, unitIt))).isFalse();

        UUID admin = UUID.randomUUID();
        when(permissions.isGlobalAdminIn(admin, unitIt)).thenReturn(true);
        assertThat(authority.lockedFor(admin, byDirector)).isFalse();
    }

    @Test
    @DisplayName("người áp đã rời tổ chức → không khoá ai")
    void formerApplierDoesNotLock() {
        UUID gone = UUID.randomUUID();
        assertThat(authority.lockedFor(head, appliedBy(gone, unitIt))).isFalse();
    }

    @Test
    @DisplayName("phạm vi: quyền ở đơn vị nào thì cả cây con của đơn vị đó; 'Cả tổ chức' chỉ người cấu hình AI")
    void scopeCoversSubtree() {
        OrgUnit hn = unit("/hn/");
        OrgUnit it = unit("/hn/it/");
        OrgUnit backend = unit("/hn/it/be/");
        OrgUnit comm = unit("/hn/comm/");
        when(permissions.getOrgUnitsWithAnyPermission(head, AiCriteriaAuthority.MANAGE, AiCriteriaAuthority.CONFIG))
                .thenReturn(List.of(it.getId()));

        AiCriteriaAuthority.Scope s = authority.scopeOf(head, org, List.of(hn, it, backend, comm));

        assertThat(s.unitIds()).containsExactlyInAnyOrder(it.getId(), backend.getId());
        assertThat(s.orgWide()).isFalse();
        assertThat(s.covers(null)).isFalse();

        when(permissions.hasPermissionInOrganization(director, AiCriteriaAuthority.CONFIG, org)).thenReturn(true);
        when(permissions.getOrgUnitsWithAnyPermission(director, AiCriteriaAuthority.MANAGE, AiCriteriaAuthority.CONFIG))
                .thenReturn(List.of(hn.getId()));
        AiCriteriaAuthority.Scope d = authority.scopeOf(director, org, List.of(hn, it, backend, comm));
        assertThat(d.unitIds()).hasSize(4);
        assertThat(d.covers(null)).isTrue();
    }

    @Test
    @DisplayName("lý do khoá nêu đơn vị, tài liệu, người áp và chức vụ")
    void lockReasonNamesApplier() {
        when(permissions.getBestRoleNameInOrgUnit(director, unitIt)).thenReturn("Giám đốc");

        assertThat(authority.lockReason(appliedBy(director, unitIt), "Phòng IT"))
                .startsWith("Phòng IT đang áp «Quy chế vận hành» do Nguyễn Văn Director (Giám đốc) áp dụng")
                .contains("gửi đề nghị");
    }

    private static OrgUnit unit(String path) {
        OrgUnit u = new OrgUnit();
        u.setId(UUID.randomUUID());
        u.setPath(path);
        return u;
    }
}
