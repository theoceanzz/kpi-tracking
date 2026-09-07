package com.kpitracking.workflow;

import com.kpitracking.dto.response.workflow.WorkflowConfigResponse;
import com.kpitracking.dto.response.workflow.WorkflowStageResponse;
import com.kpitracking.workflow.def.StageConfig;
import com.kpitracking.workflow.def.WorkflowConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;

/**
 * Gộp metadata tĩnh của {@link StageRegistry} với lựa chọn của tổ chức thành một câu trả lời duy nhất.
 *
 * <p>Viết tay thay vì MapStruct vì đây là phép GỘP hai nguồn chứ không phải ánh xạ trường sang
 * trường — MapStruct ở đây sẽ tốn nhiều chú thích hơn là một vòng lặp.
 */
@Component
@RequiredArgsConstructor
public class WorkflowResponseAssembler {

    private final StageRegistry registry;

    public WorkflowConfigResponse toResponse(WorkflowConfig config, boolean canManage, List<String> warnings) {
        List<WorkflowStageResponse> stages = registry.all().stream()
                .map(d -> {
                    StageConfig sc = config.stage(d.stage())
                            .orElseGet(() -> StageConfig.builder()
                                    .code(d.stage()).enabled(true).order(d.defaultOrder()).build());
                    return WorkflowStageResponse.builder()
                            .code(d.stage().name())
                            .label(d.defaultLabel())
                            .route(d.route())
                            .extraRoutes(d.extraRoutes())
                            .navPermission(d.navPermission())
                            .actionPermission(d.actionPermission())
                            .requires(d.requires().stream().map(Enum::name).sorted().toList())
                            .required(d.required())
                            .enabled(sc.isEnabled())
                            .order(sc.getOrder() > 0 ? sc.getOrder() : d.defaultOrder())
                            .options(sc.getOptions())
                            .build();
                })
                .sorted(Comparator.comparingInt(WorkflowStageResponse::getOrder))
                .toList();

        return WorkflowConfigResponse.builder()
                .schemaVersion(config.getSchemaVersion())
                .stages(stages)
                .ui(config.getUi())
                .warnings(warnings == null ? List.of() : warnings)
                .canManage(canManage)
                .build();
    }
}
