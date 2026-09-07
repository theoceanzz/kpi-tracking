package com.kpitracking.workflow;

import com.kpitracking.exception.BusinessException;
import com.kpitracking.workflow.def.StageConfig;
import com.kpitracking.workflow.def.WorkflowConfig;
import com.kpitracking.workflow.def.WorkflowConfigValidator;
import com.kpitracking.workflow.def.WorkflowDefinitionFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Specification: cấu hình nào lưu được, cấu hình nào không.
 *
 * <p>Quan trọng vì thứ tự các bước bị ràng buộc bởi DỮ LIỆU chứ không bởi sở thích. Lưu được một
 * tổ hợp vô nghĩa nghĩa là đẩy backend vào trạng thái không có đường đi tiếp, và nó sẽ bế tắc im
 * lặng chứ không báo gì.
 */
class WorkflowConfigValidatorTest {

    private WorkflowDefinitionFactory factory;
    private WorkflowConfigValidator validator;

    @BeforeEach
    void setUp() {
        StageRegistry registry = new StageRegistry();
        factory = new WorkflowDefinitionFactory(registry);
        validator = new WorkflowConfigValidator(registry);
    }

    @Test
    @DisplayName("Cấu hình mặc định luôn hợp lệ")
    void defaultIsValid() {
        assertThat(validator.validate(factory.defaultConfig())).isEmpty();
    }

    @Test
    @DisplayName("Tắt bước lõi thì bị từ chối — không có đợt thì cả luồng không bám vào đâu")
    void cannotDisableRequiredStage() {
        // merge() cưỡng bức bật lại bước lõi, nên kiểm trên cấu hình THÔ để thấy chính luật này.
        WorkflowConfig raw = factory.defaultConfig();
        raw.stage(WorkflowStage.PERIOD_SETUP).orElseThrow().setEnabled(false);

        assertThat(validator.validate(raw))
                .anyMatch(m -> m.contains("bắt buộc"));
    }

    @Test
    @DisplayName("Bật duyệt bản nộp mà tắt bước nộp thì bị từ chối — không ai nộp thì duyệt cái gì")
    void reviewWithoutSubmissionIsRejected() {
        WorkflowConfig raw = factory.defaultConfig();
        raw.stage(WorkflowStage.SUBMISSION).orElseThrow().setEnabled(false);

        List<String> errors = validator.validate(raw);
        assertThat(errors).anyMatch(m -> m.contains("Phê duyệt & đánh giá") && m.contains("KPI của tôi"));
    }

    @Test
    @DisplayName("Bật duyệt điều chỉnh mà tắt duyệt chỉ tiêu thì bị từ chối")
    void adjustmentWithoutApprovalIsRejected() {
        WorkflowConfig config = merged(WorkflowStage.CRITERIA_APPROVAL, false);

        assertThatThrownBy(() -> validator.validateOrThrow(config))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Duyệt điều chỉnh");
    }

    @Test
    @DisplayName("Tắt cả duyệt chỉ tiêu lẫn duyệt điều chỉnh là hợp lệ — công ty nhỏ giao KPI thẳng")
    void disablingBothApprovalStagesIsValid() {
        WorkflowConfig config = factory.merge(WorkflowConfig.builder()
                .stages(List.of(
                        StageConfig.builder().code(WorkflowStage.CRITERIA_APPROVAL).enabled(false).build(),
                        StageConfig.builder().code(WorkflowStage.CRITERIA_ADJUSTMENT).enabled(false).build()))
                .build());

        assertThatCode(() -> validator.validateOrThrow(config)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Báo HẾT lỗi trong một lần, để màn hình cấu hình không bắt sửa từng cái một")
    void reportsAllErrorsAtOnce() {
        WorkflowConfig raw = factory.defaultConfig();
        raw.stage(WorkflowStage.SUBMISSION).orElseThrow().setEnabled(false);
        raw.stage(WorkflowStage.CRITERIA_APPROVAL).orElseThrow().setEnabled(false);

        assertThat(validator.validate(raw)).hasSizeGreaterThan(1);
    }

    @Test
    @DisplayName("Giá trị tuỳ chọn ngoài tập hỗ trợ thì bị từ chối")
    void rejectsUnknownOptionValues() {
        WorkflowConfig config = factory.merge(WorkflowConfig.builder()
                .stages(List.of(
                        StageConfig.builder().code(WorkflowStage.SUBMISSION_REVIEW)
                                .enabled(true).options(Map.of("mode", "MAGIC")).build(),
                        StageConfig.builder().code(WorkflowStage.CRITERIA_ADJUSTMENT)
                                .enabled(true).options(Map.of("autoRejectAfterHours", 0)).build()))
                .build());

        List<String> errors = validator.validate(config);
        assertThat(errors).anyMatch(m -> m.contains("MAGIC"));
        assertThat(errors).anyMatch(m -> m.contains("720"));
    }

    @Test
    @DisplayName("merge() luôn bật lại bước lõi, kể cả khi dữ liệu cũ trong DB nói ngược lại")
    void mergeForcesRequiredStagesBackOn() {
        WorkflowConfig merged = factory.merge(WorkflowConfig.builder()
                .stages(List.of(StageConfig.builder()
                        .code(WorkflowStage.CRITERIA_DRAFT).enabled(false).build()))
                .build());

        assertThat(merged.isEnabled(WorkflowStage.CRITERIA_DRAFT)).isTrue();
    }

    @Test
    @DisplayName("Gửi một phần thì các bước không nhắc tới giữ nguyên cấu hình cũ")
    void partialUpdateKeepsUntouchedStages() {
        WorkflowConfig merged = factory.merge(WorkflowConfig.builder()
                .stages(List.of(StageConfig.builder()
                        .code(WorkflowStage.SELF_EVALUATION).enabled(false).build()))
                .build());

        assertThat(merged.isEnabled(WorkflowStage.SELF_EVALUATION)).isFalse();
        assertThat(merged.isEnabled(WorkflowStage.CYCLE_SETUP)).isTrue();
        assertThat(merged.stage(WorkflowStage.SUBMISSION_REVIEW).orElseThrow()
                .stringOption("mode", "")).isEqualTo("MANUAL");
    }

    private WorkflowConfig merged(WorkflowStage stage, boolean enabled) {
        return factory.merge(WorkflowConfig.builder()
                .stages(List.of(StageConfig.builder().code(stage).enabled(enabled).build()))
                .build());
    }
}
