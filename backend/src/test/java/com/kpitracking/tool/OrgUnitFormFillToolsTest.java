package com.kpitracking.tool;

import com.kpitracking.entity.OrgHierarchyLevel;
import com.kpitracking.repository.OrgHierarchyLevelRepository;
import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.service.ai.form.FormPatch;
import com.kpitracking.service.ai.form.FormPatchStore;
import com.kpitracking.service.ai.form.FormRegistry;
import com.kpitracking.service.ai.form.FormSpec.Field;
import com.kpitracking.tool.KpiAdjustmentFormFillTool.KpiAdjustmentFormFillRequest;
import com.kpitracking.tool.OrgUnitDrawerFormFillTool.OrgUnitDrawerFormFillRequest;
import com.kpitracking.tool.OrgUnitFormFillTool.OrgUnitFormFillRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Test cho ba tool điền form thêm ở đợt này: xin điều chỉnh chỉ tiêu, tạo/sửa đơn vị, và drawer sửa
 * đơn vị.
 *
 * <p>Trọng tâm vẫn là các phép so NGƯỢC — thứ chặn tính năng điền bừa. Riêng hai form đơn vị còn
 * phải chứng minh chúng KHÔNG lẫn vào nhau: khai báo khác nhau nên mở form này mà gọi tool kia phải
 * bị từ chối.
 */
class OrgUnitFormFillToolsTest {

    private OrgUnitStatisticService service;
    private OrgHierarchyLevelRepository hierarchy;
    private KpiAdjustmentFormFillTool adjustment;
    private OrgUnitFormFillTool orgUnit;
    private OrgUnitDrawerFormFillTool drawer;

    @BeforeEach
    void setUp() {
        var deps = FormFillTestFixture.create();
        service = deps.service();
        hierarchy = deps.hierarchyLevels();
        adjustment = new KpiAdjustmentFormFillTool(new FormRegistry(), deps.fill());
        orgUnit = new OrgUnitFormFillTool(new FormRegistry(), deps.fill());
        drawer = new OrgUnitDrawerFormFillTool(new FormRegistry(), deps.fill());
    }

    @AfterEach
    void tearDown() {
        FormPatchStore.clear();
        ToolCallTracker.clear();
    }

    private ToolContext form(String formId, Map<String, Object> current) {
        return new ToolContext(Map.of(
                "orgUnitId", UUID.randomUUID().toString(),
                "organizationId", UUID.randomUUID().toString(),
                "openFormId", formId,
                "openFormValues", current));
    }

