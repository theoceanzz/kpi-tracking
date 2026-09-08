package com.kpitracking.workflow.engine;

import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.workflow.StageRegistry;
import com.kpitracking.workflow.WorkflowStage;
import com.kpitracking.workflow.def.StateMachine;
import com.kpitracking.workflow.def.Transition;
import com.kpitracking.workflow.guard.TransitionGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Chạy một phép chuyển trạng thái: kiểm bước có bật không, tra bảng chuyển, chạy chuỗi guard,
 * rồi TRẢ VỀ trạng thái đích.
 *
 * <p>Engine cố ý KHÔNG tự ghi vào thực thể và KHÔNG tự phát sự kiện. Việc gán trạng thái, gán
 * {@code approvedBy/reviewedAt}, lưu, rồi {@code publishEvent} vẫn nằm trong service như cũ. Nhờ
 * ranh giới đó, chuyển từng service sang engine được từng phần mà không phải viết lại đường ghi,
 * và các {@code @TransactionalEventListener} hiện có không đổi một dòng nào.
 *
 * <p>Guard chia hai nhóm chạy trước/sau phép kiểm trạng thái, vì THỨ TỰ KIỂM là hành vi quan sát
 * được: code cũ luôn kiểm thẩm quyền trước trạng thái, nên người không có quyền nhận 403 chứ
 * không phải 422 kể cả khi bản ghi đang ở trạng thái sai. Gộp một chuỗi duy nhất sẽ âm thầm đảo
 * thứ tự đó và làm lộ trạng thái bản ghi cho người vốn không được xem.
 */
@Component
@RequiredArgsConstructor
public class WorkflowEngine {

    private final StageRegistry registry;

    /**
     * @param authorityGuards kiểm THẨM QUYỀN — chạy trước phép kiểm trạng thái
     * @param invariantGuards kiểm RÀNG BUỘC NGHIỆP VỤ — chạy sau, khi đã chắc người gọi có quyền
     * @return trạng thái đích nếu mọi guard thông
     * @throws BusinessException  bước bị tắt, hành động không có trong bảng, trạng thái không nhận,
     *                            hoặc vi phạm ràng buộc nghiệp vụ
     * @throws ForbiddenException người thao tác không đủ thẩm quyền
     */
    public <S extends Enum<S>> S resolve(StateMachine<S> machine,
                                         TransitionContext<S> ctx,
                                         List<TransitionGuard> authorityGuards,
                                         List<TransitionGuard> invariantGuards) {

        WorkflowStage stage = ctx.getAction().getStage();

        // 1. Bước bị tổ chức tắt. Kiểm trước mọi thứ khác để thông báo nói đúng nguyên nhân gốc,
        //    thay vì đổ lỗi cho trạng thái hiện tại của bản ghi.
        if (!ctx.getDefinition().isStageEnabled(stage)) {
            throw new BusinessException("Tổ chức đã tắt bước \""
                    + registry.get(stage).defaultLabel() + "\" trong cấu hình luồng KPI");
        }

        // 2. Hành động không có trong bảng chuyển.
        Transition<S> transition = machine.find(ctx.getAction())
                .orElseThrow(() -> new BusinessException("Hành động \"" + ctx.getAction()
                        + "\" không nằm trong luồng KPI hiện hành của tổ chức"));

        // 3. Thẩm quyền — trước trạng thái, đúng như code cũ.
        run(authorityGuards, ctx);

        // 4. Trạng thái hiện tại có nhận hành động này không.
        if (!transition.accepts(ctx.getCurrentStatus())) {
            throw new BusinessException(ctx.getStatusRejectionMessage() != null
                    ? ctx.getStatusRejectionMessage()
                    : describeRejection(transition, ctx));
        }

        // 5. Ràng buộc nghiệp vụ.
        run(invariantGuards, ctx);

        return transition.to();
    }

    /** Bản gọn khi chỉ có guard thẩm quyền. */
    public <S extends Enum<S>> S resolve(StateMachine<S> machine,
                                         TransitionContext<S> ctx,
                                         List<TransitionGuard> authorityGuards) {
        return resolve(machine, ctx, authorityGuards, List.of());
    }

    /** Kiểm mà không ném — dùng khi cần biết một hành động có khả dụng không (nút bấm, gợi ý việc). */
    public <S extends Enum<S>> boolean canResolve(StateMachine<S> machine, TransitionContext<S> ctx) {
        if (!ctx.getDefinition().isStageEnabled(ctx.getAction().getStage())) return false;
        return machine.find(ctx.getAction())
                .map(t -> t.accepts(ctx.getCurrentStatus()))
                .orElse(false);
    }

    private void run(List<TransitionGuard> guards, TransitionContext<?> ctx) {
        if (guards == null) return;
        for (TransitionGuard guard : guards) {
            GuardResult result = guard.check(ctx);
            if (result.denied()) {
                throw result.kind() == GuardResult.Kind.FORBIDDEN
                        ? new ForbiddenException(result.message())
                        : new BusinessException(result.message());
            }
        }
    }

    private <S extends Enum<S>> String describeRejection(Transition<S> transition, TransitionContext<S> ctx) {
        String allowed = transition.from().stream().map(Enum::name).sorted()
                .reduce((a, b) -> a + ", " + b).orElse("");
        String current = ctx.getCurrentStatus() == null ? "chưa có" : ctx.getCurrentStatus().name();
        return "Không thực hiện được ở trạng thái hiện tại (" + current
                + "). Chỉ áp dụng cho trạng thái: " + allowed;
    }
}
