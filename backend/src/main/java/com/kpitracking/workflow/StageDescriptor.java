package com.kpitracking.workflow;

import java.util.List;
import java.util.Set;

/**
 * Metadata TĨNH của một bước — phần không tổ chức nào đổi được.
 *
 * <p>Phần tổ chức đổi được (bật/tắt, thứ tự hiển thị, tuỳ chọn) nằm ở
 * {@code com.kpitracking.workflow.def.StageConfig}.
 *
 * @param stage            bước
 * @param route            đường dẫn frontend chính của bước
 * @param extraRoutes      các đường dẫn phụ cùng thuộc bước này (dùng để suy bước từ URL)
 * @param navPermission    quyền để THẤY mục menu — giữ đúng như Sidebar hiện tại để không đổi
 *                         tầm nhìn của bất kỳ ai sau refactor
 * @param actionPermission quyền để THỰC HIỆN hành động của bước — dùng cho guard ở backend
 * @param requires         các bước phải còn bật thì bước này mới có nghĩa
 * @param required         true nghĩa là bước lõi, không tắt được
 * @param defaultOrder     thứ tự hiển thị mặc định
 * @param defaultLabel     nhãn mặc định (tổ chức đổi nhãn qua {@code sidebar_settings}, không qua đây)
 */
public record StageDescriptor(
        WorkflowStage stage,
        String route,
        List<String> extraRoutes,
        String navPermission,
        String actionPermission,
        Set<WorkflowStage> requires,
        boolean required,
        int defaultOrder,
        String defaultLabel
) {
    /** Bước lõi thì không cho tắt — {@code WorkflowConfigValidator} dựa vào đây. */
    public boolean isOptional() {
        return !required;
    }
}
