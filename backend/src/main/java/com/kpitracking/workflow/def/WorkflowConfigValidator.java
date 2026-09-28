package com.kpitracking.workflow.def;

import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.workflow.StageDescriptor;
import com.kpitracking.workflow.StageRegistry;
import com.kpitracking.workflow.WorkflowStage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Specification: một cấu hình luồng chỉ hợp lệ khi thoả mọi luật dưới đây.
 *
 * <p>Lý do phải có: thứ tự các bước bị ràng buộc bởi DỮ LIỆU, không phải bởi sở thích. Không thể
 * duyệt bản nộp khi không ai nộp, không thể duyệt điều chỉnh khi không có bước duyệt chỉ tiêu để
 * mà điều chỉnh. Nếu để người dùng lưu những tổ hợp đó, backend sẽ rơi vào trạng thái không có
 * đường đi tiếp và bế tắc im lặng.
 *
 * <p>Trả về danh sách lỗi thay vì ném ở lỗi đầu tiên, để giao diện cấu hình chỉ ra được HẾT chỗ
 * sai trong một lần lưu.
 */
@Component
@RequiredArgsConstructor
public class WorkflowConfigValidator {

    private final StageRegistry registry;

    /** Kiểm và ném nếu có lỗi. Dùng ở đường ghi (PUT /config). */
    public void validateOrThrow(WorkflowConfig config) {
        List<String> errors = validate(config);
        if (!errors.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_KPI_FLOW_CONFIGURATION, String.join("; ", errors));
        }
    }

    /** Kiểm và trả danh sách lỗi (rỗng nghĩa là hợp lệ). Dùng để hiện cảnh báo tại chỗ ở giao diện. */
    public List<String> validate(WorkflowConfig config) {
        List<String> errors = new ArrayList<>();
        if (config == null) return errors;

        for (StageDescriptor d : registry.all()) {
            WorkflowStage stage = d.stage();
            boolean enabled = config.isEnabled(stage);

            // Luật 1: bước lõi không tắt được.
            if (!enabled && d.required()) {
                errors.add(ErrorMessages.text("workflow.stageRequired", "stageRequired", d.defaultLabel()));
                continue;
            }

            // Luật 2: bước đang bật thì mọi bước nó phụ thuộc cũng phải bật.
            if (enabled) {
                for (WorkflowStage req : d.requires()) {
                    if (!config.isEnabled(req)) {
                        errors.add(ErrorMessages.text("workflow.stageNeeds", "stageNeeds", d.defaultLabel(), registry.get(req).defaultLabel()));
                    }
                }
            }
        }

        errors.addAll(validateOptions(config));
        return errors;
    }

    /** Luật 3: giá trị tuỳ chọn phải nằm trong tập được hỗ trợ. */
    private List<String> validateOptions(WorkflowConfig config) {
        List<String> errors = new ArrayList<>();

        config.stage(WorkflowStage.CRITERIA_APPROVAL).ifPresent(sc -> {
            String mode = sc.stringOption("approverMode", "CHAIN");
            if (!List.of("CHAIN", "UNIT_HEAD", "ANY_WITH_PERMISSION").contains(mode)) {
                errors.add(ErrorMessages.text("workflow.invalidApproverMode", "invalidApproverMode", mode));
            }
            int days = sc.intOption("reminderAfterDays", 3);
            if (days < 1 || days > 60) {
                errors.add(ErrorMessages.text("workflow.reminderDaysRange", "reminderDaysRange"));
            }
        });

        config.stage(WorkflowStage.CRITERIA_ADJUSTMENT).ifPresent(sc -> {
            int hours = sc.intOption("autoRejectAfterHours", 24);
            if (hours < 1 || hours > 720) {
                errors.add(ErrorMessages.text("workflow.autoRejectHoursRange", "autoRejectHoursRange"));
            }
        });

        config.stage(WorkflowStage.SUBMISSION_REVIEW).ifPresent(sc -> {
            String mode = sc.stringOption("mode", "MANUAL");
            if (!List.of("MANUAL", "AUTO_APPROVE", "AUTO_APPROVE_ON_TARGET_MET").contains(mode)) {
                errors.add(ErrorMessages.text("workflow.invalidReviewMode", "invalidReviewMode", mode));
            }
        });

        return errors;
    }
}
