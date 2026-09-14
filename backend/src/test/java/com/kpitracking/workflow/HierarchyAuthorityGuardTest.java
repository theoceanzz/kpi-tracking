package com.kpitracking.workflow;

import com.kpitracking.entity.User;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.workflow.engine.GuardResult;
import com.kpitracking.workflow.engine.TransitionContext;
import com.kpitracking.workflow.guard.HierarchyAuthorityGuard;
import com.kpitracking.workflow.guard.TransitionGuard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Luật "cấp trên mới được xét" — trước đây chép nguyên văn NĂM lần và giờ chỉ còn một.
 *
 * <p>Năm bản chép nằm ở: {@code KpiCriteriaService} (duyệt, từ chối, hoàn duyệt),
 * {@code KpiSubmissionService.requireCanReview}, {@code KpiAdjustmentService.reviewRequest}. Chúng
 * chỉ khác nhau ở động từ trong thông báo, nên mỗi lần đổi luật là một dịp để hai bản lệch nhau mà
 * không ai biết. Lớp test này là chỗ duy nhất cần cập nhật khi luật thay đổi.
 */
class HierarchyAuthorityGuardTest {

    /** Số NHỎ hơn là cao hơn, ở cả hai trục — cùng quy ước với PermissionChecker. */
    private static final int LEVEL_PHONG = 1;
    private static final int LEVEL_TEAM = 2;
    private static final int RANK_TRUONG = 0;
    private static final int RANK_NHAN_VIEN = 2;

    private PermissionChecker permissionChecker;
    private HierarchyAuthorityGuard factory;
    private TransitionGuard guard;

    private final UUID unitId = UUID.randomUUID();
    private User actor;
    private User owner;

    @BeforeEach
    void setUp() {
        permissionChecker = mock(PermissionChecker.class);
        factory = new HierarchyAuthorityGuard(permissionChecker);
        guard = factory.requiring("KPI:APPROVE_CRITERIA", "phê duyệt", "chỉ tiêu", "chỉ tiêu KPI");

        actor = user();
        owner = user();

        when(permissionChecker.isGlobalAdmin(any())).thenReturn(false);
        when(permissionChecker.isGlobalAdminIn(any(), any())).thenReturn(false);
        when(permissionChecker.hasPermissionInOrgUnit(actor.getId(), "KPI:APPROVE_CRITERIA", unitId))
                .thenReturn(true);
        rank(actor, LEVEL_PHONG, RANK_TRUONG);
        rank(owner, LEVEL_TEAM, RANK_NHAN_VIEN);
        when(permissionChecker.isSuperiorTo(actor.getId(), owner.getId(), unitId)).thenReturn(true);
    }

    @Test
    @DisplayName("Trưởng phòng duyệt chỉ tiêu của nhân viên: đi qua")
    void superiorPasses() {
        assertThat(guard.check(ctx()).allowed()).isTrue();
    }

    @Test
    @DisplayName("Không có quyền trong đơn vị đó: chặn, và thông báo dùng danh từ của vế quyền")
    void withoutPermissionInUnit() {
        when(permissionChecker.hasPermissionInOrgUnit(actor.getId(), "KPI:APPROVE_CRITERIA", unitId))
                .thenReturn(false);

        GuardResult r = guard.check(ctx());
        assertThat(r.denied()).isTrue();
        assertThat(r.kind()).isEqualTo(GuardResult.Kind.FORBIDDEN);
        assertThat(r.message()).isEqualTo("Bạn không có quyền phê duyệt chỉ tiêu KPI cho đơn vị này");
    }

    @Test
    @DisplayName("Người sở hữu ở cấp CAO HƠN: chặn, thông báo nói đúng lý do cấp bậc")
    void ownerAtHigherLevel() {
        rank(actor, LEVEL_TEAM, RANK_NHAN_VIEN);
        rank(owner, LEVEL_PHONG, RANK_TRUONG);
        when(permissionChecker.isSuperiorTo(actor.getId(), owner.getId(), unitId)).thenReturn(false);

        assertThat(guard.check(ctx()).message())
                .isEqualTo("Bạn không thể phê duyệt chỉ tiêu của người có cấp bậc cao hơn bạn");
    }

