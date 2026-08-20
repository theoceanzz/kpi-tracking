package com.kpitracking.tool;

import com.kpitracking.security.PermissionChecker;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Nơi khai báo DUY NHẤT: nhóm nào gồm tool nào, và nhóm đó đòi quyền gì.
 *
 * <p>Thêm tool mới về sau chỉ là thêm một class và một dòng ở đây — không phải sửa file dùng chung,
 * không ảnh hưởng nhóm khác. Đây là phần tính mở rộng mà kiến trúc phẳng cũ không có.
 *
 * <p>Việc lọc theo QUYỀN nằm ở đây chứ không phải lúc thực thi, và đó là chủ đích: tool người dùng
 * không có quyền dùng sẽ <b>không bao giờ xuất hiện trong danh sách gửi cho model</b>. Model không
 * thể gọi thứ nó không nhìn thấy — chặt hơn nhiều so với việc để nó gọi rồi mới từ chối.
 */
@Component
@RequiredArgsConstructor
public class ToolRegistry {

    /** Nhóm ý định. Thứ tự khai báo cũng là thứ tự ưu tiên khi gửi cho model. */
    public enum Group {
        /** Luôn gửi kèm mọi truy vấn: rẻ (2 tool) và cứu được một lần định tuyến sai. */
        CORE,
        /** Cơ cấu tổ chức, nhân sự, kỳ đánh giá. */
        LOOKUP,
        /** KPI và bài nộp. */
        KPI,
        /** Xếp hạng, so sánh, xu hướng, rủi ro. */
        INSIGHT,
        /**
         * Đề xuất điền form đang mở trên màn hình. KHÔNG chọn theo nhóm như các nhóm khác: chỉ
         * đúng tool phụ trách form đang mở mới được gửi đi ({@link #formTool}), nên thêm form mới
         * không làm phình bộ tool của mọi lượt chat khác.
         */
        FORM,
        /** Tool GHI (tạo/sửa). Chưa có tool nào; để sẵn ranh giới đọc–ghi. */
        ACTION
    }

    private final SearchTool searchTool;
    private final PeopleTool peopleTool;
    private final OrgUnitTool orgUnitTool;
    private final KpiTool kpiTool;
    private final SubmissionTool submissionTool;
    private final AnalyticsTool analyticsTool;
    private final RankTool rankTool;
    private final CompareTool compareTool;
    private final EscapeHatchTool escapeHatchTool;
    private final KpiFormFillTool kpiFormFillTool;
    private final SubmissionFormFillTool submissionFormFillTool;
    private final EvaluationFormFillTool evaluationFormFillTool;
    private final KpiAdjustmentFormFillTool kpiAdjustmentFormFillTool;
    private final OrgUnitFormFillTool orgUnitFormFillTool;
    private final OrgUnitDrawerFormFillTool orgUnitDrawerFormFillTool;
    private final PermissionChecker permissionChecker;

    /** Quyền bắt buộc để mở một nhóm; {@code null} = không đòi quyền riêng. */
    private static final Map<Group, String> REQUIRED_PERMISSION = new EnumMap<>(Map.of(
                    Group.ACTION, "KPI:CREATE"
            ));

    private Map<Group, List<Object>> groups() {
        Map<Group, List<Object>> m = new EnumMap<>(Group.class);
        // get_people phục vụ cả "tôi là ai" nên nằm ở CORE cùng search — hai thứ này đi với mọi câu hỏi.
        m.put(Group.CORE, List.of(searchTool, escapeHatchTool));
        m.put(Group.LOOKUP, List.of(orgUnitTool, peopleTool));
        m.put(Group.KPI, List.of(kpiTool, submissionTool));
        m.put(Group.INSIGHT, List.of(rankTool, compareTool, analyticsTool));
        // FORM cố ý RỖNG: tool điền form chọn theo form đang mở chứ không theo nhóm — xem formTool().
        m.put(Group.FORM, List.of());
        m.put(Group.ACTION, List.of());
        return m;
    }

    /** Tên tool -> bean phụ trách form tương ứng. Thêm form mới là thêm một dòng ở đây. */
    private Map<String, Object> formTools() {
        return Map.of(
                "suggest_kpi_form", kpiFormFillTool,
                "suggest_submission_form", submissionFormFillTool,
                "suggest_evaluation_form", evaluationFormFillTool,
                "suggest_kpi_adjustment_form", kpiAdjustmentFormFillTool,
                "suggest_org_unit_form", orgUnitFormFillTool,
                "suggest_org_unit_drawer_form", orgUnitDrawerFormFillTool);
    }

