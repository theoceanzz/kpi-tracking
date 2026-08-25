package com.kpitracking.tool;

import com.kpitracking.security.PermissionChecker;
import com.kpitracking.tool.ToolRegistry.Group;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.support.ToolCallbacks;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Test cho việc lọc quyền của nhóm tool GHI.
 *
 * <p><b>Vì sao nhóm này phải lọc theo TỪNG TOOL.</b> Bốn việc ghi đòi bốn quyền khác nhau
 * ({@code SUBMISSION:REVIEW}, {@code KPI:APPROVE_CRITERIA}, {@code KPI:APPROVE_ADJUSTMENT},
 * {@code REMINDER:SEND}). Gán một quyền cho cả nhóm — như bản đầu từng làm với
 * {@code Group.ACTION -> "KPI:CREATE"} — là trao nhầm theo cả hai chiều: người chỉ có quyền tạo
 * chỉ tiêu sẽ nhận được tool DUYỆT bài nộp, còn người chỉ có quyền nhắc nhở thì không nhận được gì.
 *
 * <p>Hệ quả kéo theo: bốn tool phải nằm ở BỐN bean riêng, vì
 * {@code ToolCallbacks.from(bean)} lấy mọi {@code @Tool} của một bean cùng lúc. Lớp test này chốt
 * luôn điều đó — gộp chúng lại sẽ làm đỏ {@link #eachActionToolIsItsOwnBean}.
 */
class ActionToolPermissionTest {

    private PermissionChecker permissionChecker;
    private ToolRegistry registry;
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        permissionChecker = mock(PermissionChecker.class);
        registry = new ToolRegistry(
                mock(SearchTool.class), mock(PeopleTool.class), mock(OrgUnitTool.class),
                mock(KpiTool.class), mock(SubmissionTool.class), mock(AnalyticsTool.class),
                mock(RankTool.class), mock(CompareTool.class), mock(BscTool.class),
                mock(OkrTool.class),
                new SubmissionReviewTool(null, null, null),
                new KpiCriteriaReviewTool(null, null, null),
                new KpiAdjustmentReviewTool(null, null, null),
                new ReminderTool(null, null, null),
                mock(EscapeHatchTool.class), mock(EvidenceRequestTool.class),
                mock(AttachFilesTool.class), mock(KpiFormFillTool.class),
                mock(SubmissionFormFillTool.class), mock(EvaluationFormFillTool.class),
                mock(KpiAdjustmentFormFillTool.class), mock(OrgUnitFormFillTool.class),
                mock(OrgUnitDrawerFormFillTool.class), permissionChecker);
    }

    /** Tên các @Tool thực sự được gửi cho model khi mở nhóm GHI. */
    private List<String> actionToolNames() {
        List<Object> tools = registry.toolsFor(Set.of(Group.ACTION), userId);
        return Arrays.stream(ToolCallbacks.from(tools.toArray()))
                .map(cb -> cb.getToolDefinition().name())
                .filter(n -> n.startsWith("review_") || n.startsWith("send_"))
                .toList();
    }

    /** Chỉ giữ các bean tool GHI; toolsFor luôn hợp thêm nhóm CORE nên phải lọc ra. */
    private static List<Object> writeTools(List<Object> tools) {
        return tools.stream()
                .filter(t -> t.getClass().getSimpleName().endsWith("ReviewTool")
                        || t.getClass().getSimpleName().equals("ReminderTool"))
                .toList();
    }

    private void grant(String... permissions) {
        when(permissionChecker.hasPermission(any(), any())).thenReturn(false);
        for (String p : permissions) {
            when(permissionChecker.hasPermission(eq(userId), eq(p))).thenReturn(true);
        }
    }

    // ════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("chỉ có quyền duyệt BÀI NỘP -> chỉ thấy tool bài nộp")
    void submissionPermissionGivesOnlySubmissionTool() {
        grant("SUBMISSION:REVIEW");

        assertThat(actionToolNames()).containsExactly("review_submissions");
    }

    @Test
    @DisplayName("chỉ có quyền duyệt CHỈ TIÊU -> KHÔNG thấy tool bài nộp")
    void criteriaPermissionDoesNotLeakSubmissionTool() {
        // Đây chính là chỗ bản gán quyền theo NHÓM sai: nó trao cả bốn tool cho bất kỳ ai có
        // đúng một trong bốn quyền.
        grant("KPI:APPROVE_CRITERIA");

        assertThat(actionToolNames()).containsExactly("review_kpi_criteria");
    }

    @Test
    @DisplayName("chỉ có quyền NHẮC NHỞ -> vẫn nhận được tool nhắc nhở")
    void reminderPermissionIsEnoughForReminderTool() {
        // Chiều ngược lại của cùng lỗi: gán cả nhóm một quyền thì người chỉ có REMINDER:SEND
        // không nhận được gì cả.
        grant("REMINDER:SEND");

        assertThat(actionToolNames()).containsExactly("send_reminders");
    }

    @Test
    @DisplayName("không có quyền ghi nào -> KHÔNG tool ghi nào được gửi đi")
    void noWritePermissionMeansNoWriteTools() {
        grant();

        assertThat(actionToolNames()).isEmpty();
    }

    @Test
    @DisplayName("có đủ bốn quyền -> thấy đủ bốn tool")
    void allPermissionsGiveAllTools() {
        grant("SUBMISSION:REVIEW", "KPI:APPROVE_CRITERIA", "KPI:APPROVE_ADJUSTMENT", "REMINDER:SEND");

        assertThat(actionToolNames()).containsExactlyInAnyOrder(
                "review_submissions", "review_kpi_criteria",
                "review_kpi_adjustments", "send_reminders");
    }

    @Test
    @DisplayName("người dùng vô danh (userId null) -> KHÔNG tool ghi nào")
    void anonymousGetsNoWriteTools() {
        // Đường gợi ý KPI mượn tool mà không có người dùng nào; ở đó tuyệt đối không được ghi.
        // (Danh sách vẫn có các tool nhóm CORE — toolsFor luôn hợp CORE vào; ta chỉ soi phần GHI.)
        List<Object> tools = registry.toolsFor(Set.of(Group.ACTION), null);
        assertThat(writeTools(tools)).isEmpty();
    }

    @Test
    @DisplayName("mỗi tool GHI là một bean RIÊNG — gộp lại là gộp luôn cả quyền")
    void eachActionToolIsItsOwnBean() {
        grant("SUBMISSION:REVIEW", "KPI:APPROVE_CRITERIA", "KPI:APPROVE_ADJUSTMENT", "REMINDER:SEND");
        List<Object> tools = registry.toolsFor(Set.of(Group.ACTION), userId);

        // Bốn quyền -> bốn bean. Nếu ai đó gộp hai tool vào chung một lớp thì số bean tụt xuống,
        // và lúc đó một quyền sẽ mở nhiều hơn một việc.
        assertThat(writeTools(tools)).hasSize(4);
        assertThat(writeTools(tools).stream().map(t -> t.getClass().getSimpleName()).toList())
                .containsExactlyInAnyOrder("SubmissionReviewTool", "KpiCriteriaReviewTool",
                        "KpiAdjustmentReviewTool", "ReminderTool");
    }
}
