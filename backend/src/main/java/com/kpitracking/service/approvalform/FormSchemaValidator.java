package com.kpitracking.service.approvalform;

import com.kpitracking.entity.form.FormOption;
import com.kpitracking.entity.form.FormSchema;
import com.kpitracking.entity.form.FormWidget;
import com.kpitracking.entity.form.VisibilityRule;
import com.kpitracking.enums.WidgetType;
import com.kpitracking.service.approvalprocess.ConditionOperator;
import com.kpitracking.service.approvalprocess.FormFieldIndex;

import java.math.BigDecimal;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Kiểm form của đơn trước khi lưu — thuần logic, cùng bộ luật với {@code model/formIssues.ts} phía giao diện
 * (giao diện báo ngay và nhảy tới đúng ô; đây là bản có hiệu lực). Mỗi vấn đề mang key dịch
 * {@code approvalForm.schema.*}, id widget và tên thiết lập ({@code title}, {@code options}…) để giao diện focus.
 */
public final class FormSchemaValidator {

    public static final int MAX_WIDGETS = 100;
    public static final int MAX_COLUMNS = 20;
    public static final int MAX_OPTIONS = 100;
    public static final int MAX_TITLE = 100;
    public static final int MAX_PLACEHOLDER = 200;
    public static final int MAX_CONTENT = 2000;
    public static final int MAX_DECIMALS = 4;
    public static final int MAX_FILES = 9;
    public static final int MAX_TEXT_LENGTH = 10_000;
    private static final Pattern ID = Pattern.compile("[A-Za-z0-9_-]{1,40}");
    private static final Set<String> DISPLAYS = Set.of("DROPDOWN", "LIST");
    private static final Set<String> DATE_FORMATS = Set.of("DATE", "DATETIME");
    private static final Set<String> DURATION_UNITS = Set.of("DAY", "HOUR");

    private FormSchemaValidator() {}

    public record Issue(String widgetId, String setting, String key, List<Object> args) {
        static Issue of(String widgetId, String setting, String key, Object... args) {
            return new Issue(widgetId, setting, "approvalForm.schema." + key, List.of(args));
        }
    }

    public static List<Issue> validate(FormSchema schema) {
        List<Issue> issues = new ArrayList<>();
        List<FormWidget> widgets = schema == null ? List.of() : schema.widgetsOrEmpty();
        long total = widgets.stream().mapToLong(w -> 1 + (w == null ? 0 : w.childrenOrEmpty().size())).sum();
        if (total > MAX_WIDGETS) {
            issues.add(Issue.of(null, null, "tooMany", MAX_WIDGETS));
            return issues;
        }
        if (widgets.stream().noneMatch(w -> w != null && w.type() != null && w.type().input())) {
            issues.add(Issue.of(null, null, "noInput"));
        }

        Set<String> ids = new HashSet<>();
        Set<String> titles = new HashSet<>();
        Map<String, FormWidget> earlier = new LinkedHashMap<>();
        for (FormWidget w : widgets) {
            if (!checkIdentity(w, ids, issues)) continue;
            checkCommon(w, titles, issues);
            switch (w.type()) {
                case FORMULA -> checkFormula(w, earlier, issues);
                case TABLE -> checkTable(w, ids, titles, issues);
                default -> { }
            }
            checkVisibility(w, earlier, issues);
            earlier.put(w.id(), w);
        }
        return issues;
    }

    /** Widget mà điều kiện duyệt dùng được: số / chọn ở cấp ngoài cùng (không gồm cột bảng). */
    public static FormFieldIndex index(FormSchema schema) {
        Set<String> numbers = new HashSet<>();
        Map<String, Set<String>> options = new HashMap<>();
        for (FormWidget w : schema == null ? List.<FormWidget>of() : schema.widgetsOrEmpty()) {
            if (w == null || w.type() == null || w.id() == null) continue;
            if (w.type().numeric()) numbers.add(w.id());
            if (w.type().choice()) options.put(w.id(), optionIds(w));
        }
        return new FormFieldIndex(numbers, options);
    }

    // ── Từng phần ───────────────────────────────────────────────────────────

    private static boolean checkIdentity(FormWidget w, Set<String> ids, List<Issue> issues) {
        if (w == null || w.type() == null || w.id() == null || !ID.matcher(w.id()).matches() || !ids.add(w.id())) {
            issues.add(Issue.of(w == null ? null : w.id(), null, "badWidget"));
            return false;
        }
        return true;
    }

    private static void checkCommon(FormWidget w, Set<String> titles, List<Issue> issues) {
        String id = w.id();
        if (w.type() == WidgetType.DESCRIPTION) {
            if (blank(w.content())) issues.add(Issue.of(id, "content", "contentRequired"));
            else if (w.content().length() > MAX_CONTENT) issues.add(Issue.of(id, "content", "contentTooLong", MAX_CONTENT));
        }
        if (blank(w.title())) {
            issues.add(Issue.of(id, "title", "titleRequired"));
        } else if (w.title().strip().length() > MAX_TITLE) {
            issues.add(Issue.of(id, "title", "titleTooLong", MAX_TITLE));
        } else if (!titles.add(w.title().strip().toLowerCase(Locale.ROOT))) {
            issues.add(Issue.of(id, "title", "titleDuplicate"));
        }
        if (w.placeholder() != null && w.placeholder().length() > MAX_PLACEHOLDER) {
            issues.add(Issue.of(id, "placeholder", "placeholderTooLong", MAX_PLACEHOLDER));
        }
        if (w.maxLength() != null && (w.maxLength() < 1 || w.maxLength() > MAX_TEXT_LENGTH)) {
            issues.add(Issue.of(id, "maxLength", "badMaxLength", MAX_TEXT_LENGTH));
        }
        if (w.decimals() != null && (w.decimals() < 0 || w.decimals() > MAX_DECIMALS)) {
            issues.add(Issue.of(id, "decimals", "badDecimals", MAX_DECIMALS));
        }
        if (w.min() != null && w.max() != null && w.min() > w.max()) {
            issues.add(Issue.of(id, "min", "minAboveMax"));
        }
        if (w.type().choice()) checkOptions(w, issues);
        if (w.display() != null && !DISPLAYS.contains(w.display())) issues.add(Issue.of(id, "display", "badSetting"));
        if (w.dateFormat() != null && !DATE_FORMATS.contains(w.dateFormat())) {
            issues.add(Issue.of(id, "dateFormat", "badSetting"));
        }
        if (w.durationUnit() != null && !DURATION_UNITS.contains(w.durationUnit())) {
            issues.add(Issue.of(id, "durationUnit", "badSetting"));
        }
        if (w.type().files() && w.maxCount() != null && (w.maxCount() < 1 || w.maxCount() > MAX_FILES)) {
            issues.add(Issue.of(id, "maxCount", "badMaxCount", MAX_FILES));
        }
    }

