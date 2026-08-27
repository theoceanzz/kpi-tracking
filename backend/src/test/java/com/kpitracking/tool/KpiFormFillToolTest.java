package com.kpitracking.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.repository.ConversationMessageRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.QualitativeLevelRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.service.ai.form.FormFieldValidator;
import com.kpitracking.service.ai.form.FormFillSupport;
import com.kpitracking.service.ai.form.FormPatch;
import com.kpitracking.service.ai.form.FormRegistry;
import com.kpitracking.tool.KpiFormFillTool.KpiFormFillRequest;
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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import com.kpitracking.service.ai.agent.AgentState;
import java.util.HashMap;

/**
 * Test cho tool đề xuất điền form KPI.
 *
 * <p>Điều phải chứng minh: tool <b>chỉ đề xuất</b>, và mọi đường đi sai đều dừng lại thành thông báo
 * cho model đọc chứ không tạo ra một bản đề xuất hỏng. Người dùng sẽ bấm "Điền" mà không đọc kỹ —
 * nên thứ lọt tới bản xem trước phải đã đúng.
 */
class KpiFormFillToolTest {

    /**
     * Trạng thái của lượt, đi cùng {@code ToolContext}. Mỗi test một thực thể mới nên không
     * phải dọn gì — đó chính là điều đáng giá so với bản ThreadLocal cũ.
     */
    private AgentState st = AgentState.forToolsOnly();

    /** Ngữ cảnh tool luôn mang theo trạng thái của lượt, giống hệt lúc chạy thật. */
    private ToolContext ctxWith(java.util.Map<String, Object> base) {
        java.util.Map<String, Object> m = new HashMap<>(base);
        m.put(AgentState.CONTEXT_KEY, st);
        return new ToolContext(m);
    }

    private OrgUnitStatisticService service;
    private KpiFormFillTool tool;

    @BeforeEach
    void setUp() {
        // Phần khung dựng ở FormFillTestFixture; toàn bộ phần khẳng định bên dưới giữ nguyên từ
        // trước khi tách FormFillSupport — đó mới là thứ chứng minh bước tách không đổi hành vi.
        var deps = FormFillTestFixture.create();
        service = deps.service();
        tool = new KpiFormFillTool(new FormRegistry(), deps.fill());
    }

    @AfterEach
    void tearDown() {
    }

    /** Ngữ cảnh có form KPI đang mở, kèm các ô đã có sẵn giá trị. */
    private ToolContext withForm(Map<String, Object> currentValues) {
        return ctxWith(Map.of(
                "orgUnitId", UUID.randomUUID().toString(),
                "organizationId", UUID.randomUUID().toString(),
                "openFormId", FormRegistry.KPI_FORM,
                "openFormValues", currentValues));
    }

    private KpiFormFillRequest req(String name, String kpiType, Double weight, String frequency) {
        return new KpiFormFillRequest(kpiType, name, null, null, weight, null, null,
                frequency, null, null, null, null, null, null, "vì bạn yêu cầu");
    }

    // ════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("KHÔNG mở form thì từ chối — đề xuất sẽ rơi vào hư không")
    void refusesWhenNoFormOpen() {
        ToolContext noForm = ctxWith(Map.of(
                "orgUnitId", UUID.randomUUID().toString(),
                "organizationId", UUID.randomUUID().toString()));

        String out = tool.suggestKpiForm(req("Số task", "QUANTITATIVE", 20d, "MONTHLY"), noForm);

        assertThat(out).contains("\"error\"");
        assertThat(st.getFormPatch()).as("không được tạo đề xuất nào").isNull();
    }

