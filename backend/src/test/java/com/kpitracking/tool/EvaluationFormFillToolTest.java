package com.kpitracking.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.repository.ConversationMessageRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.QualitativeLevelRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.service.ai.form.FormFieldValidator;
import com.kpitracking.service.ai.form.FormFillSupport;
import com.kpitracking.service.ai.form.FormPatch;
import com.kpitracking.service.ai.form.FormPatchStore;
import com.kpitracking.service.ai.form.FormRegistry;
import com.kpitracking.tool.EvaluationFormFillTool.EvaluationFormFillRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Test cho tool đề xuất điền form ĐÁNH GIÁ NHÂN VIÊN.
 *
 * <p>Điểm đánh giá là dữ liệu nhân sự, nên trọng tâm là các phép so NGƯỢC: không mở form thì không
 * đề xuất, tên mơ hồ thì hỏi lại chứ không tự chọn người, và bản xem trước phải hiện TÊN chứ không
 * phải UUID để người dùng thẩm định được thứ mình sắp chấp nhận.
 */
class EvaluationFormFillToolTest {

    private OrgUnitStatisticService service;
    private EvaluationFormFillTool tool;

    @BeforeEach
    void setUp() {
        var deps = FormFillTestFixture.create();
        service = deps.service();
        tool = new EvaluationFormFillTool(new FormRegistry(), deps.fill());
    }

    @AfterEach
    void tearDown() {
        FormPatchStore.clear();
        ToolCallTracker.clear();
    }

    private ToolContext withForm(Map<String, Object> current) {
        return new ToolContext(Map.of(
                "orgUnitId", UUID.randomUUID().toString(),
                "organizationId", UUID.randomUUID().toString(),
                "openFormId", FormRegistry.EVALUATION_FORM,
                "openFormValues", current));
    }

    private void givenUser(UUID id, String name) {
        when(service.searchUsers(any(), anyString(), isNull(), isNull(), anyInt()))
                .thenReturn(List.of(Map.of("id", id, "fullName", name, "email", "x@demo.com")));
    }

    // ════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("KHÔNG mở form thì từ chối")
    void refusesWhenNoFormOpen() {
        ToolContext noForm = new ToolContext(Map.of(
                "orgUnitId", UUID.randomUUID().toString(),
                "organizationId", UUID.randomUUID().toString()));

        assertThat(tool.suggestEvaluationForm(
                new EvaluationFormFillRequest("Nguyễn Văn A", null, 8d, null, null), noForm))
                .contains("\"error\"");
        assertThat(FormPatchStore.get()).isNull();
    }

    @Test
    @DisplayName("đề xuất hợp lệ: tra người và kỳ ra UUID thật, hiện TÊN cho người đọc")
    void validSuggestionResolvesEntities() {
        UUID userId = UUID.randomUUID();
        UUID periodId = UUID.randomUUID();
        givenUser(userId, "Nguyễn Văn A");
        when(service.searchKpiPeriods(any(), anyString(), anyInt()))
                .thenReturn(List.of(Map.of("id", periodId, "name", "Tháng 6/2026")));

        String out = tool.suggestEvaluationForm(new EvaluationFormFillRequest(
                "Nguyễn Văn A", "Tháng 6/2026", 8d, "làm tốt", "theo yêu cầu"), withForm(Map.of()));

        assertThat(out).doesNotContain("\"error\"");
        FormPatch patch = FormPatchStore.get();
        assertThat(patch.formId()).isEqualTo(FormRegistry.EVALUATION_FORM);
        assertThat(patch.entries()).extracting(FormPatch.Entry::field)
                .containsExactlyInAnyOrder("score", "comment", "userId", "kpiPeriodId");

        Map<String, FormPatch.Entry> byField = patch.entries().stream()
                .collect(java.util.stream.Collectors.toMap(FormPatch.Entry::field, e -> e));
        assertThat(byField.get("userId").value()).isEqualTo(userId.toString());
        assertThat(byField.get("userId").display())
                .as("không ai thẩm định được một UUID trong bản xem trước").isEqualTo("Nguyễn Văn A");
        assertThat(byField.get("kpiPeriodId").display()).isEqualTo("Tháng 6/2026");
    }

    @Test
    @DisplayName("tên nhân viên khớp NHIỀU người thì hỏi lại, không tự chọn giúp")
    void ambiguousEmployeeAsksBack() {
        when(service.searchUsers(any(), anyString(), isNull(), isNull(), anyInt())).thenReturn(List.of(
                Map.of("id", UUID.randomUUID(), "fullName", "Nguyễn Văn A", "email", "a1@demo.com"),
                Map.of("id", UUID.randomUUID(), "fullName", "Nguyễn Văn An", "email", "a2@demo.com")));

        assertThat(tool.suggestEvaluationForm(
                new EvaluationFormFillRequest("Nguyễn Văn A", null, 8d, null, null), withForm(Map.of())))
                .contains("\"error\"").contains("a1@demo.com").contains("a2@demo.com");
        assertThat(FormPatchStore.get()).isNull();
    }

    @Test
    @DisplayName("điểm ÂM bị chặn trước khi thành đề xuất")
    void negativeScoreRejected() {
        assertThat(tool.suggestEvaluationForm(
                new EvaluationFormFillRequest(null, null, -3d, null, null), withForm(Map.of())))
                .contains("\"error\"");
        assertThat(FormPatchStore.get()).isNull();
    }

    @Test
    @DisplayName("ô đã có đúng giá trị đó thì không đề xuất lại")
    void skipsUnchangedFields() {
        assertThat(tool.suggestEvaluationForm(
                new EvaluationFormFillRequest(null, null, 8d, "làm tốt", null),
                withForm(Map.of("score", 8L, "comment", "làm tốt"))))
                .contains("Không có ô nào thay đổi");
        assertThat(FormPatchStore.get()).isNull();
    }

    @Test
    @DisplayName("nêu rõ ô bắt buộc còn thiếu: nhân viên, đợt KPI, điểm")
    void reportsStillMissing() {
        givenUser(UUID.randomUUID(), "Nguyễn Văn A");

        assertThat(tool.suggestEvaluationForm(
                new EvaluationFormFillRequest("Nguyễn Văn A", null, null, null, null), withForm(Map.of())))
                .contains("Còn thiếu bắt buộc").contains("đợt KPI").contains("điểm");
    }
}
