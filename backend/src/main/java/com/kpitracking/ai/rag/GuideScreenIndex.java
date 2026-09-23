package com.kpitracking.ai.rag;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Danh mục màn hình của bộ hướng dẫn KeyGo, xuất từ {@code scripts/guide_manifest.py}.
 *
 * <p>Dùng để gắn {@code route} và vai trò vào từng mục tài liệu lúc nạp: tài liệu .docx không biết
 * màn hình nào ở đường dẫn nào, nhưng chú thích ảnh ("Hình 3. Màn hình đăng nhập") và tiêu đề mục
 * khớp được với {@code title} trong danh mục. Có route thì câu trả lời mở được đúng trang.
 *
 * <p>Tệp JSON sinh bằng một dòng Python từ manifest (xem đầu tệp manifest); sửa manifest thì sinh
 * lại — không sửa tay JSON.
 */
@Component
@Slf4j
public class GuideScreenIndex {

    public record Screen(String id, String title, String route, String role, String description) {}

    private List<Screen> screens = List.of();

    @PostConstruct
    void load() throws IOException {
        ClassPathResource res = new ClassPathResource("rag/keygo-guide-screens.json");
        if (!res.exists()) {
            log.warn("Không có rag/keygo-guide-screens.json — mục hướng dẫn sẽ không có route");
            return;
        }
        try (var in = res.getInputStream()) {
            screens = new ObjectMapper().readValue(in,
                    new com.fasterxml.jackson.core.type.TypeReference<List<Screen>>() {});
        }
        log.info("Danh mục màn hình hướng dẫn: {} mục", screens.size());
    }

    /**
     * Màn hình khớp với một dòng chữ (tiêu đề mục hoặc chú thích ảnh). Ưu tiên tên DÀI hơn để
     * "Đánh giá đợt" không nuốt mất "Đánh giá của tôi".
     */
    public Optional<Screen> match(String text) {
        if (text == null || text.isBlank()) return Optional.empty();
        String hay = normalize(text);
        return screens.stream()
                .filter(s -> hay.contains(normalize(s.title())))
                .max((a, b) -> Integer.compare(a.title().length(), b.title().length()));
    }

    private static String normalize(String s) {
        return s.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }
}
