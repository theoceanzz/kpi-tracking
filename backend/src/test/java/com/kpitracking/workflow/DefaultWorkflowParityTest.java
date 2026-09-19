package com.kpitracking.workflow;

import com.kpitracking.enums.AdjustmentStatus;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.workflow.def.Transition;
import com.kpitracking.workflow.def.WorkflowDefinition;
import com.kpitracking.workflow.def.WorkflowDefinitionFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.EnumSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Chốt cam kết trung tâm của cả module: <b>cấu hình mặc định phải tái hiện đúng luồng đang chạy</b>.
 *
 * <p>Không có lớp test này thì việc chuyển bốn service sang máy trạng thái chỉ là lời hứa suông —
 * một trạng thái gõ nhầm trong bảng chuyển sẽ âm thầm đổi hành vi của mọi tổ chức đang dùng, mà
 * không test nào bắt được vì các test cũ chỉ soi phần thẩm quyền.
 *
 * <p>Các trạng thái mong đợi dưới đây chép từ chính code cũ, không suy diễn: xem
 * {@code KpiCriteriaService.bulkSubmitForApproval/approveKpi/rejectKpi/revertApproval},
 * {@code KpiSubmissionService.updateSubmission/reviewSubmission} và
 * {@code KpiAdjustmentService.reviewRequest}.
 */
class DefaultWorkflowParityTest {

    private WorkflowDefinitionFactory factory;
    private WorkflowDefinition def;

    @BeforeEach
    void setUp() {
        factory = new WorkflowDefinitionFactory(new StageRegistry());
        def = factory.buildDefault();
    }

    // ── Chỉ tiêu ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Chỉ tiêu: gửi duyệt đi từ NHÁP hoặc BỊ TỪ CHỐI sang CHỜ PHÊ DUYỆT")
    void submitCriteria() {
        assertCriteria(WorkflowAction.SUBMIT_CRITERIA,
                EnumSet.of(KpiStatus.DRAFT, KpiStatus.REJECTED), KpiStatus.PENDING_APPROVAL);
    }

    @Test
    @DisplayName("Chỉ tiêu: chỉ duyệt/từ chối được bản đang CHỜ PHÊ DUYỆT")
    void approveAndRejectCriteria() {
        assertCriteria(WorkflowAction.APPROVE_CRITERIA,
                EnumSet.of(KpiStatus.PENDING_APPROVAL), KpiStatus.APPROVED);
        assertCriteria(WorkflowAction.REJECT_CRITERIA,
                EnumSet.of(KpiStatus.PENDING_APPROVAL), KpiStatus.REJECTED);
    }

    @Test
    @DisplayName("Chỉ tiêu: hoàn duyệt chỉ áp dụng cho bản ĐÃ DUYỆT và đưa về CHỜ PHÊ DUYỆT")
    void revertCriteria() {
        assertCriteria(WorkflowAction.REVERT_CRITERIA_APPROVAL,
                EnumSet.of(KpiStatus.APPROVED), KpiStatus.PENDING_APPROVAL);
    }

    @Test
    @DisplayName("Chỉ tiêu: vòng điều chỉnh ĐÃ DUYỆT -> ĐANG SỬA -> ĐÃ SỬA, từ chối thì quay lại ĐÃ DUYỆT")
    void adjustmentLoopOnCriteria() {
        assertCriteria(WorkflowAction.REQUEST_ADJUSTMENT,
                EnumSet.of(KpiStatus.APPROVED), KpiStatus.EDIT);
        assertCriteria(WorkflowAction.APPROVE_ADJUSTMENT,
                EnumSet.of(KpiStatus.EDIT), KpiStatus.EDITED);
        assertCriteria(WorkflowAction.REJECT_ADJUSTMENT,
                EnumSet.of(KpiStatus.EDIT), KpiStatus.APPROVED);
    }

    // ── Bản nộp ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Bản nộp: sửa lại bản NHÁP hoặc BỊ TỪ CHỐI thì chuyển sang CHỜ DUYỆT")
    void updateSubmission() {
        Transition<SubmissionStatus> t = def.submission().find(WorkflowAction.UPDATE_SUBMISSION).orElseThrow();
        assertThat(t.from()).isEqualTo(Set.of(SubmissionStatus.DRAFT, SubmissionStatus.REJECTED));
        assertThat(t.to()).isEqualTo(SubmissionStatus.PENDING);
    }

