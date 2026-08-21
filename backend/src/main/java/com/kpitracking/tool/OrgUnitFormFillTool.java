package com.kpitracking.tool;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.kpitracking.service.ai.form.FormFillSupport;
import com.kpitracking.service.ai.form.FormPatch;
import com.kpitracking.service.ai.form.FormRegistry;
import com.kpitracking.service.ai.form.FormSpec.Descriptor;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Đề xuất giá trị điền vào form TẠO/SỬA ĐƠN VỊ đang mở.
 *
 * <p>Chỉ ĐỀ XUẤT. Cấp bậc và đơn vị cha nhận bằng TÊN, máy chủ tự tra id — đơn vị cha còn đi qua
 * {@code validateSubtreeAccess} nên không thể đề xuất gắn vào nhánh ngoài phạm vi quản lý.
 *
 * <p>Tỉnh/huyện và vai trò cố ý KHÔNG khai báo — xem chú thích ở {@code FormRegistry}.
 */
@Component
@RequiredArgsConstructor
public class OrgUnitFormFillTool {

    private final FormRegistry formRegistry;
    private final FormFillSupport fill;

    public record OrgUnitFormFillRequest(
            @JsonProperty(required = false) String name,
            @JsonProperty(required = false) String code,
            @JsonProperty(required = false) String email,
            @JsonProperty(required = false) String phone,
            @JsonProperty(required = false) String address,
            @JsonProperty(required = false) String hierarchyLevelName, // vd "Phòng ban", "Nhóm"
            @JsonProperty(required = false) String parentUnitName,
            // BẮT BUỘC — xem ghi chú ở FormFillSupport.requireArgs: mọi ô đều tuỳ chọn thì `{}` là
            // lời gọi HỢP LỆ, và model gọi rỗng để dò. Các tool đọc đều có một ô bắt buộc.
            String reason) {}

    @Tool(name = "suggest_org_unit_form", description =
            "Đề xuất giá trị điền vào form TẠO/SỬA ĐƠN VỊ đang mở trên màn hình người dùng. "
            + "Chỉ điền ô người dùng thực sự nêu — ô không chắc thì BỎ QUA, đừng đoán. "
            + "Đây là ĐỀ XUẤT: người dùng xem lại rồi tự chọn ô nào muốn nhận. "
            + "hierarchyLevelName (cấp bậc) và parentUnitName (đơn vị cha) truyền bằng TÊN, "
            + "KHÔNG truyền UUID. Form này không nhận tỉnh/huyện và vai trò. "
            + "reason: một câu ngắn nói vì sao đề xuất như vậy.")
    public String suggestOrgUnitForm(OrgUnitFormFillRequest request, ToolContext context) {
        try {
            fill.requireArgs(request, "suggest_org_unit_form", OrgUnitFormFillRequest.class);
            fill.requireOpenForm(FormRegistry.ORG_UNIT_FORM, context);
            Descriptor form = formRegistry.find(FormRegistry.ORG_UNIT_FORM);
            Map<String, Object> current = fill.currentValues(context);
            String reason = fill.reasonOr(request.reason());

            List<FormPatch.Entry> entries = new ArrayList<>();
            Map<String, Object> scalars = new LinkedHashMap<>();
            scalars.put("name", request.name());
            scalars.put("code", request.code());
            scalars.put("email", request.email());
            scalars.put("phone", request.phone());
            scalars.put("address", request.address());
            fill.addScalars(entries, form, current, scalars, reason);

            if (notBlank(request.hierarchyLevelName())) {
                FormFillSupport.Resolved h = fill.hierarchyLevel(request.hierarchyLevelName(), context);
                fill.addIfChanged(entries, current, form.field("orgHierarchyId"), h.single(), h.display(), reason);
            }
            if (notBlank(request.parentUnitName())) {
                FormFillSupport.Resolved p = fill.units(List.of(request.parentUnitName()), context);
                fill.addIfChanged(entries, current, form.field("parentId"), p.single(), p.display(), reason);
            }

            return fill.finish(context, FormRegistry.ORG_UNIT_FORM, "suggest_org_unit_form",
                    entries, stillMissing(request, current));

        } catch (Exception e) {
            return fill.toolError("suggest_org_unit_form", e);
        }
    }

    /** Ô bắt buộc theo orgUnitSchema.ts: tên, mã, cấp bậc. */
    private String stillMissing(OrgUnitFormFillRequest req, Map<String, Object> current) {
        List<String> missing = new ArrayList<>();
        if (blank(req.name(), current.get("name"))) missing.add("tên đơn vị");
        if (blank(req.code(), current.get("code"))) missing.add("mã đơn vị");
        if (blank(req.hierarchyLevelName(), current.get("orgHierarchyId"))) missing.add("cấp bậc");
        return missing.isEmpty() ? "" : "Còn thiếu bắt buộc: " + String.join(", ", missing) + ".";
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static boolean blank(String proposed, Object currentValue) {
        if (notBlank(proposed)) return false;
        return currentValue == null || String.valueOf(currentValue).isBlank();
    }
}
