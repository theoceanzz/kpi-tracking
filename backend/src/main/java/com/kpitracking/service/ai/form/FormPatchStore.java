package com.kpitracking.service.ai.form;

import org.springframework.stereotype.Component;

/**
 * Giữ bản đề xuất điền form mà tool sinh ra trong một lượt, để controller lấy ra và trả về cho
 * client cùng câu trả lời bằng lời.
 *
 * <p>Vì sao ThreadLocal chứ không phải giá trị trả về của tool: Spring AI đưa chuỗi tool trả về cho
 * MODEL đọc, không đưa cho ta. Muốn lấy dữ liệu có cấu trúc ra khỏi vòng lặp gọi tool thì phải đi
 * đường bên, giống {@link com.kpitracking.tool.ToolCallTracker} và
 * {@link com.kpitracking.tool.EscapeHatchTool}.
 *
 * <p>PHẢI xoá ở cuối mỗi lượt — {@code AiTurnPipeline} lo việc đó trong khối {@code finally}. Quên
 * dọn là bản đề xuất của người này rơi sang lượt của người khác trên cùng luồng Tomcat.
 */
@Component
public class FormPatchStore {

    private static final ThreadLocal<FormPatch> PATCH = new ThreadLocal<>();

    /** Lượt gọi tool nhiều lần thì lần sau ghi đè lần trước — đề xuất mới nhất là đề xuất đúng. */
    public static void put(FormPatch patch) {
        PATCH.set(patch);
    }

    /** Bản đề xuất của lượt, hoặc {@code null} nếu lượt này không đề xuất gì. */
    public static FormPatch get() {
        return PATCH.get();
    }

    public static void clear() {
        PATCH.remove();
    }
}
