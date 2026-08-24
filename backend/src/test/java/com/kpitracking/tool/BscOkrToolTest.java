package com.kpitracking.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.dto.response.okr.KeyResultResponse;
import com.kpitracking.dto.response.okr.ObjectiveResponse;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.enums.OkrStatus;
import com.kpitracking.repository.ConversationMessageRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.BscAnalyticsService;
import com.kpitracking.service.OkrService;
import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.service.ai.agent.AgentState;
import com.kpitracking.service.analytics.AnalyticsPeriodHelper;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.BscRequest;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.OkrRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Test cho hai tool mở rộng ngoài KPI: thẻ điểm cân bằng và mục tiêu.
 *
 * <p>Trọng tâm là <b>chốt chặn phạm vi dữ liệu</b>, vì đó là chỗ dễ rò nhất và đã rò một lần thật:
 * tool {@code rank} từng để câu hỏi không nêu đơn vị rơi vào nhánh trả CẢ CÔNG TY của service.
 * {@code OkrService} có đúng hình dạng nguy hiểm đó — hai hàm đọc đều truy vấn thẳng repository,
 * không kiểm quyền, và một trong hai lấy theo TỔ CHỨC.
 *
 * <p>Gộp hai tool vào một lớp vì chúng dùng chung fixture {@code ToolSupport}, giống cách
 * {@code OrgUnitFormFillToolsTest} gộp ba tool điền form.
 */
class BscOkrToolTest {

    /** Đơn vị của người hỏi. Mọi thứ ngoài tiền tố này phải bị chặn. */
    private static final String MY_PATH = "/cty/it/";

    private BscAnalyticsService bscService;
    private OkrService okrService;
    private OrgUnitRepository orgUnitRepository;
    private ToolSupport support;
    private BscTool bscTool;
    private OkrTool okrTool;

    private final UUID myUnitId = UUID.randomUUID();
    private final AgentState st = AgentState.forToolsOnly();

    @BeforeEach
    void setUp() {
        bscService = mock(BscAnalyticsService.class);
        okrService = mock(OkrService.class);
        orgUnitRepository = mock(OrgUnitRepository.class);

        support = new ToolSupport(
                orgUnitRepository,
                mock(UserRoleOrgUnitRepository.class),
                mock(UserRepository.class),
                mock(KpiCriteriaRepository.class),
                mock(ConversationMessageRepository.class),
                mock(OrgUnitStatisticService.class),
                mock(FollowupContextStore.class),
                new ObjectMapper());
        support.initToolMapper();

        bscTool = new BscTool(bscService, mock(AnalyticsPeriodHelper.class), support);
        okrTool = new OkrTool(okrService, support);
    }

    /** Ngữ cảnh của một trưởng đơn vị: có orgUnitPath nên phép kiểm phạm vi CÓ hiệu lực. */
    private ToolContext ctx() {
        return new ToolContext(Map.of(
                "orgUnitId", myUnitId.toString(),
                "organizationId", UUID.randomUUID().toString(),
                "orgUnitPath", MY_PATH,
                AgentState.CONTEXT_KEY, st));
    }

    /** Dựng một đơn vị với đường dẫn cho trước để lái phép kiểm cây con. */
    private UUID unitAt(String path) {
        UUID id = UUID.randomUUID();
        OrgUnit unit = new OrgUnit();
        unit.setId(id);
        unit.setPath(path);
        when(orgUnitRepository.findById(id)).thenReturn(Optional.of(unit));
        return id;
    }

    private static void assertRejected(String json, String... mustMention) {
        assertThat(json).contains("\"error\"");
        for (String s : mustMention) {
            assertThat(json).contains(s);
        }
    }

    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Thẻ điểm cân bằng (BSC)")
    class Bsc {

        @Test
        @DisplayName("thiếu view -> liệt kê ĐỦ năm giá trị hợp lệ để model tự sửa")
        void missingViewListsAll() {
            String out = bscTool.getBsc(
                    new BscRequest(null, null, null, null, null, null, null), ctx());

            assertRejected(out, "balance", "trend", "unit_comparison", "vs_system", "rankings");
            verify(bscService, never()).getBalance(any(), anyCollection());
        }

        @Test
        @DisplayName("level truyền vào view khác vs_system -> lỗi CỨNG, không lờ đi")
        void levelOnlyForVsSystem() {
            String out = bscTool.getBsc(
                    new BscRequest("balance", null, null, null, null, "MEMBER", null), ctx());

            // Lờ tham số đi thì model tưởng đã xem theo cấp nhân sự rồi kết luận trên số liệu cấp đơn vị.
            assertRejected(out, "level", "vs_system");
            verify(bscService, never()).getBalance(any(), anyCollection());
        }

        @Test
        @DisplayName("limit truyền vào view khác rankings -> lỗi CỨNG")
        void limitOnlyForRankings() {
            String out = bscTool.getBsc(
                    new BscRequest("trend", null, null, null, null, null, 10), ctx());

            assertRejected(out, "limit", "rankings");
        }

        @Test
        @DisplayName("có kỳ CUỐI mà thiếu kỳ ĐẦU -> chặn, vì khoảng kỳ khuyết một biên là vô nghĩa")
        void periodRangeNeedsBothEnds() {
            String out = bscTool.getBsc(
                    new BscRequest("trend", null, null, null, "Tháng 6/2026", null, null), ctx());

            assertRejected(out, "periodName");
        }

