package com.kpitracking.ai.document.ingest;

/**
 * Khoá metadata của mỗi đoạn trong kho vector (kho chỉ nhận String/số/UUID nên danh sách ghép bằng {@link #SEP}):
 * {@code docId, orgId, source, docTitle, title, parent, order, images, captions, route, roles}.
 */
public final class RagMetadata {

    private RagMetadata() {}

    /** Giá trị {@code orgId} của tài liệu chung toàn hệ thống (bộ hướng dẫn KeyGo). */
    public static final String GLOBAL_ORG = "GLOBAL";
    public static final String SEP = "|";

    public static final String DOC_ID = "docId";
    public static final String ORG_ID = "orgId";
    public static final String SOURCE = "source";
}
