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
 * Đề xuất giá trị điền vào form XIN ĐIỀU CHỈNH CHỈ TIÊU đang mở.
 *
 * <p>Chỉ ĐỀ XUẤT — không ghi gì xuống cơ sở dữ liệu. Form này không có ô tham chiếu thực thể nào:
 * KPI cần điều chỉnh đến từ prop của modal, không phải trường của form, nên tool chỉ việc kiểm giá
 * trị rồi dựng bản đề xuất.
 */
@Component
@RequiredArgsConstructor
public class KpiAdjustmentFormFillTool {

    private final FormRegistry formRegistry;
    private final FormFillSupport fill;

    public record KpiAdjustmentFormFillRequest(
            @JsonProperty(required = false) Double requestedTargetValue,
            @JsonProperty(required = false) Double requestedMinimumValue,
            @JsonProperty(required = false) Boolean deactivationRequest,
            @JsonProperty(required = false) String reason,
            // BẮT BUỘC — xem ghi chú ở FormFillSupport.requireArgs: mọi ô đều tuỳ chọn thì `{}` là
            // lời gọi HỢP LỆ, và model gọi rỗng để dò. Các tool đọc đều có một ô bắt buộc.
            String suggestionReason) {}

    @Tool(name = "suggest_kpi_adjustment_form", description =
            "Đề xuất giá trị điền vào form XIN ĐIỀU CHỈNH CHỈ TIÊU đang mở trên màn hình người dùng. "
            + "Chỉ điền ô người dùng thực sự nêu — ô không chắc thì BỎ QUA, đừng đoán. "
            + "Đây là ĐỀ XUẤT: người dùng xem lại rồi tự chọn ô nào muốn nhận. "
            + "reason là LÝ DO xin điều chỉnh, phải từ 10 ký tự trở lên và viết theo đúng ý người "
            + "dùng nêu — đừng tự bịa lý do. "
            + "deactivationRequest=true nghĩa là xin NGỪNG theo dõi chỉ tiêu này. "
            + "suggestionReason: một câu ngắn nói vì sao bạn đề xuất như vậy.")
    public String suggestKpiAdjustmentForm(KpiAdjustmentFormFillRequest request, ToolContext context) {
        try {
            fill.requireArgs(request, "suggest_kpi_adjustment_form", KpiAdjustmentFormFillRequest.class);
            fill.requireOpenForm(FormRegistry.KPI_ADJUSTMENT_FORM, context);
            Descriptor form = formRegistry.find(FormRegistry.KPI_ADJUSTMENT_FORM);
            Map<String, Object> current = fill.currentValues(context);
            String why = fill.reasonOr(request.suggestionReason());

            List<FormPatch.Entry> entries = new ArrayList<>();
            Map<String, Object> scalars = new LinkedHashMap<>();
            scalars.put("requestedTargetValue", request.requestedTargetValue());
            scalars.put("requestedMinimumValue", request.requestedMinimumValue());
            scalars.put("deactivationRequest", request.deactivationRequest());
            scalars.put("reason", request.reason());
            fill.addScalars(entries, form, current, scalars, why);

            return fill.finish(context, FormRegistry.KPI_ADJUSTMENT_FORM, "suggest_kpi_adjustment_form",
                    entries, stillMissing(request, current));

        } catch (Exception e) {
            return fill.toolError("suggest_kpi_adjustment_form", e);
        }
    }

    /** Lý do là ô bắt buộc duy nhất của adjustmentSchema. */
    private String stillMissing(KpiAdjustmentFormFillRequest req, Map<String, Object> current) {
        boolean hasReason = (req.reason() != null && !req.reason().isBlank())
                || (current.get("reason") != null && !String.valueOf(current.get("reason")).isBlank());
        return hasReason ? "" : "Còn thiếu bắt buộc: lý do xin điều chỉnh.";
    }
}
