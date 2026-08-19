package com.kpitracking.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.repository.ConversationMessageRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.AnalyticsRequest;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.KpiRequest;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.PeopleRequest;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.RankRequest;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.SearchRequest;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.SubmissionsRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.ai.chat.model.ToolContext;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Test cho luật quan trọng nhất của thiết kế composite: <b>tham số không thuộc view/subject đã chọn
 * phải bị TỪ CHỐI, không được lờ đi</b>.
 *
 * <p>Vì sao đáng một lớp test riêng: gộp nhiều tool thành một làm schema của mỗi tool trở thành hợp
 * của tham số mọi view. Nếu lờ tham số thừa thì model tưởng đã lọc rồi báo cáo số liệu CHƯA lọc —
 * người dùng nhận một câu trả lời trôi chảy nhưng sai, và không có gì báo động. Chính codebase này
 * đã ghi lại bài học đó trong comment ở {@code OrgUnitStatisticToolRequests}.
 *
 * <p>Mỗi test kiểm hai điều: lỗi trả về nêu đúng tham số sai, và <b>tầng service không hề bị gọi</b>
 * — tức là đã chặn TRƯỚC khi chạm dữ liệu.
 */
class CompositeToolValidationTest {

    private OrgUnitStatisticService service;
    private ToolSupport support;
    private ToolContext context;

    @BeforeEach
    void setUp() {
        service = mock(OrgUnitStatisticService.class);
        support = new ToolSupport(
                mock(OrgUnitRepository.class),
                mock(UserRoleOrgUnitRepository.class),
                mock(UserRepository.class),
                mock(KpiCriteriaRepository.class),
                mock(ConversationMessageRepository.class),
                service,
                mock(DisambiguationGuard.class),
                mock(FollowupContextStore.class),
                new ObjectMapper());
        support.initToolMapper();
        context = new ToolContext(Map.of(
                "orgUnitId", UUID.randomUUID().toString(),
                "organizationId", UUID.randomUUID().toString(),
                "orgUnitPath", "/cty/it/"));
    }

    /**
     * Ngữ cảnh KHÔNG có orgUnitPath: {@code validateSubtreeAccess} bỏ qua phép kiểm phạm vi, để
     * test tập trung vào giá trị được truyền xuống service thay vì phải dựng cả cây đơn vị giả.
     */
    private ToolContext noScopeContext() {
        return new ToolContext(Map.of(
                "orgUnitId", UUID.randomUUID().toString(),
                "organizationId", UUID.randomUUID().toString()));
    }

    /** Kết quả tool là JSON; lỗi nằm ở khoá "error". */
    private static void assertRejected(String json, String... mustMention) {
        assertThat(json).contains("\"error\"");
        for (String s : mustMention) {
            assertThat(json).contains(s);
        }
    }

    // ════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("rank: lọc theo chức vụ không dùng được khi xếp hạng ĐƠN VỊ")
    void rankRejectsPositionFilterForOrgUnits() {
        RankTool tool = new RankTool(service, mock(FollowupContextStore.class), support);

        String json = tool.rank(new RankRequest("org_units", "average_performance", null, null,
                null, "Phòng IT", null, null, null, null, null, "trưởng phòng", null, null), context);

        assertRejected(json, "positionName", "subject=members");
        verifyNoInteractions(service);
    }

    @Test
    @DisplayName("rank: subject sai thì báo rõ giá trị hợp lệ")
    void rankRejectsUnknownSubject() {
        RankTool tool = new RankTool(service, mock(FollowupContextStore.class), support);

        String json = tool.rank(new RankRequest("phong_ban", null, null, null,
                null, null, null, null, null, null, null, null, null, null), context);

        assertRejected(json, "members", "org_units");
        verifyNoInteractions(service);
    }

