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
 * Đề xuất giá trị điền vào form SỬA ĐƠN VỊ dạng drawer (màn Cơ cấu tổ chức).
 *
 * <p>KHÁC {@link OrgUnitFormFillTool} dù nhìn giống: ở đây cấp bậc là CHỮ tự do
 * ({@code unitTypeName}) chứ không phải id, có thêm {@code status}, và không có đơn vị cha —
 * đơn vị cha do chính chỗ bấm mở drawer quyết định. Gộp hai form lại là mở đường cho đề xuất
 * sai kiểu.
 */
@Component
@RequiredArgsConstructor
public class OrgUnitDrawerFormFillTool {

    private final FormRegistry formRegistry;
    private final FormFillSupport fill;

    public record OrgUnitDrawerFormFillRequest(
            @JsonProperty(required = false) String name,
            @JsonProperty(required = false) String code,
            @JsonProperty(required = false) String unitTypeName, // loại tổ chức, chữ tự do
            @JsonProperty(required = false) String email,
            @JsonProperty(required = false) String phone,
            @JsonProperty(required = false) String address,
            @JsonProperty(required = false) String status,       // ACTIVE|TRIAL|INACTIVE|SUSPENDED
            // BẮT BUỘC — xem ghi chú ở FormFillSupport.requireArgs: mọi ô đều tuỳ chọn thì `{}` là
            // lời gọi HỢP LỆ, và model gọi rỗng để dò. Các tool đọc đều có một ô bắt buộc.
            String reason) {}

    @Tool(name = "suggest_org_unit_drawer_form", description =
            "Đề xuất giá trị điền vào form SỬA ĐƠN VỊ (drawer ở màn Cơ cấu tổ chức) đang mở. "
            + "Chỉ điền ô người dùng thực sự nêu — ô không chắc thì BỎ QUA, đừng đoán. "
            + "Đây là ĐỀ XUẤT: người dùng xem lại rồi tự chọn ô nào muốn nhận. "
            + "unitTypeName là loại tổ chức viết bằng chữ (vd 'Phòng ban', 'Nhóm'). "
            + "status nhận ACTIVE | TRIAL | INACTIVE | SUSPENDED, hoặc nhãn tiếng Việt tương ứng "
            + "(Hoạt động, Dùng thử, Tạm dừng, Đình chỉ). "
            + "Form này không nhận đơn vị cha, tỉnh/huyện hay vai trò. "
            + "reason: một câu ngắn nói vì sao đề xuất như vậy.")
    public String suggestOrgUnitDrawerForm(OrgUnitDrawerFormFillRequest request, ToolContext context) {
        try {
            fill.requireArgs(request, "suggest_org_unit_drawer_form", OrgUnitDrawerFormFillRequest.class);
            fill.requireOpenForm(FormRegistry.ORG_UNIT_DRAWER_FORM, context);
            Descriptor form = formRegistry.find(FormRegistry.ORG_UNIT_DRAWER_FORM);
            Map<String, Object> current = fill.currentValues(context);
            String reason = fill.reasonOr(request.reason());

            List<FormPatch.Entry> entries = new ArrayList<>();
            Map<String, Object> scalars = new LinkedHashMap<>();
            scalars.put("name", request.name());
            scalars.put("code", request.code());
            scalars.put("unitTypeName", request.unitTypeName());
            scalars.put("email", request.email());
            scalars.put("phone", request.phone());
            scalars.put("address", request.address());
            scalars.put("status", request.status());
            fill.addScalars(entries, form, current, scalars, reason);

            return fill.finish(context, FormRegistry.ORG_UNIT_DRAWER_FORM, "suggest_org_unit_drawer_form",
                    entries, stillMissing(request, current));

        } catch (Exception e) {
            return fill.toolError("suggest_org_unit_drawer_form", e);
        }
    }

    /** Ô bắt buộc theo schema của drawer: tên, mã, loại tổ chức. */
    private String stillMissing(OrgUnitDrawerFormFillRequest req, Map<String, Object> current) {
        List<String> missing = new ArrayList<>();
        if (blank(req.name(), current.get("name"))) missing.add("tên đơn vị");
        if (blank(req.code(), current.get("code"))) missing.add("mã đơn vị");
        if (blank(req.unitTypeName(), current.get("unitTypeName"))) missing.add("loại tổ chức");
        return missing.isEmpty() ? "" : "Còn thiếu bắt buộc: " + String.join(", ", missing) + ".";
    }

    private static boolean blank(String proposed, Object currentValue) {
        if (proposed != null && !proposed.isBlank()) return false;
        return currentValue == null || String.valueOf(currentValue).isBlank();
    }
}
