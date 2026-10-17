package com.kpitracking.service.approvalform;

import com.kpitracking.entity.form.FormSchema;
import com.kpitracking.entity.form.FormWidget;
import com.kpitracking.enums.WidgetType;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Kiểm và chuẩn hoá giá trị người nộp gửi lên theo form của đơn — chỗ tin cậy duy nhất. Giao diện kiểm trước để báo
 * đẹp, nhưng điều kiện duyệt đọc kết quả ở đây nên:
 * <ul>
 *   <li>Công thức và thời lượng khoảng ngày luôn tính lại, không nhận số client gửi.</li>
 *   <li>Widget bị ẩn (theo điều kiện hiện) không bắt buộc và bị bỏ giá trị; khoá lạ bị bỏ.</li>
 *   <li>Phương án / người / đơn vị phải có thật trong form / tổ chức; tệp phải nằm trong thư mục tải lên của người nộp.</li>
 * </ul>
 * Kết quả kèm {@code facts}: số và phương án đã chọn theo id widget — đầu vào của điều kiện duyệt.
 */
public final class FormValues {

    public static final int MAX_TABLE_ROWS = 200;
    private static final int DEFAULT_TEXT = 1000;
    private static final int DEFAULT_TEXTAREA = 5000;
    private static final int MAX_FILE_NAME = 255;
    private static final Pattern PHONE = Pattern.compile("\\+?[0-9 ().-]{6,20}");

    private FormValues() {}

    /** Tra người / đơn vị trong tổ chức của người nộp, và thư mục tải tệp của họ. */
    public interface Lookup {
        /** Chỉ trả người thuộc tổ chức (id → tên). */
        Map<UUID, String> users(Collection<UUID> ids);

        /** Chỉ trả đơn vị thuộc tổ chức (id → tên). */
        Map<UUID, String> units(Collection<UUID> ids);

        /** {@code publicId} của tệp hợp lệ phải bắt đầu bằng chuỗi này. */
        String uploadFolder();
    }

    public record Result(Map<String, Object> values, Map<String, Object> facts) {}

    /**
     * @param strict {@code false} (xem trước quy trình): không đòi trường bắt buộc, giá trị sai thì bỏ qua thay vì báo lỗi
     */
    public static Result normalize(FormSchema schema, Map<String, Object> raw, Lookup lookup, boolean strict) {
        Run run = new Run(lookup, strict);
        Map<String, Object> input = raw == null ? Map.of() : raw;
        Map<String, Object> values = new LinkedHashMap<>();
        for (FormWidget w : schema.widgetsOrEmpty()) {
            if (w == null || w.type() == null || w.type() == WidgetType.DESCRIPTION) continue;
            if (!Visibility.visible(w, run.numbers, run.options)) continue;
            Object v = w.type() == WidgetType.FORMULA ? run.formula(w) : run.value(w, input.get(w.id()));
            if (v != null) values.put(w.id(), v);
        }
        Map<String, Object> facts = new LinkedHashMap<>();
        run.numbers.forEach(facts::put);
        run.options.forEach(facts::put);
        return new Result(values, facts);
    }

    private static final class Run {
        final Lookup lookup;
        final boolean strict;
        final Map<String, Double> numbers = new LinkedHashMap<>();
        final Map<String, List<String>> options = new LinkedHashMap<>();
        final Map<String, Double> columnSums = new HashMap<>();

        Run(Lookup lookup, boolean strict) {
            this.lookup = lookup;
            this.strict = strict;
        }

        /** Giá trị đã chuẩn hoá của một widget cấp ngoài cùng (ghi lại số / phương án cho điều kiện). */
        Object value(FormWidget w, Object raw) {
            Object v;
            try {
                v = w.type() == WidgetType.TABLE ? table(w, raw) : cell(w, raw);
            } catch (Invalid e) {
                if (strict) throw new BusinessException(ErrorCode.APPROVAL_REQUEST_FIELD_INVALID, w.title());
                v = null;
            }
            if (empty(v)) {
                if (strict && w.isRequired()) throw new BusinessException(ErrorCode.APPROVAL_REQUEST_FIELD_REQUIRED, w.title());
                return null;
            }
            record(w, v);
            return v;
        }

        private void record(FormWidget w, Object v) {
            switch (w.type()) {
                case NUMBER, AMOUNT -> numbers.put(w.id(), ((BigDecimal) v).doubleValue());
                case DATE_RANGE -> {
                    Object d = ((Map<?, ?>) v).get("duration");
                    if (d instanceof BigDecimal b) numbers.put(w.id(), b.doubleValue());
                }
                case RADIO -> options.put(w.id(), List.of((String) v));
                case CHECKBOX -> options.put(w.id(), castList(v));
                default -> { }
            }
        }

