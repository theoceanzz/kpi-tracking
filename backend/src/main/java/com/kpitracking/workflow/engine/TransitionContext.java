package com.kpitracking.workflow.engine;

import com.kpitracking.entity.User;
import com.kpitracking.workflow.WorkflowAction;
import com.kpitracking.workflow.def.WorkflowDefinition;
import lombok.Builder;
import lombok.Getter;

import java.util.UUID;

/**
 * Mọi thứ một guard cần để phán xét, gom vào một chỗ.
 *
 * <p>{@code targetOwnerId} tách riêng khỏi {@code target} vì luật cấp bậc so người thao tác với
 * NGƯỜI SỞ HỮU việc, mà người sở hữu lại là trường khác nhau tuỳ thực thể: người tạo với chỉ tiêu,
 * người nộp với bản nộp. Để guard tự đi tìm thì nó phải biết mọi kiểu thực thể, và thế là mất
 * đúng cái tính dùng chung khiến nó đáng tồn tại.
 *
 * @param <S> kiểu enum trạng thái của thực thể đang chuyển
 */
@Getter
@Builder
public class TransitionContext<S extends Enum<S>> {

    private final WorkflowDefinition definition;
    private final WorkflowAction action;

    /** Trạng thái hiện tại. {@code null} khi đang TẠO MỚI (chưa có trạng thái nào). */
    private final S currentStatus;

    private final User actor;

    /** Đơn vị mà hành động diễn ra trong đó — trục để kiểm quyền theo phạm vi. */
    private final UUID orgUnitId;

    /** Thực thể đang bị tác động (KpiCriteria / KpiSubmission / KpiAdjustmentRequest). */
    private final Object target;

    /** Người sở hữu việc: người tạo chỉ tiêu, người nộp báo cáo. Có thể {@code null}. */
    private final UUID targetOwnerId;

    /**
     * Thông báo riêng khi trạng thái hiện tại không nhận hành động này.
     *
     * <p>Có mặt để giữ nguyên câu chữ mà người dùng đang thấy ("Chỉ có thể phê duyệt KPI ở trạng
     * thái CHỜ PHÊ DUYỆT"). Bỏ trống thì engine tự sinh câu mô tả kèm trạng thái hiện tại.
     */
    private final String statusRejectionMessage;

    public UUID actorId() {
        return actor == null ? null : actor.getId();
    }
}