    @Test
    @DisplayName("rank: KHÔNG nêu đơn vị thì phải kẹp về đơn vị hiện tại, không xếp hạng cả công ty")
    void rankWithoutUnitStaysInCallerScope() {
        RankTool tool = new RankTool(service, mock(FollowupContextStore.class), support);

        // Model hỏi "xếp hạng toàn bộ nhân viên công ty" -> scope=organization, không có unitName.
        tool.rank(new RankRequest("members", "average_progress", null, "organization",
                null, null, null, null, null, null, null, null, null, null), context);

        // Nhánh scope != unit/kpi trong service gọi findUsersByOrganizationId -> CẢ CÔNG TY.
        // Tool phải đổi scope thành "unit" để service chỉ lấy người trong subtree của người hỏi.
        ArgumentCaptor<String> scope = ArgumentCaptor.forClass(String.class);
        verify(service).rankMembers(any(), any(), any(), scope.capture(), any(), any(), any(),
                any(), any(), any(), any(), any(), any());
        assertThat(scope.getValue())
                .as("scope phải bị kẹp về 'unit'; để nguyên 'organization' là rò dữ liệu giữa đơn vị")
                .isEqualTo("unit");
    }

    @Test
    @DisplayName("get_analytics: time_series không nhận khoảng ngày, phải dùng lookback")
    void analyticsRejectsDateRangeForTimeSeries() {
        AnalyticsTool tool = new AnalyticsTool(service, support);

        String json = tool.getAnalytics(new AnalyticsRequest("time_series", null, null,
                "2026-01-01", "2026-06-30", "completion", "MONTH", 6), context);

        assertRejected(json, "lookback");
        verifyNoInteractions(service);
    }

    @Test
    @DisplayName("get_analytics: dashboard không nhận metric/granularity của time_series")
    void analyticsRejectsSeriesParamsForDashboard() {
        AnalyticsTool tool = new AnalyticsTool(service, support);

        String json = tool.getAnalytics(new AnalyticsRequest("dashboard", null, null,
                null, null, "completion", null, null), context);

        assertRejected(json, "view=time_series");
        verifyNoInteractions(service);
    }

    @Test
    @DisplayName("get_kpi: view theo MỘT KPI không nhận unitName")
    void kpiRejectsUnitForPerKpiView() {
        KpiTool tool = new KpiTool(service, support);

        String json = tool.getKpi(new KpiRequest("detail", "Phòng IT", null, UUID.randomUUID().toString(),
                null, null, null, null, null, null, null, null, null, null, null, null, null, null), context);

        assertRejected(json, "unitName");
        verifyNoInteractions(service);
    }

    @Test
    @DisplayName("get_kpi: view theo ĐƠN VỊ không nhận kpiId")
    void kpiRejectsKpiIdForUnitView() {
        KpiTool tool = new KpiTool(service, support);

        String json = tool.getKpi(new KpiRequest("list", null, null, UUID.randomUUID().toString(),
                null, null, null, null, null, null, null, null, null, null, null, null, null, null), context);

        assertRejected(json, "kpiId");
        verifyNoInteractions(service);
    }

    @Test
    @DisplayName("get_kpi: view=assignees nhận kpiName và GỘP người được giao qua mọi kỳ")
    void assigneesByNameMergesAcrossPeriods() {
        String kpi = "Code review";
        String id1 = UUID.randomUUID().toString(), id2 = UUID.randomUUID().toString();
        when(service.searchKpis(any(), anyString(), anyInt())).thenReturn(List.of(
                Map.of("id", id1, "name", kpi, "periodName", "Tháng 4/2026"),
                Map.of("id", id2, "name", kpi, "periodName", "Tháng 5/2026")));
        // Cùng một người được giao ở CẢ HAI kỳ -> phải khử trùng, không đếm hai lần.
        Map<String, Object> anh = Map.of("fullName", "Hoàng Văn TeamLead", "email", "lead@demo.com");
        Map<String, Object> chi = Map.of("fullName", "Phạm Thị Staff", "email", "staff@demo.com");
        when(service.getKpiAssignees(UUID.fromString(id1)))
                .thenReturn(Map.of("assignees", List.of(anh, chi)));
        when(service.getKpiAssignees(UUID.fromString(id2)))
                .thenReturn(Map.of("assignees", List.of(anh)));

        String json = new KpiTool(service, support).getKpi(new KpiRequest("assignees", null, null, null,
                kpi, null, null, null, null, null, null, null, null, null, null, null, null, null), noScopeContext());

        assertThat(json).doesNotContain("\"error\"");
        assertThat(json).contains("\"assigneesCount\":2");           // khử trùng theo email
        assertThat(json).contains("Tháng 4/2026").contains("Tháng 5/2026");
        assertThat(json).contains("lead@demo.com").contains("staff@demo.com");
    }

