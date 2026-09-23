package com.kpitracking.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.ai.tool.KeyGoToolProvider;
import com.kpitracking.dto.response.kpi.CycleUnitEvaluationResponse;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiCycle;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Role;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.CycleUnitEvalStatus;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.repository.ConversationMessageRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiCycleRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.KpiCycleEvaluationService;
import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.action.ActionSupport;
import com.kpitracking.service.ai.action.PendingAction;
import com.kpitracking.service.ai.action.PendingActionStore;
import com.kpitracking.service.ai.agent.AgentState;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.CycleFinalizeRequest;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.DecomposeKpiRequest;
import dev.langchain4j.invocation.InvocationParameters;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Đợt "use case còn lại": chốt đợt (rủi ro cao), phân rã chỉ tiêu, và bộ lọc theo cờ tổ chức.
 * Vẫn là chốt chặn: không mời khi điều kiện sai; con số chia phải cộng đúng cha; tool của tính
 * năng đã tắt không được lọt vào bộ tool.
 */
class UseCaseToolsTest {

    private static final String MY_PATH = "/cty/it/";

    private OrgUnitRepository orgUnitRepository;
    private ToolSupport support;
    private PendingActionStore store;
    private ActionSupport actions;
    private final UUID myUnitId = UUID.randomUUID();
    private final UUID me = UUID.randomUUID();
    private final AgentState st = AgentState.forToolsOnly();

    @BeforeEach
    void setUp() {
        orgUnitRepository = mock(OrgUnitRepository.class);
        store = new PendingActionStore();
        support = new ToolSupport(orgUnitRepository, mock(UserRoleOrgUnitRepository.class), mock(UserRepository.class),
                mock(KpiCriteriaRepository.class), mock(ConversationMessageRepository.class),
                mock(OrgUnitStatisticService.class), mock(FollowupContextStore.class), new ObjectMapper());
        support.initToolMapper();
        actions = new ActionSupport(store, support);
        unitAt(myUnitId, MY_PATH, "Phòng IT");
    }

    private InvocationParameters ctx() {
        return new InvocationParameters(Map.of(
                "orgUnitId", myUnitId.toString(), "organizationId", UUID.randomUUID().toString(),
                "orgUnitPath", MY_PATH, "userId", me, "conversationId", "conv-1", AgentState.CONTEXT_KEY, st));
    }

    private OrgUnit unitAt(UUID id, String path, String name) {
        OrgUnit unit = new OrgUnit();
        unit.setId(id);
        unit.setPath(path);
        unit.setName(name);
        when(orgUnitRepository.findById(id)).thenReturn(Optional.of(unit));
        return unit;
    }

    @Test
    @DisplayName("tổ chức tắt hạnh kiểm/thưởng -> đúng các tool đó bị ẩn, kể cả bản cá nhân")
    void featureFlagsHideTools() {
        assertThat(KeyGoToolProvider.hiddenByFeatures(AiTurn.OrgFeatures.NONE))
                .containsExactlyInAnyOrder("get_conduct", "get_my_conduct", "get_rewards", "review_reward_grants", "get_my_rewards");
        assertThat(KeyGoToolProvider.hiddenByFeatures(new AiTurn.OrgFeatures(true, false, false, false, false)))
                .containsExactlyInAnyOrder("get_rewards", "review_reward_grants", "get_my_rewards");
        assertThat(KeyGoToolProvider.hiddenByFeatures(new AiTurn.OrgFeatures(true, true, false, false, false))).isEmpty();
    }

    @Nested
    @DisplayName("finalize_cycle_evaluation")
    class Finalize {
        private KpiCycleEvaluationService evaluation;
        private CycleFinalizeTool tool;
        private KpiCycle cycle;

        @BeforeEach
        void init() {
            evaluation = mock(KpiCycleEvaluationService.class);
            KpiCycleRepository cycles = mock(KpiCycleRepository.class);
            cycle = new KpiCycle();
            cycle.setId(UUID.randomUUID());
            cycle.setName("Quý 2/2026");
            cycle.setStartDate(Instant.now().minus(30, ChronoUnit.DAYS));
            cycle.setEndDate(Instant.now().plus(30, ChronoUnit.DAYS));
            when(cycles.findByOrganizationIdOrderByStartDateDesc(any())).thenReturn(List.of(cycle));
            PermissionChecker permissions = mock(PermissionChecker.class);
            when(permissions.hasPermission(any(), any())).thenReturn(true);
            tool = new CycleFinalizeTool(evaluation, new CycleEvaluationTool(evaluation, cycles, orgUnitRepository, support),
                    orgUnitRepository, permissions, support, actions);
        }