        Object formula(FormWidget w) {
            Double result;
            try {
                result = Formula.parse(w.expression()).evaluate(ref -> ref.sum()
                        ? columnSums.get(ref.widget() + "." + ref.column())
                        : numbers.get(ref.widget()));
            } catch (Formula.FormulaException e) {
                result = null;
            }
            if (result == null) return null;
            BigDecimal v = round(BigDecimal.valueOf(result), w.decimals() == null ? 2 : w.decimals());
            numbers.put(w.id(), v.doubleValue());
            return v;
        }

        /** Chi tiết/Bảng: các dòng, bỏ dòng trống; cộng sẵn cột Số / Tiền cho {@code SUM} của công thức. */
        private Object table(FormWidget w, Object raw) {
            if (raw == null) return null;
            if (!(raw instanceof List<?> rows) || rows.size() > MAX_TABLE_ROWS) throw new Invalid();
            List<Map<String, Object>> out = new ArrayList<>();
            Map<String, BigDecimal> sums = new HashMap<>();
            for (Object r : rows) {
                if (!(r instanceof Map<?, ?> row)) throw new Invalid();
                Map<String, Object> cleaned = new LinkedHashMap<>();
                for (FormWidget c : w.childrenOrEmpty()) {
                    Object v;
                    try {
                        v = cell(c, row.get(c.id()));
                    } catch (Invalid e) {
                        if (strict) throw new BusinessException(ErrorCode.APPROVAL_REQUEST_FIELD_INVALID, c.title());
                        v = null;
                    }
                    if (!empty(v)) cleaned.put(c.id(), v);
                }
                if (cleaned.isEmpty()) continue;
                for (FormWidget c : w.childrenOrEmpty()) {
                    if (strict && c.isRequired() && !cleaned.containsKey(c.id())) {
                        throw new BusinessException(ErrorCode.APPROVAL_REQUEST_FIELD_REQUIRED, c.title());
                    }
                    if (cleaned.get(c.id()) instanceof BigDecimal n) sums.merge(c.id(), n, BigDecimal::add);
                }
                out.add(cleaned);
            }
            sums.forEach((col, sum) -> columnSums.put(w.id() + "." + col, sum.doubleValue()));
            return out;
        }

        /** Một ô (widget ngoài cùng hoặc cột bảng). {@code null} = trống. */
        private Object cell(FormWidget w, Object raw) {
            if (raw == null) return null;
            return switch (w.type()) {
                case TEXT -> text(raw, w.maxLength() == null ? DEFAULT_TEXT : w.maxLength());
                case TEXTAREA -> text(raw, w.maxLength() == null ? DEFAULT_TEXTAREA : w.maxLength());
                case PHONE -> {
                    String s = text(raw, 20);
                    if (s != null && !PHONE.matcher(s).matches()) throw new Invalid();
                    yield s;
                }
                case NUMBER, AMOUNT -> number(w, raw);
                case RADIO -> {
                    String s = text(raw, 100);
                    if (s != null && !FormSchemaValidator.optionIds(w).contains(s)) throw new Invalid();
                    yield s;
                }
                case CHECKBOX -> {
                    List<String> ids = strings(raw);
                    if (!FormSchemaValidator.optionIds(w).containsAll(ids)) throw new Invalid();
                    yield ids.isEmpty() ? null : ids;
                }
                case DATE -> date(w, raw);
                case DATE_RANGE -> dateRange(w, raw);
                case IMAGE, ATTACHMENT -> files(w, raw);
                case CONTACT -> refs(w, raw, true);
                case DEPARTMENT -> refs(w, raw, false);
                default -> null;
            };
        }

        private static String text(Object raw, int max) {
            if (!(raw instanceof String s)) throw new Invalid();
            String t = s.strip();
            if (t.isEmpty()) return null;
            if (t.length() > max) throw new Invalid();
            return t;
        }

        private static BigDecimal number(FormWidget w, Object raw) {
            BigDecimal n;
            if (raw instanceof Number num) {
                double d = num.doubleValue();
                if (!Double.isFinite(d)) throw new Invalid();
                n = new BigDecimal(num.toString());
            } else if (raw instanceof String s) {
                if (s.isBlank()) return null;
                n = FormSchemaValidator.parse(s);
                if (n == null) throw new Invalid();
            } else {
                throw new Invalid();
            }
            if (n.scale() < 0) n = n.setScale(0);
            if (w.decimals() != null) n = round(n, w.decimals());
            if (w.min() != null && n.compareTo(BigDecimal.valueOf(w.min())) < 0) throw new Invalid();
            if (w.max() != null && n.compareTo(BigDecimal.valueOf(w.max())) > 0) throw new Invalid();
            return n;
        }

        private static String date(FormWidget w, Object raw) {
            String s = text(raw, 30);
            if (s == null) return null;
            try {
                return w.withTime() ? LocalDateTime.parse(s).toString() : LocalDate.parse(s).toString();
            } catch (DateTimeParseException e) {
                throw new Invalid();
            }
        }

