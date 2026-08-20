package com.kpitracking.service.ai.form;

import com.kpitracking.entity.OrgHierarchyLevel;
import com.kpitracking.entity.QualitativeLevel;
import com.kpitracking.repository.OrgHierarchyLevelRepository;
import com.kpitracking.repository.QualitativeLevelRepository;
import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.service.ai.form.FormSpec.Descriptor;
import com.kpitracking.service.ai.form.FormSpec.Field;
import com.kpitracking.tool.ToolCallTracker;
import com.kpitracking.tool.ToolSupport;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Phần dùng chung của MỌI tool đề xuất điền form: kiểm giá trị, tra tên → ID, dựng bản đề xuất.
 *
 * <p>Cùng vai trò với {@link ToolSupport} ở tầng tool đọc — giữ MỘT bản duy nhất của những việc lặp
 * lại, để thêm một form mới chỉ còn là khai báo các ô và ánh xạ tham số, không phải chép lại toàn
 * bộ phần khung.
 *
 * <p><b>Mọi lỗi ném ra từ đây là viết cho MODEL đọc</b>, không phải cho lập trình viên: tool bắt rồi
 * trả nguyên văn, model đọc và tự sửa ngay trong cùng lượt. Đó là thứ khiến vòng lặp tự chữa được
 * thay vì trả bừa.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class FormFillSupport {

    private final FormFieldValidator validator;
    private final OrgUnitStatisticService orgUnitStatisticService;
    private final QualitativeLevelRepository qualitativeLevelRepository;
    private final OrgHierarchyLevelRepository orgHierarchyLevelRepository;
    private final ToolSupport support;

    /** Số kết quả tối đa khi tra tên; nhiều hơn nghĩa là tên quá chung, phải hỏi lại. */
    private static final int MATCH_LIMIT = 5;

    // ── ngữ cảnh form đang mở ────────────────────────────────────────────────

    /**
     * Chặn lượt mà client không mở đúng form này.
     *
     * <p>Không thể xảy ra khi định tuyến đúng (tool chỉ được trao khi form mở), nhưng nếu xảy ra thì
     * bản đề xuất rơi vào hư không — báo rõ còn hơn im lặng tạo ra thứ không ai nhận.
     */
    public void requireOpenForm(String formId, ToolContext context) {
        if (!formId.equals(context.getContext().get("openFormId"))) {
            throw new IllegalArgumentException(
                    "Người dùng không mở form này nên chưa đề xuất điền form được. "
                    + "Hãy trả lời bằng lời thay vì gọi tool này.");
        }
    }

    /** Giá trị các ô đang có trên form; rỗng nếu client không gửi. */
    @SuppressWarnings("unchecked")
    public Map<String, Object> currentValues(ToolContext context) {
        return (Map<String, Object>) context.getContext().getOrDefault("openFormValues", Map.of());
    }

    // ── dựng bản đề xuất ─────────────────────────────────────────────────────

    /**
     * Kiểm và thêm các ô GIÁ TRỊ ĐƠN (chữ, số, boolean, enum, ngày).
     *
     * <p>Bỏ qua ô {@code null} (model không nêu) và ô không có trong bản khai báo — ô lạ không phải
     * lỗi của model, chỉ là thứ form này không cho điền.
     */
    public void addScalars(List<FormPatch.Entry> entries, Descriptor form, Map<String, Object> current,
                           Map<String, Object> proposed, String reason) {
        for (Map.Entry<String, Object> e : proposed.entrySet()) {
            if (e.getValue() == null) continue;
            Field f = form.field(e.getKey());
            if (f == null) continue;
            FormFieldValidator.Checked c = validator.check(f, e.getValue());
            addIfChanged(entries, current, f, c.value(), c.display(), reason);
        }
    }

    /** Bỏ qua ô mà giá trị đề xuất trùng với giá trị đang có — đề xuất y hệt chỉ làm nhiễu. */
    public void addIfChanged(List<FormPatch.Entry> entries, Map<String, Object> current,
                             Field f, Object value, String display, String reason) {
        if (f == null) return;
        Object now = current.get(f.name());
        if (now != null && String.valueOf(now).equals(String.valueOf(value))) return;
        entries.add(new FormPatch.Entry(f.name(), f.label(), value, display, reason));
    }

    /**
     * Chốt lượt: ghi bản đề xuất vào kho và trả câu tóm tắt cho model.
     *
     * <p>Trả {@code null} khi không có ô nào đổi — chỗ gọi tự quyết định nói gì.
     */
    public String finish(String formId, String toolName, List<FormPatch.Entry> entries, String suffix) {
        if (entries.isEmpty()) {
            return "Không có ô nào thay đổi so với form hiện tại. Hãy trả lời người dùng bằng lời.";
        }
        FormPatchStore.put(new FormPatch(formId, entries));
        ToolCallTracker.record(toolName);
        log.info("AI-TOOL-CALL {} ({} ô)", toolName, entries.size());

        return "Đã chuẩn bị đề xuất cho " + entries.size() + " ô: "
                + entries.stream().map(FormPatch.Entry::label).toList()
                + ". " + (suffix == null ? "" : suffix)
                + " Hãy nói ngắn gọn cho người dùng biết bạn đề xuất gì và vì sao; "
                + "KHÔNG liệt kê lại từng ô vì giao diện đã hiện bản xem trước.";
    }

    public String reasonOr(String raw) {
        return raw == null || raw.isBlank() ? "Theo yêu cầu của bạn" : raw.trim();
    }

    // ── tra tên → ID, kèm kiểm quyền ─────────────────────────────────────────

    /** Đơn vị theo tên. Trả về [ids, tên hiển thị]; nhập nhằng thì ném để model hỏi lại. */
    public Resolved units(List<String> names, ToolContext context) {
        List<String> ids = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        for (String n : names) {
            ToolSupport.UnitRef ref = support.resolveUnit(null, n, context);
            if (ref.clarification() != null) {
                throw new IllegalArgumentException("Tên đơn vị '" + n
                        + "' khớp nhiều mục. Hãy hỏi người dùng chọn đúng đơn vị nào trước khi đề xuất.");
            }
            support.validateSubtreeAccess(ref.id(), context);
            ids.add(ref.id().toString());
            labels.add(n.trim());
        }
        return new Resolved(ids, String.join(", ", labels));
    }

    /** Nhân sự theo tên, đã kiểm quyền xem từng người. */
    public Resolved users(List<String> names, ToolContext context) {
        List<String> ids = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        for (String n : names) {
            Map<String, Object> u = oneUser(n, context);
            UUID id = UUID.fromString(String.valueOf(u.get("id")));
            support.validateUserAccess(id, context);
            ids.add(id.toString());
            labels.add(String.valueOf(u.get("fullName")));
        }
        return new Resolved(ids, String.join(", ", labels));
    }

    /** Đúng MỘT nhân sự theo tên. */
    public Resolved user(String name, ToolContext context) {
        Resolved r = users(List.of(name), context);
        return new Resolved(r.ids(), r.display());
    }

    public Resolved period(String keyword, ToolContext context) {
        List<Map<String, Object>> found = orgUnitStatisticService.searchKpiPeriods(
                support.getOrgId(context), keyword.trim(), MATCH_LIMIT);
        if (found.isEmpty()) {
            throw new IllegalArgumentException("Không tìm thấy kỳ KPI nào tên '" + keyword
                    + "'. Dùng search (entityType=period) để xem các kỳ đang có rồi nêu đúng tên.");
        }
        if (found.size() > 1) {
            throw new IllegalArgumentException("Tên kỳ '" + keyword + "' khớp nhiều kỳ: "
                    + found.stream().map(m -> String.valueOf(m.get("name"))).toList()
                    + ". Hãy hỏi người dùng chọn kỳ nào.");
        }
        Map<String, Object> p = found.get(0);
        return new Resolved(List.of(String.valueOf(p.get("id"))), String.valueOf(p.get("name")));
    }

    /**
     * KPI theo tên.
     *
     * <p>Một KPI thường lặp qua NHIỀU kỳ nên tên trùng là chuyện bình thường. Khác với các tool đọc
     * (gộp mọi bản trùng tên được), ở đây phải chọn đúng MỘT bản của đúng một kỳ — chọn nhầm là
     * người dùng nộp số vào sai kỳ. Vì vậy trùng tên thì BẮT hỏi lại, kèm tên kỳ để phân biệt.
     */
    public Resolved kpi(String keyword, String periodName, ToolContext context) {
        List<Map<String, Object>> pool = support.kpiMatchPool(keyword.trim(), support.getOrgId(context));
        if (pool.isEmpty()) {
            throw new IllegalArgumentException("Không tìm thấy chỉ tiêu nào tên '" + keyword
                    + "'. Dùng search (entityType=kpi) để tra đúng tên.");
        }
        // Trong dữ liệu thật MỌI KPI đều lặp qua nhiều kỳ, nên nếu không lọc theo kỳ thì tên nào
        // cũng nhập nhằng và tool không bao giờ tra được. Lọc trước rồi mới xét nhập nhằng.
        if (periodName != null && !periodName.isBlank()) {
            String want = FormSpec.Field.normalize(periodName);
            List<Map<String, Object>> byPeriod = pool.stream()
                    .filter(m -> m.get("periodName") != null
                            && FormSpec.Field.normalize(String.valueOf(m.get("periodName"))).contains(want))
                    .toList();
            if (byPeriod.isEmpty()) {
                throw new IllegalArgumentException("Chỉ tiêu '" + keyword + "' không có bản nào ở kỳ '"
                        + periodName + "'. Các kỳ đang có: "
                        + pool.stream().map(m -> String.valueOf(m.get("periodName"))).distinct().toList() + ".");
            }
            pool = byPeriod;
        }
        if (pool.size() > 1) {
            throw new IllegalArgumentException("Tên chỉ tiêu '" + keyword + "' khớp nhiều bản (một KPI "
                    + "lặp qua nhiều kỳ): "
                    + pool.stream().map(m -> m.get("name") + " — " + m.get("periodName")).toList()
                    + ". Hãy hỏi người dùng nộp cho kỳ nào rồi truyền periodName.");
        }
        Map<String, Object> k = pool.get(0);
        UUID id = UUID.fromString(String.valueOf(k.get("id")));
        support.validateKpiAccess(id, context);
        String label = k.get("periodName") != null
                ? k.get("name") + " (" + k.get("periodName") + ")" : String.valueOf(k.get("name"));
        return new Resolved(List.of(id.toString()), label);
    }

    /** Mức định tính (vd "Tốt", "Xuất sắc") theo tên; mỗi tổ chức chỉ vài mức nên lọc trong bộ nhớ. */
    public Resolved qualitativeLevel(String keyword, ToolContext context) {
        String want = FormSpec.Field.normalize(keyword);
        List<QualitativeLevel> all = qualitativeLevelRepository
                .findByOrganizationIdOrderByPositionAsc(support.getOrgId(context));
        List<QualitativeLevel> hit = all.stream()
                .filter(l -> l.getName() != null && FormSpec.Field.normalize(l.getName()).contains(want))
                .toList();
        if (hit.isEmpty()) {
            throw new IllegalArgumentException("Không có mức định tính nào tên '" + keyword + "'. Các mức đang có: "
                    + all.stream().map(QualitativeLevel::getName).toList() + ".");
        }
        if (hit.size() > 1) {
            throw new IllegalArgumentException("Tên mức '" + keyword + "' khớp nhiều mức: "
                    + hit.stream().map(QualitativeLevel::getName).toList() + ". Hãy hỏi người dùng chọn mức nào.");
        }
        return new Resolved(List.of(hit.get(0).getId().toString()), hit.get(0).getName());
    }

    /** Cấp bậc đơn vị (vd "Phòng ban", "Nhóm") theo tên; mỗi tổ chức chỉ vài cấp nên lọc trong bộ nhớ. */
    public Resolved hierarchyLevel(String keyword, ToolContext context) {
        String want = FormSpec.Field.normalize(keyword);
        List<OrgHierarchyLevel> all = orgHierarchyLevelRepository
                .findByOrganizationIdOrderByLevelOrderAsc(support.getOrgId(context));
        List<OrgHierarchyLevel> hit = all.stream()
                .filter(l -> l.getUnitTypeName() != null
                        && FormSpec.Field.normalize(l.getUnitTypeName()).contains(want))
                .toList();
        if (hit.isEmpty()) {
            throw new IllegalArgumentException("Không có cấp bậc nào tên '" + keyword + "'. Các cấp đang có: "
                    + all.stream().map(OrgHierarchyLevel::getUnitTypeName).toList() + ".");
        }
        if (hit.size() > 1) {
            throw new IllegalArgumentException("Tên cấp bậc '" + keyword + "' khớp nhiều cấp: "
                    + hit.stream().map(OrgHierarchyLevel::getUnitTypeName).toList()
                    + ". Hãy hỏi người dùng chọn cấp nào.");
        }
        return new Resolved(List.of(hit.get(0).getId().toString()), hit.get(0).getUnitTypeName());
    }

    private Map<String, Object> oneUser(String keyword, ToolContext context) {
        List<Map<String, Object>> found = orgUnitStatisticService.searchUsers(
                support.getOrgId(context), keyword.trim(), null, null, MATCH_LIMIT);
        if (found.isEmpty()) {
            throw new IllegalArgumentException("Không tìm thấy nhân sự nào tên '" + keyword
                    + "'. Dùng search (entityType=user) để tra đúng tên.");
        }
        if (found.size() > 1) {
            throw new IllegalArgumentException("Tên '" + keyword + "' khớp nhiều người: "
                    + found.stream().map(m -> m.get("fullName") + " (" + m.get("email") + ")").toList()
                    + ". Hãy hỏi người dùng chọn ai.");
        }
        return found.get(0);
    }

    /**
     * @param ids     id đã tra được; ô nhận một thực thể thì lấy {@link #single()}
     * @param display tên cho người đọc — bản xem trước phải hiện TÊN, vì không ai thẩm định được UUID
     */
    public record Resolved(List<String> ids, String display) {
        public String single() {
            return ids.get(0);
        }
    }

    public String toolError(String tool, Exception e) {
        return support.toolError(tool, e);
    }
}
