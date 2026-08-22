package com.kpitracking.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.entity.QualitativeLevel;
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
import com.kpitracking.tool.SubmissionFormFillTool.SubmissionFormFillRequest;
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

/**
 * Test cho tool đề xuất điền form NỘP BÁO CÁO.
 *
 * <p>Trọng tâm là các phép so NGƯỢC — thứ chặn tính năng điền bừa. Riêng form này có một ràng buộc
 * nặng hơn các form khác: nộp nhầm kỳ là ghi số vào sai chỗ, nên KPI trùng tên PHẢI bắt hỏi lại.
 */
class SubmissionFormFillToolTest {

    private OrgUnitStatisticService service;
    private QualitativeLevelRepository levels;
    private KpiCriteriaRepository kpiCriteria;
    private SubmissionFormFillTool tool;

    @BeforeEach
    void setUp() {
        var deps = FormFillTestFixture.create();
        service = deps.service();
        levels = deps.qualitativeLevels();
        kpiCriteria = deps.kpiCriteria();
        tool = new SubmissionFormFillTool(new FormRegistry(), deps.fill());
    }

    @AfterEach
    void tearDown() {
        FormPatchStore.clear();
        ToolCallTracker.clear();
    }

    /** Không có orgUnitPath -> validateKpiAccess bỏ qua phép kiểm phạm vi, test tập trung vào logic tool. */
    private ToolContext withForm(Map<String, Object> current) {
        return new ToolContext(Map.of(
                "orgUnitId", UUID.randomUUID().toString(),
                "organizationId", UUID.randomUUID().toString(),
                "openFormId", FormRegistry.SUBMISSION_FORM,
                "openFormValues", current));
    }

    /** Như withForm nhưng client CÓ khai các ô đang hiện trên màn hình. */
    private ToolContext withFields(Map<String, Object> current, List<String> fields) {
        return new ToolContext(Map.of(
                "orgUnitId", UUID.randomUUID().toString(),
                "organizationId", UUID.randomUUID().toString(),
                "openFormId", FormRegistry.SUBMISSION_FORM,
                "openFormValues", current,
                "openFormFields", fields));
    }

    /** Dặn kho trả về một chỉ tiêu có đúng loại cần thử. */
    private UUID givenKpiOfType(com.kpitracking.enums.KpiType type) {
        UUID id = UUID.randomUUID();
        when(kpiCriteria.findById(id)).thenReturn(java.util.Optional.of(
                com.kpitracking.entity.KpiCriteria.builder().id(id).kpiType(type).build()));
        return id;
    }

    private SubmissionFormFillRequest req(String kpiName, Double actual, String note) {
        return new SubmissionFormFillRequest(kpiName, null, actual, null, note, "vì bạn yêu cầu");
    }

    // ════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("KHÔNG mở form thì từ chối")
    void refusesWhenNoFormOpen() {
        ToolContext noForm = new ToolContext(Map.of(
                "orgUnitId", UUID.randomUUID().toString(),
                "organizationId", UUID.randomUUID().toString()));

        assertThat(tool.suggestSubmissionForm(req("KPI A", 10d, null), noForm)).contains("\"error\"");
        assertThat(FormPatchStore.get()).isNull();
    }

    @Test
    @DisplayName("mở NHẦM form khác cũng từ chối — đề xuất sẽ rơi vào hư không")
    void refusesWhenAnotherFormIsOpen() {
        ToolContext kpiForm = new ToolContext(Map.of(
                "orgUnitId", UUID.randomUUID().toString(),
                "organizationId", UUID.randomUUID().toString(),
                "openFormId", FormRegistry.KPI_FORM));

        assertThat(tool.suggestSubmissionForm(req("KPI A", 10d, null), kpiForm)).contains("\"error\"");
        assertThat(FormPatchStore.get()).isNull();
    }

    @Test
    @DisplayName("đề xuất hợp lệ: tra KPI ra UUID thật và hiện TÊN kèm KỲ cho người đọc")
    void validSuggestionResolvesKpi() {
        UUID kpiId = UUID.randomUUID();
        when(service.searchKpis(any(), anyString(), anyInt())).thenReturn(List.of(
                Map.of("id", kpiId, "name", "Số task hoàn thành", "periodName", "Tháng 6/2026")));

        String out = tool.suggestSubmissionForm(req("Số task hoàn thành", 45d, "xong sớm"), withForm(Map.of()));

        assertThat(out).doesNotContain("\"error\"");
        FormPatch patch = FormPatchStore.get();
        assertThat(patch.formId()).isEqualTo(FormRegistry.SUBMISSION_FORM);
        assertThat(patch.entries()).extracting(FormPatch.Entry::field)
                .containsExactlyInAnyOrder("actualValue", "note", "kpiCriteriaId");
        FormPatch.Entry kpi = patch.entries().stream()
                .filter(e -> e.field().equals("kpiCriteriaId")).findFirst().orElseThrow();
        assertThat(kpi.value()).isEqualTo(kpiId.toString());
        assertThat(kpi.display())
                .as("phải hiện kỳ để người dùng biết mình đang nộp cho kỳ nào")
                .isEqualTo("Số task hoàn thành (Tháng 6/2026)");
    }

