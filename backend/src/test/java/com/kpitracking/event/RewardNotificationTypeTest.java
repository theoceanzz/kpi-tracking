package com.kpitracking.event;

import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.RewardGrant;
import com.kpitracking.entity.RewardGrantItem;
import com.kpitracking.entity.RewardProgram;
import com.kpitracking.entity.RewardProgramRun;
import com.kpitracking.entity.RewardProgramRunItem;
import com.kpitracking.entity.User;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.RewardBudgetRepository;
import com.kpitracking.repository.RewardGrantItemRepository;
import com.kpitracking.repository.RewardGrantRepository;
import com.kpitracking.repository.RewardProgramRunItemRepository;
import com.kpitracking.repository.RewardProgramRunRepository;
import com.kpitracking.repository.RewardRedemptionRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.service.notification.NotificationDispatcher;
import com.kpitracking.service.notification.NotificationRoutingService;
import com.kpitracking.service.reward.RewardContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Loại thông báo của luồng điểm thưởng: điểm bị TRỪ (thu hồi thưởng tay, hoàn tác chương trình tự động) phải mang
 * {@code REWARD_POINT_REVOKED}, tách khỏi {@code REWARD_POINT} (được cộng điểm) — chuông vẽ biểu tượng cảnh báo và
 * không gì phía frontend nhầm nó thành tin vui. Người trao bị thu hồi vẫn nhận {@code REWARD_GRANT}.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RewardNotificationTypeTest {

    @Mock NotificationDispatcher dispatcher;
    @Mock NotificationRoutingService routing;
    @Mock RewardContext context;
    @Mock RewardGrantRepository grantRepository;
    @Mock RewardGrantItemRepository grantItemRepository;
    @Mock RewardBudgetRepository budgetRepository;
    @Mock RewardProgramRunRepository runRepository;
    @Mock RewardProgramRunItemRepository runItemRepository;
    @Mock RewardRedemptionRepository redemptionRepository;
    @Mock UserRepository userRepository;
    @Mock OrgUnitRepository orgUnitRepository;
    @InjectMocks RewardNotificationEventListener listener;

    private final UUID orgId = UUID.randomUUID();
    private final Organization org = new Organization();
    private final OrgUnit unit = new OrgUnit();
    private final User grantor = user("Người trao");
    private final User recipient = user("Người nhận");
    private final User admin = user("Quản trị");

    @BeforeEach
    void setUp() {
        org.setId(orgId);
        when(context.getPrimaryOrgUnit(any())).thenReturn(unit);
        when(userRepository.findById(admin.getId())).thenReturn(Optional.of(admin));
    }

    @Test
    void revokingManualGrant_sendsRevokedTypeToRecipient_andGrantTypeToGrantor() {
        RewardGrant grant = grant();
        when(grantItemRepository.findByGrantId(grant.getId())).thenReturn(List.of(item(grant, recipient)));

        listener.handleGrantRevoked(new RewardEvents.GrantRevoked(grant.getId(), admin.getId(), "sai đối tượng"));

        verify(dispatcher).dispatchImmediate(eq(orgId), eq("reward_grant_revoked"), eq(recipient), eq(unit),
                any(), any(), eq("REWARD_POINT_REVOKED"), eq(grant.getId()));
        verify(dispatcher).dispatchImmediate(eq(orgId), eq("reward_grant_revoked"), eq(grantor), eq(unit),
                any(), any(), eq("REWARD_GRANT"), eq(grant.getId()));
        // Không bao giờ còn gửi loại "được cộng điểm" cho điểm bị trừ.
        verify(dispatcher, never()).dispatchImmediate(any(), anyString(), any(), any(), any(), any(), eq("REWARD_POINT"), any());
        verify(dispatcher, never()).dispatch(any(), anyString(), any(), any(), any(), any(), eq("REWARD_POINT"), any());
    }

    @Test
    void revertingProgramRun_sendsRevokedType() {
        RewardProgramRun run = run();
        when(runItemRepository.findByRunIdOrderByOrderIndexAsc(run.getId())).thenReturn(List.of(runItem(run, recipient)));

        listener.handleRunReverted(new RewardEvents.RunReverted(run.getId(), admin.getId()));

        verify(dispatcher).dispatchImmediate(eq(orgId), eq("reward_program_reverted"), eq(recipient), eq(unit),
                any(), any(), eq("REWARD_POINT_REVOKED"), eq(run.getId()));
        verify(dispatcher, never()).dispatchImmediate(any(), anyString(), any(), any(), any(), any(), eq("REWARD_POINT"), any());
    }

    @Test
    void receivingPoints_keepsPointType() {
        RewardGrant grant = grant();
        when(grantItemRepository.findByGrantId(grant.getId())).thenReturn(List.of(item(grant, recipient)));

        listener.handleGrantIssued(new RewardEvents.GrantIssued(grant.getId(), grantor.getId()));

        verify(dispatcher).dispatch(eq(orgId), eq("reward_points_received"), eq(recipient), eq(unit),
                any(), any(), eq("REWARD_POINT"), eq(grant.getId()));
        verify(dispatcher, never()).dispatch(any(), anyString(), any(), any(), any(), any(), eq("REWARD_POINT_REVOKED"), any());
    }

    @Test
    void issuingProgramRun_keepsPointType() {
        RewardProgramRun run = run();
        when(runItemRepository.findByRunIdOrderByOrderIndexAsc(run.getId())).thenReturn(List.of(runItem(run, recipient)));

        listener.handleRunIssued(new RewardEvents.RunIssued(run.getId(), admin.getId()));

        verify(dispatcher).dispatch(eq(orgId), eq("reward_program_issued"), eq(recipient), eq(unit),
                any(), any(), eq("REWARD_POINT"), eq(run.getId()));
    }

    // ── Dữ liệu ──

    private static User user(String name) {
        User u = new User();
        u.setId(UUID.randomUUID());
        u.setFullName(name);
        u.setEmail(name.replace(' ', '.') + "@test.local");
        return u;
    }

    private RewardGrant grant() {
        RewardGrant g = RewardGrant.builder().id(UUID.randomUUID()).organization(org).orgUnit(unit).grantor(grantor)
                .totalPoints(40).reason("Thưởng").build();
        when(grantRepository.findById(g.getId())).thenReturn(Optional.of(g));
        return g;
    }

    private static RewardGrantItem item(RewardGrant grant, User user) {
        return RewardGrantItem.builder().id(UUID.randomUUID()).grant(grant).user(user).points(40).build();
    }

    private RewardProgramRun run() {
        RewardProgram program = RewardProgram.builder().id(UUID.randomUUID()).name("Top KPI").build();
        RewardProgramRun r = RewardProgramRun.builder().id(UUID.randomUUID()).organization(org).program(program).build();
        when(runRepository.findById(r.getId())).thenReturn(Optional.of(r));
        return r;
    }

    private static RewardProgramRunItem runItem(RewardProgramRun run, User user) {
        return RewardProgramRunItem.builder().id(UUID.randomUUID()).run(run).user(user).rank(1).orderIndex(1).points(25).build();
    }
}