        private CycleUnitEvaluationResponse unit(CycleUnitEvalStatus status) {
            CycleUnitEvaluationResponse r = new CycleUnitEvaluationResponse();
            r.setOrgUnitName("Phòng IT");
            r.setStatus(status);
            r.setSelfScore(84.0);
            r.setManagerScore(82.0);
            r.setMemberCount(8);
            return r;
        }

        @Test
        @DisplayName("đã chốt rồi -> báo chặn, KHÔNG mời xác nhận")
        void alreadyFinalizedBlocks() {
            when(evaluation.getUnitCycleSummary(any(), any())).thenReturn(unit(CycleUnitEvalStatus.FINALIZED));

            String out = tool.finalizeCycle(new CycleFinalizeRequest("finalize", null, null, null, null), ctx());

            assertThat(out).contains("\"blocked\":true").contains("ĐÃ chốt");
            assertThat(store.size()).isZero();
        }

        @Test
        @DisplayName("chưa chốt -> lời mời kèm preview điểm từng người; dịch vụ chốt KHÔNG được gọi")
        void proposesWithPreview() {
            when(evaluation.getUnitCycleSummary(any(), any())).thenReturn(unit(CycleUnitEvalStatus.DRAFT));
            OrgUnit mine = unitAt(myUnitId, MY_PATH, "Phòng IT"); // stub trước, không lồng when() trong when()
            when(orgUnitRepository.findAllInSubtrees(any(), any())).thenReturn(List.of(mine));
            when(evaluation.listUserRankings(any())).thenReturn(List.of());

            String out = tool.finalizeCycle(new CycleFinalizeRequest("finalize", null, null, null, "ok"), ctx());

            assertThat(out).contains("\"preview\"").contains("\"unitSelfScore\":84.0");
            PendingAction a = store.takeLatestFor(me, "conv-1");
            assertThat(a.kind()).isEqualTo(PendingAction.Kind.CYCLE_FINALIZE);
            assertThat(a.items()).hasSize(1);
            assertThat(a.items().get(0).relatedId()).isEqualTo(cycle.getId());
            verify(evaluation, never()).finalizeUnitCycle(any(), any(), any());
        }

        @Test
        @DisplayName("đơn vị anh em -> chặn trước khi dựng lời mời")
        void siblingIsBlocked() {
            UUID other = UUID.randomUUID();
            unitAt(other, "/cty/comm/", "Phòng Truyền Thông");
            String out = tool.finalizeCycle(new CycleFinalizeRequest("finalize", null, other.toString(), null, null), ctx());
            assertThat(out).contains("\"error\"");
            assertThat(store.size()).isZero();
        }
    }

    @Nested
    @DisplayName("decompose_kpi")
    class Decompose {
        private KpiCriteriaRepository kpis;
        private UserRoleOrgUnitRepository memberships;
        private KpiDecomposeTool tool;
        private KpiCriteria parent;
        private final UUID teamA = UUID.randomUUID();
        private final UUID teamB = UUID.randomUUID();

        @BeforeEach
        void init() {
            kpis = mock(KpiCriteriaRepository.class);
            memberships = mock(UserRoleOrgUnitRepository.class);
            parent = new KpiCriteria();
            parent.setId(UUID.randomUUID());
            parent.setName("Nâng mức hài lòng");
            parent.setOrgUnit(unitAt(myUnitId, MY_PATH, "Phòng IT"));
            parent.setTargetValue(100.0);
            parent.setWeight(60.0);
            parent.setUnit("%");
            parent.setStatus(KpiStatus.APPROVED);
            when(kpis.findById(parent.getId())).thenReturn(Optional.of(parent));
            when(kpis.findByParentId(parent.getId())).thenReturn(List.of());
            OrgUnit a = unitAt(teamA, MY_PATH + "backend/", "Team Backend");
            OrgUnit b = unitAt(teamB, MY_PATH + "frontend/", "Team Frontend");
            when(orgUnitRepository.findByParentId(myUnitId)).thenReturn(List.of(a, b));
            when(memberships.findByOrgUnitId(teamA)).thenReturn(members(3));
            when(memberships.findByOrgUnitId(teamB)).thenReturn(members(1));
            // kpiId đi thẳng, không qua search — validateKpiAccess dùng KpiCriteriaRepository của support (mock) -> stub
            tool = new KpiDecomposeTool(kpis, orgUnitRepository, memberships, support, actions);
        }