        @Test
        @DisplayName("đơn vị NGOÀI cây con -> chặn, không chạm tới service")
        void refusesUnitOutsideSubtree() {
            UUID other = unitAt("/cty/truyenthong/");

            String out = bscTool.getBsc(
                    new BscRequest("balance", null, other.toString(), null, null, null, null), ctx());

            assertRejected(out, "quyền");
            verify(bscService, never()).getBalance(any(), anyCollection());
        }

        @Test
        @DisplayName("không nêu đơn vị -> dùng đơn vị của CHÍNH người hỏi")
        void defaultsToCallerUnit() {
            when(bscService.getBalance(any(), any())).thenReturn(null);

            bscTool.getBsc(new BscRequest("balance", null, null, null, null, null, null), ctx());

            verify(bscService).getBalance(eq(myUnitId), any());
        }
    }

    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Mục tiêu và kết quả then chốt (OKR)")
    class Okr {

        private ObjectiveResponse objective(String name, OkrStatus status, String perspective,
                                            Double... progresses) {
            ObjectiveResponse o = new ObjectiveResponse();
            o.setName(name);
            o.setStatus(status);
            o.setPerspectiveName(perspective);
            o.setKeyResults(java.util.Arrays.stream(progresses).map(p -> {
                KeyResultResponse kr = new KeyResultResponse();
                kr.setProgress(p);
                return kr;
            }).toList());
            return o;
        }

        @Test
        @DisplayName("view sai -> liệt kê đủ giá trị hợp lệ")
        void badViewListsAll() {
            String out = okrTool.getOkr(new OkrRequest("linh tinh", null, null, null, null), ctx());
            assertRejected(out, "objectives", "progress");
        }

        @Test
        @DisplayName("status sai -> liệt kê ba trạng thái CÓ THẬT, không để model đoán")
        void badStatusListsReal() {
            String out = okrTool.getOkr(
                    new OkrRequest("objectives", null, null, null, "ĐANG_TREO"), ctx());
            assertRejected(out, "ACTIVE", "COMPLETED", "CANCELLED");
        }

        @Test
        @DisplayName("đơn vị NGOÀI cây con -> chặn, KHÔNG gọi service")
        void refusesUnitOutsideSubtree() {
            UUID other = unitAt("/cty/truyenthong/");

            String out = okrTool.getOkr(
                    new OkrRequest("objectives", null, other.toString(), null, null), ctx());

            // OkrService truy vấn thẳng repository, không kiểm quyền — nên chặn PHẢI xảy ra ở đây.
            assertRejected(out, "quyền");
            verify(okrService, never()).getObjectivesByOrgUnit(any());
        }

        @Test
        @DisplayName("không nêu đơn vị -> lấy theo đơn vị người hỏi, KHÔNG bao giờ theo cả tổ chức")
        void neverFallsBackToWholeOrganization() {
            when(okrService.getObjectivesByOrgUnit(any())).thenReturn(List.of());

            okrTool.getOkr(new OkrRequest("objectives", null, null, null, null), ctx());

            verify(okrService).getObjectivesByOrgUnit(eq(myUnitId));
            // Đây là chốt chặn quan trọng nhất của lớp test: hàm theo TỔ CHỨC không được đụng tới.
            verify(okrService, never()).getObjectivesByOrganization(any());
        }

        @Test
        @DisplayName("lọc theo viễn cảnh BSC — OKR vốn đã gắn với viễn cảnh")
        void filtersByPerspective() {
            when(okrService.getObjectivesByOrgUnit(any())).thenReturn(List.of(
                    objective("Tăng doanh thu", OkrStatus.ACTIVE, "Tài chính", 50.0),
                    objective("Nâng hài lòng", OkrStatus.ACTIVE, "Khách hàng", 70.0)));

            String out = okrTool.getOkr(
                    new OkrRequest("objectives", null, null, "Tài chính", null), ctx());

            assertThat(out).contains("Tăng doanh thu").doesNotContain("Nâng hài lòng");
        }

        @Test
        @DisplayName("progress: đếm theo trạng thái và tính tiến độ trung bình")
        void aggregatesProgress() {
            when(okrService.getObjectivesByOrgUnit(any())).thenReturn(List.of(
                    objective("A", OkrStatus.ACTIVE, "Tài chính", 40.0, 60.0),
                    objective("B", OkrStatus.COMPLETED, "Tài chính", 100.0)));

            String out = okrTool.getOkr(new OkrRequest("progress", null, null, null, null), ctx());

            assertThat(out).contains("\"totalObjectives\":2");
            assertThat(out).contains("ACTIVE").contains("COMPLETED");
            assertThat(out).contains("\"averageProgress\":66.7");   // (40+60+100)/3
        }

        @Test
        @DisplayName("chưa có kết quả then chốt nào -> KHÔNG bịa ra tiến độ 0%")
        void noKeyResultsMeansNoNumber() {
            when(okrService.getObjectivesByOrgUnit(any())).thenReturn(List.of(
                    objective("Mới lập", OkrStatus.ACTIVE, "Tài chính")));

            String out = okrTool.getOkr(new OkrRequest("progress", null, null, null, null), ctx());

            // "chưa nhập" khác hẳn "đạt 0%" — trả 0 là mời model kết luận đơn vị bết bát.
            assertThat(out).doesNotContain("\"averageProgress\":0");
            assertThat(out).contains("Đừng suy ra con số nào");
            assertThat(out).contains("\"objectivesWithoutKeyResults\":1");
        }
    }
}
