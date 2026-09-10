package com.kpitracking.workflow.def;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;

/** Phần trình bày của luồng — chỉ ảnh hưởng giao diện, không đổi nghiệp vụ. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class WorkflowUiConfig {

    /** Hiện thanh tiến trình nối các bước ở đầu mỗi trang trong luồng. */
    @Builder.Default
    private boolean showRail = true;

    /** Gom các bước vào một nhóm menu ("Quản lý KPI") thay vì trải phẳng. */
    @Builder.Default
    private boolean groupInSidebar = true;

    public static WorkflowUiConfig defaults() {
        return WorkflowUiConfig.builder().build();
    }
}