        /** {@code {start, end}} → thêm {@code duration}: số ngày (tính cả hai đầu) hoặc số giờ / ngày theo phút. */
        private static Map<String, Object> dateRange(FormWidget w, Object raw) {
            if (!(raw instanceof Map<?, ?> m)) throw new Invalid();
            String start = date(w, m.get("start"));
            String end = date(w, m.get("end"));
            if (start == null && end == null) return null;
            if (start == null || end == null) throw new Invalid();
            BigDecimal duration;
            if (w.withTime()) {
                long minutes = ChronoUnit.MINUTES.between(LocalDateTime.parse(start), LocalDateTime.parse(end));
                if (minutes < 0) throw new Invalid();
                boolean days = "DAY".equals(w.durationUnit());
                duration = round(BigDecimal.valueOf(minutes).divide(BigDecimal.valueOf(days ? 1440 : 60), 4, RoundingMode.HALF_UP), 2);
            } else {
                long days = ChronoUnit.DAYS.between(LocalDate.parse(start), LocalDate.parse(end));
                if (days < 0) throw new Invalid();
                duration = BigDecimal.valueOf(days + 1);
            }
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("start", start);
            out.put("end", end);
            out.put("duration", duration);
            return out;
        }

        private List<Map<String, Object>> files(FormWidget w, Object raw) {
            if (!(raw instanceof List<?> list)) throw new Invalid();
            int max = w.maxCount() == null ? FormSchemaValidator.MAX_FILES : w.maxCount();
            if (list.size() > max) throw new Invalid();
            String folder = lookup.uploadFolder() + "/";
            List<Map<String, Object>> out = new ArrayList<>();
            for (Object o : list) {
                if (!(o instanceof Map<?, ?> f)) throw new Invalid();
                String publicId = f.get("publicId") instanceof String p ? p : null;
                String url = f.get("url") instanceof String u ? u : null;
                String type = f.get("contentType") instanceof String t ? t : "";
                if (publicId == null || url == null || !publicId.startsWith(folder) || publicId.contains("..")
                        || !url.startsWith("https://") || !url.contains(publicId)) throw new Invalid();
                if (w.type() == WidgetType.IMAGE && !type.startsWith("image/")) throw new Invalid();
                String name = f.get("name") instanceof String n && !n.isBlank() ? n.strip() : publicId;
                Map<String, Object> file = new LinkedHashMap<>();
                file.put("url", url);
                file.put("publicId", publicId);
                file.put("name", name.length() > MAX_FILE_NAME ? name.substring(0, MAX_FILE_NAME) : name);
                file.put("contentType", type);
                if (f.get("size") instanceof Number size) file.put("size", size.longValue());
                out.add(file);
            }
            return out.isEmpty() ? null : out;
        }

        /** Người / đơn vị: nhận id (hoặc {@code {id}}), trả {@code [{id, name}]} với tên lấy từ DB. */
        private List<Map<String, Object>> refs(FormWidget w, Object raw, boolean users) {
            List<String> rawIds = new ArrayList<>();
            if (!(raw instanceof List<?> list)) throw new Invalid();
            for (Object o : list) {
                Object id = o instanceof Map<?, ?> m ? m.get("id") : o;
                if (!(id instanceof String s)) throw new Invalid();
                if (!rawIds.contains(s)) rawIds.add(s);
            }
            if (rawIds.isEmpty()) return null;
            if (!w.isMultiple() && rawIds.size() > 1) throw new Invalid();
            List<UUID> ids = new ArrayList<>();
            for (String s : rawIds) {
                try {
                    ids.add(UUID.fromString(s));
                } catch (IllegalArgumentException e) {
                    throw new Invalid();
                }
            }
            Map<UUID, String> names = users ? lookup.users(ids) : lookup.units(ids);
            List<Map<String, Object>> out = new ArrayList<>();
            for (UUID id : ids) {
                String name = names.get(id);
                if (name == null) throw new Invalid();
                out.add(Map.of("id", id.toString(), "name", name));
            }
            return out;
        }

        private static List<String> strings(Object raw) {
            if (!(raw instanceof List<?> list)) throw new Invalid();
            List<String> out = new ArrayList<>();
            for (Object o : list) {
                if (!(o instanceof String s)) throw new Invalid();
                if (!out.contains(s)) out.add(s);
            }
            return out;
        }

        @SuppressWarnings("unchecked")
        private static List<String> castList(Object v) {
            return (List<String>) v;
        }

        private static boolean empty(Object v) {
            return v == null || (v instanceof Collection<?> c && c.isEmpty());
        }
    }

    private static BigDecimal round(BigDecimal v, int decimals) {
        BigDecimal r = v.setScale(decimals, RoundingMode.HALF_UP).stripTrailingZeros();
        return r.scale() < 0 ? r.setScale(0) : r;
    }

    /** Giá trị không hợp lệ — đổi thành lỗi theo tên widget ở chỗ gọi. */
    private static final class Invalid extends RuntimeException {
        Invalid() {
            super(null, null, false, false);
        }
    }
}
