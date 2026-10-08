package com.kpitracking.tool;

import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.service.ai.form.FormPatch;
import com.kpitracking.service.ai.form.FormRegistry;
import com.kpitracking.service.ai.form.FormSpec.Field;
import com.kpitracking.tool.KpiAdjustmentFormFillTool.KpiAdjustmentFormFillRequest;
import com.kpitracking.tool.OrgUnitDrawerFormFillTool.OrgUnitDrawerFormFillRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import dev.langchain4j.invocation.InvocationParameters;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import com.kpitracking.service.ai.agent.AgentState;
import java.util.HashMap;
import com.kpitracking.service.ai.AiTurn;

/**
 * Test cho hai tool điền form: xin điều chỉnh chỉ tiêu và drawer tạo/sửa đơn vị.
 *
 * <p>Trọng tâm vẫn là các phép so NGƯỢC — thứ chặn tính năng điền bừa.
 */
class OrgUnitFormFillToolsTest {

    /**
     * Trạng thái của lượt, đi cùng {@code InvocationParameters}. Mỗi test một thực thể mới nên không
     * phải dọn gì — đó chính là điều đáng giá so với bản ThreadLocal cũ.
     */
    private AgentState st = AgentState.forToolsOnly();

    /** Ngữ cảnh tool luôn mang theo trạng thái của lượt, giống hệt lúc chạy thật. */
    private InvocationParameters ctxWith(java.util.Map<String, Object> base) {
        java.util.Map<String, Object> m = new HashMap<>(base);
        m.put(AgentState.CONTEXT_KEY, st);
        return new InvocationParameters(m);
    }

    private OrgUnitStatisticService service;
    private KpiAdjustmentFormFillTool adjustment;
    private OrgUnitDrawerFormFillTool drawer;

    @BeforeEach
    void setUp() {
        var deps = FormFillTestFixture.create();
        service = deps.service();
        adjustment = new KpiAdjustmentFormFillTool(new FormRegistry(), deps.fill());
        drawer = new OrgUnitDrawerFormFillTool(new FormRegistry(), deps.fill());
    }

    @AfterEach
    void tearDown() {
    }

    private InvocationParameters form(String formId, Map<String, Object> current) {
        return ctxWith(Map.of(
                "orgUnitId", UUID.randomUUID().toString(),
                "organizationId", UUID.randomUUID().toString(),
                "openFormId", formId,
                "openFormValues", current));
    }

    private InvocationParameters noForm() {
        return ctxWith(Map.of(
                "orgUnitId", UUID.randomUUID().toString(),
                "organizationId", UUID.randomUUID().toString()));
    }

    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Xin điều chỉnh chỉ tiêu")
    class Adjustment {

        @Test
        @DisplayName("KHÔNG mở form thì từ chối")
        void refusesWhenNoFormOpen() {
            assertThat(adjustment.suggestKpiAdjustmentForm(new KpiAdjustmentFormFillRequest(
                    40d, null, null, "Khối lượng công việc tăng đột biến", null), noForm()))
                    .contains("\"error\"");
            assertThat(st.getFormPatch()).isNull();
        }

        @Test
        @DisplayName("đề xuất hợp lệ: mục tiêu mới kèm lý do")
        void validSuggestion() {
            String out = adjustment.suggestKpiAdjustmentForm(new KpiAdjustmentFormFillRequest(
                    40d, null, null, "Khối lượng công việc tăng đột biến", "theo yêu cầu"),
                    form(FormRegistry.KPI_ADJUSTMENT_FORM, Map.of()));

            assertThat(out).doesNotContain("\"error\"");
            assertThat(st.getFormPatch().entries()).extracting(FormPatch.Entry::field)
                    .containsExactlyInAnyOrder("requestedTargetValue", "reason");
        }

        @Test
        @DisplayName("lý do NGẮN hơn 10 ký tự bị chặn — form sẽ từ chối, chặn sớm còn hơn báo đỏ sau khi Điền")
        void tooShortReasonRejected() {
            String out = adjustment.suggestKpiAdjustmentForm(new KpiAdjustmentFormFillRequest(
                    40d, null, null, "bận", null), form(FormRegistry.KPI_ADJUSTMENT_FORM, Map.of()));

            assertThat(out).contains("\"error\"").contains("10");
            assertThat(st.getFormPatch()).isNull();
        }

