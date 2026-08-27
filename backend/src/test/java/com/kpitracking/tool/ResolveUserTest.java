package com.kpitracking.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Role;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.repository.ConversationMessageRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.service.ai.agent.AgentState;
import com.kpitracking.tool.ToolSupport.UserRef;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Test cho phép giải "tên người → id".
 *
 * <p>Sinh ra cho tool GHI: {@code review_submissions} lọc theo tên người nộp, và chọn nhầm ở đó là
 * <b>duyệt bài của người khác</b> — việc không có nút hoàn tác. Nên hai tính chất dưới đây quan
 * trọng ngang nhau: khớp đúng một người thì đi tiếp, còn <b>trùng tên thì HỎI LẠI chứ không tự
 * chọn</b>.
 *
 * <p>Dùng CHUNG luật khớp tên với đơn vị và KPI (ưu tiên khớp chính xác rồi mới tới khớp gần đúng).
 * Hai luật song song sẽ trôi lệch rồi trả lời khác nhau cho cùng một câu hỏi.
 */
class ResolveUserTest {

    private static final String MY_PATH = "/cty/it/";

    private OrgUnitStatisticService statisticService;
    private UserRoleOrgUnitRepository roleRepository;
    private ToolSupport support;

    private final UUID orgId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        statisticService = mock(OrgUnitStatisticService.class);
        roleRepository = mock(UserRoleOrgUnitRepository.class);

        support = new ToolSupport(
                mock(OrgUnitRepository.class), roleRepository, mock(UserRepository.class),
                mock(KpiCriteriaRepository.class), mock(ConversationMessageRepository.class),
                statisticService, mock(FollowupContextStore.class), new ObjectMapper());
        support.initToolMapper();
    }

    private ToolContext ctx() {
        return new ToolContext(Map.of(
                "orgUnitId", UUID.randomUUID().toString(),
                "organizationId", orgId.toString(),
                "orgUnitPath", MY_PATH,
                AgentState.CONTEXT_KEY, AgentState.forToolsOnly()));
    }

    /** Một người trong kết quả tìm kiếm, kèm đơn vị để phép kiểm cây con có cái mà xét. */
    private UUID person(String fullName, String path, String unitName) {
        UUID id = UUID.randomUUID();
        OrgUnit unit = new OrgUnit();
        unit.setId(UUID.randomUUID());
        unit.setPath(path);
        unit.setName(unitName);

        UserRoleOrgUnit assignment = new UserRoleOrgUnit();
        assignment.setOrgUnit(unit);
        assignment.setRole(new Role());
        when(roleRepository.findByUserId(id)).thenReturn(List.of(assignment));
        return id;
    }

    private Map<String, Object> row(UUID id, String fullName, String unitName) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("fullName", fullName);
        m.put("orgUnitName", unitName);
        return m;
    }

    private void searchReturns(String keyword, List<Map<String, Object>> rows) {
        when(statisticService.searchUsers(eq(orgId), eq(keyword), any(), any(), anyInt()))
                .thenReturn(rows);
    }

    // ════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("khớp đúng MỘT người -> trả id, không hỏi lại")
    void singleMatchResolves() {
        UUID id = person("Vũ Thị", MY_PATH + "backend/", "Team Backend");
        searchReturns("Vũ Thị", List.of(row(id, "Vũ Thị", "Team Backend")));

        UserRef ref = support.resolveUser(null, "Vũ Thị", ctx());

        assertThat(ref.id()).isEqualTo(id);
        assertThat(ref.clarification()).isNull();
    }

    @Test
    @DisplayName("TRÙNG TÊN -> hỏi lại, KHÔNG tự chọn")
    void ambiguousAsksBack() {
        // Đây là chốt chặn thật sự: tự chọn giúp ở đây là duyệt bài của người khác.
        UUID a = person("Nguyễn Văn A", MY_PATH + "backend/", "Team Backend");
        UUID b = person("Nguyễn Văn A", MY_PATH + "frontend/", "Team Frontend");
        searchReturns("Nguyễn Văn A", List.of(
                row(a, "Nguyễn Văn A", "Team Backend"),
                row(b, "Nguyễn Văn A", "Team Frontend")));

        UserRef ref = support.resolveUser(null, "Nguyễn Văn A", ctx());

        assertThat(ref.id()).isNull();
        assertThat(ref.clarification()).containsEntry("needsClarification", true);
        assertThat(String.valueOf(ref.clarification().get("message")))
                .contains("khớp NHIỀU người").contains("TUYỆT ĐỐI không tự chọn");
    }

    @Test
    @DisplayName("ưu tiên khớp CHÍNH XÁC — cùng luật với đơn vị và KPI")
    void exactMatchWinsOverPartial() {
        // "Vũ Thị" không được coi là mơ hồ chỉ vì còn "Vũ Thị Deputy Lead" trong kết quả tìm kiếm.
        UUID exact = person("Vũ Thị", MY_PATH + "backend/", "Team Backend");
        UUID longer = person("Vũ Thị Deputy Lead", MY_PATH + "backend/", "Team Backend");
        searchReturns("Vũ Thị", List.of(
                row(longer, "Vũ Thị Deputy Lead", "Team Backend"),
                row(exact, "Vũ Thị", "Team Backend")));

        assertThat(support.resolveUser(null, "Vũ Thị", ctx()).id()).isEqualTo(exact);
    }

    @Test
    @DisplayName("không tìm thấy ai -> cũng hỏi lại chứ không im lặng bỏ lọc")
    void notFoundAsksBack() {
        // Trả null ở đây là âm thầm bỏ điều kiện lọc rồi duyệt bài của CẢ đơn vị — hỏng nặng hơn
        // nhiều so với việc hỏi lại một câu.
        searchReturns("Không Có Ai", List.of());

        UserRef ref = support.resolveUser(null, "Không Có Ai", ctx());

        assertThat(ref.id()).isNull();
        assertThat(ref.clarification()).containsEntry("needsClarification", true);
    }

    @Test
    @DisplayName("không nêu ai -> null, KHÔNG mặc định thành chính người đang hỏi")
    void blankMeansEveryone() {
        // Khác resolveUnit ở đúng chỗ này: "duyệt bài nộp" mà hiểu thành "bài nộp của tôi" là
        // hiểu ngược ý người dùng.
        UserRef ref = support.resolveUser(null, null, ctx());

        assertThat(ref.id()).isNull();
        assertThat(ref.clarification()).isNull();
    }

    @Test
    @DisplayName("người NGOÀI cây con -> chặn")
    void refusesUserOutsideSubtree() {
        UUID outsider = person("Người Lạ", "/cty/truyenthong/", "Phòng Truyền Thông");
        searchReturns("Người Lạ", List.of(row(outsider, "Người Lạ", "Phòng Truyền Thông")));

        assertThatThrownBy(() -> support.resolveUser(null, "Người Lạ", ctx()))
                .isInstanceOf(SecurityException.class)
                .hasMessageContaining("không thuộc phạm vi đơn vị của bạn");
    }
}
