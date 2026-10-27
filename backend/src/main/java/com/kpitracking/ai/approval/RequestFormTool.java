package com.kpitracking.ai.approval;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.kpitracking.ai.core.ToolProgress;
import com.kpitracking.ai.core.agent.AgentState;
import com.kpitracking.ai.core.tool.ToolSupport;
import com.kpitracking.dto.approvalform.ApprovalFormDtos.Catalog;
import com.kpitracking.dto.approvalform.ApprovalFormDtos.CatalogForm;
import com.kpitracking.dto.approvalform.ApprovalFormDtos.CatalogGroup;
import com.kpitracking.dto.approvalform.ApprovalFormDtos.SubmitView;
import com.kpitracking.dto.response.ai.RequestDraftResponse;
import com.kpitracking.entity.form.FormOption;
import com.kpitracking.entity.form.FormWidget;
import com.kpitracking.enums.WidgetType;
import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.service.approvalform.ApprovalFormLibrary;
import com.kpitracking.service.approvalform.ApprovalRequestService;
import com.kpitracking.service.approvalform.Visibility;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.invocation.InvocationParameters;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * K.AI TẠO ĐƠN HỘ (Đơn từ): tìm mẫu đơn người dùng được nộp, rồi điền sẵn một bản NHÁP. Không bao giờ nộp — bản nháp
 * đi lên giao diện thành thẻ "Mở đơn để nộp", người dùng xem lại trong hộp nộp đơn và tự bấm Nộp (lúc đó máy chủ kiểm
 * chặt như mọi đơn).
 *
 * <p>Model nói bằng CHỮ (tên ô, nhãn phương án, tên người / đơn vị, ngày ISO); tool quy về đúng dạng hộp nộp đơn nhận
 * (id phương án, {@code [{id}]}, {@code {start,end}}) rồi để {@link ApprovalRequestService#draft} chuẩn hoá — giá trị
 * sai bị BỎ chứ không làm hỏng bản nháp, và tool báo lại cho model biết ô nào không nhận.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RequestFormTool {

    private final ApprovalRequestService requestService;
    private final ToolSupport support;

    public record ListRequest(@JsonProperty(required = false) String formName) {}

    /**
     * @param form   id hoặc TÊN mẫu đơn (lấy từ list_request_forms)
     * @param fields từng ô: {@code field} = id hoặc tên ô, {@code value} = giá trị dạng chữ
     */
    public record DraftRequest(String form, List<FieldValue> fields) {}

    public record FieldValue(String field, String value) {}

    @Tool(name = "list_request_forms", value = "ĐƠN TỪ — các mẫu đơn người dùng được nộp (nghỉ phép, tăng ca, công tác, "
            + "thanh toán, tạm ứng, mua hàng, thôi việc...). Không truyền formName: danh sách mẫu. Có formName: các ô của "
            + "mẫu đó (id, tên, loại, bắt buộc, phương án). Gọi TRƯỚC draft_request.")
    public String listRequestForms(ListRequest request, InvocationParameters context) {
        try {
            String lang = language();
            Catalog catalog = requestService.catalog();
            if (request == null || !ToolSupport.notBlank(request.formName())) {
                List<Map<String, Object>> forms = new ArrayList<>();
                for (CatalogGroup g : catalog.groups()) {
                    for (CatalogForm f : g.forms()) {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("formId", f.id());
                        m.put("name", ApprovalFormLibrary.pick(f.name(), lang));
                        m.put("group", ApprovalFormLibrary.pick(g.name(), lang));
                        String desc = ApprovalFormLibrary.pick(f.description(), lang);
                        if (ToolSupport.notBlank(desc)) m.put("description", desc);
                        forms.add(m);
                    }
                }
                return support.respond(context, "list_request_forms", Map.of("forms", forms,
                        "message", forms.isEmpty() ? "Người dùng chưa được nộp mẫu đơn nào."
                                : "Bước kế: gọi lại list_request_forms với formName của mẫu khớp yêu cầu để lấy các ô, rồi "
                                + "draft_request. Tên ô lấy từ kết quả đó — không hỏi người dùng tên ô."));
            }
            UUID formId = findForm(catalog, request.formName(), lang);
            if (formId == null) {
                return support.respond(context, "list_request_forms", Map.of("message",
                        "Không có mẫu đơn nào khớp '" + request.formName().strip() + "' mà người dùng được nộp. "
                                + "Gọi lại không kèm formName để xem danh sách."));
            }
            SubmitView view = requestService.submitView(formId);
            List<Map<String, Object>> fields = new ArrayList<>();
            for (FormWidget w : view.schema().widgetsOrEmpty()) {
                if (w == null || w.type() == null || !w.type().input()) continue;
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", w.id());
                m.put("name", w.title());
                m.put("type", w.type().name());
                m.put("format", formatHint(w));
                if (w.isRequired()) m.put("required", true);
                if (w.type().choice()) m.put("options", w.options() == null ? List.of()
                        : w.options().stream().map(FormOption::label).toList());
                fields.add(m);
            }
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("formId", view.id());
            out.put("name", ApprovalFormLibrary.pick(view.name(), lang));
            out.put("fields", fields);
            return support.respond(context, "list_request_forms", out);
        } catch (Exception e) {
            return support.toolError("list_request_forms", e);
        }
    }

    @Tool(name = "draft_request", value = "ĐƠN TỪ — điền sẵn một bản NHÁP đơn cho người dùng (KHÔNG nộp). form = id hoặc tên "
            + "mẫu; fields = từng ô {field: id hoặc tên ô, value: chữ}. Ngày dạng yyyy-MM-dd (có giờ: yyyy-MM-ddTHH:mm); "
            + "khoảng ngày 'bắt đầu/kết thúc'; chọn nhiều cách nhau dấu phẩy; người / phòng ban ghi TÊN. Chỉ điền ô người "
            + "dùng đã nói; tệp đính kèm người dùng tự thêm. Sau khi gọi, nói người dùng bấm 'Mở đơn để nộp' để xem lại và nộp.")
    public String draftRequest(DraftRequest request, InvocationParameters context) {
        try {
            String lang = language();
            if (request == null || !ToolSupport.notBlank(request.form())) {
                throw new IllegalArgumentException("Thiếu mẫu đơn (form). Gọi list_request_forms trước.");
            }
            UUID formId = parseId(request.form());
            if (formId == null) formId = findForm(requestService.catalog(), request.form(), lang);
            if (formId == null) {
                return support.respond(context, "draft_request", Map.of("message",
                        "Không có mẫu đơn '" + request.form().strip() + "' mà người dùng được nộp. Gọi list_request_forms."));
            }
            SubmitView view = requestService.submitView(formId);
            UUID orgId = support.getOrgId(context);

            Map<String, Object> raw = new LinkedHashMap<>();
            List<String> rejected = new ArrayList<>();
            for (FieldValue fv : request.fields() == null ? List.<FieldValue>of() : request.fields()) {
                if (fv == null || !ToolSupport.notBlank(fv.field()) || !ToolSupport.notBlank(fv.value())) continue;
                FormWidget w = findWidget(view.schema().widgetsOrEmpty(), fv.field());
                if (w == null || !w.type().input()) {
                    rejected.add(fv.field() + " (không có ô này)");
                    continue;
                }
                if (w.type().files() || w.type() == WidgetType.TABLE) {
                    rejected.add(w.title() + " (người dùng tự điền trong hộp đơn)");
                    continue;
                }
                Object v = toRaw(w, fv.value().strip(), orgId);
                if (v == null) rejected.add(w.title() + " ('" + fv.value().strip() + "' không hợp lệ)");
                else raw.put(w.id(), v);
            }

            ApprovalRequestService.Draft draft = requestService.draft(formId, raw);
            for (String id : raw.keySet()) {
                if (!draft.values().containsKey(id)) {
                    FormWidget w = findWidget(view.schema().widgetsOrEmpty(), id);
                    rejected.add((w == null ? id : w.title()) + " (giá trị không hợp lệ)");
                }
            }
            RequestDraftResponse result = toResponse(draft, lang);
            if (result.entries().isEmpty()) {
                // Thường do model đoán tên ô: trả kèm các ô thật để nó tự gọi lại, thay vì đi hỏi người dùng tên ô.
                Map<String, Object> out = new LinkedHashMap<>();
                out.put("message", "Chưa điền được ô nào" + (rejected.isEmpty() ? "" : ": " + rejected)
                        + ". Gọi lại draft_request với field là id hoặc tên ô trong availableFields.");
                out.put("availableFields", view.schema().widgetsOrEmpty().stream()
                        .filter(w -> w != null && w.type() != null && w.type().input() && !w.type().files()
                                && w.type() != WidgetType.TABLE)
                        .map(w -> Map.of("id", w.id(), "name", w.title(), "format", formatHint(w))).toList());
                return support.respond(context, "draft_request", out);
            }
            AgentState state = AgentState.from(context);
            if (state != null) {
                state.setRequestDraft(result);
                state.recordSuccess("draft_request");
            }
            log.info("AI-TOOL-CALL draft_request ({} ô, mẫu {})", result.entries().size(), formId);
            ToolProgress.announce(context, "draft_request");

            Map<String, Object> out = new LinkedHashMap<>();
            out.put("form", result.formName());
            out.put("filled", result.entries().stream().map(e -> e.label() + ": " + e.display()).toList());
            if (!result.missing().isEmpty()) out.put("stillRequired", result.missing());
            if (!rejected.isEmpty()) out.put("notFilled", rejected);
            out.put("message", "Đã có bản nháp — CHƯA nộp. Nói người dùng bấm 'Mở đơn để nộp' để xem lại, bổ sung "
                    + "ô còn thiếu rồi tự bấm Nộp.");
            return support.respond(context, "draft_request", out);
        } catch (Exception e) {
            return support.toolError("draft_request", e);
        }
    }

    // ── quy chữ của model về dạng hộp nộp đơn nhận ─────────────────────────────

    /** Giá trị thô cho một ô, hoặc {@code null} khi không hiểu được. */
    Object toRaw(FormWidget w, String value, UUID orgId) {
        return switch (w.type()) {
            case RADIO -> optionId(w, value);
            case CHECKBOX -> {
                List<String> ids = new ArrayList<>();
                for (String part : value.split("[,;]")) {
                    String id = optionId(w, part.strip());
                    if (id == null) yield null;
                    if (!ids.contains(id)) ids.add(id);
                }
                yield ids.isEmpty() ? null : ids;
            }
            case DATE_RANGE -> {
                String[] parts = value.split("\\s*(/|\\.\\.|→| đến | to )\\s*");
                if (parts.length != 2) yield null;
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("start", parts[0].strip());
                m.put("end", parts[1].strip());
                yield m;
            }
            case CONTACT -> refs(value, orgId, true, w.isMultiple());
            case DEPARTMENT -> refs(value, orgId, false, w.isMultiple());
            default -> value;   // chữ, số, ngày, điện thoại: FormValues tự kiểm
        };
    }

    private List<Map<String, Object>> refs(String value, UUID orgId, boolean users, boolean multiple) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (String name : value.split("[,;]")) {
            String n = name.strip();
            if (n.isEmpty()) continue;
            List<Map<String, Object>> pool = users ? support.userMatchPool(n, orgId) : support.unitMatchPool(n, orgId);
            if (pool.size() != 1) return null;   // không thấy hoặc trùng tên: để người dùng tự chọn trong hộp
            out.add(Map.of("id", String.valueOf(pool.get(0).get("id"))));
        }
        if (out.isEmpty() || (!multiple && out.size() > 1)) return null;
        return out;
    }

    private static String optionId(FormWidget w, String value) {
        if (w.options() == null) return null;
        String key = fold(value);
        for (FormOption o : w.options()) {
            if (o.id().equals(value) || fold(o.label()).equals(key)) return o.id();
        }
        return null;
    }

    private static String formatHint(FormWidget w) {
        return switch (w.type()) {
            case DATE -> FormWidget.DATETIME.equals(w.dateFormat()) ? "yyyy-MM-ddTHH:mm" : "yyyy-MM-dd";
            case DATE_RANGE -> FormWidget.DATETIME.equals(w.dateFormat())
                    ? "yyyy-MM-ddTHH:mm/yyyy-MM-ddTHH:mm" : "yyyy-MM-dd/yyyy-MM-dd";
            case NUMBER, AMOUNT -> "số" + (w.currency() != null ? " (" + w.currency() + ")" : w.unit() != null ? " (" + w.unit() + ")" : "");
            case RADIO -> "một phương án";
            case CHECKBOX -> "các phương án, cách nhau dấu phẩy";
            case CONTACT -> w.isMultiple() ? "tên người, cách nhau dấu phẩy" : "tên một người";
            case DEPARTMENT -> w.isMultiple() ? "tên phòng ban, cách nhau dấu phẩy" : "tên một phòng ban";
            case IMAGE, ATTACHMENT, TABLE -> "người dùng tự điền trong hộp đơn";
            default -> "chữ";
        };
    }

    // ── dựng thẻ nháp ─────────────────────────────────────────────────────────

    RequestDraftResponse toResponse(ApprovalRequestService.Draft draft, String lang) {
        Map<String, Double> numbers = new LinkedHashMap<>();
        Map<String, List<String>> options = new LinkedHashMap<>();
        List<RequestDraftResponse.Entry> entries = new ArrayList<>();
        List<FormWidget> widgets = draft.schema().widgetsOrEmpty();
        for (FormWidget w : widgets) {
            Object v = draft.values().get(w.id());
            if (v == null) continue;
            if (v instanceof BigDecimal n) numbers.put(w.id(), n.doubleValue());
            if (w.type() == WidgetType.RADIO) options.put(w.id(), List.of(String.valueOf(v)));
            if (w.type() == WidgetType.CHECKBOX && v instanceof List<?> l) options.put(w.id(), l.stream().map(String::valueOf).toList());
            if (w.type() == WidgetType.DATE_RANGE && v instanceof Map<?, ?> m && m.get("duration") instanceof BigDecimal d) {
                numbers.put(w.id(), d.doubleValue());
            }
            if (w.type() == WidgetType.FORMULA) continue;   // máy tự tính, không phải K.AI điền
            entries.add(new RequestDraftResponse.Entry(w.id(), w.title(), display(w, v, lang)));
        }
        List<String> missing = new ArrayList<>();
        for (FormWidget w : widgets) {
            if (w == null || w.type() == null || !w.type().input() || !w.isRequired()) continue;
            if (draft.values().containsKey(w.id())) continue;
            if (!Visibility.visible(w, numbers, options)) continue;
            missing.add(w.title());
        }
        return new RequestDraftResponse(draft.formId(), ApprovalFormLibrary.pick(draft.name(), lang),
                draft.values(), entries, missing);
    }

    private static String display(FormWidget w, Object v, String lang) {
        return switch (w.type()) {
            case DATE -> date(String.valueOf(v), lang);
            case RADIO -> label(w, String.valueOf(v));
            case CHECKBOX -> v instanceof List<?> l ? String.join(", ", l.stream().map(x -> label(w, String.valueOf(x))).toList()) : "";
            case CONTACT, DEPARTMENT -> v instanceof List<?> l
                    ? String.join(", ", l.stream().map(x -> x instanceof Map<?, ?> m ? String.valueOf(m.get("name")) : "").toList()) : "";
            case DATE_RANGE -> v instanceof Map<?, ?> m ? date(String.valueOf(m.get("start")), lang) + " → " + date(String.valueOf(m.get("end")), lang)
                    + (m.get("duration") instanceof BigDecimal d ? " (" + d.stripTrailingZeros().toPlainString()
                    + (FormWidget.HOUR.equals(w.durationUnit()) ? " giờ)" : " ngày)") : "") : "";
            case NUMBER, AMOUNT -> ((BigDecimal) v).stripTrailingZeros().toPlainString()
                    + (w.currency() != null ? " " + w.currency() : w.unit() != null ? " " + w.unit() : "");
            default -> String.valueOf(v);
        };
    }

    /** Ngày ISO (có thể kèm giờ) -> chữ người đọc: tiếng Việt dd/MM/yyyy [HH:mm], còn lại giữ ISO. */
    static String date(String iso, String lang) {
        if (!"vi".equals(lang) || iso == null || iso.length() < 10) return iso;
        String d = iso.substring(8, 10) + "/" + iso.substring(5, 7) + "/" + iso.substring(0, 4);
        return iso.length() >= 16 ? d + " " + iso.substring(11, 16) : d;
    }

    private static String label(FormWidget w, String id) {
        if (w.options() != null) for (FormOption o : w.options()) if (o.id().equals(id)) return o.label();
        return id;
    }

    // ── tìm mẫu / ô theo tên ──────────────────────────────────────────────────

    /** Mẫu khớp tên (bỏ dấu, không phân biệt hoa thường): khớp hẳn trước, rồi chứa; nhiều mẫu cùng chứa = không chọn. */
    static UUID findForm(Catalog catalog, String name, String lang) {
        String key = fold(name);
        List<UUID> contains = new ArrayList<>();
        for (CatalogGroup g : catalog.groups()) {
            for (CatalogForm f : g.forms()) {
                if (f.id().toString().equalsIgnoreCase(name.strip())) return f.id();
                String n = fold(ApprovalFormLibrary.pick(f.name(), lang));
                if (n.equals(key)) return f.id();
                if (n.contains(key) || key.contains(n)) contains.add(f.id());
            }
        }
        return contains.size() == 1 ? contains.get(0) : null;
    }

    static FormWidget findWidget(List<FormWidget> widgets, String field) {
        String key = fold(field);
        for (FormWidget w : widgets) if (w != null && field.strip().equals(w.id())) return w;
        for (FormWidget w : widgets) if (w != null && w.title() != null && fold(w.title()).equals(key)) return w;
        return null;
    }

    static String fold(String s) {
        if (s == null) return "";
        String n = Normalizer.normalize(s.strip().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").replace('đ', 'd');
        return n.replaceAll("\\s+", " ");
    }

    private static UUID parseId(String s) {
        try {
            return UUID.fromString(s.strip());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static String language() {
        return ErrorMessages.currentLocale().getLanguage();
    }
}
