package com.kpitracking.ai.document.profile;

import com.kpitracking.ai.document.model.ParsedDocument;
import com.kpitracking.ai.document.section.HeadingSectioning;
import com.kpitracking.ai.document.section.LegalStructureSectioning;
import com.kpitracking.ai.document.section.SectioningStrategy;
import com.kpitracking.ai.document.section.SizeSectioning;

/**
 * Phương án xử lý MỘT loại tài liệu (Strategy) — {@link DocumentProfileRegistry} chọn theo loại người dùng
 * khai, hoặc tự nhận ra ({@link #detect}) khi bóc bộ tiêu chí. Thêm loại tài liệu mới = thêm một bean cài
 * interface này; đường nạp ({@code DocumentIngestionPipeline}) và đường bóc không phải sửa.
 */
public interface DocumentProfile {

    DocumentKind kind();

    /** Tên hiển thị ("Quy chế, quy định"). */
    String label();

    /**
     * Mức chắc chắn 0..100 rằng tài liệu thuộc loại này — chỉ dùng khi không ai nói loại (bóc bộ tiêu chí).
     * Mặc định 0: loại chỉ chọn được khi khai rõ (hướng dẫn KeyGo, minh chứng).
     */
    default int detect(ParsedDocument doc) {
        return 0;
    }

    /** Cách cắt mục cho tài liệu này (có thể tuỳ nội dung: có "Điều N." thì cắt theo điều…). */
    SectioningStrategy sectioning(ParsedDocument doc);

    /** Có nạp vào kho tri thức (pgvector) không. */
    default IndexPolicy indexPolicy() {
        return IndexPolicy.INDEX;
    }

    /** Bộ nhóm khi bóc bộ tiêu chí từ loại tài liệu này; {@link CriteriaScheme#NONE} = không dùng để bóc. */
    default CriteriaScheme criteriaScheme() {
        return CriteriaScheme.NONE;
    }

    enum IndexPolicy { INDEX, NO_INDEX }

    /**
     * Cắt theo cấu trúc có sẵn của tài liệu: văn bản pháp quy ("Điều N.", "CHƯƠNG") → theo điều; có kiểu
     * tiêu đề (Word) → theo tiêu đề; không có gì → theo độ dài.
     */
    static SectioningStrategy structural(ParsedDocument doc) {
        if (LegalStructureSectioning.markerCount(doc.plainText()) >= 2) return LegalStructureSectioning.INSTANCE;
        if (doc.hasHeadings()) return HeadingSectioning.INSTANCE;
        return SizeSectioning.INSTANCE;
    }

    /** Có một trong các từ khoá trong phần đầu tài liệu (tiêu đề, trích yếu). */
    static boolean headMentions(ParsedDocument doc, int headChars, String... keywords) {
        String head = doc.plainText();
        head = head.substring(0, Math.min(head.length(), headChars)).toLowerCase();
        for (String k : keywords) {
            if (head.contains(k)) return true;
        }
        return false;
    }
}
