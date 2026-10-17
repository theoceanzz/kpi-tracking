package com.kpitracking.ai.approval;

import com.kpitracking.ai.core.agent.AgentState;
import com.kpitracking.ai.core.tool.ToolSupport;
import com.kpitracking.dto.approvalform.ApprovalFormDtos.Catalog;
import com.kpitracking.dto.approvalform.ApprovalFormDtos.CatalogForm;
import com.kpitracking.dto.approvalform.ApprovalFormDtos.CatalogGroup;
import com.kpitracking.dto.approvalform.ApprovalFormDtos.SubmitView;
import com.kpitracking.dto.response.ai.RequestDraftResponse;
import com.kpitracking.entity.form.FormOption;
import com.kpitracking.entity.form.FormSchema;
import com.kpitracking.entity.form.FormWidget;
import com.kpitracking.entity.form.VisibilityRule;
import com.kpitracking.enums.WidgetType;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.service.approvalform.ApprovalRequestService;
import dev.langchain4j.invocation.InvocationParameters;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** K.AI tạo đơn hộ: quy chữ của model về dạng hộp nộp đơn, chỉ ra bản NHÁP, không nộp. */
class RequestFormToolTest {

    private final UUID formId = UUID.randomUUID();
    private final UUID orgId = UUID.randomUUID();
    private final UUID bossId = UUID.randomUUID();
    private ApprovalRequestService service;
    private ToolSupport support;
    private RequestFormTool tool;
    private AgentState state;
    private InvocationParameters ctx;

    /** Mẫu "Nghỉ phép": loại nghỉ (chọn một), khoảng ngày, lý do (bắt buộc), người duyệt thay, tệp đính kèm (bắt buộc), ô "Lý do khác" chỉ hiện khi chọn "Khác". */
    private final FormSchema schema = new FormSchema(List.of(
            widget("type", WidgetType.RADIO, "Loại nghỉ", true, List.of(new FormOption("annual", "Phép năm"),
                    new FormOption("other", "Khác")), null),
            widget("days", WidgetType.DATE_RANGE, "Thời gian nghỉ", true, null, null),
            widget("reason", WidgetType.TEXTAREA, "Lý do", true, null, null),
            widget("otherReason", WidgetType.TEXT, "Lý do khác", true, null,
                    List.of(new VisibilityRule("type", com.kpitracking.service.approvalprocess.ConditionOperator.IN, List.of("other")))),
            widget("backup", WidgetType.CONTACT, "Người làm thay", false, null, null),
            widget("file", WidgetType.ATTACHMENT, "Giấy tờ", true, null, null)));

    private static FormWidget widget(String id, WidgetType type, String title, boolean required,
                                     List<FormOption> options, List<VisibilityRule> visibility) {
        return FormWidget.builder().id(id).type(type).title(title).required(required).options(options)
                .visibility(visibility).build();
    }

    @BeforeEach
    void setUp() throws Exception {
        service = mock(ApprovalRequestService.class);
        support = mock(ToolSupport.class);
        tool = new RequestFormTool(service, support);
        state = AgentState.forToolsOnly();
        Map<String, Object> m = new HashMap<>();
        m.put(AgentState.CONTEXT_KEY, state);
        ctx = new InvocationParameters(m);
        when(support.getOrgId(any())).thenReturn(orgId);
        when(support.respond(any(), anyString(), any())).thenAnswer(inv -> String.valueOf(inv.getArgument(2, Object.class)));
        when(support.toolError(anyString(), any())).thenAnswer(inv -> "LỖI " + inv.getArgument(1, Exception.class).getClass().getSimpleName());
        when(service.catalog()).thenReturn(new Catalog(List.of(new CatalogGroup(UUID.randomUUID(), Map.of("vi", "Nhân sự"),
                List.of(new CatalogForm(formId, null, null, Map.of("vi", "Đơn xin nghỉ phép"), Map.of())))), false));
        when(service.submitView(formId)).thenReturn(new SubmitView(formId, null, null, Map.of("vi", "Đơn xin nghỉ phép"),
                Map.of(), schema, List.of()));
    }