        @Test
        @DisplayName("mục tiêu ÂM bị chặn")
        void negativeTargetRejected() {
            assertThat(adjustment.suggestKpiAdjustmentForm(new KpiAdjustmentFormFillRequest(
                    -5d, null, null, "Lý do đủ dài để qua ràng buộc", null),
                    form(FormRegistry.KPI_ADJUSTMENT_FORM, Map.of())))
                    .contains("\"error\"");
            assertThat(st.getFormPatch()).isNull();
        }

        @Test
        @DisplayName("thiếu lý do thì nhắc — đây là ô bắt buộc duy nhất")
        void reportsMissingReason() {
            assertThat(adjustment.suggestKpiAdjustmentForm(new KpiAdjustmentFormFillRequest(
                    40d, null, null, null, null), form(FormRegistry.KPI_ADJUSTMENT_FORM, Map.of())))
                    .contains("Còn thiếu bắt buộc").contains("lý do");
        }

        /** Ngữ cảnh có LỜI người dùng thật — chốt chặn viết-hộ chỉ so được khi có câu hỏi gốc. */
        private InvocationParameters asked(String question) {
            AgentState withTurn = new AgentState(new AiTurn(question, null, null));
            return new InvocationParameters(Map.of(
                    "orgUnitId", UUID.randomUUID().toString(),
                    "organizationId", UUID.randomUUID().toString(),
                    "openFormId", FormRegistry.KPI_ADJUSTMENT_FORM,
                    "openFormValues", Map.of(),
                    AgentState.CONTEXT_KEY, withTurn));
        }

        @Test
        @DisplayName("model TỰ VIẾT lý do dài ra cho qua mức tối thiểu -> chặn")
        void rejectsFabricatedReason() {
            // Đo được 3/3 lần: người dùng nói "lý do: bận" (3 ký tự, dưới mức 10), model bèn viết
            // hộ một câu đủ dài. Đặt chữ vào miệng người dùng trên đơn gửi quản lý — mô tả tool đã
            // dặn "đừng tự bịa lý do" và thua cả ba lần, nên phải chặn bằng code.
            String out = adjustment.suggestKpiAdjustmentForm(new KpiAdjustmentFormFillRequest(
                    40d, null, null, "Do công việc hiện tại bận, không thể tập trung", null),
                    asked("Xin điều chỉnh mục tiêu xuống 40, lý do: bận"));

            assertThat(out).contains("\"error\"").contains("lời người dùng");
        }

        @Test
        @DisplayName("lý do TRÍCH từ chính lời người dùng -> cho qua")
        void acceptsReasonQuotedFromUser() {
            // Chốt chặn chỉ chặn mà không cho qua thứ hợp lệ thì còn tệ hơn không có: nó sẽ giết
            // luôn ca A01 của bộ điền form.
            String out = adjustment.suggestKpiAdjustmentForm(new KpiAdjustmentFormFillRequest(
                    40d, null, null, "Khối lượng công việc tăng đột biến", null),
                    asked("Xin điều chỉnh mục tiêu xuống 40, lý do là khối lượng công việc "
                            + "tăng đột biến trong quý này"));

            assertThat(out).doesNotContain("\"error\"");
        }

        @Test
        @DisplayName("không có câu hỏi gốc để so -> KHÔNG chặn, tránh biến phép an toàn thành lỗi giả")
        void doesNotBlockWithoutQuestion() {
            String out = adjustment.suggestKpiAdjustmentForm(new KpiAdjustmentFormFillRequest(
                    40d, null, null, "Một lý do bất kỳ không liên quan gì", null),
                    form(FormRegistry.KPI_ADJUSTMENT_FORM, Map.of()));

            assertThat(out).doesNotContain("\"error\"");
        }
    }

    @Nested
    @DisplayName("Drawer sửa đơn vị")
    class Drawer {

        @Test
        @DisplayName("trạng thái nhận cả hằng số lẫn nhãn tiếng Việt")
        void statusAcceptsVietnameseLabel() {
            drawer.suggestOrgUnitDrawerForm(new OrgUnitDrawerFormFillRequest(
                    null, null, null, null, null, null, "Tạm dừng", null, null),
                    form(FormRegistry.ORG_UNIT_DRAWER_FORM, Map.of()));

            assertThat(st.getFormPatch().entries())
                    .anySatisfy(e -> {
                        assertThat(e.field()).isEqualTo("status");
                        assertThat(e.value()).isEqualTo("INACTIVE");
                    });
        }

