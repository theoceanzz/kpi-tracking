package com.kpitracking.dto.response.ai;

import dev.langchain4j.data.document.Metadata;

/**
 * Một tài liệu của tổ chức mà K.AI đã đọc để trả lời lượt này — client vẽ thành chip bấm mở tài liệu
 * (docs/DOCUMENTS_DESIGN.md §8.5).
 *
 * <p>Chỉ dựng từ những đoạn mà bộ truy hồi ĐÃ trả cho người hỏi, tức đã qua bộ lọc quyền — nên không lộ thêm
 * gì. Bấm mở vẫn đi qua kiểm quyền: quyền bị thu sau đó thì client nhận 404.
 *
 * @param scope   {@code COMPANY} | {@code UNIT} | {@code PERSONAL}
 * @param section mục trong tài liệu đã đọc (đoạn đầu tiên khớp), để chip nói rõ "mục nào"
 * @param legacy  tài liệu tri thức cũ không có tệp gốc (nằm ở rag_documents, không ở thư viện tài liệu)
 */
public record DocumentSourceResponse(String docId, String title, String scope, String section, boolean legacy) {

    /**
     * Từ metadata của một đoạn. {@code null} với bộ hướng dẫn chung (GLOBAL) — nó không phải tài liệu trong thư
     * viện, câu trả lời đã có đường dẫn màn hình riêng — và với đoạn thiếu khoá.
     */
    public static DocumentSourceResponse fromMetadata(Metadata m) {
        if (m == null) return null;
        String docId = m.getString("docId");
        String scope = m.getString("scope");
        if (docId == null || scope == null || "GLOBAL".equals(scope)) return null;
        String parent = m.getString("parent");
        String title = m.getString("title");
        String section = title == null || title.isBlank() ? null
                : parent == null || parent.isBlank() ? title : parent + " › " + title;
        // DocumentIndexer luôn ghi "version"; vector của rag_documents cũ thì không.
        boolean legacy = !m.containsKey("version");
        String docTitle = m.getString("docTitle");
        return new DocumentSourceResponse(docId, docTitle == null ? title : docTitle, scope, section, legacy);
    }
}