    private static void checkOptions(FormWidget w, List<Issue> issues) {
        List<FormOption> options = w.optionsOrEmpty();
        if (options.isEmpty()) {
            issues.add(Issue.of(w.id(), "options", "optionsRequired"));
            return;
        }
        if (options.size() > MAX_OPTIONS) issues.add(Issue.of(w.id(), "options", "tooManyOptions", MAX_OPTIONS));
        Set<String> ids = new HashSet<>();
        Set<String> labels = new HashSet<>();
        for (FormOption o : options) {
            if (o == null || blank(o.id()) || !ids.add(o.id()) || blank(o.label())) {
                issues.add(Issue.of(w.id(), "options", "optionEmpty"));
                return;
            }
            if (!labels.add(o.label().strip().toLowerCase(Locale.ROOT))) {
                issues.add(Issue.of(w.id(), "options", "optionDuplicate", o.label().strip()));
                return;
            }
        }
        Object def = w.defaultValue();
        if (def == null) return;
        Collection<?> chosen = def instanceof Collection<?> c ? c : List.of(def);
        if ((w.type() == WidgetType.RADIO && chosen.size() > 1) || !chosen.stream().allMatch(v -> ids.contains(String.valueOf(v)))) {
            issues.add(Issue.of(w.id(), "defaultValue", "badDefault"));
        }
    }

    private static void checkFormula(FormWidget w, Map<String, FormWidget> earlier, List<Issue> issues) {
        Formula formula;
        try {
            formula = Formula.parse(w.expression());
        } catch (Formula.FormulaException e) {
            issues.add(Issue.of(w.id(), "expression", "formulaInvalid"));
            return;
        }
        for (Formula.Ref ref : formula.refs()) {
            FormWidget target = earlier.get(ref.widget());
            boolean ok;
            if (ref.sum()) {
                ok = target != null && target.type() == WidgetType.TABLE && target.childrenOrEmpty().stream()
                        .anyMatch(c -> c != null && ref.column().equals(c.id())
                                && (c.type() == WidgetType.NUMBER || c.type() == WidgetType.AMOUNT));
            } else {
                ok = target != null && target.type().numeric();
            }
            if (!ok) {
                issues.add(Issue.of(w.id(), "expression", "formulaBadRef"));
                return;
            }
        }
    }

    private static void checkTable(FormWidget w, Set<String> ids, Set<String> titles, List<Issue> issues) {
        List<FormWidget> columns = w.childrenOrEmpty();
        if (columns.isEmpty()) {
            issues.add(Issue.of(w.id(), "children", "tableNoColumns"));
            return;
        }
        if (columns.size() > MAX_COLUMNS) issues.add(Issue.of(w.id(), "children", "tooManyColumns", MAX_COLUMNS));
        for (FormWidget c : columns) {
            if (!checkIdentity(c, ids, issues)) continue;
            if (!WidgetType.TABLE_CHILDREN.contains(c.type())) {
                issues.add(Issue.of(c.id(), null, "tableBadColumn"));
                continue;
            }
            checkCommon(c, titles, issues);
        }
    }

    /** Điều kiện hiện chỉ trỏ widget chọn / số đứng TRƯỚC, đúng toán tử, đủ giá trị. */
    private static void checkVisibility(FormWidget w, Map<String, FormWidget> earlier, List<Issue> issues) {
        for (VisibilityRule r : w.visibilityOrEmpty()) {
            FormWidget source = r == null ? null : earlier.get(r.widget());
            if (source == null || r.operator() == null || !validRule(r, source)) {
                issues.add(Issue.of(w.id(), "visibility", "visibilityInvalid"));
                return;
            }
        }
    }

    private static boolean validRule(VisibilityRule r, FormWidget source) {
        List<String> values = r.valuesOrEmpty().stream().filter(v -> !blank(v)).toList();
        if (values.isEmpty()) return false;
        if (source.type().choice()) {
            return (r.operator() == ConditionOperator.IN || r.operator() == ConditionOperator.NOT_IN)
                    && optionIds(source).containsAll(values);
        }
        if (source.type().numeric()) {
            return Visibility.NUMBER_OPS.contains(r.operator()) && values.size() == 1 && parse(values.get(0)) != null;
        }
        return false;
    }

    static Set<String> optionIds(FormWidget w) {
        Set<String> out = new LinkedHashSet<>();
        for (FormOption o : w.optionsOrEmpty()) if (o != null && o.id() != null) out.add(o.id());
        return out;
    }

    static BigDecimal parse(String raw) {
        try {
            return raw == null ? null : new BigDecimal(raw.strip());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
