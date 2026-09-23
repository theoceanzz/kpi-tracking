package com.kpitracking.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.kpi.KpiCriteriaResponse;
import com.kpitracking.entity.KpiCycle;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.repository.ConversationMessageRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiCycleRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.KpiCriteriaService;
import com.kpitracking.service.KpiCycleEvaluationService;
import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.service.ai.action.ActionSupport;
import com.kpitracking.service.ai.action.PendingAction;
import com.kpitracking.service.ai.action.PendingActionStore;
import com.kpitracking.service.ai.agent.AgentState;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.CycleEvaluationRequest;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.SubmitKpisRequest;
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
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Hai tool mới của đợt "5 tool": gửi duyệt KPI (GHI) và đợt đánh giá (ĐỌC). Trọng tâm vẫn là
 * chốt chặn: ngoài cây đơn vị phải bị chặn TRƯỚC khi dựng lời mời; luật trọng số 100 % kiểm trước
 * khi mời; đợt được chọn đúng "đợt đang diễn ra".
 */
class NewToolsTest {

    private static final String MY_PATH = "/cty/it/";

    private OrgUnitRepository orgUnitRepository;
    private OrgUnitStatisticService stats;
    private KpiCriteriaService kpiCriteriaService;
    private PendingActionStore store;
    private ToolSupport support;
    private KpiSubmitTool submitTool;

    private final UUID myUnitId = UUID.randomUUID();
    private final UUID me = UUID.randomUUID();
    private final AgentState st = AgentState.forToolsOnly();

    @BeforeEach
    void setUp() {
        orgUnitRepository = mock(OrgUnitRepository.class);
        stats = mock(OrgUnitStatisticService.class);
        kpiCriteriaService = mock(KpiCriteriaService.class);
        store = new PendingActionStore();
        support = new ToolSupport(orgUnitRepository, mock(UserRoleOrgUnitRepository.class), mock(UserRepository.class),
                mock(KpiCriteriaRepository.class), mock(ConversationMessageRepository.class),
                stats, mock(FollowupContextStore.class), new ObjectMapper());
        support.initToolMapper();
        submitTool = new KpiSubmitTool(kpiCriteriaService, support, new ActionSupport(store, support));
        unitAt(myUnitId, MY_PATH);
    }

    private InvocationParameters ctx() {
        return new InvocationParameters(Map.of(
                "orgUnitId", myUnitId.toString(),
                "organizationId", UUID.randomUUID().toString(),
                "orgUnitPath", MY_PATH,
                "userId", me,
                "conversationId", "conv-1",
                AgentState.CONTEXT_KEY, st));
    }

    private void unitAt(UUID id, String path) {
        OrgUnit unit = new OrgUnit();
        unit.setId(id);
        unit.setPath(path);
        unit.setName("Đơn vị " + path);
        when(orgUnitRepository.findById(id)).thenReturn(Optional.of(unit));
    }

    private KpiCriteriaResponse draft(String name, UUID creator) {
        KpiCriteriaResponse k = new KpiCriteriaResponse();
        k.setId(UUID.randomUUID());
        k.setName(name);
        k.setWeight(50.0);
        k.setTargetValue(10.0);
        k.setStatus(KpiStatus.DRAFT);
        k.setCreatedById(creator);
        k.setCreatedByName(creator.equals(me) ? "Tôi" : "Người khác");
        return k;
    }

    private void stubDrafts(KpiCriteriaResponse... kpis) {
        PageResponse<KpiCriteriaResponse> page = new PageResponse<>();
        page.setContent(List.of(kpis));
        when(kpiCriteriaService.getKpiCriteria(anyInt(), anyInt(), eq(KpiStatus.DRAFT), any(), any(), any(), any(),
                any(), any(), any(), anyString(), anyString(), any(), any(), any(), eq(false), any(), any(), any(), any()))
                .thenReturn(page);
    }

    @Nested
    @DisplayName("submit_kpis_for_approval")
    class Submit {

        @Test
        @DisplayName("đơn vị ngoài cây -> chặn TRƯỚC khi dựng lời mời, kho lời mời trống")
        void outsideSubtreeIsBlockedBeforeProposal() {
            UUID other = UUID.randomUUID();
            unitAt(other, "/cty/comm/");

            String out = submitTool.submitKpis(new SubmitKpisRequest(null, other.toString(), "Tháng 6/2026", null), ctx());

            assertThat(out).contains("\"error\"");
            assertThat(store.size()).isZero();
            verify(kpiCriteriaService, never()).getKpiCriteria(anyInt(), anyInt(), any(), any(), any(), any(), any(),
                    any(), any(), any(), anyString(), anyString(), any(), any(), any(), any(boolean.class), any(), any(), any(), any());
        }

        @Test
        @DisplayName("tổng trọng số khác 100 % -> báo thiếu/thừa, KHÔNG mời xác nhận")
        void weightMismatchBlocks() {
            stubPeriod();
            stubDrafts(draft("Uptime", me));
            when(kpiCriteriaService.calculateTotalWeightByOrgUnit(eq(myUnitId), any())).thenReturn(80.0);

            String out = submitTool.submitKpis(new SubmitKpisRequest(null, null, "Tháng 6/2026", null), ctx());

            assertThat(out).contains("\"blocked\":true").contains("THIẾU 20");
            assertThat(store.size()).isZero();
        }

