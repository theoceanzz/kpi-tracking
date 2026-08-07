package com.kpitracking.dto.response.email;

import lombok.*;

import java.util.List;
import java.util.Map;

/** Một loại email trong danh mục, kèm nội dung đang dùng (mặc định hoặc đã tuỳ chỉnh). */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class EmailTemplateResponse {
    private String code;
    private String label;
    private String description;
    private String group;

    /** Nội dung đang có hiệu lực. */
    private String subject;
    private String body;
    private boolean fullHtml;
    private boolean enabled;

    /**
     * Ai làm chủ công tắc bật/tắt gửi:
     * {@code self} — ngay tại màn hình này;
     * {@code notification_settings} — thuộc tab Thiết lập thông báo;
     * {@code locked} — không được tắt (mail bảo mật).
     */
    private String enabledControl;

    /** true = tổ chức đã tuỳ chỉnh; false = đang dùng bản mặc định của hệ thống. */
    private boolean customized;

    /** Bản mặc định, để giao diện hiện nút "khôi phục mặc định" và so sánh. */
    private String defaultSubject;
    private String defaultBody;

    /** Tên biến → mô tả, dùng làm chip bấm-để-chèn. */
    private Map<String, String> variables;
    /** Biến không được xoá, nếu thiếu thì lưu sẽ báo lỗi. */
    private List<String> requiredVariables;
}
