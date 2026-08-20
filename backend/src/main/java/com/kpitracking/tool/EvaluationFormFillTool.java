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
 * Đề xuất giá trị điền vào form ĐÁNH GIÁ NHÂN VIÊN đang mở.
 *
 * <p>Chỉ ĐỀ XUẤT — điểm đánh giá là dữ liệu nhân sự nên tuyệt đối không tự ghi; người dùng phải
 * xem trước và tự bấm chấp nhận. Người được đề xuất cũng đi qua
 * {@code ToolSupport.validateUserAccess}, nên không thể đề xuất chấm điểm người ngoài phạm vi quản lý.
 */
@Component
@RequiredArgsConstructor
public class EvaluationFormFillTool {

    private final FormRegistry formRegistry;
    private final FormFillSupport fill;

    public record EvaluationFormFillRequest(
            @JsonProperty(required = false) String employeeName,  // tên nhân viên được đánh giá
            @JsonProperty(required = false) String periodName,    // tên đợt KPI
            @JsonProperty(required = false) Double score,
            @JsonProperty(required = false) String comment,
            @JsonProperty(required = false) String reason) {}

    @Tool(name = "suggest_evaluation_form", description =
            "Đề xuất giá trị điền vào form ĐÁNH GIÁ NHÂN VIÊN đang mở trên màn hình người dùng. "
            + "Chỉ điền ô người dùng thực sự nêu — ô không chắc thì BỎ QUA, đừng đoán. "
            + "TUYỆT ĐỐI không tự nghĩ ra điểm: chỉ điền score khi người dùng nói rõ con số. "
            + "Đây là ĐỀ XUẤT: người dùng xem lại rồi tự chọn ô nào muốn nhận. "
            + "employeeName và periodName truyền bằng TÊN, KHÔNG truyền UUID. "
            + "reason: một câu ngắn nói vì sao đề xuất như vậy.")
    public String suggestEvaluationForm(EvaluationFormFillRequest request, ToolContext context) {
        try {
            fill.requireOpenForm(FormRegistry.EVALUATION_FORM, context);
            Descriptor form = formRegistry.find(FormRegistry.EVALUATION_FORM);
            Map<String, Object> current = fill.currentValues(context);
            String reason = fill.reasonOr(request.reason());

            List<FormPatch.Entry> entries = new ArrayList<>();

            Map<String, Object> scalars = new LinkedHashMap<>();
            scalars.put("score", request.score());
            scalars.put("comment", request.comment());
            fill.addScalars(entries, form, current, scalars, reason);

            if (notBlank(request.employeeName())) {
                FormFillSupport.Resolved u = fill.user(request.employeeName(), context);
                fill.addIfChanged(entries, current, form.field("userId"), u.single(), u.display(), reason);
            }
            if (notBlank(request.periodName())) {
                FormFillSupport.Resolved p = fill.period(request.periodName(), context);
                fill.addIfChanged(entries, current, form.field("kpiPeriodId"), p.single(), p.display(), reason);
            }

            return fill.finish(FormRegistry.EVALUATION_FORM, "suggest_evaluation_form",
                    entries, stillMissing(request, current));

        } catch (Exception e) {
            return fill.toolError("suggest_evaluation_form", e);
        }
    }

    /** Ô bắt buộc còn trống theo evaluationSchema.ts: nhân viên, đợt KPI, điểm. */
    private String stillMissing(EvaluationFormFillRequest req, Map<String, Object> current) {
        List<String> missing = new ArrayList<>();
        if (!notBlank(req.employeeName()) && isBlank(current.get("userId"))) missing.add("nhân viên");
        if (!notBlank(req.periodName()) && isBlank(current.get("kpiPeriodId"))) missing.add("đợt KPI");
        if (req.score() == null && current.get("score") == null) missing.add("điểm");
        return missing.isEmpty() ? "" : "Còn thiếu bắt buộc: " + String.join(", ", missing) + ".";
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static boolean isBlank(Object o) {
        return o == null || String.valueOf(o).isBlank();
    }
}
