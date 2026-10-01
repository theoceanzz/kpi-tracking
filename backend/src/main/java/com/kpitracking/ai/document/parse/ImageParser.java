package com.kpitracking.ai.document.parse;

import com.kpitracking.ai.document.model.FileRef;
import com.kpitracking.ai.document.model.ParsedDocument;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;

/**
 * Ảnh ({@code jpg/jpeg/png/webp}): mô hình đọc ảnh chép lại chữ. Nguồn {@code IMAGE} — có thể sai, không bao
 * giờ dùng để tính điểm. Tắt đọc ảnh / ảnh không có chữ → {@link Unparseable} kèm lý do.
 */
@Component
public class ImageParser implements DocumentParser {

    private final VisionReader vision;

    public ImageParser(VisionReader vision) {
        this.vision = vision;
    }

    @Override
    public Set<String> formats() {
        return Set.of("jpg", "jpeg", "png", "webp");
    }

    @Override
    public boolean accepts(FileRef file) {
        return formats().contains(file.extension());
    }

    @Override
    public ParsedDocument parse(FileRef file) throws Exception {
        if (!vision.enabled()) throw new Unparseable("ảnh — chưa bật đọc ảnh");
        String text;
        try {
            text = vision.transcribe(List.of(file.bytes()), mimeOf(file.extension()));
        } catch (RuntimeException e) {
            throw new Unparseable("không đọc được ảnh (mô hình đọc ảnh lỗi)");
        }
        if (text == null) throw new Unparseable("ảnh không có chữ");
        return ParsedDocument.fromText(file.name(), file.extension(), text, ParsedDocument.TextSource.IMAGE, false, null);
    }

    static String mimeOf(String ext) {
        return switch (ext) {
            case "png" -> "image/png";
            case "webp" -> "image/webp";
            default -> "image/jpeg";
        };
    }
}