    @Test
    @DisplayName("gọi tool mà KHÔNG truyền ô nào -> lời nhắc model sửa được, không phải NPE")
    void nullRequestIsRecoverable() {
        // Đo được ở cả hai đường: model gọi tool với tham số rỗng, Spring AI truyền thẳng null vào,
        // tool ném NPE và model nhận nguyên văn thông báo NPE của Java — thứ nó không sửa được.
        String out = tool.suggestKpiForm(null, withForm(Map.of()));

        assertThat(out).contains("\"error\"");
        assertThat(out).as("phải nói model cần làm gì, không phải rò nội bộ Java")
                .doesNotContain("NullPointerException")
                .contains("gọi lại")
                // Nêu đúng tên các ô, lấy từ chính record — không có phần này model đoán mò và
                // đo được là nó lặp lại lời gọi rỗng nhiều lần trước khi trúng.
                .contains("weight")
                .contains("frequency");
        assertThat(st.getFormPatch()).isNull();
    }

    @Test
    @DisplayName("đề xuất hợp lệ được ghi vào kho, kèm nhãn tiếng Việt cho người đọc")
    void validSuggestionIsStored() {
        String out = tool.suggestKpiForm(
                req("Số task hoàn thành", "QUANTITATIVE", 20d, "MONTHLY"), withForm(Map.of()));

        FormPatch patch = st.getFormPatch();
        assertThat(patch).isNotNull();
        assertThat(patch.formId()).isEqualTo(FormRegistry.KPI_FORM);
        assertThat(patch.entries()).extracting(FormPatch.Entry::field)
                .containsExactlyInAnyOrder("name", "kpiType", "weight", "frequency");
        assertThat(patch.entries()).extracting(FormPatch.Entry::label)
                .as("người dùng đọc nhãn tiếng Việt, không đọc tên trường")
                .contains("Tên chỉ tiêu", "Trọng số (%)");
        assertThat(out).doesNotContain("\"error\"");
    }

    @Test
    @DisplayName("ô đã có ĐÚNG giá trị đó thì bỏ qua — đề xuất y hệt chỉ làm nhiễu")
    void skipsFieldsAlreadyHoldingTheSameValue() {
        String out = tool.suggestKpiForm(
                req("Số task", "QUANTITATIVE", 20d, "MONTHLY"),
                withForm(Map.of("name", "Số task", "kpiType", "QUANTITATIVE")));

        assertThat(st.getFormPatch().entries()).extracting(FormPatch.Entry::field)
                .containsExactlyInAnyOrder("weight", "frequency");
        assertThat(out).doesNotContain("\"error\"");
    }

    @Test
    @DisplayName("không có ô nào đổi thì KHÔNG tạo đề xuất, và bảo model trả lời bằng lời")
    void noChangeMeansNoPatch() {
        String out = tool.suggestKpiForm(
                req("Số task", "QUANTITATIVE", 20d, "MONTHLY"),
                withForm(Map.of("name", "Số task", "kpiType", "QUANTITATIVE",
                        "weight", 20L, "frequency", "MONTHLY")));

        assertThat(st.getFormPatch()).isNull();
        assertThat(out).contains("Không có ô nào thay đổi");
    }

    @Test
    @DisplayName("giá trị sai luật bị chặn TRƯỚC khi thành đề xuất, thông báo đủ để model tự sửa")
    void invalidValueIsRejectedBeforeBecomingASuggestion() {
        String out = tool.suggestKpiForm(
                req("Số task", "QUANTITATIVE", 150d, "MONTHLY"), withForm(Map.of()));

        assertThat(out).contains("\"error\"").contains("100");
        assertThat(st.getFormPatch())
                .as("một ô hỏng thì bỏ CẢ đề xuất — điền nửa vời còn khó hiểu hơn không điền")
                .isNull();
    }

    @Test
    @DisplayName("tần suất KHÔNG có thật bị chặn và được liệt kê giá trị đúng")
    void unknownEnumIsRejected() {
        String out = tool.suggestKpiForm(
                req("Số task", "QUANTITATIVE", 20d, "hai tuần một lần"), withForm(Map.of()));

        assertThat(out).contains("\"error\"").contains("MONTHLY");
    }