    @Test
    @DisplayName("Bản nộp: duyệt lại bản ĐÃ DUYỆT hoặc TỪ CHỐI vẫn được — đó là đường ghi đè có chủ ý, không phải sơ suất")
    void reviewSubmissionAllowsOverride() {
        Transition<SubmissionStatus> approve = def.submission().find(WorkflowAction.APPROVE_SUBMISSION).orElseThrow();
        assertThat(approve.from())
                .containsExactlyInAnyOrder(SubmissionStatus.PENDING, SubmissionStatus.APPROVED, SubmissionStatus.REJECTED);
        assertThat(approve.to()).isEqualTo(SubmissionStatus.APPROVED);

        Transition<SubmissionStatus> reject = def.submission().find(WorkflowAction.REJECT_SUBMISSION).orElseThrow();
        assertThat(reject.from())
                .containsExactlyInAnyOrder(SubmissionStatus.PENDING, SubmissionStatus.APPROVED, SubmissionStatus.REJECTED);
        assertThat(reject.to()).isEqualTo(SubmissionStatus.REJECTED);
    }

    @Test
    @DisplayName("Bản nộp: KHÔNG có đường quay về NHÁP — lỗ hổng cũ cho client tự chọn trạng thái đích")
    void noPathBackToDraft() {
        // reviewSubmission cũ ghi thẳng request.getStatus() nên gọi API đặt được PENDING -> DRAFT.
        // Đi qua bảng chuyển thì chỉ những đích khai báo sẵn mới tới được.
        assertThat(def.submission().transitions())
                .noneMatch(t -> t.to() == SubmissionStatus.DRAFT);
    }

    // ── Yêu cầu điều chỉnh ───────────────────────────────────────────────────

    @Test
    @DisplayName("Yêu cầu điều chỉnh: chỉ xử lý được bản đang CHỜ")
    void adjustmentRequest() {
        Transition<AdjustmentStatus> approve = def.adjustment().find(WorkflowAction.APPROVE_ADJUSTMENT).orElseThrow();
        assertThat(approve.from()).isEqualTo(Set.of(AdjustmentStatus.PENDING));
        assertThat(approve.to()).isEqualTo(AdjustmentStatus.APPROVED);

        Transition<AdjustmentStatus> reject = def.adjustment().find(WorkflowAction.REJECT_ADJUSTMENT).orElseThrow();
        assertThat(reject.from()).isEqualTo(Set.of(AdjustmentStatus.PENDING));
        assertThat(reject.to()).isEqualTo(AdjustmentStatus.REJECTED);
    }

    // ── Cấu hình mặc định ────────────────────────────────────────────────────

    @Test
    @DisplayName("Mặc định: mọi bước đều BẬT, nên tổ chức chưa cấu hình gì thì không đổi hành vi")
    void everyStageEnabledByDefault() {
        for (WorkflowStage stage : WorkflowStage.values()) {
            assertThat(def.isStageEnabled(stage))
                    .as("bước %s phải bật ở cấu hình mặc định", stage)
                    .isTrue();
        }
    }

    @Test
    @DisplayName("Mặc định: tuỳ chọn khớp các hằng số vốn viết cứng trong service")
    void defaultOptionsMatchOldConstants() {
        assertThat(def.stageConfig(WorkflowStage.CRITERIA_APPROVAL)
                .booleanOption("allowSelfApprove", false)).isTrue();
        assertThat(def.stageConfig(WorkflowStage.CRITERIA_ADJUSTMENT)
                .intOption("autoRejectAfterHours", 0)).isEqualTo(24);
        assertThat(def.stageConfig(WorkflowStage.SUBMISSION_REVIEW)
                .stringOption("mode", "")).isEqualTo("MANUAL");
    }

    @Test
    @DisplayName("Mỗi bước trong enum đều phải có mục trong registry — thêm bước mà quên đăng ký thì hỏng ngay")
    void everyStageIsRegistered() {
        StageRegistry registry = new StageRegistry();
        for (WorkflowStage stage : WorkflowStage.values()) {
            assertThat(registry.get(stage)).isNotNull();
        }
        assertThat(registry.all()).hasSize(WorkflowStage.values().length);
    }

    private void assertCriteria(WorkflowAction action, Set<KpiStatus> from, KpiStatus to) {
        Transition<KpiStatus> t = def.criteria().find(action).orElseThrow(
                () -> new AssertionError("thiếu phép chuyển cho " + action));
        assertThat(t.from()).as("trạng thái nguồn của %s", action).isEqualTo(from);
        assertThat(t.to()).as("trạng thái đích của %s", action).isEqualTo(to);
    }
}
