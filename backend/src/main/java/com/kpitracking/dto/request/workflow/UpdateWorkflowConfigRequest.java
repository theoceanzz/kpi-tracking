package com.kpitracking.dto.request.workflow;

import com.kpitracking.workflow.def.StageConfig;
import com.kpitracking.workflow.def.WorkflowConfig;
import com.kpitracking.workflow.def.WorkflowUiConfig;
import lombok.*;

import java.util.List;

/**
 * Ý muốn đổi luồng của tổ chức.
 *
 * <p>Gửi thiếu bước nào thì bước đó GIỮ NGUYÊN cấu hình đang có, nhờ bước trộn ở
 * {@code WorkflowDefinitionFactory.merge}. Nên gửi một phần là hợp lệ và an toàn.
 */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class UpdateWorkflowConfigRequest {

    private List<StageConfig> stages;

    private WorkflowUiConfig ui;

    public WorkflowConfig toConfig() {
        return WorkflowConfig.builder()
                .schemaVersion(1)
                .stages(stages == null ? List.of() : stages)
                .ui(ui)
                .build();
    }
}
