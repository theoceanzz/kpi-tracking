package com.kpitracking.i18n;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Câu hệ thống sinh ra dưới dạng key + tham số, dịch lúc HIỂN THỊ chứ không lúc tạo.
 *
 * <p>Dùng cho chữ được lưu lại rồi đọc sau (thông báo, lý do bỏ qua bước duyệt, lịch sử khoá kỳ): lưu
 * {@link #toJson()} vào cột {@code *_i18n}, đọc ra bằng {@link #fromJson(String)} và
 * {@link #render(Locale)} theo ngôn ngữ người xem. Tham số có thể là chuỗi, số, hoặc một
 * {@code LocalizedText} khác (cụm từ cũng cần dịch, vd. "chỉ tiêu"/"yêu cầu điều chỉnh"). Dữ liệu người
 * dùng (tên KPI, tên người, lý do tự nhập) truyền nguyên văn dạng chuỗi.
 */
public record LocalizedText(String key, List<Object> args) {

    private static final ObjectMapper JSON = new ObjectMapper();

    public LocalizedText {
        args = args == null ? List.of() : List.copyOf(args.stream().map(a -> a == null ? "" : a).toList());
    }

    public static LocalizedText of(String key, Object... args) {
        return new LocalizedText(key, List.of(args == null ? new Object[0] : replaceNulls(args)));
    }

    private static Object[] replaceNulls(Object[] args) {
        Object[] out = args.clone();
        for (int i = 0; i < out.length; i++) if (out[i] == null) out[i] = "";
        return out;
    }

    public String render(Locale locale) {
        Object[] resolved = args.stream()
                .map(a -> a instanceof LocalizedText t ? t.render(locale) : a)
                .toArray();
        return ErrorMessages.text(locale, key, key, resolved);
    }

    /** Theo ngôn ngữ của request hiện tại (tiếng Việt nếu ngoài request). */
    public String render() {
        return render(ErrorMessages.currentLocale());
    }

    public String toJson() {
        try {
            return JSON.writeValueAsString(toNode());
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private ObjectNode toNode() {
        ObjectNode node = JSON.createObjectNode();
        node.put("key", key);
        ArrayNode arr = node.putArray("args");
        for (Object a : args) {
            if (a instanceof LocalizedText t) arr.add(t.toNode());
            else if (a instanceof Integer i) arr.add(i);
            else if (a instanceof Long l) arr.add(l);
            else if (a instanceof Double d) arr.add(d);
            else if (a instanceof java.math.BigDecimal b) arr.add(b);
            else arr.add(String.valueOf(a));
        }
        return node;
    }

    /** Null hoặc JSON hỏng thì trả null — nơi gọi rơi về cột chữ cũ. */
    public static LocalizedText fromJson(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return fromNode(JSON.readTree(json));
        } catch (JsonProcessingException | RuntimeException e) {
            return null;
        }
    }

    private static LocalizedText fromNode(JsonNode node) {
        List<Object> args = new ArrayList<>();
        for (JsonNode a : node.path("args")) {
            if (a.isObject()) args.add(fromNode(a));
            else if (a.isIntegralNumber()) args.add(a.longValue());
            else if (a.isNumber()) args.add(a.decimalValue());
            else args.add(a.asText());
        }
        return new LocalizedText(node.path("key").asText(), args);
    }

    /** Bản đã lưu dịch được thì dịch, không thì dùng chữ cũ. */
    public static String renderOr(String json, String legacy, Locale locale) {
        LocalizedText t = fromJson(json);
        return t != null ? t.render(locale) : legacy;
    }
}