    @Test
    @DisplayName("Ngang cấp ngang chức: chặn — hệ quả là không ai tự duyệt việc của chính mình")
    void peerIsBlocked() {
        rank(owner, LEVEL_PHONG, RANK_TRUONG);
        when(permissionChecker.isSuperiorTo(actor.getId(), owner.getId(), unitId)).thenReturn(false);

        assertThat(guard.check(ctx()).message())
                .isEqualTo("Bạn không thể phê duyệt chỉ tiêu của người có cùng chức vụ");
    }

    @Test
    @DisplayName("Quản trị của ĐÚNG tổ chức đi thẳng, không vướng quyền theo đơn vị lẫn cấp bậc")
    void globalAdminBypasses() {
        // Bypass chỉ áp dụng khi actor là admin của tổ chức sở hữu đơn vị đích — admin của
        // tổ chức khác (isGlobalAdmin=true nhưng isGlobalAdminIn=false) không đi qua được.
        when(permissionChecker.isGlobalAdmin(actor.getId())).thenReturn(true);
        when(permissionChecker.isGlobalAdminIn(eq(actor.getId()), any())).thenReturn(true);
        when(permissionChecker.hasPermissionInOrgUnit(any(), any(), any())).thenReturn(false);
        when(permissionChecker.isSuperiorTo(any(), any(), any())).thenReturn(false);

        assertThat(guard.check(ctx()).allowed()).isTrue();
    }

    @Test
    @DisplayName("Quản trị của tổ chức KHÁC không được đi thẳng")
    void adminOfAnotherOrgDoesNotBypass() {
        when(permissionChecker.isGlobalAdmin(actor.getId())).thenReturn(true);
        when(permissionChecker.isGlobalAdminIn(eq(actor.getId()), any())).thenReturn(false);
        when(permissionChecker.hasPermissionInOrgUnit(any(), any(), any())).thenReturn(false);

        assertThat(guard.check(ctx()).allowed()).isFalse();
    }

    @Test
    @DisplayName("Không xác định được người sở hữu thì bỏ qua vế cấp bậc, vẫn giữ vế quyền")
    void withoutOwnerOnlyPermissionMatters() {
        TransitionContext<KpiStatus> noOwner = TransitionContext.<KpiStatus>builder()
                .action(WorkflowAction.APPROVE_CRITERIA)
                .currentStatus(KpiStatus.PENDING_APPROVAL)
                .actor(actor)
                .orgUnitId(unitId)
                .build();

        assertThat(guard.check(noOwner).allowed()).isTrue();
    }

    @Test
    @DisplayName("Động từ và danh từ đi vào thông báo, nên mỗi hành động vẫn giữ đúng câu chữ cũ")
    void verbAndNounFlowIntoMessages() {
        TransitionGuard revert = factory.requiring("KPI:REVERT_APPROVAL", "hoàn duyệt", "chỉ tiêu", "chỉ tiêu KPI");
        when(permissionChecker.hasPermissionInOrgUnit(actor.getId(), "KPI:REVERT_APPROVAL", unitId))
                .thenReturn(false);

        assertThat(revert.check(ctx()).message())
                .isEqualTo("Bạn không có quyền hoàn duyệt chỉ tiêu KPI cho đơn vị này");
    }

    private TransitionContext<KpiStatus> ctx() {
        return TransitionContext.<KpiStatus>builder()
                .action(WorkflowAction.APPROVE_CRITERIA)
                .currentStatus(KpiStatus.PENDING_APPROVAL)
                .actor(actor)
                .orgUnitId(unitId)
                .targetOwnerId(owner.getId())
                .build();
    }

    private void rank(User u, int level, int rank) {
        when(permissionChecker.getMinLevelInOrgUnit(u.getId(), unitId)).thenReturn(level);
        when(permissionChecker.getMinRankInOrgUnit(u.getId(), unitId)).thenReturn(rank);
    }

    private static User user() {
        User u = new User();
        u.setId(UUID.randomUUID());
        return u;
    }
}
