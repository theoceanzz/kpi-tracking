package com.kpitracking.workflow.def;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.kpitracking.workflow.WorkflowStage;
import lombok.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * DẠNG LƯU của cấu hình luồng — đúng những gì nằm trong cột {@code kpi_workflow_configs.definition}.
 *
 * <p>Tách khỏi {@link WorkflowDefinition} (dạng CHẠY) có chủ đích: dạng lưu chỉ là ý muốn của tổ
 * chức, còn các bảng chuyển trạng thái là thứ SUY RA từ ý muốn đó. Suy ra chứ không lưu, nên
 * không bao giờ có chuyện cấu hình nói một đằng máy trạng thái chạy một nẻo.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class WorkflowConfig {

    @Builder.Default
    private int schemaVersion = 1;

    @Builder.Default
    private List<StageConfig> stages = new ArrayList<>();

    @Builder.Default
    private WorkflowUiConfig ui = WorkflowUiConfig.defaults();

    public Optional<StageConfig> stage(WorkflowStage stage) {
        if (stages == null) return Optional.empty();
        return stages.stream().filter(s -> s.getCode() == stage).findFirst();
    }

    /** Bước không được nhắc tới trong cấu hình coi như BẬT — cấu hình thiếu không được âm thầm tắt bước. */
    public boolean isEnabled(WorkflowStage stage) {
        return stage(stage).map(StageConfig::isEnabled).orElse(true);
    }
}
