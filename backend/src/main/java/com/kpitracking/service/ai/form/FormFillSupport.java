package com.kpitracking.service.ai.form;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.OrgHierarchyLevel;
import com.kpitracking.entity.QualitativeLevel;
import com.kpitracking.enums.KpiType;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.OrgHierarchyLevelRepository;
import com.kpitracking.repository.QualitativeLevelRepository;
import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.service.ai.form.FormSpec.Descriptor;
import com.kpitracking.service.ai.form.FormSpec.Field;
import com.kpitracking.service.ai.ToolProgress;
import com.kpitracking.tool.ToolSupport;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.stereotype.Component;

import java.lang.reflect.RecordComponent;
import java.util.Arrays;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import com.kpitracking.service.ai.agent.AgentState;

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
    private final KpiCriteriaRepository kpiCriteriaRepository;
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

    /**
     * Chặn lượt mà model gọi tool NHƯNG không truyền ô nào.
     *
     * <p>Đo được ở cả hai đường (gọi thường lẫn luồng): model gọi {@code suggest_kpi_form} với tham
     * số rỗng, và vì tham số là một record nên Spring AI truyền thẳng {@code null} vào — tool ném
     * {@code NullPointerException}. Model nhận về nguyên văn thông báo NPE của Java, thứ nó không
     * hiểu và không sửa được: đường gọi thường tình cờ gọi lại lần hai rồi mới trúng, còn đường
     * luồng thì bỏ cuộc và người dùng chẳng thấy đề xuất nào.
     *
     * <p>Ném {@code IllegalArgumentException} để đi đúng đường "lỗi sửa được" như các phép kiểm ô:
     * model đọc được, gọi lại cho đúng, và log không dính stack trace.
     *
     * <p><b>Gốc rễ đã chữa ở chỗ khác, đây là lưới chắn.</b> Sáu record điền form ban đầu để MỌI ô
     * là tuỳ chọn, nên {@code {}} là lời gọi HỢP LỆ theo schema và model gọi rỗng để dò — đo được
     * 11 lời gọi rỗng trên 4 lượt. Các tool đọc không dính vì đều có một ô bắt buộc
     * ({@code get_people.view}). Nay mỗi form cũng có một ô bắt buộc là câu giải thích, nên lời gọi
     * rỗng không còn hợp lệ. Giữ lưới này lại vì mô hình vẫn có thể gửi tham số sai hình dạng.
     */
    public void requireArgs(Object request, String toolName, Class<?> shape) {
        if (request != null) return;
        // Kèm ĐÚNG tên các tham số tool nhận. Không có phần này, model thử lại bằng cách đoán và đo
        // được là nó lặp lại lời gọi rỗng 5-6 lần rồi mới trúng — mỗi lần là một vòng gọi model.
        // Tên lấy từ chính record khai báo tham số nên không thể lệch với mã.
        String fields = shape.getRecordComponents() == null ? ""
                : Arrays.stream(shape.getRecordComponents())
                        .map(RecordComponent::getName)
                        .collect(Collectors.joining(", "));
        // `request` null nghĩa là JSON lời gọi KHÔNG có khoá "request" — đo được: model đặt các ô
        // phẳng ở ngoài ({"actualValue":15,...}) thay vì lồng vào trong. Nêu tên tham số thôi thì
        // nó thử lại y hệt 4-8 vòng rồi bỏ cuộc, nên phải chỉ thẳng HÌNH DẠNG đúng.
        String example = shape.getRecordComponents() == null || shape.getRecordComponents().length == 0
                ? "{\"request\": {...}}"
                : "{\"request\": {\"" + shape.getRecordComponents()[0].getName()
                        + "\": ..., \"reason\": \"...\"}}";
        throw new IllegalArgumentException("Bạn gọi " + toolName
                + " mà không truyền ô nào nên chưa đề xuất được gì. "
                + "Hãy gọi lại và đặt MỌI ô vào TRONG object `request`, đừng để phẳng ở ngoài. "
                + "Đúng dạng: " + example + ". "
                + "Các ô nhận được: " + fields + ".");
    }

    /** Giá trị các ô đang có trên form; rỗng nếu client không gửi. */
    @SuppressWarnings("unchecked")
    public Map<String, Object> currentValues(ToolContext context) {
        return (Map<String, Object>) context.getContext().getOrDefault("openFormValues", Map.of());
    }

    /**
     * Loại của một chỉ tiêu ({@code QUANTITATIVE} / {@code QUALITATIVE}), hoặc {@code null} khi
     * chưa chọn chỉ tiêu nào hoặc id không tra được.
     *
     * <p>Phải đọc thẳng từ kho chứ không lấy từ {@code ToolSupport.kpiMatchPool}: bản chiếu của
     * {@code searchKpis} không có cột {@code kpiType}. Cũng không lấy từ {@code openFormValues} —
     * client chỉ gửi id, và đây là lớp cố ý KHÔNG tin client.
     */
    public KpiType kpiTypeOf(Object kpiCriteriaId) {
        if (kpiCriteriaId == null || String.valueOf(kpiCriteriaId).isBlank()) return null;
        try {
            return kpiCriteriaRepository.findById(UUID.fromString(String.valueOf(kpiCriteriaId)))
                    .map(KpiCriteria::getKpiType)
                    .orElse(null);
        } catch (IllegalArgumentException e) {
            return null; // không phải UUID -> coi như chưa biết, để lời gọi đi tiếp như trước
        }
    }

    /**
     * Giữ lại các ô THẬT SỰ có trên màn hình người dùng; ô còn lại rơi vào {@code hidden}.
     *
     * <p>Bản khai báo ở {@code FormRegistry} là TĨNH, còn form vẽ ô theo điều kiện chạy: KPI định
     * lượng không có ô Mức định tính, lượt sửa khoá ô Chỉ tiêu, modal xem lại khoá sạch. Đo được ca
     * thật: trợ lý đề xuất "Mức định tính: KHÁ" cho một KPI định lượng rồi báo "đã điền vào form",
     * trong khi ô ấy không hề được vẽ ra — người dùng không có chỗ nào để nhìn thấy hay xoá đi.
     *
     * <p>Danh sách do client gửi, nhưng tin được vì nó chỉ THU HẸP: đây là phép giao với những ô
     * {@code FormRegistry} vốn đã cho phép, nên client bị sửa cùng lắm tự bó tay mình.
     *
     * <p>Client cũ không gửi khoá này thì giữ nguyên hành vi trước đây — thà cũ còn hơn chặn sạch
     * mọi đề xuất trong lúc triển khai dở.
     */
    @SuppressWarnings("unchecked")
    private List<FormPatch.Entry> keepFillable(ToolContext context, List<FormPatch.Entry> entries,
                                               List<String> hidden) {
        Object raw = context.getContext().get("openFormFields");
        if (!(raw instanceof Collection<?> allowed)) return entries;

        List<FormPatch.Entry> kept = new ArrayList<>();
        for (FormPatch.Entry e : entries) {
            if (allowed.contains(e.field())) kept.add(e);
            else hidden.add(e.label());
        }
        return kept;
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
    public String finish(ToolContext context, String formId, String toolName,
                         List<FormPatch.Entry> entries, String suffix) {
        if (entries.isEmpty()) {
            return "Không có ô nào thay đổi so với form hiện tại. Hãy trả lời người dùng bằng lời.";
        }

        // Lọc ô KHÔNG có trên màn hình. Đặt ở đây vì mọi tool điền form đều đi qua finish() và nó
        // đã sẵn ToolContext — chặn một chỗ là chặn cả sáu form, không phải sửa sáu chữ ký.
        int before = entries.size();
        List<String> hidden = new ArrayList<>();
        entries = keepFillable(context, entries, hidden);
        if (entries.isEmpty()) {
            // Nói rõ vì sao rỗng: câu "không có ô nào thay đổi" ở trên sẽ khiến model tưởng nó đã
            // đề xuất trùng giá trị cũ, rồi thử lại y hệt.
            return "Các ô bạn đề xuất (" + hidden + ") KHÔNG có trên màn hình của người dùng với "
                    + "cấu hình hiện tại, nên không đề xuất được. Hãy nói cho họ biết form này không "
                    + "có những ô đó, ĐỪNG thử lại.";
        }
        if (before != entries.size()) {
            log.info("Bỏ {} ô không hiện trên màn hình khi điền {}: {}", before - entries.size(), formId, hidden);
        }
        // Ghi thẳng vào trạng thái của lượt. Trước đây phải qua ThreadLocal vì Spring AI sở hữu
        // vòng lặp và không trả kết quả tool cho ta; nay trạng thái đi cùng ToolContext nên đúng ở
        // mọi luồng — và không còn gì phải dọn.
        AgentState state = AgentState.from(context);
        if (state != null) {
            state.setFormPatch(new FormPatch(formId, entries));
            state.recordSuccess(toolName);
        }
        log.info("AI-TOOL-CALL {} ({} ô)", toolName, entries.size());
        // Cùng chỗ với ToolSupport.respond: báo tiến độ ở đúng nơi đang ghi AI-TOOL-CALL.
        ToolProgress.announce(context, toolName);

        return "Đã chuẩn bị đề xuất cho " + entries.size() + " ô: "
                + entries.stream().map(FormPatch.Entry::label).toList()
                + ". " + (suffix == null ? "" : suffix)
                + " Hãy nói ngắn gọn cho người dùng biết bạn đề xuất gì và vì sao; "
                + "KHÔNG liệt kê lại từng ô vì giao diện đã hiện bản xem trước.";
    }

    /** Dưới mức này coi như lý do không bắt nguồn từ lời người dùng. */
    private static final int MIN_GROUNDED_PCT = 60;

    /**
     * Chốt chặn ô văn xuôi bị model VIẾT HỘ: nội dung phải bắt nguồn từ lời người dùng vừa gõ.
     *
     * <p><b>Vì sao phải chặn bằng code.</b> Mô tả tool xin điều chỉnh đã dặn thẳng "đừng tự bịa lý
     * do", và nó THUA 3/3 lần đo: người dùng nói {@code "lý do: bận"} — 3 ký tự, dưới mức tối thiểu
     * 10 — model bèn tự viết dài ra cho qua validator ("Do công việc hiện tại bận, không thể tập
     * trung", "Do công việc bận, cần giảm mục tiêu KPI"...). Đó là đặt chữ vào miệng người dùng
     * trên một tờ đơn gửi lên quản lý, nặng hơn hẳn việc điền sai một con số.
     *
     * <p>Luật: mọi từ có nghĩa trong nội dung đề xuất phải có mặt trong chính câu người dùng vừa
     * gõ. Trợ lý được TRÍCH và RÚT GỌN lời họ, không được SÁNG TÁC. Ngưỡng
     * {@value #MIN_GROUNDED_PCT}% chừa chỗ cho vài từ nối model thêm vào.
     *
     * <p>Đọc được câu hỏi gốc là nhờ {@code AgentState} mang theo {@code AiTurn}; trước bản refactor
     * đó tool không có đường nào chạm tới lời người dùng nên chốt chặn này không viết được.
     *
     * <p><b>Không so được thì KHÔNG chặn</b> — vắng ngữ cảnh (test dựng {@code ToolContext} trần)
     * mà chặn thì biến một phép an toàn thành lỗi giả.
     */
    public void guardGroundedText(String proposed, String fieldLabel, ToolContext context) {
        if (proposed == null || proposed.isBlank()) return;

        AgentState state = AgentState.from(context);
        String question = (state == null || state.getTurn() == null)
                ? null : state.getTurn().getQuestion();
        if (question == null || question.isBlank()) return;

        String haystack = FormSpec.Field.normalize(question).replaceAll("[^a-z0-9 ]", " ");
        String[] words = FormSpec.Field.normalize(proposed).replaceAll("[^a-z0-9 ]", " ").split(" +");

        int counted = 0;
        int grounded = 0;
        for (String w : words) {
            if (w.length() < 2) continue;      // từ một ký tự là nhiễu, không mang nghĩa
            counted++;
            if (haystack.contains(w)) grounded++;
        }
        if (counted == 0) return;

        if (grounded * 100 / counted < MIN_GROUNDED_PCT) {
            throw new IllegalArgumentException(
                    "Ô '" + fieldLabel + "' phải dùng ĐÚNG lời người dùng vừa nêu, không được viết hộ. "
                            + "Nội dung bạn đưa ra hầu hết không có trong câu của họ. "
                            + "Nếu điều họ nêu quá ngắn so với mức tối thiểu thì BỎ TRỐNG ô này và bảo "
                            + "họ tự viết đầy đủ hơn — đừng viết thay.");
        }
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
