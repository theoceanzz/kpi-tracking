package com.kpitracking.ai.document.retrieve;

import com.kpitracking.entity.RagDocument;

import java.util.List;

/**
 * Ai đọc kho tri thức, được đọc những loại tài liệu nào. Chốt chặn đa tổ chức ở {@link DocumentRetrieverFactory}
 * dựa trên đây — thêm một nơi đọc kho = thêm một hằng, không tự dựng bộ lọc.
 *
 * @param includeGlobal thấy cả tài liệu chung toàn hệ thống (bộ hướng dẫn KeyGo)
 * @param sources       loại tài liệu của tổ chức được đọc; {@code null} = mọi loại
 */
public enum RetrievalProfile {
    /** Hỏi đáp cách dùng KeyGo + tài liệu của tổ chức. Không biết tổ chức → chỉ tài liệu chung. */
    HELP(true, null),
    /** Gợi ý / đề xuất chỉ tiêu KPI: mô tả công việc + chiến lược (quy chế nói cách chấm, không nói việc phải làm). */
    KPI_CONTEXT(false, List.of(RagDocument.Source.JOB_DESCRIPTION, RagDocument.Source.STRATEGY)),
    /** AI chấm bài nộp: quy chế + mô tả công việc làm căn cứ. */
    SUBMISSION_REVIEW(false, List.of(RagDocument.Source.REGULATION, RagDocument.Source.JOB_DESCRIPTION));

    private final boolean includeGlobal;
    private final List<RagDocument.Source> sources;

    RetrievalProfile(boolean includeGlobal, List<RagDocument.Source> sources) {
        this.includeGlobal = includeGlobal;
        this.sources = sources;
    }

    public boolean includeGlobal() {
        return includeGlobal;
    }

    public List<RagDocument.Source> sources() {
        return sources;
    }
}