    @Test
    @DisplayName("chữ của model -> dạng hộp nộp đơn: nhãn phương án -> id, khoảng ngày, tên người -> id; không nộp")
    void draftsWithoutSubmitting() {
        when(support.userMatchPool("Trần Văn Sếp", orgId)).thenReturn(List.of(Map.of("id", bossId.toString())));
        // Máy chủ chuẩn hoá như xem trước quy trình; ở đây trả đúng thứ hộp nộp đơn sẽ nhận.
        when(service.draft(eq(formId), any())).thenAnswer(inv -> {
            @SuppressWarnings("unchecked") Map<String, Object> raw = inv.getArgument(1, Map.class);
            assertThat(raw.get("type")).isEqualTo("annual");
            assertThat(raw.get("days")).isEqualTo(Map.of("start", "2026-10-20", "end", "2026-10-21"));
            assertThat(raw.get("backup")).isEqualTo(List.of(Map.of("id", bossId.toString())));
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("type", "annual");
            v.put("days", Map.of("start", "2026-10-20", "end", "2026-10-21", "duration", BigDecimal.valueOf(2)));
            v.put("backup", List.of(Map.of("id", bossId.toString(), "name", "Trần Văn Sếp")));
            return new ApprovalRequestService.Draft(formId, Map.of("vi", "Đơn xin nghỉ phép"), schema, v);
        });

        String out = tool.draftRequest(new RequestFormTool.DraftRequest("nghỉ phép", List.of(
                new RequestFormTool.FieldValue("Loại nghỉ", "phép năm"),
                new RequestFormTool.FieldValue("days", "2026-10-20/2026-10-21"),
                new RequestFormTool.FieldValue("Người làm thay", "Trần Văn Sếp"),
                new RequestFormTool.FieldValue("Giấy tờ", "giay.pdf"),
                new RequestFormTool.FieldValue("Ô lạ", "x"))), ctx);

        RequestDraftResponse draft = state.getRequestDraft();
        assertThat(draft).isNotNull();
        assertThat(draft.formName()).isEqualTo("Đơn xin nghỉ phép");
        assertThat(draft.entries()).extracting(RequestDraftResponse.Entry::display)
                .containsExactly("Phép năm", "20/10/2026 → 21/10/2026 (2 ngày)", "Trần Văn Sếp");
        // Bắt buộc còn thiếu: Lý do, Giấy tờ; "Lý do khác" đang ẩn (chưa chọn "Khác") nên không đòi.
        assertThat(draft.missing()).containsExactly("Lý do", "Giấy tờ");
        assertThat(out).contains("Ô lạ (không có ô này)").contains("Giấy tờ (người dùng tự điền trong hộp đơn)");
        verify(service, never()).submit(any());
    }

    @Test
    @DisplayName("tên người trùng / không thấy -> để trống cho người dùng tự chọn, báo lại cho model")
    void ambiguousPersonIsLeftEmpty() {
        when(support.userMatchPool("Lan", orgId)).thenReturn(List.of(Map.of("id", "a"), Map.of("id", "b")));
        when(service.draft(eq(formId), any())).thenAnswer(inv -> new ApprovalRequestService.Draft(formId,
                Map.of("vi", "Đơn xin nghỉ phép"), schema, Map.of("reason", "Việc gia đình")));

        String out = tool.draftRequest(new RequestFormTool.DraftRequest(formId.toString(), List.of(
                new RequestFormTool.FieldValue("Người làm thay", "Lan"),
                new RequestFormTool.FieldValue("Lý do", "Việc gia đình"))), ctx);

        assertThat(out).contains("Người làm thay ('Lan' không hợp lệ)");
        assertThat(state.getRequestDraft().entries()).extracting(RequestDraftResponse.Entry::label).containsExactly("Lý do");
    }

    @Test
    @DisplayName("mẫu người dùng không được nộp -> lỗi, không có bản nháp")
    void formOutsideCatalogIsRefused() {
        when(service.submitView(formId)).thenThrow(new ForbiddenException("x"));

        String out = tool.draftRequest(new RequestFormTool.DraftRequest(formId.toString(), List.of(
                new RequestFormTool.FieldValue("Lý do", "x"))), ctx);

        assertThat(out).startsWith("LỖI");
        assertThat(state.getRequestDraft()).isNull();
    }

    @Test
    @DisplayName("tìm mẫu theo tên: bỏ dấu, không phân biệt hoa thường; tên mơ hồ -> không chọn")
    void findFormByName() {
        Catalog c = new Catalog(List.of(new CatalogGroup(UUID.randomUUID(), Map.of("vi", "Chung"), List.of(
                new CatalogForm(formId, null, null, Map.of("vi", "Đơn xin nghỉ phép"), Map.of()),
                new CatalogForm(UUID.randomUUID(), null, null, Map.of("vi", "Đơn xin tăng ca"), Map.of())))), false);

        assertThat(RequestFormTool.findForm(c, "don xin NGHI PHEP", "vi")).isEqualTo(formId);
        assertThat(RequestFormTool.findForm(c, "nghỉ phép", "vi")).isEqualTo(formId);
        assertThat(RequestFormTool.findForm(c, "đơn xin", "vi")).isNull();
    }
}
