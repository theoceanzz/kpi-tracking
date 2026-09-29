package com.kpitracking.util;

import com.kpitracking.enums.F360Relationship;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;

/** Cột {@code relationships} của câu hỏi 360 lưu dạng CSV tên enum; rỗng/null = hỏi mọi nhóm. */
public final class F360Relationships {

    private F360Relationships() {}

    public static List<F360Relationship> parse(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> {
                    try {
                        return F360Relationship.valueOf(s);
                    } catch (IllegalArgumentException e) {
                        return null;
                    }
                })
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    public static String join(List<F360Relationship> rels) {
        if (rels == null || rels.isEmpty()) return null;
        return String.join(",", rels.stream().filter(Objects::nonNull).distinct().map(Enum::name).toList());
    }
}