    /**
     * Tool phụ trách form đang mở, hoặc {@code null} nếu không có form nào khớp.
     *
     * <p>Tên tool lấy từ {@code FormRegistry.toolNameFor(formId)} — bản khai báo form nằm ở đó,
     * còn ở đây chỉ ánh xạ tên sang bean, để hai việc "form nào có ô nào" và "tool nào chạy" không
     * trộn vào một chỗ.
     */
    public Object formTool(String toolName) {
        return toolName == null ? null : formTools().get(toolName);
    }

    /** Mọi nhóm chỉ ĐỌC — dùng khi tắt router hoặc khi router lưỡng lự. */
    public Set<Group> readGroups() {
        return Set.of(Group.CORE, Group.LOOKUP, Group.KPI, Group.INSIGHT);
    }

    /**
     * Tên tool → nhóm chứa nó.
     *
     * <p>Bảng này chép lại quan hệ đã có trong {@link #groups()}, nhưng theo TÊN thay vì theo
     * instance — cần thế vì công đoạn lập kế hoạch chỉ nói được tên tool, chưa có instance nào
     * trong tay. {@code ToolRegistryTest} đối chiếu bảng này với mọi {@code @Tool} thật, nên bảng
     * lệch sẽ làm hỏng test chứ không âm thầm định tuyến sai.
     */
    private static final Map<String, Group> GROUP_BY_TOOL_NAME = Map.ofEntries(
            Map.entry("search", Group.CORE),
            Map.entry("need_other_tools", Group.CORE),
            Map.entry("get_org_unit", Group.LOOKUP),
            Map.entry("get_people", Group.LOOKUP),
            Map.entry("get_kpi", Group.KPI),
            Map.entry("get_submissions", Group.KPI),
            Map.entry("rank", Group.INSIGHT),
            Map.entry("compare_org_units", Group.INSIGHT),
            Map.entry("get_analytics", Group.INSIGHT),
            Map.entry("suggest_kpi_form", Group.FORM),
            Map.entry("suggest_submission_form", Group.FORM),
            Map.entry("suggest_evaluation_form", Group.FORM),
            Map.entry("suggest_kpi_adjustment_form", Group.FORM),
            Map.entry("suggest_org_unit_form", Group.FORM),
            Map.entry("suggest_org_unit_drawer_form", Group.FORM));

    /** Nhóm cần mở để gọi được các tool này. Tên lạ bị bỏ qua, không làm hỏng lượt hỏi. */
    public static Set<Group> groupsForTools(Collection<String> toolNames) {
        if (toolNames == null) return Set.of();
        Set<Group> found = new LinkedHashSet<>();
        for (String name : toolNames) {
            Group g = name == null ? null : GROUP_BY_TOOL_NAME.get(name.trim().toLowerCase(Locale.ROOT));
            if (g != null) found.add(g);
        }
        return found;
    }

    /** Bảng tra tên tool → nhóm, để test đối chiếu với các {@code @Tool} thật. */
    static Map<String, Group> groupByToolName() {
        return GROUP_BY_TOOL_NAME;
    }

    /**
     * Danh sách tool gửi cho model = (nhóm router chọn ∪ CORE) ∩ quyền của người dùng.
     */
    public List<Object> toolsFor(Set<Group> requested, UUID userId) {
        Set<Group> effective = new LinkedHashSet<>();
        effective.add(Group.CORE);
        if (requested != null) effective.addAll(requested);

        Map<Group, List<Object>> all = groups();
        List<Object> tools = new ArrayList<>();
        for (Group g : Group.values()) {
            if (!effective.contains(g)) continue;
            String permission = REQUIRED_PERMISSION.get(g);
            if (permission != null && (userId == null || !permissionChecker.hasPermission(userId, permission))) {
                continue;
            }
            tools.addAll(all.getOrDefault(g, List.of()));
        }
        return tools;
    }

    /** Mọi lớp tool, để thu thập tên tool cho bộ lọc câu trả lời. */
    public static Class<?>[] toolClasses() {
        return new Class<?>[]{
                SearchTool.class, OrgUnitTool.class, PeopleTool.class, KpiTool.class,
                SubmissionTool.class, AnalyticsTool.class, RankTool.class, CompareTool.class,
                EscapeHatchTool.class, KpiFormFillTool.class,
                SubmissionFormFillTool.class, EvaluationFormFillTool.class,
                KpiAdjustmentFormFillTool.class, OrgUnitFormFillTool.class,
                OrgUnitDrawerFormFillTool.class
        };
    }
}
