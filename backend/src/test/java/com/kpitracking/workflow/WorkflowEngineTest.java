package com.kpitracking.workflow;

import com.kpitracking.entity.User;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.workflow.def.StageConfig;
import com.kpitracking.workflow.def.WorkflowConfig;
import com.kpitracking.workflow.def.WorkflowDefinition;
import com.kpitracking.workflow.def.WorkflowDefinitionFactory;
import com.kpitracking.workflow.engine.GuardResult;
import com.kpitracking.workflow.engine.TransitionContext;
import com.kpitracking.workflow.engine.WorkflowEngine;
import com.kpitracking.workflow.guard.TransitionGuard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Máy trạng thái: cái gì đi qua, cái gì bị chặn, và bị chặn theo THỨ TỰ nào. */
class WorkflowEngineTest {

    private WorkflowDefinitionFactory factory;
    private WorkflowEngine engine;
    private User actor;

    @BeforeEach
    void setUp() {
        StageRegistry registry = new StageRegistry();
        factory = new WorkflowDefinitionFactory(registry);
        engine = new WorkflowEngine(registry);
        actor = new User();
        actor.setId(UUID.randomUUID());
    }

    @Test
    @DisplayName("Phép chuyển hợp lệ trả về trạng thái đích")
    void allowsValidTransition() {
        WorkflowDefinition def = factory.buildDefault();
        KpiStatus next = engine.resolve(def.criteria(),
                ctx(def, WorkflowAction.APPROVE_CRITERIA, KpiStatus.PENDING_APPROVAL), List.of());
        assertThat(next).isEqualTo(KpiStatus.APPROVED);
    }

    @Test
    @DisplayName("Sai trạng thái nguồn thì bị chặn, kèm câu mô tả trạng thái hiện tại")
    void rejectsWrongSourceStatus() {
        WorkflowDefinition def = factory.buildDefault();
        assertThatThrownBy(() -> engine.resolve(def.criteria(),
                ctx(def, WorkflowAction.APPROVE_CRITERIA, KpiStatus.DRAFT), List.of()))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("DRAFT")
                .hasMessageContaining("PENDING_APPROVAL");
    }

    @Test
    @DisplayName("Bước bị tắt thì thông báo nói ĐÚNG nguyên nhân gốc, không đổ lỗi cho trạng thái")
    void disabledStageExplainsItself() {
        WorkflowDefinition def = factory.build(disabling(WorkflowStage.CRITERIA_APPROVAL));

        // Trạng thái ở đây vốn HỢP LỆ với phép duyệt. Nếu engine kiểm trạng thái trước, người dùng
        // sẽ nhận một thông báo đúng về mặt kỹ thuật nhưng vô nghĩa với họ.
        assertThatThrownBy(() -> engine.resolve(def.criteria(),
                ctx(def, WorkflowAction.APPROVE_CRITERIA, KpiStatus.PENDING_APPROVAL), List.of()))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("đã tắt bước")
                .hasMessageContaining("Duyệt chỉ tiêu");
    }

    @Test
    @DisplayName("Tắt bước thì mọi hành động của bước đó biến khỏi bảng chuyển")
    void disabledStageRemovesItsActions() {
        WorkflowDefinition def = factory.build(disabling(WorkflowStage.CRITERIA_APPROVAL));

        assertThat(def.criteria().supports(WorkflowAction.APPROVE_CRITERIA)).isFalse();
        assertThat(def.criteria().supports(WorkflowAction.REJECT_CRITERIA)).isFalse();
        assertThat(def.criteria().supports(WorkflowAction.SUBMIT_CRITERIA)).isFalse();
        assertThat(def.criteria().supports(WorkflowAction.REVERT_CRITERIA_APPROVAL)).isFalse();

        // Bước điều chỉnh không bị tắt nên hành động của nó vẫn còn.
        assertThat(def.criteria().supports(WorkflowAction.REQUEST_ADJUSTMENT)).isTrue();
    }

    @Test
    @DisplayName("Guard thẩm quyền từ chối thì ra 403, guard nghiệp vụ từ chối thì ra 422")
    void guardKindDecidesExceptionType() {
        WorkflowDefinition def = factory.buildDefault();
        TransitionGuard forbid = c -> GuardResult.forbidden("không đủ thẩm quyền");
        TransitionGuard reject = c -> GuardResult.reject("chưa đủ điều kiện");

        assertThatThrownBy(() -> engine.resolve(def.criteria(),
                ctx(def, WorkflowAction.APPROVE_CRITERIA, KpiStatus.PENDING_APPROVAL), List.of(forbid)))
                .isInstanceOf(ForbiddenException.class);

        assertThatThrownBy(() -> engine.resolve(def.criteria(),
                ctx(def, WorkflowAction.APPROVE_CRITERIA, KpiStatus.PENDING_APPROVAL),
                List.of(), List.of(reject)))
                .isInstanceOf(BusinessException.class)
                .hasMessage("chưa đủ điều kiện");
    }

