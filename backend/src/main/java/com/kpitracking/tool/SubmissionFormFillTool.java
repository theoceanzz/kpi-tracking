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
 * Đề xuất giá trị điền vào form NỘP BÁO CÁO KPI đang mở.
 *
 * <p>Chỉ ĐỀ XUẤT — không ghi gì xuống cơ sở dữ liệu, người dùng xem trước rồi tự chấp nhận.
 *
 * <p>Điểm khác các form kia: chỉ tiêu phải là ĐÚNG MỘT bản của đúng một kỳ. Một KPI thường lặp qua
 * nhiều kỳ, và nộp nhầm kỳ là ghi số vào sai chỗ — nên {@link FormFillSupport#kpi} bắt hỏi lại khi
 * tên khớp nhiều bản thay vì tự chọn.
 */
@Component
@RequiredArgsConstructor
public class SubmissionFormFillTool {

    private final FormRegistry formRegistry;
    private final FormFillSupport fill;

    public record SubmissionFormFillRequest(
            @JsonProperty(required = false) String kpiName,             // tên chỉ tiêu cần nộp
            @JsonProperty(required = false) String periodName,          // kỳ của chỉ tiêu đó
            @JsonProperty(required = false) Double actualValue,
            @JsonProperty(required = false) String qualitativeLevelName, // vd "Tốt", "Xuất sắc"
            @JsonProperty(required = false) String note,
            @JsonProperty(required = false) String periodStart,          // dd/MM/yyyy hoặc yyyy-MM-dd
            @JsonProperty(required = false) String periodEnd,
            // BẮT BUỘC — xem ghi chú ở FormFillSupport.requireArgs: mọi ô đều tuỳ chọn thì `{}` là
            // lời gọi HỢP LỆ, và model gọi rỗng để dò. Các tool đọc đều có một ô bắt buộc.
            String reason) {}

    @Tool(name = "suggest_submission_form", description =
            "Đề xuất giá trị điền vào form NỘP BÁO CÁO KPI đang mở trên màn hình người dùng. "
            + "Chỉ điền ô người dùng thực sự nêu — ô không chắc thì BỎ QUA, đừng đoán. "
            + "Đây là ĐỀ XUẤT: người dùng xem lại rồi tự chọn ô nào muốn nhận. "
            + "kpiName, periodName và qualitativeLevelName truyền bằng TÊN, KHÔNG truyền UUID. "
            + "KPI định lượng dùng actualValue (con số đạt được); KPI định tính dùng "
            + "qualitativeLevelName. "
            + "MỘT KPI LẶP QUA NHIỀU KỲ nên gần như luôn phải truyền kèm periodName "
            + "(vd kpiName=\"API hoàn thành\", periodName=\"Tháng 6/2026\"); thiếu nó thì tool "
            + "không biết nộp cho kỳ nào và sẽ báo lỗi kèm danh sách kỳ để bạn hỏi lại người dùng. "
            + "reason: một câu ngắn nói vì sao đề xuất như vậy.")
    public String suggestSubmissionForm(SubmissionFormFillRequest request, ToolContext context) {
        try {
            fill.requireArgs(request, "suggest_submission_form", SubmissionFormFillRequest.class);
            fill.requireOpenForm(FormRegistry.SUBMISSION_FORM, context);
            Descriptor form = formRegistry.find(FormRegistry.SUBMISSION_FORM);
            Map<String, Object> current = fill.currentValues(context);
            String reason = fill.reasonOr(request.reason());

            List<FormPatch.Entry> entries = new ArrayList<>();

            Map<String, Object> scalars = new LinkedHashMap<>();
            scalars.put("actualValue", request.actualValue());
            scalars.put("note", request.note());
            scalars.put("periodStart", request.periodStart());
            scalars.put("periodEnd", request.periodEnd());
            fill.addScalars(entries, form, current, scalars, reason);

            if (notBlank(request.kpiName())) {
                FormFillSupport.Resolved k = fill.kpi(request.kpiName(), request.periodName(), context);
                fill.addIfChanged(entries, current, form.field("kpiCriteriaId"), k.single(), k.display(), reason);
            }
            if (notBlank(request.qualitativeLevelName())) {
                FormFillSupport.Resolved q = fill.qualitativeLevel(request.qualitativeLevelName(), context);
                fill.addIfChanged(entries, current, form.field("qualitativeLevelId"), q.single(), q.display(), reason);
            }

            return fill.finish(context, FormRegistry.SUBMISSION_FORM, "suggest_submission_form",
                    entries, stillMissing(request, current));

        } catch (Exception e) {
            return fill.toolError("suggest_submission_form", e);
        }
    }

    /**
     * Ô bắt buộc còn trống theo submissionSchema.ts. Chỉ tiêu là bắt buộc; phần giá trị thì tuỳ loại
     * KPI nên chỉ nhắc khi CẢ HAI đường (số và mức định tính) đều trống.
     */
    private String stillMissing(SubmissionFormFillRequest req, Map<String, Object> current) {
        List<String> missing = new ArrayList<>();
        if (!notBlank(req.kpiName()) && isBlank(current.get("kpiCriteriaId"))) missing.add("chỉ tiêu");
        boolean noValue = req.actualValue() == null && current.get("actualValue") == null
                && !notBlank(req.qualitativeLevelName()) && isBlank(current.get("qualitativeLevelId"));
        if (noValue) missing.add("giá trị thực tế hoặc mức định tính");
        return missing.isEmpty() ? "" : "Còn thiếu bắt buộc: " + String.join(", ", missing) + ".";
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static boolean isBlank(Object o) {
        return o == null || String.valueOf(o).isBlank();
    }
}
