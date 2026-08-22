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
                new EvaluationFormFillRequest(null, 8d, null, null), noForm))
                .contains("\"error\"");
        assertThat(FormPatchStore.get()).isNull();
    }

    @Test
    @DisplayName("đề xuất hợp lệ: tra kỳ ra UUID thật, hiện TÊN cho người đọc")
    void validSuggestionResolvesEntities() {
        UUID periodId = UUID.randomUUID();
        when(service.searchKpiPeriods(any(), anyString(), anyInt()))
                .thenReturn(List.of(Map.of("id", periodId, "name", "Tháng 6/2026")));

        String out = tool.suggestEvaluationForm(new EvaluationFormFillRequest(
                "Tháng 6/2026", 8d, "làm tốt", "theo yêu cầu"), withForm(Map.of()));

        assertThat(out).doesNotContain("\"error\"");
        FormPatch patch = FormPatchStore.get();
        assertThat(patch.formId()).isEqualTo(FormRegistry.EVALUATION_FORM);
        assertThat(patch.entries()).extracting(FormPatch.Entry::field)
                .containsExactlyInAnyOrder("score", "comment", "kpiPeriodId");

        Map<String, FormPatch.Entry> byField = patch.entries().stream()
                .collect(java.util.stream.Collectors.toMap(FormPatch.Entry::field, e -> e));
        assertThat(byField.get("kpiPeriodId").display())
                .as("không ai thẩm định được một UUID trong bản xem trước").isEqualTo("Tháng 6/2026");
    }

    @Test
    @DisplayName("KHÔNG đổi được người bị đánh giá — ô đó ẩn hoàn toàn trên giao diện")
    void cannotRetargetTheEvaluatedPerson() {
        // userId là <input type="hidden"> đặt sẵn bằng chính người đang đăng nhập. Khai nó ra là
        // một câu tiếng Việt chuyển được bài đánh giá sang người khác, mà onSubmit thì đẩy thẳng
        // data đi — người dùng không có chỗ nào nhìn thấy để phát hiện.
        assertThat(FormRegistry.EVALUATION_FORM).isNotNull();
        assertThat(new FormRegistry().find(FormRegistry.EVALUATION_FORM).fields())
                .extracting(com.kpitracking.service.ai.form.FormSpec.Field::name)
                .doesNotContain("userId");

        // Và tool cũng không còn nhận tên nhân viên: bốn tham số, không tham số nào là người.
        assertThat(EvaluationFormFillRequest.class.getRecordComponents())
                .extracting(java.lang.reflect.RecordComponent::getName)
                .containsExactly("periodName", "score", "comment", "reason");
    }

    @Test
    @DisplayName("điểm ÂM bị chặn trước khi thành đề xuất")
    void negativeScoreRejected() {
        assertThat(tool.suggestEvaluationForm(
                new EvaluationFormFillRequest(null, -3d, null, null), withForm(Map.of())))
                .contains("\"error\"");
        assertThat(FormPatchStore.get()).isNull();
    }

    @Test
    @DisplayName("ô đã có đúng giá trị đó thì không đề xuất lại")
    void skipsUnchangedFields() {
        assertThat(tool.suggestEvaluationForm(
                new EvaluationFormFillRequest(null, 8d, "làm tốt", null),
                withForm(Map.of("score", 8L, "comment", "làm tốt"))))
                .contains("Không có ô nào thay đổi");
        assertThat(FormPatchStore.get()).isNull();
    }

    @Test
    @DisplayName("nêu rõ ô bắt buộc còn thiếu: đợt KPI, điểm")
    void reportsStillMissing() {
        assertThat(tool.suggestEvaluationForm(
        // Phải có ÍT NHẤT một ô điền được, không thì finish() thoát sớm ở nhánh "không có ô nào
        // thay đổi" và câu báo thiếu chẳng bao giờ tới tay model.
                new EvaluationFormFillRequest(null, null, "làm tốt", "theo yêu cầu"), withForm(Map.of())))
                .contains("Còn thiếu bắt buộc").contains("đợt KPI").contains("điểm");
    }
}