    @Test
    @DisplayName("Thẩm quyền kiểm TRƯỚC trạng thái — người không có quyền không được biết bản ghi đang ở đâu")
    void authorityIsCheckedBeforeStatus() {
        // Đây là hành vi quan sát được của code cũ, không phải chi tiết nội bộ: mọi service đều
        // kiểm quyền rồi mới kiểm trạng thái. Đảo lại sẽ biến 403 thành 422 và làm lộ trạng thái
        // bản ghi cho người vốn không được xem.
        WorkflowDefinition def = factory.buildDefault();
        List<String> order = new ArrayList<>();
        TransitionGuard authority = c -> {
            order.add("authority");
            return GuardResult.forbidden("chặn");
        };

        assertThatThrownBy(() -> engine.resolve(def.criteria(),
                // trạng thái SAI với phép duyệt: nếu trạng thái được kiểm trước thì guard không
                // bao giờ chạy và danh sách order sẽ rỗng.
                ctx(def, WorkflowAction.APPROVE_CRITERIA, KpiStatus.DRAFT), List.of(authority)))
                .isInstanceOf(ForbiddenException.class);

        assertThat(order).containsExactly("authority");
    }

    @Test
    @DisplayName("Guard nghiệp vụ chỉ chạy SAU khi trạng thái đã hợp lệ")
    void invariantsRunOnlyAfterStatusPasses() {
        WorkflowDefinition def = factory.buildDefault();
        List<String> ran = new ArrayList<>();
        TransitionGuard invariant = c -> {
            ran.add("invariant");
            return GuardResult.ok();
        };

        assertThatThrownBy(() -> engine.resolve(def.criteria(),
                ctx(def, WorkflowAction.APPROVE_CRITERIA, KpiStatus.DRAFT), List.of(), List.of(invariant)))
                .isInstanceOf(BusinessException.class);

        assertThat(ran).isEmpty();
    }

    @Test
    @DisplayName("Thông báo riêng cho lỗi trạng thái được giữ nguyên, để câu chữ cũ không đổi")
    void customStatusMessageIsHonoured() {
        WorkflowDefinition def = factory.buildDefault();
        TransitionContext<KpiStatus> ctx = TransitionContext.<KpiStatus>builder()
                .definition(def)
                .action(WorkflowAction.APPROVE_CRITERIA)
                .currentStatus(KpiStatus.DRAFT)
                .actor(actor)
                .statusRejectionMessage("Chỉ có thể phê duyệt KPI ở trạng thái CHỜ PHÊ DUYỆT")
                .build();

        assertThatThrownBy(() -> engine.resolve(def.criteria(), ctx, List.of()))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Chỉ có thể phê duyệt KPI ở trạng thái CHỜ PHÊ DUYỆT");
    }

    @Test
    @DisplayName("canResolve trả lời được/không mà không ném — dùng cho nút bấm và đường hàng loạt")
    void canResolveDoesNotThrow() {
        WorkflowDefinition def = factory.buildDefault();
        assertThat(engine.canResolve(def.criteria(),
                ctx(def, WorkflowAction.SUBMIT_CRITERIA, KpiStatus.DRAFT))).isTrue();
        assertThat(engine.canResolve(def.criteria(),
                ctx(def, WorkflowAction.SUBMIT_CRITERIA, KpiStatus.APPROVED))).isFalse();

        WorkflowDefinition off = factory.build(disabling(WorkflowStage.CRITERIA_APPROVAL));
        assertThat(engine.canResolve(off.criteria(),
                ctx(off, WorkflowAction.SUBMIT_CRITERIA, KpiStatus.DRAFT))).isFalse();
    }

    // ── tiện ích ─────────────────────────────────────────────────────────────

    private TransitionContext<KpiStatus> ctx(WorkflowDefinition def, WorkflowAction action, KpiStatus current) {
        return TransitionContext.<KpiStatus>builder()
                .definition(def)
                .action(action)
                .currentStatus(current)
                .actor(actor)
                .orgUnitId(UUID.randomUUID())
                .build();
    }

    private WorkflowConfig disabling(WorkflowStage stage) {
        return WorkflowConfig.builder()
                .stages(List.of(StageConfig.builder().code(stage).enabled(false).build()))
                .build();
    }
}
