package com.kpitracking.tool;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.kpitracking.service.ai.form.FormFillSupport;
import com.kpitracking.service.ai.form.FormPatch;
import com.kpitracking.service.ai.form.FormRegistry;
import com.kpitracking.service.ai.form.FormSpec.Descriptor;
import lombok.RequiredArgsConstructor;
import dev.langchain4j.invocation.InvocationParameters;
import dev.langchain4j.agent.tool.Tool;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Đề xuất giá trị điền vào form TẠO/SỬA ĐƠN VỊ dạng drawer (màn Cơ cấu tổ chức) — form đơn vị duy
 * nhất còn dùng. Cấp bậc là CHỮ tự do ({@code unitTypeName}); không có đơn vị cha — đơn vị cha do
 * chính chỗ bấm mở drawer quyết định.
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
            @JsonProperty(required = false) String parentRelation, // DIRECT|ADVISORY|SUPERVISORY — chỉ khi người dùng nói rõ
            // BẮT BUỘC — xem ghi chú ở FormFillSupport.requireArgs: mọi ô đều tuỳ chọn thì `{}` là
            // lời gọi HỢP LỆ, và model gọi rỗng để dò. Các tool đọc đều có một ô bắt buộc.
            String reason) {}

    @Tool(name = "suggest_org_unit_drawer_form", value =
            "Đề xuất giá trị điền vào form SỬA ĐƠN VỊ (drawer ở màn Cơ cấu tổ chức) đang mở. "
            + "Chỉ điền ô người dùng thực sự nêu — ô không chắc thì BỎ QUA, đừng đoán. "
            + "Đây là ĐỀ XUẤT: người dùng xem lại rồi tự chọn ô nào muốn nhận. "
            + "unitTypeName là loại tổ chức viết bằng chữ (vd 'Phòng ban', 'Nhóm'). "
            + "status nhận ACTIVE | TRIAL | INACTIVE | SUSPENDED, hoặc nhãn tiếng Việt tương ứng "
            + "(Hoạt động, Dùng thử, Tạm dừng, Đình chỉ). "
            + "parentRelation là quan hệ với đơn vị cấp trên: DIRECT (trực tuyến), ADVISORY (tham mưu – tư vấn), "
            + "SUPERVISORY (giám sát độc lập). CHỈ điền ADVISORY/SUPERVISORY khi người dùng NÓI RÕ quan hệ đó "
            + "(vd 'ban tham mưu', 'ban kiểm soát độc lập'); KHÔNG suy ra từ tên đơn vị — tên có chữ 'Kiểm soát' "
            + "hay 'Cố vấn' chưa phải là người dùng nói về quan hệ. Không nói gì về quan hệ thì BỎ ô này. "
            + "Form này không nhận đơn vị cha, tỉnh/huyện hay vai trò. "
            + "reason: một câu ngắn nói vì sao đề xuất như vậy.")
    public String suggestOrgUnitDrawerForm(OrgUnitDrawerFormFillRequest request, InvocationParameters context) {
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
            List<String> skipped = new ArrayList<>();
            scalars.put("parentRelation", relationOf(request.parentRelation(), form, context, skipped));
            fill.addScalars(entries, form, current, scalars, reason);

            String note = skipped.isEmpty() ? "" : " " + String.join(" ", skipped);
            if (entries.isEmpty() && !skipped.isEmpty()) {
                // Ô duy nhất bị bỏ: nói đúng lý do thay vì "không có ô nào thay đổi" (model sẽ thử lại y hệt).
                return note.trim() + " Hãy trả lời người dùng bằng lời, ĐỪNG thử lại.";
            }
            return fill.finish(context, FormRegistry.ORG_UNIT_DRAWER_FORM, "suggest_org_unit_drawer_form",
                    entries, stillMissing(request, current) + note);

        } catch (Exception e) {
            return fill.toolError("suggest_org_unit_drawer_form", e);
        }
    }

    /**
     * Cụm từ người dùng phải nói ra thì mới nhận quan hệ tham mưu / giám sát (đã bỏ dấu, chữ thường).
     * Cố ý KHÔNG có từ đứng một mình: "tư vấn" (phòng tư vấn khách hàng là đơn vị trực tuyến),
     * "độc lập" (hạch toán độc lập), "giám sát" (phòng giám sát chất lượng).
     */
    private static final Map<String, List<String>> RELATION_WORDS = Map.of(
            "ADVISORY", List.of("tham muu", "quan he tu van", "co van cho", "advisory", "advisor"),
            "SUPERVISORY", List.of("giam sat doc lap", "kiem soat doc lap", "doc lap voi", "supervisory", "oversight"));

    /**
     * Giá trị ô quan hệ với cấp trên sau khi kiểm, hoặc {@code null} = bỏ ô (lý do ghi vào {@code skipped}).
     *
     * <p>Giá trị sai thì BỎ ô chứ không làm hỏng cả đề xuất như các ô enum khác: đây là ô phụ, các ô
     * còn lại vẫn có ích. ADVISORY/SUPERVISORY chỉ nhận khi CÂU NGƯỜI DÙNG có từ nói về quan hệ đó —
     * model hay suy từ tên ("Ban Kiểm soát" ⇒ giám sát) mà luật là không đoán theo tên. Không đọc được
     * câu người dùng thì cũng bỏ: không kiểm được là không nhận, khác chốt chặn văn xuôi.
     */
    private String relationOf(String raw, Descriptor form, InvocationParameters context, List<String> skipped) {
        if (raw == null || raw.isBlank()) return null;
        String value = form.field("parentRelation").matchEnum(raw.trim());
        if (value == null) {
            skipped.add("Bỏ qua ô quan hệ với cấp trên: '" + raw.trim()
                    + "' không hợp lệ (chỉ nhận DIRECT, ADVISORY, SUPERVISORY).");
            return null;
        }
        if ("DIRECT".equals(value)) return value;
        String question = fill.normalizedQuestion(context);
        boolean said = question != null && RELATION_WORDS.get(value).stream().anyMatch(question::contains);
        if (!said) {
            skipped.add("Bỏ qua ô quan hệ với cấp trên: người dùng chưa nói rõ đơn vị là "
                    + ("ADVISORY".equals(value) ? "tham mưu – tư vấn" : "giám sát độc lập")
                    + " — không suy ra từ tên đơn vị.");
            return null;
        }
        return value;
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