        @Test
        @DisplayName("trạng thái không có thật bị chặn và liệt kê giá trị đúng")
        void unknownStatusRejected() {
            assertThat(drawer.suggestOrgUnitDrawerForm(new OrgUnitDrawerFormFillRequest(
                    null, null, null, null, null, null, "Đang nghỉ lễ", null, null),
                    form(FormRegistry.ORG_UNIT_DRAWER_FORM, Map.of())))
                    .contains("\"error\"").contains("ACTIVE");
            assertThat(st.getFormPatch()).isNull();
        }

        @Test
        @DisplayName("KHÔNG nhận ô đơn vị cha — form này không có ô đó")
        void doesNotAcceptParentUnit() {
            // Không có tham số parentUnitName trong record, và descriptor cũng không khai `parentId`.
            assertThat(new FormRegistry().find(FormRegistry.ORG_UNIT_DRAWER_FORM).field("parentId"))
                    .as("khai báo drawer không được lẫn ô của form kia").isNull();
        }

        // ── Quan hệ với đơn vị cấp trên (chỉ để vẽ sơ đồ) ──────────────────────────────

        /** Drawer đang mở, có câu người dùng thật; {@code fields} = ô đang hiện (null = client cũ, không lọc). */
        private InvocationParameters drawerAsked(String question, List<String> fields) {
            Map<String, Object> m = new HashMap<>(Map.of(
                    "orgUnitId", UUID.randomUUID().toString(),
                    "organizationId", UUID.randomUUID().toString(),
                    "openFormId", FormRegistry.ORG_UNIT_DRAWER_FORM,
                    "openFormValues", Map.of()));
            if (fields != null) m.put("openFormFields", fields);
            st = new AgentState(new AiTurn(question, null, null)); // lượt có câu người dùng thật
            m.put(AgentState.CONTEXT_KEY, st);
            return new InvocationParameters(m);
        }

        private OrgUnitDrawerFormFillRequest relation(String name, String parentRelation) {
            return new OrgUnitDrawerFormFillRequest(name, null, null, null, null, null, null, parentRelation, null);
        }

        private Object proposed(String field) {
            return st.getFormPatch() == null ? null : st.getFormPatch().entries().stream()
                    .filter(e -> e.field().equals(field)).map(FormPatch.Entry::value).findFirst().orElse(null);
        }

        @Test
        @DisplayName("người dùng nói rõ 'ban tham mưu' thì nhận ADVISORY")
        void advisoryWhenUserSaysSo() {
            drawer.suggestOrgUnitDrawerForm(relation(null, "ADVISORY"),
                    drawerAsked("Đơn vị này là ban tham mưu cho giám đốc", null));
            assertThat(proposed("parentRelation")).isEqualTo("ADVISORY");
        }

        @Test
        @DisplayName("người dùng nói 'ban kiểm soát độc lập' thì nhận SUPERVISORY")
        void supervisoryWhenUserSaysSo() {
            drawer.suggestOrgUnitDrawerForm(relation(null, "SUPERVISORY"),
                    drawerAsked("Đặt đơn vị này là ban kiểm soát độc lập", null));
            assertThat(proposed("parentRelation")).isEqualTo("SUPERVISORY");
        }

        @Test
        @DisplayName("DIRECT (cả nhãn tiếng Việt) luôn nhận, không cần từ khoá")
        void directAlwaysAccepted() {
            drawer.suggestOrgUnitDrawerForm(relation(null, "Trực tuyến"), drawerAsked("Sửa lại cho đúng", null));
            assertThat(proposed("parentRelation")).isEqualTo("DIRECT");
        }

        @Test
        @DisplayName("NGƯỢC — chỉ có TÊN 'Ban Kiểm soát' thì không suy ra SUPERVISORY; ô khác vẫn điền")
        void doesNotGuessFromUnitName() {
            String out = drawer.suggestOrgUnitDrawerForm(relation("Ban Kiểm soát", "SUPERVISORY"),
                    drawerAsked("Đổi tên đơn vị thành Ban Kiểm soát", null));

            assertThat(proposed("parentRelation")).isNull();
            assertThat(proposed("name")).isEqualTo("Ban Kiểm soát");
            assertThat(out).contains("Bỏ qua ô quan hệ").doesNotContain("\"error\"");
        }