    @Test
    @DisplayName("tần suất viết bằng NHÃN TIẾNG VIỆT của giao diện thì nhận, không bắt model nhớ hằng số")
    void vietnameseEnumLabelIsAccepted() {
        // Đo được end-to-end: model trả "Hàng tháng", bị từ chối, rồi bỏ cuộc thay vì sửa lại.
        tool.suggestKpiForm(req("Số task", "Định lượng", 20d, "Hàng tháng"), withForm(Map.of()));

        assertThat(st.getFormPatch().entries())
                .anySatisfy(e -> {
                    assertThat(e.field()).isEqualTo("frequency");
                    assertThat(e.value()).isEqualTo("MONTHLY");
                })
                .anySatisfy(e -> {
                    assertThat(e.field()).isEqualTo("kpiType");
                    assertThat(e.value()).isEqualTo("QUANTITATIVE");
                });
    }

    @Test
    @DisplayName("tên kỳ khớp NHIỀU kỳ thì bắt hỏi lại, không tự chọn giúp")
    void ambiguousPeriodAsksBack() {
        when(service.searchKpiPeriods(any(), anyString(), anyInt())).thenReturn(List.of(
                Map.of("id", UUID.randomUUID(), "name", "Tháng 6/2026"),
                Map.of("id", UUID.randomUUID(), "name", "Tháng 6/2025")));

        KpiFormFillRequest r = new KpiFormFillRequest(null, null, null, null, null, null, null,
                null, null, null, null, "Tháng 6", null, null, null);
        String out = tool.suggestKpiForm(r, withForm(Map.of()));

        assertThat(out).contains("\"error\"").contains("Tháng 6/2026");
        assertThat(st.getFormPatch()).isNull();
    }

    @Test
    @DisplayName("tên kỳ không có thật thì chỉ đường sang search chứ không bịa id")
    void unknownPeriodPointsToSearch() {
        when(service.searchKpiPeriods(any(), anyString(), anyInt())).thenReturn(List.of());

        KpiFormFillRequest r = new KpiFormFillRequest(null, null, null, null, null, null, null,
                null, null, null, null, "Quý 9", null, null, null);
        String out = tool.suggestKpiForm(r, withForm(Map.of()));

        assertThat(out).contains("\"error\"").contains("search");
        assertThat(st.getFormPatch()).isNull();
    }

    @Test
    @DisplayName("kỳ tra được đúng một kết quả thì hiện TÊN kỳ, không hiện UUID")
    void resolvedPeriodShowsNameNotUuid() {
        UUID id = UUID.randomUUID();
        when(service.searchKpiPeriods(any(), anyString(), anyInt()))
                .thenReturn(List.of(Map.of("id", id, "name", "Tháng 6/2026")));

        KpiFormFillRequest r = new KpiFormFillRequest(null, null, null, null, null, null, null,
                null, null, null, null, "Tháng 6/2026", null, null, null);
        tool.suggestKpiForm(r, withForm(Map.of()));

        FormPatch.Entry e = st.getFormPatch().entries().get(0);
        assertThat(e.field()).isEqualTo("kpiPeriodId");
        assertThat(e.value()).isEqualTo(id.toString());
        assertThat(e.display())
                .as("người dùng không thẩm định được một UUID trong bản xem trước")
                .isEqualTo("Tháng 6/2026");
    }

    @Test
    @DisplayName("nêu rõ ô BẮT BUỘC còn thiếu, để model nhắc trước khi người dùng bấm Lưu")
    void reportsStillMissingRequiredFields() {
        String out = tool.suggestKpiForm(
                req("Số task", "QUANTITATIVE", 20d, "MONTHLY"), withForm(Map.of()));

        assertThat(out).contains("Còn thiếu bắt buộc")
                .contains("đợt KPI").contains("giá trị mục tiêu").contains("đơn vị tính");
    }

    @Test
    @DisplayName("KPI định tính KHÔNG bị đòi các ô đo lường của định lượng")
    void qualitativeDoesNotDemandQuantitativeFields() {
        String out = tool.suggestKpiForm(
                req("Thái độ làm việc", "QUALITATIVE", 30d, "MONTHLY"),
                withForm(Map.of("kpiPeriodId", UUID.randomUUID().toString())));

        assertThat(out).doesNotContain("giá trị mục tiêu").doesNotContain("đơn vị tính");
    }
}
