package com.kpitracking.tool;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.kpitracking.enums.KpiType;
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
 *
 * <p>Nhập nhằng đó CHỈ tồn tại khi tra chỉ tiêu bằng TÊN. Người dùng chọn chỉ tiêu trong danh sách
 * thả xuống là đã chọn đúng một bản của đúng một kỳ, nên lượt "điền hộ trị số" không cần biết kỳ.
 * Bản mô tả tool trước đây nói phải truyền periodName mà không nêu điều kiện, và model suy ra là
 * phải hỏi kỳ ở MỌI lượt — đo được: bốn lượt liên tiếp chỉ xin điền trị số đều bị hỏi ngược lại
 * tên kỳ, có lượt còn đòi thêm cả từ ngày / đến ngày.
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
            + "Người dùng KHÔNG nêu tên chỉ tiêu (vd chỉ nói \"điền trị số 15\") → form đã chọn sẵn "
            + "chỉ tiêu, mà chỉ tiêu đã chọn TỰ XÁC ĐỊNH kỳ. Khi đó gọi tool với ĐÚNG ô họ nêu — "
            + "vd actualValue=15 kèm reason — để trống kpiName và periodName, và KHÔNG hỏi lại về kỳ. "
            + "Người dùng CÓ nêu tên một chỉ tiêu → PHẢI truyền kpiName để tool tra và đổi ô Chỉ tiêu. "
            + "Đừng bao giờ giả định tên họ nêu chính là chỉ tiêu đang chọn sẵn: bỏ qua kpiName lúc đó "
            + "là ghi số vào chỉ tiêu KHÁC với chỉ tiêu họ vừa gọi tên. "
            + "periodName CHỈ cần khi người dùng nêu tên một chỉ tiêu và tên đó khớp nhiều kỳ "
            + "(vd kpiName=\"API hoàn thành\", periodName=\"Tháng 6/2026\") — khi đó tool báo lỗi kèm "
            + "danh sách kỳ để bạn hỏi lại. "
            + "Nếu người dùng NGOÀI việc điền ô còn xin chỗ gửi tài liệu minh chứng, hãy gọi thêm "
            + "`request_evidence_upload` trong CÙNG lượt — tool này không mở được vùng thả. "
            + "reason: một câu ngắn nói vì sao đề xuất như vậy.")
    public String suggestSubmissionForm(SubmissionFormFillRequest request, ToolContext context) {
        try {
            fill.requireArgs(request, "suggest_submission_form", SubmissionFormFillRequest.class);
            fill.requireOpenForm(FormRegistry.SUBMISSION_FORM, context);
            Descriptor form = formRegistry.find(FormRegistry.SUBMISSION_FORM);
            Map<String, Object> current = fill.currentValues(context);
            String reason = fill.reasonOr(request.reason());

            // Loại của chỉ tiêu ĐANG chọn — tra thẳng từ kho, không tin client. Chỉ tiêu người
            // dùng vừa gọi tên trong chính lượt này thì lấy loại của bản đó (xử lý bên dưới).
            KpiType type = fill.kpiTypeOf(current.get("kpiCriteriaId"));
            guardAgainstWrongType(type, request);

            List<FormPatch.Entry> entries = new ArrayList<>();

            Map<String, Object> scalars = new LinkedHashMap<>();
            scalars.put("actualValue", request.actualValue());
            scalars.put("note", request.note());
            fill.addScalars(entries, form, current, scalars, reason);

            if (notBlank(request.kpiName())) {
                FormFillSupport.Resolved k = fill.kpi(request.kpiName(), request.periodName(), context);
                // Người dùng đổi sang chỉ tiêu khác thì luật phải theo chỉ tiêu MỚI, không phải
                // cái đang có trên form.
                guardAgainstWrongType(fill.kpiTypeOf(k.single()), request);
                fill.addIfChanged(entries, current, form.field("kpiCriteriaId"), k.single(), k.display(), reason);
            }
            if (notBlank(request.qualitativeLevelName())) {
                FormFillSupport.Resolved q = fill.qualitativeLevel(request.qualitativeLevelName(), context);
                fill.addIfChanged(entries, current, form.field("qualitativeLevelId"), q.single(), q.display(), reason);
            }

            return fill.finish(context, FormRegistry.SUBMISSION_FORM, "suggest_submission_form",
                    entries, stillMissing(request, current, type));

        } catch (Exception e) {
            return fill.toolError("suggest_submission_form", e);
        }
    }

    /**
     * Ô bắt buộc còn trống theo submissionSchema.ts. Chỉ tiêu là bắt buộc; phần giá trị thì tuỳ loại
     * KPI nên chỉ nhắc khi CẢ HAI đường (số và mức định tính) đều trống.
     */
    private String stillMissing(SubmissionFormFillRequest req, Map<String, Object> current, KpiType type) {
        List<String> missing = new ArrayList<>();
        if (!notBlank(req.kpiName()) && isBlank(current.get("kpiCriteriaId"))) missing.add("chỉ tiêu");
        // Mức định tính KHÔNG thay được trị số ở KPI định lượng. Trước đây nó thay được, nên trợ
        // lý báo "không thiếu gì", người dùng bấm lưu và ăn lỗi 400 của KpiSubmissionService.
        boolean hasQualitative = notBlank(req.qualitativeLevelName()) || !isBlank(current.get("qualitativeLevelId"));
        boolean hasNumber = req.actualValue() != null || current.get("actualValue") != null;
        boolean noValue = type == KpiType.QUANTITATIVE ? !hasNumber : !(hasNumber || hasQualitative);
        if (noValue) missing.add("giá trị thực tế hoặc mức định tính");
        return missing.isEmpty() ? "" : "Còn thiếu bắt buộc: " + String.join(", ", missing) + ".";
    }

    /**
     * Chặn đề xuất lệch loại chỉ tiêu.
     *
     * <p>Ném ngoại lệ "sửa được" chứ không bỏ qua lặng lẽ như lớp lọc ô ẩn: ở đây model CÓ đủ
     * thông tin để làm đúng ngay trong lượt này, chỉ cần biết mình vừa chọn nhầm ô.
     */
    private static void guardAgainstWrongType(KpiType type, SubmissionFormFillRequest req) {
        if (type == KpiType.QUANTITATIVE && notBlank(req.qualitativeLevelName())) {
            throw new IllegalArgumentException("Chỉ tiêu đang chọn là ĐỊNH LƯỢNG nên form không có ô "
                    + "Mức định tính. Hãy dùng actualValue (con số đạt được) thay vì qualitativeLevelName.");
        }
        if (type == KpiType.QUALITATIVE && req.actualValue() != null) {
            throw new IllegalArgumentException("Chỉ tiêu đang chọn là ĐỊNH TÍNH nên form không có ô "
                    + "Giá trị thực tế. Hãy dùng qualitativeLevelName (vd \"Tốt\") thay vì actualValue.");
        }
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static boolean isBlank(Object o) {
        return o == null || String.valueOf(o).isBlank();
    }
}