        @Test
        @DisplayName("NGƯỢC — 'hạch toán độc lập' không phải giám sát độc lập")
        void independentAccountingIsNotSupervisory() {
            drawer.suggestOrgUnitDrawerForm(relation("Chi nhánh Đà Nẵng", "SUPERVISORY"),
                    drawerAsked("Đổi tên thành Chi nhánh Đà Nẵng, đây là chi nhánh hạch toán độc lập", null));
            assertThat(proposed("parentRelation")).isNull();
            assertThat(proposed("name")).isEqualTo("Chi nhánh Đà Nẵng");
        }

        @Test
        @DisplayName("NGƯỢC — 'phòng tư vấn khách hàng' là đơn vị trực tuyến, không phải tham mưu")
        void customerAdvisoryDeptIsNotAdvisory() {
            drawer.suggestOrgUnitDrawerForm(relation("Phòng tư vấn khách hàng", "ADVISORY"),
                    drawerAsked("Đổi tên thành Phòng tư vấn khách hàng", null));
            assertThat(proposed("parentRelation")).isNull();
            assertThat(proposed("name")).isEqualTo("Phòng tư vấn khách hàng");
        }

        @Test
        @DisplayName("NGƯỢC — 'phòng giám sát chất lượng' không phải giám sát độc lập")
        void qualityControlDeptIsNotSupervisory() {
            drawer.suggestOrgUnitDrawerForm(relation(null, "SUPERVISORY"),
                    drawerAsked("Đây là phòng giám sát chất lượng", null));
            assertThat(proposed("parentRelation")).isNull();
        }

        @Test
        @DisplayName("NGƯỢC — không đọc được câu người dùng thì không nhận ADVISORY/SUPERVISORY")
        void noQuestionNoSideRelation() {
            drawer.suggestOrgUnitDrawerForm(relation("Phòng A", "ADVISORY"),
                    form(FormRegistry.ORG_UNIT_DRAWER_FORM, Map.of()));
            assertThat(proposed("parentRelation")).isNull();
            assertThat(proposed("name")).isEqualTo("Phòng A");
        }

        @Test
        @DisplayName("giá trị sai bị BỎ QUA — không làm hỏng các ô còn lại, không báo lỗi")
        void invalidValueIgnored() {
            String out = drawer.suggestOrgUnitDrawerForm(relation("Phòng A", "SONG_SONG"),
                    drawerAsked("Đổi tên thành Phòng A, đơn vị song song", null));

            assertThat(out).doesNotContain("\"error\"").contains("không hợp lệ");
            assertThat(proposed("parentRelation")).isNull();
            assertThat(proposed("name")).isEqualTo("Phòng A");
        }

        @Test
        @DisplayName("chỉ đề xuất mỗi ô quan hệ mà sai thì không có bản đề xuất, nói rõ lý do")
        void onlyInvalidRelationGivesNoPatch() {
            String out = drawer.suggestOrgUnitDrawerForm(relation(null, "khong biet"),
                    drawerAsked("Đổi quan hệ", null));
            assertThat(st.getFormPatch()).isNull();
            assertThat(out).contains("không hợp lệ").doesNotContain("\"error\"");
        }

        @Test
        @DisplayName("đơn vị GỐC: màn hình không có ô quan hệ nên không điền ô đó")
        void rootUnitHasNoRelationField() {
            drawer.suggestOrgUnitDrawerForm(relation("Công ty mẹ", "ADVISORY"),
                    drawerAsked("Đổi tên thành Công ty mẹ, là ban tham mưu", List.of("name", "email", "phone", "address", "unitTypeName")));

            assertThat(proposed("parentRelation")).isNull();
            assertThat(proposed("name")).isEqualTo("Công ty mẹ");
        }

        @Test
        @DisplayName("KHÔNG mở form thì từ chối")
        void refusesWhenNoFormOpen() {
            assertThat(drawer.suggestOrgUnitDrawerForm(new OrgUnitDrawerFormFillRequest(
                    "X", "X", "Nhóm", null, null, null, null, null, null), noForm()))
                    .contains("\"error\"");
            assertThat(st.getFormPatch()).isNull();
        }
    }

    @Test
    @DisplayName("tỉnh/huyện và vai trò cố ý KHÔNG khai báo ở form đơn vị")
    void addressAndRoleFieldsAreNotFillable() {
        assertThat(new FormRegistry().find(FormRegistry.ORG_UNIT_DRAWER_FORM).fields()).extracting(Field::name)
                .doesNotContain("provinceId", "districtId", "roleIds");
    }
}
