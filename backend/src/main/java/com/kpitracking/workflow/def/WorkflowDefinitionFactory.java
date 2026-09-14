package com.kpitracking.workflow.def;

import com.kpitracking.enums.AdjustmentStatus;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.workflow.StageDescriptor;
import com.kpitracking.workflow.StageRegistry;
import com.kpitracking.workflow.WorkflowAction;
import com.kpitracking.workflow.WorkflowStage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Dựng {@link WorkflowDefinition} từ cấu hình của tổ chức.
 *
 * <p><b>Cam kết quan trọng nhất của cả module:</b> {@link #defaultConfig()} tái hiện ĐÚNG luồng
 * đang chạy hôm nay. Tổ chức chưa có bản ghi cấu hình thì dùng nó, nên triển khai bản này lên
 * production không đổi hành vi của bất kỳ tổ chức nào. {@code DefaultWorkflowParityTest} canh
 * đúng điều đó.
 *
 * <p>Cách tắt một bước cũng gọn theo: dựng bảng chuyển ĐẦY ĐỦ rồi lọc bỏ những hành động thuộc
 * bước đã tắt. Không có nhánh {@code if} riêng cho từng bước, nên thêm bước mới về sau không phải
 * sửa chỗ này.
 */
@Component
@RequiredArgsConstructor
public class WorkflowDefinitionFactory {

    private final StageRegistry registry;

    // ---- Bảng chuyển MẶC ĐỊNH: chép đúng luật đang chạy trong các service ----

    /**
     * KpiCriteria. Nguồn: {@code KpiCriteriaService.bulkSubmitForApproval / approveKpi / rejectKpi /
     * revertApproval} và {@code KpiAdjustmentService.createRequest / reviewRequest}.
     */
    private static List<Transition<KpiStatus>> defaultCriteriaTransitions() {
        return List.of(
                new Transition<>(WorkflowAction.SUBMIT_CRITERIA,
                        EnumSet.of(KpiStatus.DRAFT, KpiStatus.REJECTED), KpiStatus.PENDING_APPROVAL),
                new Transition<>(WorkflowAction.APPROVE_CRITERIA,
                        EnumSet.of(KpiStatus.PENDING_APPROVAL), KpiStatus.APPROVED),
                new Transition<>(WorkflowAction.REJECT_CRITERIA,
                        EnumSet.of(KpiStatus.PENDING_APPROVAL), KpiStatus.REJECTED),
                new Transition<>(WorkflowAction.REVERT_CRITERIA_APPROVAL,
                        EnumSet.of(KpiStatus.APPROVED), KpiStatus.PENDING_APPROVAL),
                new Transition<>(WorkflowAction.REQUEST_ADJUSTMENT,
                        EnumSet.of(KpiStatus.APPROVED), KpiStatus.EDIT),
                new Transition<>(WorkflowAction.APPROVE_ADJUSTMENT,
                        EnumSet.of(KpiStatus.EDIT), KpiStatus.EDITED),
                // Từ chối điều chỉnh trả KPI về trạng thái TRƯỚC khi vào EDIT. Đích ghi ở đây là
                // APPROVED vì đó là trường hợp gần như luôn đúng; giá trị thật lấy từ
                // previousKpiStatus (Memento) khi có -- xem KpiAdjustmentService.
                new Transition<>(WorkflowAction.REJECT_ADJUSTMENT,
                        EnumSet.of(KpiStatus.EDIT), KpiStatus.APPROVED)
        );
    }

    /**
     * KpiSubmission. Nguồn: {@code KpiSubmissionService.updateSubmission / reviewSubmission}.
     *
     * <p>Cho phép duyệt lại bản đã APPROVED là có chủ ý: đó là đường ghi đè mà
     * {@code requireCanReview} bảo vệ bằng luật cấp bậc, không phải sơ suất. Bản đã REJECTED
     * cũng chấm lại được: trưởng đơn vị chấm điểm theo đợt vẫn thấy bản bị từ chối trong danh
     * sách, nếu chặn ở đây thì họ không có cách nào chấm hay sửa quyết định cho bản đó.
     */
    private static List<Transition<SubmissionStatus>> defaultSubmissionTransitions() {
        return List.of(
                new Transition<>(WorkflowAction.UPDATE_SUBMISSION,
                        EnumSet.of(SubmissionStatus.DRAFT, SubmissionStatus.REJECTED),
                        SubmissionStatus.PENDING),
                new Transition<>(WorkflowAction.APPROVE_SUBMISSION,
                        EnumSet.of(SubmissionStatus.PENDING, SubmissionStatus.APPROVED, SubmissionStatus.REJECTED),
                        SubmissionStatus.APPROVED),
                new Transition<>(WorkflowAction.REJECT_SUBMISSION,
                        EnumSet.of(SubmissionStatus.PENDING, SubmissionStatus.APPROVED, SubmissionStatus.REJECTED),
                        SubmissionStatus.REJECTED)
        );
    }

    /** KpiAdjustmentRequest. Nguồn: {@code KpiAdjustmentService.reviewRequest / autoRejectExpiredRequests}. */
    private static List<Transition<AdjustmentStatus>> defaultAdjustmentTransitions() {
        return List.of(
                new Transition<>(WorkflowAction.APPROVE_ADJUSTMENT,
                        EnumSet.of(AdjustmentStatus.PENDING), AdjustmentStatus.APPROVED),
                new Transition<>(WorkflowAction.REJECT_ADJUSTMENT,
                        EnumSet.of(AdjustmentStatus.PENDING), AdjustmentStatus.REJECTED)
        );
    }

    // ---- Cấu hình mặc định ----

    /** Mọi bước bật, thứ tự như registry, tuỳ chọn khớp các hằng số đang hardcode trong service. */
    public WorkflowConfig defaultConfig() {
        List<StageConfig> stages = new ArrayList<>();
        for (StageDescriptor d : registry.all()) {
            stages.add(StageConfig.builder()
                    .code(d.stage())
                    .enabled(true)
                    .order(d.defaultOrder())
                    .options(defaultOptions(d.stage()))
                    .build());
        }
        return WorkflowConfig.builder()
                .schemaVersion(1)
                .stages(stages)
                .ui(WorkflowUiConfig.defaults())
                .build();
    }

    private static Map<String, Object> defaultOptions(WorkflowStage stage) {
        Map<String, Object> o = new LinkedHashMap<>();
        switch (stage) {
            case CRITERIA_APPROVAL -> {
                // UNIT_HEAD = luật "người duyệt phải cấp/chức vụ cao hơn người tạo" đang chạy.
                o.put("approverMode", "UNIT_HEAD");
                // Giữ đường tắt của quyền KPI:APPROVE_OWN: có quyền thì KPI tạo ra đã APPROVED.
                o.put("allowSelfApprove", true);
            }
            // Thay cho số 24 hardcode trong autoRejectExpiredRequests.
            case CRITERIA_ADJUSTMENT -> o.put("autoRejectAfterHours", 24);
            case SUBMISSION -> {
                o.put("allowDraft", true);
                o.put("requireAttachment", false);
                o.put("lockAfterDeadline", false);
            }
            case SUBMISSION_REVIEW -> o.put("mode", "MANUAL");
            default -> { /* các bước còn lại chưa có tuỳ chọn nào */ }
        }
        return o;
    }

    // ---- Dựng dạng chạy ----

    /** Nở cấu hình thành các bảng chuyển. {@code null} nghĩa là tổ chức chưa cấu hình gì. */
    public WorkflowDefinition build(WorkflowConfig config) {
        WorkflowConfig effective = merge(config);
        return new WorkflowDefinition(
                effective,
                StateMachine.of(enabledOnly(defaultCriteriaTransitions(), effective)),
                StateMachine.of(enabledOnly(defaultSubmissionTransitions(), effective)),
                StateMachine.of(enabledOnly(defaultAdjustmentTransitions(), effective))
        );
    }

    public WorkflowDefinition buildDefault() {
        return build(null);
    }

    private <S extends Enum<S>> List<Transition<S>> enabledOnly(List<Transition<S>> all, WorkflowConfig config) {
        return all.stream()
                .filter(t -> config.isEnabled(t.action().getStage()))
                .toList();
    }

    /**
     * Template Method: lấy mặc định làm nền rồi phủ ý muốn của tổ chức lên trên.
     * Bước nào tổ chức không nhắc tới thì giữ nguyên mặc định, nên cấu hình cũ thiếu trường mới
     * vẫn chạy đúng sau khi nâng cấp mà không cần backfill dữ liệu.
     */
    public WorkflowConfig merge(WorkflowConfig override) {
        WorkflowConfig base = defaultConfig();
        if (override == null || override.getStages() == null || override.getStages().isEmpty()) {
            return base;
        }
        for (StageConfig o : override.getStages()) {
            if (o == null || o.getCode() == null) continue;
            base.stage(o.getCode()).ifPresent(b -> {
                b.setEnabled(o.isEnabled());
                if (o.getOrder() > 0) b.setOrder(o.getOrder());
                if (o.getOptions() != null && !o.getOptions().isEmpty()) {
                    b.getOptions().putAll(o.getOptions());
                }
            });
        }
        if (override.getUi() != null) {
            base.setUi(override.getUi());
        }
        // Bước lõi không bao giờ tắt được, kể cả khi dữ liệu cũ trong DB nói ngược lại.
        registry.requiredStages().forEach(s -> base.stage(s).ifPresent(sc -> sc.setEnabled(true)));
        return base;
    }
}