    @Test
    @DisplayName("KPI trùng tên qua nhiều kỳ PHẢI hỏi lại — nộp nhầm kỳ là ghi số vào sai chỗ")
    void ambiguousKpiAsksBack() {
        when(service.searchKpis(any(), anyString(), anyInt())).thenReturn(List.of(
                Map.of("id", UUID.randomUUID(), "name", "Số task hoàn thành", "periodName", "Tháng 5/2026"),
                Map.of("id", UUID.randomUUID(), "name", "Số task hoàn thành", "periodName", "Tháng 6/2026")));

        String out = tool.suggestSubmissionForm(req("Số task hoàn thành", 45d, null), withForm(Map.of()));

        assertThat(out).contains("\"error\"").contains("Tháng 5/2026").contains("Tháng 6/2026");
        assertThat(FormPatchStore.get())
                .as("một ô hỏng thì bỏ CẢ đề xuất").isNull();
    }

    @Test
    @DisplayName("periodName lọc được đúng một bản trong các bản trùng tên")
    void periodNameNarrowsDuplicates() {
        UUID thang6 = UUID.randomUUID();
        when(service.searchKpis(any(), anyString(), anyInt())).thenReturn(List.of(
                Map.of("id", UUID.randomUUID(), "name", "API hoàn thành", "periodName", "Tháng 5/2026"),
                Map.of("id", thang6, "name", "API hoàn thành", "periodName", "Tháng 6/2026")));

        // Trong dữ liệu thật MỌI KPI đều lặp qua nhiều kỳ, nên không có lối này thì tool
        // không bao giờ tra được chỉ tiêu nào.
        String out = tool.suggestSubmissionForm(new SubmissionFormFillRequest(
                "API hoàn thành", "Tháng 6/2026", 12d, null, null, null), withForm(Map.of()));

        assertThat(out).doesNotContain("\"error\"");
        assertThat(FormPatchStore.get().entries())
                .anySatisfy(e -> {
                    assertThat(e.field()).isEqualTo("kpiCriteriaId");
                    assertThat(e.value()).isEqualTo(thang6.toString());
                });
    }

    @Test
    @DisplayName("kỳ không có bản nào thì LIỆT KÊ các kỳ đang có, không im lặng chọn bừa")
    void unknownPeriodListsAvailableOnes() {
        when(service.searchKpis(any(), anyString(), anyInt())).thenReturn(List.of(
                Map.of("id", UUID.randomUUID(), "name", "API hoàn thành", "periodName", "Tháng 5/2026")));

        assertThat(tool.suggestSubmissionForm(new SubmissionFormFillRequest(
                "API hoàn thành", "Tháng 12/2026", 12d, null, null, null), withForm(Map.of())))
                .contains("\"error\"").contains("Tháng 5/2026");
        assertThat(FormPatchStore.get()).isNull();
    }

    @Test
    @DisplayName("KPI không có thật thì chỉ đường sang search chứ không bịa id")
    void unknownKpiPointsToSearch() {
        when(service.searchKpis(any(), anyString(), anyInt())).thenReturn(List.of());

        assertThat(tool.suggestSubmissionForm(req("KPI không tồn tại", 10d, null), withForm(Map.of())))
                .contains("\"error\"").contains("search");
        assertThat(FormPatchStore.get()).isNull();
    }

    @Test
    @DisplayName("giá trị thực tế ÂM bị chặn")
    void negativeActualValueRejected() {
        assertThat(tool.suggestSubmissionForm(req(null, -5d, null), withForm(Map.of())))
                .contains("\"error\"");
        assertThat(FormPatchStore.get()).isNull();
    }

    @Test
    @DisplayName("mức định tính tra theo tên, tên lạ thì LIỆT KÊ các mức đang có")
    void qualitativeLevelResolution() {
        UUID id = UUID.randomUUID();
        when(levels.findByOrganizationIdOrderByPositionAsc(any())).thenReturn(List.of(
                QualitativeLevel.builder().id(id).name("Tốt").build(),
                QualitativeLevel.builder().id(UUID.randomUUID()).name("Xuất sắc").build()));

        SubmissionFormFillRequest ok = new SubmissionFormFillRequest(
                null, null, null, "tot", null, null);
        tool.suggestSubmissionForm(ok, withForm(Map.of()));
        assertThat(FormPatchStore.get().entries().get(0).value())
                .as("bỏ dấu vẫn phải khớp").isEqualTo(id.toString());

        FormPatchStore.clear();
        SubmissionFormFillRequest bad = new SubmissionFormFillRequest(
                null, null, null, "Siêu cấp", null, null);
        assertThat(tool.suggestSubmissionForm(bad, withForm(Map.of())))
                .contains("\"error\"").contains("Tốt").contains("Xuất sắc");
    }

