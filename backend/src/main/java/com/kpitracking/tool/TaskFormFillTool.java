package com.kpitracking.tool;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.kpitracking.service.ai.form.FormFillSupport;
import com.kpitracking.service.ai.form.FormPatch;
import com.kpitracking.service.ai.form.FormRegistry;
import com.kpitracking.service.ai.form.FormSpec.Descriptor;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.invocation.InvocationParameters;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Đề xuất giá trị điền vào hộp TẠO CÔNG VIỆC đang mở (trang Công việc) — "giao cho anh A việc chuẩn bị báo cáo, hạn thứ
 * Sáu". Chỉ ĐỀ XUẤT: không tạo việc, người dùng xem lại rồi tự bấm Tạo (form chạy đủ luật giao việc / KPI ở máy chủ).
 * Người thực hiện tra theo tên và đã kiểm quyền xem từng người; KPI tra theo tên như form KPI.
 */
@Component
@RequiredArgsConstructor
public class TaskFormFillTool {

    private final FormRegistry formRegistry;
    private final FormFillSupport fill;

    public record TaskFormFillRequest(
            @JsonProperty(required = false) String title,
            @JsonProperty(required = false) String description,
            @JsonProperty(required = false) String startDate,     // yyyy-MM-dd
            @JsonProperty(required = false) String dueDate,       // yyyy-MM-dd
            @JsonProperty(required = false) String priority,      // HIGH|MEDIUM|LOW hoặc Cao|Trung bình|Thấp
            @JsonProperty(required = false) List<String> assigneeNames,
            @JsonProperty(required = false) String kpiName,
            @JsonProperty(required = false) String periodName,
            // BẮT BUỘC — xem ghi chú ở FormFillSupport.requireArgs.
            String reason) {}

    @Tool(name = "suggest_task_form", value =
            "Đề xuất giá trị điền vào hộp TẠO CÔNG VIỆC đang mở (trang Công việc). "
            + "Chỉ điền ô người dùng thực sự nêu — ô không chắc thì BỎ QUA, đừng đoán. "
            + "Đây là ĐỀ XUẤT: người dùng xem lại rồi tự bấm Tạo; tool KHÔNG tạo việc. "
            + "title: tên việc ngắn gọn (động từ + việc), description: chi tiết thêm nếu người dùng nêu. "
            + "startDate / dueDate dạng yyyy-MM-dd — tự quy đổi 'thứ Sáu này', 'cuối tháng' theo ngày hôm nay. "
            + "priority: HIGH | MEDIUM | LOW (Cao / Trung bình / Thấp). "
            + "assigneeNames: TÊN người thực hiện (không truyền UUID); bỏ trống = chính người dùng. "
            + "kpiName CHỈ khi người dùng muốn gắn việc vào một KPI cụ thể — việc không cần KPI thì bỏ trống; "
            + "periodName chỉ khi tên KPI khớp nhiều đợt. "
            + "reason: một câu ngắn nói vì sao đề xuất như vậy.")
    public String suggestTaskForm(TaskFormFillRequest request, InvocationParameters context) {
        try {
            fill.requireArgs(request, "suggest_task_form", TaskFormFillRequest.class);
            fill.requireOpenForm(FormRegistry.TASK_FORM, context);
            Descriptor form = formRegistry.find(FormRegistry.TASK_FORM);
            Map<String, Object> current = fill.currentValues(context);
            String reason = fill.reasonOr(request.reason());

            List<FormPatch.Entry> entries = new ArrayList<>();
            Map<String, Object> scalars = new LinkedHashMap<>();
            scalars.put("title", request.title());
            scalars.put("description", request.description());
            scalars.put("startDate", request.startDate());
            scalars.put("dueDate", request.dueDate());
            scalars.put("priority", request.priority());
            fill.addScalars(entries, form, current, scalars, reason);

            if (request.assigneeNames() != null && !request.assigneeNames().isEmpty()) {
                FormFillSupport.Resolved people = fill.users(request.assigneeNames(), context);
                fill.addIfChanged(entries, current, form.field("assigneeIds"), people.ids(), people.display(), reason);
            }
            if (request.kpiName() != null && !request.kpiName().isBlank()) {
                FormFillSupport.Resolved k = fill.kpi(request.kpiName(), request.periodName(), context);
                fill.addIfChanged(entries, current, form.field("kpiId"), k.single(), k.display(), reason);
            }
            String missing = (request.title() == null || request.title().isBlank())
                    && (current.get("title") == null || String.valueOf(current.get("title")).isBlank())
                    ? "Còn thiếu bắt buộc: tên công việc." : "";
            return fill.finish(context, FormRegistry.TASK_FORM, "suggest_task_form", entries, missing);
        } catch (Exception e) {
            return fill.toolError("suggest_task_form", e);
        }
    }
}
