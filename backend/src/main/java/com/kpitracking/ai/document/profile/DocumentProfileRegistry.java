package com.kpitracking.ai.document.profile;

import com.kpitracking.ai.document.model.ParsedDocument;
import com.kpitracking.entity.RagDocument;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Chọn {@link DocumentProfile} (Registry + Factory): theo loại khai rõ, hoặc tự nhận ra loại tài liệu khi bóc
 * bộ tiêu chí. Mọi profile là bean — thêm loại mới không sửa ở đây.
 */
@Component
@Slf4j
public class DocumentProfileRegistry {

    /** Dưới ngưỡng này thì không tin phỏng đoán nào — dùng loại chung. */
    static final int MIN_CONFIDENCE = 30;

    private final Map<DocumentKind, DocumentProfile> byKind = new EnumMap<>(DocumentKind.class);

    public DocumentProfileRegistry(List<DocumentProfile> profiles) {
        for (DocumentProfile p : profiles) {
            DocumentProfile old = byKind.put(p.kind(), p);
            if (old != null) throw new IllegalStateException("Hai profile cho cùng loại " + p.kind());
        }
        if (!byKind.containsKey(DocumentKind.GENERIC)) throw new IllegalStateException("Thiếu profile GENERIC");
    }

    public DocumentProfile forKind(DocumentKind kind) {
        return byKind.getOrDefault(kind, byKind.get(DocumentKind.GENERIC));
    }

    public DocumentProfile forSource(RagDocument.Source source) {
        return forKind(DocumentKind.of(source));
    }

    /** Loại đã lưu theo tên (cột {@code ai_criteria_sets.profile}); tên lạ / trống → loại chung. */
    public DocumentProfile forName(String name) {
        if (name == null || name.isBlank()) return forKind(DocumentKind.GENERIC);
        try {
            return forKind(DocumentKind.valueOf(name));
        } catch (IllegalArgumentException e) {
            return forKind(DocumentKind.GENERIC);
        }
    }

    /**
     * Nhận ra loại tài liệu để BÓC BỘ TIÊU CHÍ: trong các profile có bộ nhóm, lấy điểm {@code detect} cao nhất;
     * không ai đủ {@link #MIN_CONFIDENCE} thì dùng loại chung.
     */
    public DocumentProfile detectForCriteria(ParsedDocument doc) {
        DocumentProfile best = byKind.values().stream()
                .filter(p -> !p.criteriaScheme().isEmpty() && p.kind() != DocumentKind.GENERIC)
                .max(Comparator.comparingInt(p -> p.detect(doc)))
                .filter(p -> p.detect(doc) >= MIN_CONFIDENCE)
                .orElse(forKind(DocumentKind.GENERIC));
        log.info("Tài liệu «{}» nhận là: {}", doc.fileName(), best.kind());
        return best;
    }
}