    @Test
    @DisplayName("get_kpi: view=assignees thiếu cả kpiId lẫn kpiName thì báo rõ cả hai đường")
    void assigneesRequiresIdOrName() {
        String json = new KpiTool(service, support).getKpi(new KpiRequest("assignees", null, null, null,
                null, null, null, null, null, null, null, null, null, null, null, null, null, null), context);

        assertRejected(json, "kpiId", "kpiName");
        verifyNoInteractions(service);
    }

    @Test
    @DisplayName("get_kpi: view=detail thiếu kpiId thì chỉ rõ cách lấy ID")
    void kpiDetailRequiresKpiId() {
        KpiTool tool = new KpiTool(service, support);

        String json = tool.getKpi(new KpiRequest("detail", null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null), context);

        assertRejected(json, "kpiId", "search (entityType=kpi)");
        verifyNoInteractions(service);
    }

    @Test
    @DisplayName("get_people: KHÔNG truyền includeChildUnits thì mặc định tính CẢ đơn vị con")
    void peopleListDefaultsToWholeSubtree() {
        when(service.searchOrgUnits(any(), anyString(), anyInt()))
                .thenReturn(List.of(Map.of("id", UUID.randomUUID().toString(), "name", "Phòng IT")));
        PeopleTool tool = new PeopleTool(service, support);

        tool.getPeople(new PeopleRequest("list", "Phòng IT", null, null,
                null, null, null, null, null, null, null, null, null, null, null, null, null), noScopeContext());

        // "Phòng IT có bao nhiêu người" phải ra cả phòng (8), không phải chỉ trưởng+phó (2).
        ArgumentCaptor<Boolean> subtree = ArgumentCaptor.forClass(Boolean.class);
        verify(service).getMembers(any(), subtree.capture(), any(), any(), any(), any(), any(), any());
        assertThat(subtree.getValue())
                .as("mặc định false khiến 'Phòng IT có bao nhiêu người' trả 2 thay vì 8 — sai mà không báo lỗi")
                .isTrue();
    }

    @Test
    @DisplayName("get_people: truyền includeChildUnits=false thì tôn trọng, chỉ lấy người gắn trực tiếp")
    void peopleListRespectsExplicitFalse() {
        when(service.searchOrgUnits(any(), anyString(), anyInt()))
                .thenReturn(List.of(Map.of("id", UUID.randomUUID().toString(), "name", "Phòng IT")));
        PeopleTool tool = new PeopleTool(service, support);

        tool.getPeople(new PeopleRequest("list", "Phòng IT", null, null,
                false, null, null, null, null, null, null, null, null, null, null, null, null), noScopeContext());

        ArgumentCaptor<Boolean> subtree = ArgumentCaptor.forClass(Boolean.class);
        verify(service).getMembers(any(), subtree.capture(), any(), any(), any(), any(), any(), any());
        assertThat(subtree.getValue()).isFalse();
    }

    @Test
    @DisplayName("get_people: view=me không nhận userId của người khác")
    void peopleMeRejectsUserId() {
        PeopleTool tool = new PeopleTool(service, support);

        String json = tool.getPeople(new PeopleRequest("me", null, null, UUID.randomUUID().toString(),
                null, null, null, null, null, null, null, null, null, null, null, null, null), context);

        assertRejected(json, "view=user_summary");
        verifyNoInteractions(service);
    }

