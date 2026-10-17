package com.kpitracking.service.task;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.entity.task.TaskListField;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Predicate;

/**
 * Giá trị trường tuỳ chỉnh lưu dạng {@code {"v": …}} (JSONB) để lọc bằng {@code @>} và chỉ mục GIN:
 * TEXT = chuỗi; NUMBER = số; SINGLE_SELECT = id lựa chọn; MULTI_SELECT = mảng id lựa chọn; MEMBER = mảng id người;
 * DATE = "yyyy-MM-dd"; CHECKBOX = true/false. Lựa chọn của trường: mảng {@link Option}.
 */
public final class TaskFieldCodec {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    public static final int MAX_TEXT = 2000;
    public static final int MAX_OPTIONS = 50;

    private TaskFieldCodec() {}

    public record Option(String id, String label, String color) {}

    public static List<Option> options(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return MAPPER.readValue(json, new TypeReference<List<Option>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    /** Chuẩn hoá danh sách lựa chọn: bỏ dòng trống, tự sinh id thiếu, tối đa {@link #MAX_OPTIONS}. */
    public static String optionsJson(List<Option> options) {
        if (options == null) return null;
        List<Option> clean = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        for (Option o : options) {
            if (o == null || o.label() == null || o.label().isBlank()) continue;
            String id = o.id() == null || o.id().isBlank() || ids.contains(o.id()) ? UUID.randomUUID().toString().substring(0, 8) : o.id();
            ids.add(id);
            String label = o.label().strip();
            clean.add(new Option(id, label.length() > 80 ? label.substring(0, 80) : label, o.color()));
            if (clean.size() >= MAX_OPTIONS) break;
        }
        return write(clean);
    }

    public static String wrapJson(Object value) {
        return write(Map.of("v", value));
    }

    public static Object unwrap(String json) {
        if (json == null) return null;
        try {
            Map<String, Object> m = MAPPER.readValue(json, new TypeReference<Map<String, Object>>() {});
            return m.get("v");
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Kiểm + chuẩn hoá giá trị theo kiểu trường. Trả JSON để lưu, hoặc null = xoá giá trị (rỗng / false với CHECKBOX vẫn
     * lưu false). {@code memberOk}: người được chọn ở trường MEMBER có hợp lệ không (cùng tổ chức).
     */
    public static String encode(TaskListField field, Object raw, Predicate<UUID> memberOk) {
        if (raw == null || (raw instanceof String s && s.isBlank()) || (raw instanceof Collection<?> c && c.isEmpty())) {
            return null;
        }
        try {
            return switch (field.getType()) {
                case TEXT -> {
                    String s = String.valueOf(raw).strip();
                    yield wrapJson(s.length() > MAX_TEXT ? s.substring(0, MAX_TEXT) : s);
                }
                case NUMBER -> {
                    BigDecimal n = raw instanceof Number num ? new BigDecimal(num.toString()) : new BigDecimal(String.valueOf(raw).strip());
                    yield wrapJson(n);
                }
                case DATE -> wrapJson(LocalDate.parse(String.valueOf(raw).strip()).toString());
                case CHECKBOX -> wrapJson(raw instanceof Boolean b ? b : Boolean.parseBoolean(String.valueOf(raw)));
                case SINGLE_SELECT -> {
                    String id = String.valueOf(raw);
                    if (options(field.getOptions()).stream().noneMatch(o -> o.id().equals(id))) throw invalid(field);
                    yield wrapJson(id);
                }
                case MULTI_SELECT -> {
                    Set<String> valid = new HashSet<>();
                    options(field.getOptions()).forEach(o -> valid.add(o.id()));
                    List<String> ids = new ArrayList<>(new LinkedHashSet<>(asList(raw)));
                    if (!valid.containsAll(ids)) throw invalid(field);
                    yield wrapJson(ids);
                }
                case MEMBER -> {
                    List<String> ids = new ArrayList<>(new LinkedHashSet<>(asList(raw)));
                    for (String id : ids) if (!memberOk.test(UUID.fromString(id))) throw invalid(field);
                    yield wrapJson(ids);
                }
            };
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw invalid(field);
        }
    }

    private static List<String> asList(Object raw) {
        if (raw instanceof Collection<?> c) return c.stream().map(String::valueOf).toList();
        return List.of(String.valueOf(raw));
    }

    private static BusinessException invalid(TaskListField f) {
        return new BusinessException(ErrorCode.TASK_FIELD_VALUE_INVALID, f.getName());
    }

    public static String write(Object o) {
        try {
            return MAPPER.writeValueAsString(o);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public static <T> T read(String json, Class<T> type) {
        try {
            return json == null ? null : MAPPER.readValue(json, type);
        } catch (Exception e) {
            return null;
        }
    }
}