        private List<UserRoleOrgUnit> members(int n) {
            return java.util.stream.IntStream.range(0, n).mapToObj(i -> {
                UserRoleOrgUnit m = new UserRoleOrgUnit();
                User u = new User();
                u.setId(UUID.randomUUID());
                m.setUser(u);
                m.setRole(new Role());
                return m;
            }).toList();
        }

        @Test
        @DisplayName("chia theo nhân sự 3:1 -> 75/25 mục tiêu, 45/15 trọng số; tổng đúng bằng cha; chưa tạo gì")
        void headcountSplitSumsToParent() {
            String out = tool.decompose(new DecomposeKpiRequest(null, parent.getId().toString(), null, "headcount", null, null, null),
                    ctxWithKpiAccess());

            assertThat(out).contains("\"preview\"");
            PendingAction a = store.takeLatestFor(me, "conv-1");
            assertThat(a.kind()).isEqualTo(PendingAction.Kind.KPI_DECOMPOSE);
            assertThat(a.items()).hasSize(2);
            double target = a.items().stream().mapToDouble(i -> (Double) i.params().get("targetValue")).sum();
            double weight = a.items().stream().mapToDouble(i -> (Double) i.params().get("weight")).sum();
            assertThat(target).isEqualTo(100.0);
            assertThat(weight).isEqualTo(60.0);
            assertThat(a.items().get(0).params().get("targetValue")).isEqualTo(75.0);
            assertThat(a.items().get(0).params().get("relation")).isEqualTo("DECOMPOSITION");
        }

        @Test
        @DisplayName("mọi đơn vị con đã nhận phần -> nothingToDo kèm phần đã chia, không mời (D16)")
        void alreadyDecomposedReportsExistingShares() {
            KpiCriteria childA = new KpiCriteria();
            childA.setOrgUnit(unitAt(teamA, MY_PATH + "backend/", "Team Backend"));
            childA.setTargetValue(60.0);
            childA.setWeight(36.0);
            childA.setParentRelationType(com.kpitracking.enums.KpiParentRelationType.DECOMPOSITION);
            KpiCriteria childB = new KpiCriteria();
            childB.setOrgUnit(unitAt(teamB, MY_PATH + "frontend/", "Team Frontend"));
            childB.setTargetValue(40.0);
            childB.setWeight(24.0);
            when(kpis.findByParentId(parent.getId())).thenReturn(List.of(childA, childB));

            String out = tool.decompose(new DecomposeKpiRequest(null, parent.getId().toString(), null, "headcount", null, null, null),
                    ctxWithKpiAccess());

            assertThat(out).contains("\"nothingToDo\":true").contains("ĐÃ NHẬN")
                    .contains("Team Backend").contains("Team Frontend").contains("36.0");
            assertThat(store.size()).isZero();
        }

        @Test
        @DisplayName("shares tự nêu mà trọng số không bằng cha -> từ chối, không mời")
        void explicitSharesMustMatchParentWeight() {
            String out = tool.decompose(new DecomposeKpiRequest(null, parent.getId().toString(), null, null, null, null,
                    List.of(new OrgUnitStatisticToolRequests.DecomposeShare("Team Backend", 50.0, 20.0),
                            new OrgUnitStatisticToolRequests.DecomposeShare("Team Frontend", 50.0, 20.0))), ctxWithKpiAccess());

            assertThat(out).contains("\"error\"").contains("bằng trọng số cha");
            assertThat(store.size()).isZero();
        }

        /** validateKpiAccess tra KPI qua repository của ToolSupport — trỏ nó về cùng bản ghi cha. */
        private InvocationParameters ctxWithKpiAccess() {
            KpiCriteriaRepository supportRepo = supportKpiRepository();
            when(supportRepo.findById(parent.getId())).thenReturn(Optional.of(parent));
            return ctx();
        }

        private KpiCriteriaRepository supportKpiRepository() {
            try {
                var f = ToolSupport.class.getDeclaredField("kpiCriteriaRepository");
                f.setAccessible(true);
                return (KpiCriteriaRepository) f.get(support);
            } catch (ReflectiveOperationException e) {
                throw new IllegalStateException(e);
            }
        }
    }
}
