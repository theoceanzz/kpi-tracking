package com.kpitracking.dto.request.email;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class SaveEmailTemplateRequest {
    private String subject;

    /**
     * HTML thân email. Ở chế độ thường, đây là kết quả của trình soạn trực quan
     * (TipTap) — các khối đặc thù mang thuộc tính {@code data-email} để mở lại sửa được.
     * Ở chế độ nâng cao, đây là HTML người dùng tự viết.
     */
    private String body;

    /** true = body là toàn bộ tài liệu HTML, hệ thống không bọc khung header/footer. */
    private boolean fullHtml;

    /** false = tắt hẳn loại mail này. */
    private boolean enabled = true;
}
