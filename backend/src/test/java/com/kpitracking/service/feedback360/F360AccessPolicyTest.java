package com.kpitracking.service.feedback360;

import com.kpitracking.entity.*;
import com.kpitracking.enums.F360CampaignStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.PermissionChecker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Luật quan trọng nhất của 360: người được đánh giá không đi đường tắt qua quyền quản lý — trưởng
 * đơn vị có VIEW trên chính đơn vị mình, HR có MANAGE, nhưng báo cáo của CHÍNH HỌ chỉ xem được khi
 * đã công bố, và không thao tác ghi nào nhắm vào chính họ được phép.
 */
class F360AccessPolicyTest {

    private final PermissionChecker permissions = mock(PermissionChecker.class);
    private final UserRoleOrgUnitRepository assignments = mock(UserRoleOrgUnitRepository.class);
    private final F360AccessPolicy policy = new F360AccessPolicy(mock(UserRepository.class), assignments, permissions);

    private Organization org;
    private OrgUnit unit;
    private User head;
    private User staff;
    private F360Campaign campaign;

    @BeforeEach
    void setUp() {
        org = Organization.builder().id(UUID.randomUUID()).enableFeedback360(true).build();
        OrgHierarchyLevel level = OrgHierarchyLevel.builder().id(UUID.randomUUID()).organization(org).build();
        unit = OrgUnit.builder().id(UUID.randomUUID()).path("/a/").orgHierarchyLevel(level).build();
        head = User.builder().id(UUID.randomUUID()).fullName("Trưởng phòng").build();
        staff = User.builder().id(UUID.randomUUID()).fullName("Nhân viên").build();
        campaign = F360Campaign.builder().id(UUID.randomUUID()).organization(org)
                .status(F360CampaignStatus.CLOSED).releaseToSubject(true).build();

        for (User u : List.of(head, staff)) {
            when(assignments.findByUserId(u.getId())).thenReturn(List.of(
                    UserRoleOrgUnit.builder().user(u).orgUnit(unit).build()));
        }
        // Trưởng phòng: VIEW trong đơn vị mình + VIEW_MY.
        when(permissions.hasPermissionInOrgUnit(eq(head.getId()), eq(F360AccessPolicy.VIEW), any())).thenReturn(true);
        when(permissions.hasPermission(head.getId(), F360AccessPolicy.VIEW_MY)).thenReturn(true);
        when(permissions.hasPermission(staff.getId(), F360AccessPolicy.VIEW_MY)).thenReturn(true);
    }

    private F360Subject subjectOf(User u) {
        return F360Subject.builder().id(UUID.randomUUID()).campaign(campaign).user(u).orgUnit(unit).build();
    }

    @Test
    @DisplayName("trưởng phòng xem được báo cáo của nhân viên trong đơn vị từ lúc đóng")
    void headSeesStaffAfterClose() {
        assertThatCode(() -> policy.requireReportAccess(head, subjectOf(staff))).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("trưởng phòng KHÔNG xem sớm báo cáo của chính mình qua quyền VIEW")
    void headCannotSeeOwnBeforeRelease() {
        assertThatThrownBy(() -> policy.requireReportAccess(head, subjectOf(head)))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("sau khi công bố, ai cũng xem được báo cáo của chính mình")
    void ownAfterRelease() {
        campaign.setStatus(F360CampaignStatus.RELEASED);
        assertThatCode(() -> policy.requireReportAccess(staff, subjectOf(staff))).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("chiến dịch tắt \"cho người được đánh giá xem\" thì kể cả sau công bố cũng không xem được")
    void releaseToSubjectOff() {
        campaign.setStatus(F360CampaignStatus.RELEASED);
        campaign.setReleaseToSubject(false);
        assertThatThrownBy(() -> policy.requireReportAccess(staff, subjectOf(staff)))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("chưa đóng thì chưa ai xem được báo cáo của người khác")
    void notBeforeClose() {
        campaign.setStatus(F360CampaignStatus.OPEN);
        assertThatThrownBy(() -> policy.requireReportAccess(head, subjectOf(staff)))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("nhân viên không xem được báo cáo của đồng nghiệp")
    void staffCannotSeePeer() {
        User peer = User.builder().id(UUID.randomUUID()).build();
        assertThatThrownBy(() -> policy.requireReportAccess(staff, subjectOf(peer)))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("HR là người được đánh giá: mọi thao tác ghi nhắm vào chính mình bị chặn, trên người khác thì được")
    void noSelfTargetedWrites() {
        assertThatThrownBy(() -> policy.assertNotSelfTarget(head, subjectOf(head)))
                .isInstanceOf(ForbiddenException.class);
        assertThatCode(() -> policy.assertNotSelfTarget(head, subjectOf(staff))).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("dòng của chính người xem không nằm trong phạm vi quản lý của họ")
    void selfNotInManagerScope() {
        assertThat(policy.inManagerScope(head, subjectOf(head))).isFalse();
        assertThat(policy.inManagerScope(head, subjectOf(staff))).isTrue();
    }

    @Test
    @DisplayName("tổ chức tắt 360 thì không ai xem được gì")
    void disabledOrg() {
        org.setEnableFeedback360(false);
        campaign.setStatus(F360CampaignStatus.RELEASED);
        assertThatThrownBy(() -> policy.requireReportAccess(staff, subjectOf(staff)))
                .isInstanceOf(ForbiddenException.class);
    }
}
