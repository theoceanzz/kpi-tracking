package com.kpitracking.dto.response.ai;

import com.kpitracking.ai.rag.RagIngestionService;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Một đoạn đang nằm trong kho vector, đúng như trợ lý sẽ nhận: {@code text} đã có tiêu đề mục chèn
 * đầu, metadata đã tách về danh sách. Không có vector — nó không mang thông tin gì cho người đọc.
 */
public record RagChunkResponse(
        String id,
        Integer order,
        Integer index,
        String title,
        String parent,
        String route,
        String roles,
        String text,
        List<String> images,
        List<String> captions) {

    public static RagChunkResponse of(String id, String text, Map<String, Object> meta) {
        return new RagChunkResponse(id, asInt(meta.get("order")), asInt(meta.get("index")),
                asString(meta.get("title")), asString(meta.get("parent")), asString(meta.get("route")),
                asString(meta.get("roles")), text, split(asString(meta.get("images"))), split(asString(meta.get("captions"))));
    }

    static String asString(Object v) {
        return v == null ? null : v.toString();
    }

    static Integer asInt(Object v) {
        if (v instanceof Number n) return n.intValue();
        try {
            return v == null ? null : Integer.valueOf(v.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Danh sách ghép bằng {@code RagIngestionService.SEP} lúc nạp (kho chỉ nhận metadata phẳng). */
    static List<String> split(String joined) {
        if (joined == null || joined.isBlank()) return List.of();
        return Arrays.stream(joined.split(Pattern.quote(RagIngestionService.SEP))).toList();
    }
}
