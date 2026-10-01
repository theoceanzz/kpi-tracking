package com.kpitracking.ai.document.profile;

import com.kpitracking.entity.RagDocument;

/**
 * Loại tài liệu theo NGHIỆP VỤ (khác định dạng tệp). Mỗi loại có một {@link DocumentProfile} quyết định cách
 * cắt mục, có nạp kho tri thức không, và bóc bộ tiêu chí thành những nhóm nào.
 *
 * <p>Loại lưu trong kho tri thức ánh xạ về {@link RagDocument.Source} (tên cột cũ giữ nguyên, không đổi CSDL);
 * {@link #EVIDENCE} không bao giờ vào kho — minh chứng thuộc về một người và theo đúng luật xem của người đó.
 */
public enum DocumentKind {
    GUIDE(RagDocument.Source.GUIDE),
    REGULATION(RagDocument.Source.REGULATION),
    JOB_DESCRIPTION(RagDocument.Source.JOB_DESCRIPTION),
    STRATEGY(RagDocument.Source.STRATEGY),
    /** Bảng tiêu chí / bảng KPI dạng Excel — khi nạp kho thì tính là quy chế chấm. */
    KPI_TABLE(RagDocument.Source.REGULATION),
    /** Không nhận ra loại — cắt theo cấu trúc có sẵn, bóc đủ mọi vai trò. */
    GENERIC(RagDocument.Source.REGULATION),
    /** Tệp minh chứng đính kèm bài nộp: chỉ đọc để chấm, KHÔNG nạp kho. */
    EVIDENCE(null);

    private final RagDocument.Source storedAs;

    DocumentKind(RagDocument.Source storedAs) {
        this.storedAs = storedAs;
    }

    /** Nguồn ghi vào {@code rag_documents.source}; {@code null} = không lưu kho. */
    public RagDocument.Source storedAs() {
        return storedAs;
    }

    public static DocumentKind of(RagDocument.Source source) {
        return switch (source) {
            case GUIDE -> GUIDE;
            case REGULATION -> REGULATION;
            case JOB_DESCRIPTION -> JOB_DESCRIPTION;
            case STRATEGY -> STRATEGY;
        };
    }
}
