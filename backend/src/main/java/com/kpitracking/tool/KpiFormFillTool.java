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
 * Đề xuất giá trị điền vào form tạo/sửa chỉ tiêu KPI đang mở trên màn hình người dùng.
 *
 * <p><b>Chỉ ĐỀ XUẤT.</b> Tool này không ghi gì xuống cơ sở dữ liệu và không tự sửa form. Nó trả về
 * một bản đề xuất; client hiện xem trước từng ô kèm lý do, người dùng chọn ô nào muốn nhận. Vì vậy
 * nó không nằm trong nhóm {@code ACTION} (nhóm dành cho tool GHI, đòi quyền {@code KPI:CREATE}).
 *
 * <p><b>Nhận TÊN chứ không nhận UUID.</b> Model nêu "Team Backend", "kỳ tháng 6"; máy chủ tự tra ra
 * id và kiểm quyền. Bắt model tự đi tìm UUID rồi truyền vào là mở đường cho nó bịa ra một UUID
 * đúng định dạng — thứ không thể phát hiện bằng mắt trong bản xem trước.
 *
 * <p>Phần khung (kiểm giá trị, tra tên, dựng bản đề xuất) nằm ở {@link FormFillSupport} và dùng
 * chung với các form khác; ở đây chỉ còn khai báo tham số và ánh xạ sang tên ô.
 */
@Component
@RequiredArgsConstructor
public class KpiFormFillTool {

    private final FormRegistry formRegistry;
    private final FormFillSupport fill;

    public record KpiFormFillRequest(
            @JsonProperty(required = false) String kpiType,        // QUANTITATIVE | QUALITATIVE
            @JsonProperty(required = false) String name,
            @JsonProperty(required = false) String description,
            @JsonProperty(required = false) String unit,
            @JsonProperty(required = false) Double weight,
            @JsonProperty(required = false) Double targetValue,
            @JsonProperty(required = false) Double minimumValue,
            @JsonProperty(required = false) String frequency,
            @JsonProperty(required = false) Boolean isReverseKpi,
            @JsonProperty(required = false) Boolean isBonusKpi,
            @JsonProperty(required = false) String deadline,       // dd/MM/yyyy hoặc yyyy-MM-dd
            @JsonProperty(required = false) String periodName,     // tên kỳ KPI
            @JsonProperty(required = false) List<String> orgUnitNames,
            @JsonProperty(required = false) List<String> assigneeNames,
            @JsonProperty(required = false) String reason) {}      // vì sao đề xuất như vậy

    @Tool(name = "suggest_kpi_form", description =
            "Đề xuất giá trị điền vào form TẠO/SỬA CHỈ TIÊU KPI đang mở trên màn hình người dùng. "
            + "Chỉ điền những ô người dùng thực sự nêu hoặc suy ra được chắc chắn — ô không chắc thì BỎ QUA, "
            + "đừng đoán. Đây là ĐỀ XUẤT: người dùng sẽ xem lại và tự chọn ô nào muốn nhận. "
            + "Đơn vị/người/kỳ truyền bằng TÊN (vd orgUnitNames=[\"Team Backend\"], periodName=\"Tháng 6\"), "
            + "KHÔNG truyền UUID. "
            + "kpiType=QUANTITATIVE cần thêm unit, targetValue, minimumValue, weight; "
            + "kpiType=QUALITATIVE chỉ cần weight. "
            + "reason: một câu ngắn nói vì sao đề xuất như vậy, hiện cho người dùng đọc.")
    public String suggestKpiForm(KpiFormFillRequest request, ToolContext context) {
        try {
            fill.requireOpenForm(FormRegistry.KPI_FORM, context);
            Descriptor form = formRegistry.find(FormRegistry.KPI_FORM);
            Map<String, Object> current = fill.currentValues(context);
            String reason = fill.reasonOr(request.reason());

            List<FormPatch.Entry> entries = new ArrayList<>();

            Map<String, Object> scalars = new LinkedHashMap<>();
            scalars.put("kpiType", request.kpiType());
            scalars.put("name", request.name());
            scalars.put("description", request.description());
            scalars.put("unit", request.unit());
            scalars.put("weight", request.weight());
            scalars.put("targetValue", request.targetValue());
            scalars.put("minimumValue", request.minimumValue());
            scalars.put("frequency", request.frequency());
            scalars.put("isReverseKpi", request.isReverseKpi());
            scalars.put("isBonusKpi", request.isBonusKpi());
            scalars.put("deadline", request.deadline());
            fill.addScalars(entries, form, current, scalars, reason);

            if (notBlank(request.periodName())) {
                FormFillSupport.Resolved p = fill.period(request.periodName(), context);
                fill.addIfChanged(entries, current, form.field("kpiPeriodId"), p.single(), p.display(), reason);
            }
            if (request.orgUnitNames() != null && !request.orgUnitNames().isEmpty()) {
                FormFillSupport.Resolved u = fill.units(request.orgUnitNames(), context);
                fill.addIfChanged(entries, current, form.field("orgUnitIds"), u.ids(), u.display(), reason);
            }
            if (request.assigneeNames() != null && !request.assigneeNames().isEmpty()) {
                FormFillSupport.Resolved a = fill.users(request.assigneeNames(), context);
                fill.addIfChanged(entries, current, form.field("assignedToIds"), a.ids(), a.display(), reason);
            }

            return fill.finish(FormRegistry.KPI_FORM, "suggest_kpi_form", entries, stillMissing(request, current));

        } catch (Exception e) {
            return fill.toolError("suggest_kpi_form", e);
        }
    }

    /**
     * Các ô BẮT BUỘC còn trống sau khi áp đề xuất, theo đúng ràng buộc của kpiSchema.ts. Nói ra để
     * model nhắc người dùng, thay vì để họ bấm Lưu rồi mới thấy form báo đỏ.
     */
    private String stillMissing(KpiFormFillRequest req, Map<String, Object> current) {
        String type = req.kpiType() != null ? req.kpiType() : String.valueOf(current.get("kpiType"));
        List<String> missing = new ArrayList<>();
        if (blank(req.name(), current.get("name"))) missing.add("tên chỉ tiêu");
        if (req.periodName() == null && blank(null, current.get("kpiPeriodId"))) missing.add("đợt KPI");
        if (req.weight() == null && current.get("weight") == null) missing.add("trọng số");
        if ("QUANTITATIVE".equalsIgnoreCase(type)) {
            if (req.targetValue() == null && current.get("targetValue") == null) missing.add("giá trị mục tiêu");
            if (req.minimumValue() == null && current.get("minimumValue") == null) missing.add("mục tiêu tối thiểu");
            if (blank(req.unit(), current.get("unit"))) missing.add("đơn vị tính");
        }
        return missing.isEmpty() ? "" : "Còn thiếu bắt buộc: " + String.join(", ", missing) + ".";
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private boolean blank(String proposed, Object currentValue) {
        if (proposed != null && !proposed.isBlank()) return false;
        return currentValue == null || String.valueOf(currentValue).isBlank();
    }
}
