package com.kpitracking.dto.response.workflow;

import lombok.*;

import java.util.List;
import java.util.Map;

/**
 * Một bước của luồng, đã gộp metadata tĩnh của registry với lựa chọn của tổ chức.
 *
 * <p>Gộp sẵn ở backend để frontend chỉ cần MỘT lời gọi là dựng được cả menu, thanh tiến trình và
 * màn hình cấu hình — thay vì tự ghép danh mục với cấu hình rồi lệch nhau như
 * {@code navItems} và {@code menuItems} đang lệch.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class WorkflowStageResponse {

    /** Mã bước, ví dụ {@code CRITERIA_APPROVAL}. */
    private String code;

    /** Nhãn mặc định. Tổ chức đổi nhãn qua {@code sidebar_settings} theo route, không qua đây. */
    private String label;

    private String route;
    private List<String> extraRoutes;

    /** Quyền để THẤY mục menu. */
    private String navPermission;

    /** Quyền để THỰC HIỆN hành động của bước. */
    private String actionPermission;

    /** Các bước phải còn bật thì bước này mới có nghĩa. */
    private List<String> requires;

    /** Bước lõi thì không tắt được — giao diện làm mờ công tắc. */
    private boolean required;

    private boolean enabled;
    private int order;
    private Map<String, Object> options;
}
