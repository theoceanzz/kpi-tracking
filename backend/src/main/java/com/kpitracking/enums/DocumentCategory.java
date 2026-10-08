package com.kpitracking.enums;

/**
 * Danh mục tài liệu. {@link #JOB_DESCRIPTION} và {@link #STRATEGY} là hai loại công cụ gợi ý KPI
 * ({@code get_org_documents}) đọc; ba giá trị đầu trùng tên với {@code RagDocument.Source} cũ để vector
 * nạp trước đây mang sẵn {@code category} đúng khi được gắn scope lúc khởi động.
 */
public enum DocumentCategory {
    REGULATION,
    JOB_DESCRIPTION,
    STRATEGY,
    PROCESS,
    TEMPLATE,
    REFERENCE,
    OTHER
}