    @Test
    @DisplayName("ô đã có đúng giá trị đó thì bỏ qua, không đề xuất lại")
    void skipsUnchangedFields() {
        String out = tool.suggestSubmissionForm(req(null, 45d, "xong sớm"),
                withForm(Map.of("actualValue", 45L, "note", "xong sớm")));

        assertThat(FormPatchStore.get()).isNull();
        assertThat(out).contains("Không có ô nào thay đổi");
    }

    @Test
    @DisplayName("nêu rõ ô bắt buộc còn thiếu để model nhắc trước khi người dùng bấm Lưu")
    void reportsStillMissing() {
        assertThat(tool.suggestSubmissionForm(req(null, null, "ghi chú"), withForm(Map.of())))
                .contains("Còn thiếu bắt buộc").contains("chỉ tiêu");
    }

    // ── ô ẩn trên màn hình ───────────────────────────────────────────────

    @Test
    @DisplayName("ô KHÔNG có trên màn hình thì không thành đề xuất, dù bản khai báo cho phép")
    void dropsFieldsHiddenOnScreen() {
        // KPI định lượng: form chỉ vẽ Trị số, không vẽ Mức định tính. Trước đây trợ lý vẫn điền
        // được rồi báo "đã điền vào form" — người dùng không có chỗ nào để nhìn thấy hay xoá đi.
        assertThat(tool.suggestSubmissionForm(req(null, 18d, "ghi chú"),
                withFields(Map.of(), List.of("actualValue"))))
                .doesNotContain("\"error\"");

        assertThat(FormPatchStore.get().entries()).extracting(FormPatch.Entry::field)
                .containsExactly("actualValue")
                .as("Ghi chú bị ẩn thì không được lọt vào bản đề xuất");
    }

    @Test
    @DisplayName("client không khai ô nào đang hiện -> giữ nguyên hành vi cũ")
    void keepsOldBehaviourWhenClientSendsNothing() {
        // Client cũ chưa gửi openFormFields. Thà cũ còn hơn chặn sạch mọi đề xuất khi triển khai dở.
        assertThat(tool.suggestSubmissionForm(req(null, 18d, "ghi chú"), withForm(Map.of())))
                .doesNotContain("\"error\"");
        assertThat(FormPatchStore.get().entries()).extracting(FormPatch.Entry::field)
                .containsExactlyInAnyOrder("actualValue", "note");
    }

    @Test
    @DisplayName("mọi ô đề xuất đều bị ẩn -> nói rõ vì sao, KHÔNG nói \"không có gì thay đổi\"")
    void explainsWhenEverythingIsHidden() {
        String out = tool.suggestSubmissionForm(req(null, 18d, null),
                withFields(Map.of(), List.of("note")));

        // Câu "không có ô nào thay đổi" sẽ khiến model tưởng nó đề xuất trùng giá trị cũ rồi thử lại.
        assertThat(out).contains("KHÔNG có trên màn hình").doesNotContain("không có ô nào thay đổi");
        assertThat(FormPatchStore.get()).isNull();
    }

    // ── luật máy chủ theo loại chỉ tiêu ──────────────────────────────────

    @Test
    @DisplayName("mức định tính trên KPI ĐỊNH LƯỢNG bị chặn, kèm câu chỉ cách sửa")
    void rejectsQualitativeLevelOnQuantitativeKpi() {
        UUID id = givenKpiOfType(com.kpitracking.enums.KpiType.QUANTITATIVE);

        String out = tool.suggestSubmissionForm(
                new SubmissionFormFillRequest(null, null, null, "Tốt", null, "vì bạn yêu cầu"),
                withForm(Map.of("kpiCriteriaId", id.toString())));

        assertThat(out).contains("\"error\"").contains("ĐỊNH LƯỢNG").contains("actualValue");
        assertThat(FormPatchStore.get()).isNull();
    }

    @Test
    @DisplayName("trị số trên KPI ĐỊNH TÍNH cũng bị chặn — chặn cả hai chiều")
    void rejectsActualValueOnQualitativeKpi() {
        UUID id = givenKpiOfType(com.kpitracking.enums.KpiType.QUALITATIVE);

        String out = tool.suggestSubmissionForm(req(null, 18d, null),
                withForm(Map.of("kpiCriteriaId", id.toString())));

        assertThat(out).contains("\"error\"").contains("ĐỊNH TÍNH").contains("qualitativeLevelName");
    }

    @Test
    @DisplayName("KPI định lượng: mức định tính KHÔNG thay được trị số khi báo ô còn thiếu")
    void qualitativeLevelDoesNotSatisfyMissingValue() {
        // Đây là chỗ sinh ra lời khuyên sai: trợ lý báo "không thiếu gì", người dùng bấm lưu và
        // ăn lỗi 400 "Vui lòng nhập giá trị thực tế cho chỉ tiêu định lượng".
        UUID id = givenKpiOfType(com.kpitracking.enums.KpiType.QUANTITATIVE);

        String out = tool.suggestSubmissionForm(req(null, null, "ghi chú"),
                withForm(Map.of("kpiCriteriaId", id.toString(), "qualitativeLevelId", UUID.randomUUID().toString())));

        assertThat(out).contains("Còn thiếu bắt buộc").contains("giá trị thực tế");
    }
}