        @Test
        @DisplayName("chỉ tiêu do người khác tạo bị tách riêng, không lặng lẽ biến mất")
        void othersDraftsAreReportedNotHidden() {
            stubPeriod();
            stubDrafts(draft("Của người khác", UUID.randomUUID()));

            String out = submitTool.submitKpis(new SubmitKpisRequest(null, null, "Tháng 6/2026", null), ctx());

            assertThat(out).contains("\"nothingToDo\":true").contains("chỉ người tạo mới gửi duyệt được");
            assertThat(store.size()).isZero();
        }

        @Test
        @DisplayName("đủ 100 %, KPI của mình -> lời mời với đúng số mục, KHÔNG gọi dịch vụ gửi")
        void proposesWithoutSubmitting() {
            stubPeriod();
            stubDrafts(draft("Uptime", me), draft("Ticket 4h", me), draft("Của người khác", UUID.randomUUID()));
            when(kpiCriteriaService.calculateTotalWeightByOrgUnit(eq(myUnitId), any())).thenReturn(100.0);

            String out = submitTool.submitKpis(new SubmitKpisRequest(null, null, "Tháng 6/2026", null), ctx());

            assertThat(out).contains("skippedNotCreatedByYou");
            assertThat(store.size()).isEqualTo(1);
            PendingAction action = store.takeLatestFor(me, "conv-1");
            assertThat(action.kind()).isEqualTo(PendingAction.Kind.KPI_SUBMIT);
            assertThat(action.items()).hasSize(2);
            verify(kpiCriteriaService, never()).bulkSubmitForApproval(any());
        }

        private void stubPeriod() {
            when(stats.searchKpiPeriods(any(), anyString(), anyInt()))
                    .thenReturn(List.of(Map.of("id", UUID.randomUUID().toString(), "name", "Tháng 6/2026")));
        }
    }

    @Nested
    @DisplayName("get_cycle_evaluation")
    class Cycle {

        private KpiCycleRepository cycles;
        private KpiCycleEvaluationService evaluation;
        private CycleEvaluationTool tool;

        @BeforeEach
        void init() {
            cycles = mock(KpiCycleRepository.class);
            evaluation = mock(KpiCycleEvaluationService.class);
            tool = new CycleEvaluationTool(evaluation, cycles, orgUnitRepository, support);
        }

        private KpiCycle cycle(String name, Instant start, Instant end) {
            KpiCycle c = new KpiCycle();
            c.setId(UUID.randomUUID());
            c.setName(name);
            c.setStartDate(start);
            c.setEndDate(end);
            return c;
        }

        @Test
        @DisplayName("không nêu tên -> chọn đợt ĐANG diễn ra, không phải đợt mới nhất trong tương lai")
        void picksRunningCycle() {
            Instant now = Instant.now();
            KpiCycle future = cycle("Tháng sau", now.plus(10, ChronoUnit.DAYS), now.plus(40, ChronoUnit.DAYS));
            KpiCycle running = cycle("Tháng này", now.minus(10, ChronoUnit.DAYS), now.plus(10, ChronoUnit.DAYS));
            when(cycles.findByOrganizationIdOrderByStartDateDesc(any())).thenReturn(List.of(future, running));

            assertThat(tool.resolveCycle(null, UUID.randomUUID()).getName()).isEqualTo("Tháng này");
            assertThat(tool.resolveCycle("sau", UUID.randomUUID()).getName()).isEqualTo("Tháng sau");
            assertThat(tool.resolveCycle("không có", UUID.randomUUID())).isNull();
        }

        @Test
        @DisplayName("đơn vị ngoài cây -> chặn, dịch vụ không được gọi")
        void outsideSubtreeIsBlocked() {
            Instant now = Instant.now();
            when(cycles.findByOrganizationIdOrderByStartDateDesc(any()))
                    .thenReturn(List.of(cycle("Tháng này", now.minus(1, ChronoUnit.DAYS), now.plus(1, ChronoUnit.DAYS))));
            UUID other = UUID.randomUUID();
            unitAt(other, "/cty/comm/");

            String out = tool.getCycleEvaluation(new CycleEvaluationRequest("unit", null, other.toString(), null, null, null), ctx());

            assertThat(out).contains("\"error\"");
            verify(evaluation, never()).getUnitCycleSummary(any(), any());
        }

        @Test
        @DisplayName("view lạ -> liệt kê đủ view hợp lệ")
        void unknownViewListsAll() {
            String out = tool.getCycleEvaluation(new CycleEvaluationRequest("xyz", null, null, null, null, null), ctx());
            assertThat(out).contains("\"error\"").contains("unit").contains("chain").contains("users");
        }
    }

    @Test
    @DisplayName("get_my_tasks: ô không có quyền ghi 'không có quyền', các ô khác vẫn chạy")
    void myTasksSkipsBucketsWithoutPermission() {
        PermissionChecker permissions = mock(PermissionChecker.class);
        when(permissions.hasPermission(eq(me), eq("REMINDER:SEND"))).thenReturn(true);
        when(stats.getNonSubmitters(eq(myUnitId), any(), any(), any(), anyInt()))
                .thenReturn(Map.of("nonSubmitters", List.of(Map.of("fullName", "A", "missingKpiCount", 2))));
        MyTasksTool tool = new MyTasksTool(mock(com.kpitracking.service.KpiSubmissionService.class), kpiCriteriaService,
                mock(com.kpitracking.service.KpiAdjustmentService.class), stats,
                mock(KpiCycleEvaluationService.class), mock(CycleEvaluationTool.class), permissions, support);

        String out = tool.getMyTasks(new OrgUnitStatisticToolRequests.MyTasksRequest(null, null, null), ctx());

        assertThat(out).contains("\"totalPending\":1").contains("A (thiếu 2 KPI)")
                .contains("không có quyền SUBMISSION:REVIEW");
    }
}
