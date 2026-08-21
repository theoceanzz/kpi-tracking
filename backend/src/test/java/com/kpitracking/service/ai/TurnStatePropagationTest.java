package com.kpitracking.service.ai;

import com.kpitracking.service.ai.form.FormPatch;
import com.kpitracking.service.ai.form.FormPatchStore;
import com.kpitracking.tool.DisambiguationGuard;
import com.kpitracking.tool.EscapeHatchTool;
import com.kpitracking.tool.ToolCallTracker;
import io.micrometer.context.ContextSnapshot;
import io.micrometer.context.ContextSnapshotFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Test cho việc mang trạng thái theo lượt sang luồng khác.
 *
 * <p><b>Vì sao cần test này.</b> Lỗi mà nó khoá lại KHÔNG ném ngoại lệ và KHÔNG làm sai câu trả lời:
 * ở lượt streaming, Spring AI chạy vòng gọi tool trên luồng reactor, nên mọi thứ tool ghi vào
 * ThreadLocal đều vô hình với chuỗi công đoạn. Triệu chứng duy nhất là các tính năng lặng lẽ biến
 * mất — bản đề xuất điền form không tới người dùng, câu hỏi gợi ý rỗng, cửa thoát hiểm ngừng chạy.
 * Đúng loại lỗi mà không ai phát hiện cho tới khi có người dùng phàn nàn.
 *
 * <p>Ở đây dùng một {@link Thread} thường thay cho luồng reactor: điều cần chứng minh là hai luồng
 * ghi và ĐỌC CÙNG MỘT chỗ, chứ không phải reactor hoạt động ra sao.
 */
class TurnStatePropagationTest {

    private final DisambiguationGuard guard = new DisambiguationGuard();

    @BeforeEach
    void setUp() {
        new TurnStatePropagation(guard).register();
    }

    @AfterEach
    void tearDown() {
        FormPatchStore.clear();
        ToolCallTracker.clear();
        EscapeHatchTool.clear();
        guard.clear();
    }

    /** Chạy việc trên luồng khác, mang theo trạng thái lượt như reactor vẫn làm. */
    private void onAnotherThread(Runnable work) throws InterruptedException {
        ContextSnapshot snapshot = ContextSnapshotFactory.builder().build().captureAll();
        Thread t = new Thread(snapshot.wrap(work), "giả-lập-luồng-reactor");
        t.start();
        t.join();
    }

    // ════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("bản đề xuất điền form ghi ở luồng khác thì luồng chạy chuỗi công đoạn ĐỌC ĐƯỢC")
    void formPatchCrossesThreads() throws InterruptedException {
        FormPatchStore.get(); // tạo hộp chứa trên luồng này trước khi chụp ngữ cảnh
        FormPatch patch = new FormPatch("kpi_form",
                List.of(new FormPatch.Entry("weight", "Trọng số (%)", 15, "15", "vì bạn yêu cầu")));

        onAnotherThread(() -> FormPatchStore.put(patch));

        assertThat(FormPatchStore.get())
                .as("mất chỗ này là tính năng gợi ý điền form im lặng ngừng hoạt động khi phát chữ dần")
                .isSameAs(patch);
    }

    @Test
    @DisplayName("tool chạy ở luồng khác vẫn được ghi nhận — nền tảng của ValidationStage và FollowupStage")
    void toolCallsCrossThreads() throws InterruptedException {
        ToolCallTracker.calls();

        onAnotherThread(() -> ToolCallTracker.record("get_org_unit"));

        assertThat(ToolCallTracker.anyCalled())
                .as("không thấy tool nào chạy thì ValidationStage chặn nhầm và FollowupStage bỏ qua")
                .isTrue();
        assertThat(ToolCallTracker.calls()).containsExactly("get_org_unit");
    }

    @Test
    @DisplayName("cửa thoát hiểm bật ở luồng khác vẫn tới được EscapeHatchStage")
    void escapeHatchCrossesThreads() throws InterruptedException {
        EscapeHatchTool.wasRequested();

        onAnotherThread(() -> new EscapeHatchTool()
                .needOtherTools(new EscapeHatchTool.NeedOtherToolsRequest("thiếu công cụ KPI"), null));

        assertThat(EscapeHatchTool.wasRequested()).isTrue();
        assertThat(EscapeHatchTool.reason()).contains("thiếu công cụ KPI");
    }

    @Test
    @DisplayName("chốt chặn hỏi-lại-khi-trùng-tên nạp ở luồng khác vẫn có hiệu lực")
    void disambiguationGuardCrossesThreads() throws InterruptedException {
        UUID id = UUID.randomUUID();
        guard.isArmed("org_units", id);

        onAnotherThread(() -> guard.arm("org_units", Set.of(id)));

        assertThat(guard.isArmed("org_units", id))
                .as("mất chỗ này thì tool chi tiết tự chọn bừa một trong nhiều đơn vị trùng tên")
                .isTrue();
    }

    @Test
    @DisplayName("luồng KHÔNG mang ngữ cảnh thì không thấy gì — chứng minh trạng thái không rò lung tung")
    void plainThreadSeesNothing() throws InterruptedException {
        ToolCallTracker.record("get_kpi");

        boolean[] seen = {true};
        Thread t = new Thread(() -> seen[0] = ToolCallTracker.anyCalled());
        t.start();
        t.join();

        assertThat(seen[0])
                .as("chỉ luồng được mang ngữ cảnh mới thấy — không phải mọi luồng đều dùng chung")
                .isFalse();
    }
}
