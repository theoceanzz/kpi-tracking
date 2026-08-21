package com.kpitracking.service.ai.form;

import io.micrometer.context.ThreadLocalAccessor;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicReference;

/**
 * Giữ bản đề xuất điền form mà tool sinh ra trong một lượt, để controller lấy ra và trả về cho
 * client cùng câu trả lời bằng lời.
 *
 * <p>Vì sao ThreadLocal chứ không phải giá trị trả về của tool: Spring AI đưa chuỗi tool trả về cho
 * MODEL đọc, không đưa cho ta. Muốn lấy dữ liệu có cấu trúc ra khỏi vòng lặp gọi tool thì phải đi
 * đường bên, giống {@link com.kpitracking.tool.ToolCallTracker} và
 * {@link com.kpitracking.tool.EscapeHatchTool}.
 *
 * <p><b>Vì sao chứa trong {@link AtomicReference} chứ không giữ thẳng bản đề xuất.</b> Ở lượt
 * streaming, tool chạy trên luồng reactor chứ không phải luồng đang chạy chuỗi công đoạn.
 * {@code TurnStatePropagation} truyền được THAM CHIẾU của hộp chứa sang luồng đó, nhưng nếu ô nhớ
 * giữ thẳng giá trị thì luồng kia chỉ ghi vào bản sao của riêng nó và bản đề xuất không bao giờ về
 * tới người dùng. Có hộp chứa thì hai luồng ghi/đọc cùng một chỗ.
 *
 * <p>PHẢI xoá ở cuối mỗi lượt — {@code AiTurnPipeline} lo việc đó trong khối {@code finally}. Quên
 * dọn là bản đề xuất của người này rơi sang lượt của người khác trên cùng luồng Tomcat.
 */
@Component
public class FormPatchStore {

    private static final ThreadLocal<AtomicReference<FormPatch>> PATCH =
            ThreadLocal.withInitial(AtomicReference::new);

    /** Lượt gọi tool nhiều lần thì lần sau ghi đè lần trước — đề xuất mới nhất là đề xuất đúng. */
    public static void put(FormPatch patch) {
        PATCH.get().set(patch);
    }

    /** Bản đề xuất của lượt, hoặc {@code null} nếu lượt này không đề xuất gì. */
    public static FormPatch get() {
        return PATCH.get().get();
    }

    public static void clear() {
        PATCH.remove();
    }

    /** Cho phép {@code TurnStatePropagation} mang hộp chứa này sang luồng reactor. */
    public static final class Accessor implements ThreadLocalAccessor<AtomicReference<FormPatch>> {
        public static final String KEY = "kpi.ai.form-patch";
        @Override public Object key() { return KEY; }
        @Override public AtomicReference<FormPatch> getValue() { return PATCH.get(); }
        @Override public void setValue(AtomicReference<FormPatch> value) { PATCH.set(value); }
        @Override public void setValue() { PATCH.remove(); }
    }
}