    private ToolContext noForm() {
        return new ToolContext(Map.of(
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
            assertThat(FormPatchStore.get()).isNull();
        }

        @Test
        @DisplayName("đề xuất hợp lệ: mục tiêu mới kèm lý do")
        void validSuggestion() {
            String out = adjustment.suggestKpiAdjustmentForm(new KpiAdjustmentFormFillRequest(
                    40d, null, null, "Khối lượng công việc tăng đột biến", "theo yêu cầu"),
                    form(FormRegistry.KPI_ADJUSTMENT_FORM, Map.of()));

            assertThat(out).doesNotContain("\"error\"");
            assertThat(FormPatchStore.get().entries()).extracting(FormPatch.Entry::field)
                    .containsExactlyInAnyOrder("requestedTargetValue", "reason");
        }

        @Test
        @DisplayName("lý do NGẮN hơn 10 ký tự bị chặn — form sẽ từ chối, chặn sớm còn hơn báo đỏ sau khi Điền")
        void tooShortReasonRejected() {
            String out = adjustment.suggestKpiAdjustmentForm(new KpiAdjustmentFormFillRequest(
                    40d, null, null, "bận", null), form(FormRegistry.KPI_ADJUSTMENT_FORM, Map.of()));

            assertThat(out).contains("\"error\"").contains("10");
            assertThat(FormPatchStore.get()).isNull();
        }

        @Test
        @DisplayName("mục tiêu ÂM bị chặn")
        void negativeTargetRejected() {
            assertThat(adjustment.suggestKpiAdjustmentForm(new KpiAdjustmentFormFillRequest(
                    -5d, null, null, "Lý do đủ dài để qua ràng buộc", null),
                    form(FormRegistry.KPI_ADJUSTMENT_FORM, Map.of())))
                    .contains("\"error\"");
            assertThat(FormPatchStore.get()).isNull();
        }

        @Test
        @DisplayName("thiếu lý do thì nhắc — đây là ô bắt buộc duy nhất")
        void reportsMissingReason() {
            assertThat(adjustment.suggestKpiAdjustmentForm(new KpiAdjustmentFormFillRequest(
                    40d, null, null, null, null), form(FormRegistry.KPI_ADJUSTMENT_FORM, Map.of())))
                    .contains("Còn thiếu bắt buộc").contains("lý do");
        }
    }

    @Nested
    @DisplayName("Tạo/sửa đơn vị")
    class OrgUnitForm {

        @Test
        @DisplayName("tra cấp bậc theo tên ra UUID thật, hiện TÊN cho người đọc")
        void resolvesHierarchyLevel() {
            UUID id = UUID.randomUUID();
            when(hierarchy.findByOrganizationIdOrderByLevelOrderAsc(any())).thenReturn(List.of(
                    OrgHierarchyLevel.builder().id(id).unitTypeName("Phòng ban").build(),
                    OrgHierarchyLevel.builder().id(UUID.randomUUID()).unitTypeName("Nhóm").build()));

            orgUnit.suggestOrgUnitForm(new OrgUnitFormFillRequest(
                    "Phòng Marketing", "MKT", null, null, null, "phong ban", null, null),
                    form(FormRegistry.ORG_UNIT_FORM, Map.of()));

            assertThat(FormPatchStore.get().entries())
                    .anySatisfy(e -> {
                        assertThat(e.field()).isEqualTo("orgHierarchyId");
                        assertThat(e.value()).as("bỏ dấu vẫn phải khớp").isEqualTo(id.toString());
                        assertThat(e.display()).isEqualTo("Phòng ban");
                    });
        }

        @Test
        @DisplayName("cấp bậc không có thật thì LIỆT KÊ các cấp đang có, không bịa id")
        void unknownHierarchyListsAvailable() {
            when(hierarchy.findByOrganizationIdOrderByLevelOrderAsc(any())).thenReturn(List.of(
                    OrgHierarchyLevel.builder().id(UUID.randomUUID()).unitTypeName("Phòng ban").build()));

            assertThat(orgUnit.suggestOrgUnitForm(new OrgUnitFormFillRequest(
                    "X", "X", null, null, null, "Chi nhánh vùng", null, null),
                    form(FormRegistry.ORG_UNIT_FORM, Map.of())))
                    .contains("\"error\"").contains("Phòng ban");
            assertThat(FormPatchStore.get()).isNull();
        }

        @Test
        @DisplayName("mở form DRAWER mà gọi tool này thì từ chối — hai form khai báo khác nhau")
        void refusesWhenTheOtherOrgUnitFormIsOpen() {
            assertThat(orgUnit.suggestOrgUnitForm(new OrgUnitFormFillRequest(
                    "Phòng Marketing", "MKT", null, null, null, null, null, null),
                    form(FormRegistry.ORG_UNIT_DRAWER_FORM, Map.of())))
                    .contains("\"error\"");
            assertThat(FormPatchStore.get()).isNull();
        }

        @Test
        @DisplayName("nhắc đủ ô bắt buộc còn thiếu")
        void reportsStillMissing() {
            assertThat(orgUnit.suggestOrgUnitForm(new OrgUnitFormFillRequest(
                    "Phòng Marketing", null, null, null, null, null, null, null),
                    form(FormRegistry.ORG_UNIT_FORM, Map.of())))
                    .contains("Còn thiếu bắt buộc").contains("mã đơn vị").contains("cấp bậc");
        }
    }

    @Nested
    @DisplayName("Drawer sửa đơn vị")
    class Drawer {

        @Test
        @DisplayName("trạng thái nhận cả hằng số lẫn nhãn tiếng Việt")
        void statusAcceptsVietnameseLabel() {
            drawer.suggestOrgUnitDrawerForm(new OrgUnitDrawerFormFillRequest(
                    null, null, null, null, null, null, "Tạm dừng", null),
                    form(FormRegistry.ORG_UNIT_DRAWER_FORM, Map.of()));

            assertThat(FormPatchStore.get().entries())
                    .anySatisfy(e -> {
                        assertThat(e.field()).isEqualTo("status");
                        assertThat(e.value()).isEqualTo("INACTIVE");
                    });
        }

        @Test
        @DisplayName("trạng thái không có thật bị chặn và liệt kê giá trị đúng")
        void unknownStatusRejected() {
            assertThat(drawer.suggestOrgUnitDrawerForm(new OrgUnitDrawerFormFillRequest(
                    null, null, null, null, null, null, "Đang nghỉ lễ", null),
                    form(FormRegistry.ORG_UNIT_DRAWER_FORM, Map.of())))
                    .contains("\"error\"").contains("ACTIVE");
            assertThat(FormPatchStore.get()).isNull();
        }

        @Test
        @DisplayName("KHÔNG nhận ô đơn vị cha — form này không có ô đó")
        void doesNotAcceptParentUnit() {
            // Không có tham số parentUnitName trong record, và descriptor cũng không khai `parentId`.
            assertThat(new FormRegistry().find(FormRegistry.ORG_UNIT_DRAWER_FORM).field("parentId"))
                    .as("khai báo drawer không được lẫn ô của form kia").isNull();
        }

        @Test
        @DisplayName("KHÔNG mở form thì từ chối")
        void refusesWhenNoFormOpen() {
            assertThat(drawer.suggestOrgUnitDrawerForm(new OrgUnitDrawerFormFillRequest(
                    "X", "X", "Nhóm", null, null, null, null, null), noForm()))
                    .contains("\"error\"");
            assertThat(FormPatchStore.get()).isNull();
        }
    }

    @Test
    @DisplayName("tỉnh/huyện và vai trò cố ý KHÔNG khai báo ở cả hai form đơn vị")
    void addressAndRoleFieldsAreNotFillable() {
        FormRegistry registry = new FormRegistry();
        for (String id : List.of(FormRegistry.ORG_UNIT_FORM, FormRegistry.ORG_UNIT_DRAWER_FORM)) {
            assertThat(registry.find(id).fields()).extracting(Field::name)
                    .as("form %s", id)
                    .doesNotContain("provinceId", "districtId", "roleIds");
        }
    }
}