    @Test
    @DisplayName("get_submissions: history không nhận unitName — đó là của non_submitters")
    void submissionsHistoryRejectsUnit() {
        SubmissionTool tool = new SubmissionTool(service, support);

        String json = tool.getSubmissions(new SubmissionsRequest("history", null, "KPI doanh thu",
                null, null, "Phòng IT", null, null, null, null, null), context);

        assertRejected(json, "view=non_submitters");
        verifyNoInteractions(service);
    }

    @Test
    @DisplayName("get_submissions: non_submitters không nhận kpiName — nó đếm trên toàn đơn vị")
    void submissionsNonSubmittersRejectsKpiName() {
        SubmissionTool tool = new SubmissionTool(service, support);

        String json = tool.getSubmissions(new SubmissionsRequest("non_submitters", null, "KPI doanh thu",
                null, null, null, null, null, null, null, null), context);

        assertRejected(json, "view=history");
        verifyNoInteractions(service);
    }

    @Test
    @DisplayName("search: unitId/positionName chỉ dành cho entityType=user")
    void searchRejectsUserFiltersForOtherEntities() {
        SearchTool tool = new SearchTool(service, support);

        String json = tool.search(new SearchRequest("kpi", "doanh thu",
                UUID.randomUUID().toString(), null, null), context);

        assertRejected(json, "entityType=user");
        verifyNoInteractions(service);
    }

    @Test
    @DisplayName("search: đường HỎI LÀM RÕ cũng phải ghi nhận là tool đã chạy")
    void ambiguousPathStillCountsAsToolCall() {
        // Trùng tên -> tool trả về danh sách để người dùng chọn. Đây là đường ra THỨ HAI, không đi
        // qua respond(). Bỏ sót ghi nhận ở đây khiến ValidationStage tưởng lượt đó không lấy được
        // dữ liệu nào rồi chặn nhầm — đã đo được 4 câu bị chặn oan vì đúng lỗi này.
        String dup = "API hoàn thành";
        when(service.searchKpis(any(), anyString(), anyInt())).thenReturn(List.of(
                Map.of("id", UUID.randomUUID().toString(), "name", dup, "periodName", "Tháng 4/2026"),
                Map.of("id", UUID.randomUUID().toString(), "name", dup, "periodName", "Tháng 5/2026")));
        ToolCallTracker.clear();
        SearchTool tool = new SearchTool(service, support);

        String json = tool.search(new SearchRequest("kpi", dup, null, null, null), noScopeContext());

        assertThat(json).contains("NEEDS_DISAMBIGUATION");
        assertThat(ToolCallTracker.anyCalled())
                .as("hỏi làm rõ vẫn là tool đã lấy được dữ liệu thật")
                .isTrue();
        ToolCallTracker.clear();
    }

    @Test
    @DisplayName("search: entityType sai thì liệt kê đủ giá trị hợp lệ để model tự sửa")
    void searchRejectsUnknownEntityType() {
        SearchTool tool = new SearchTool(service, support);

        String json = tool.search(new SearchRequest("nhan_vien_gi_do", "abc", null, null, null), context);

        assertRejected(json, "user", "org_unit", "kpi", "position", "period");
        verifyNoInteractions(service);
    }

    @Test
    @DisplayName("search: chấp nhận vài cách viết quen thuộc thay vì bắt lỗi cứng")
    void searchNormalizesCommonAliases() {
        // "users" (số nhiều) phải được hiểu là "user" và ĐI TIẾP tới service chứ không bị từ chối.
        // Model nhỏ hay viết số nhiều/gạch nối; bắt lỗi cứng ở đây chỉ tốn thêm một vòng gọi.
        when(service.searchUsers(any(), anyString(), any(), any(), anyInt()))
                .thenReturn(List.of(Map.of("id", UUID.randomUUID().toString(), "fullName", "Phạm Thị Staff")));
        SearchTool tool = new SearchTool(service, support);

        String json = tool.search(new SearchRequest("users", "Staff", null, null, null), context);

        assertThat(json).doesNotContain("\"error\"");
        assertThat(json).contains("\"users\"").contains("Phạm Thị Staff");
    }
}
