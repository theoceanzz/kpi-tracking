package com.kpitracking.ai.document.section;

import com.kpitracking.ai.document.model.DocumentSection;
import com.kpitracking.ai.document.model.ParsedDocument;

import java.util.List;

/**
 * Cách cắt một tài liệu đã đọc thành các MỤC (Strategy). Mỗi loại tài liệu chọn cách cắt hợp với nó qua
 * {@code DocumentProfile.sectioning} — hướng dẫn cắt theo tiêu đề, quy chế theo Chương/Điều, bảng theo trang
 * tính, còn lại theo độ dài.
 */
public interface SectioningStrategy {

    List<DocumentSection> sections(ParsedDocument doc);

    /** Tên ngắn để ghi log / lưu vết ("heading", "legal", …). */
    String name();
}
