package com.kpitracking.service.ai;

import com.kpitracking.tool.ToolRegistry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Test cho phần báo "trợ lý đang tra cứu cái gì".
 *
 * <p>Điều quan trọng nhất ở đây là phép kiểm ĐỘ PHỦ: mọi {@code @Tool} của dự án đều phải có nhãn.
 * Thiếu nhãn không làm vỡ gì cả — tool chỉ lặng lẽ rơi về nhãn chung "Đang tra cứu dữ liệu" — nên
 * nếu không chốt bằng test thì bản đồ nhãn sẽ tụt hậu dần mỗi lần thêm tool và không ai biết.
 */
class ToolProgressTest {

    /** Tên mọi @Tool, gom bằng reflection giống {@code ModelCallStage.collectToolNames()}. */
    private static Set<String> allToolNames() {
        Set<String> names = new LinkedHashSet<>();
        for (Class<?> toolClass : ToolRegistry.toolClasses()) {
            for (Method m : toolClass.getDeclaredMethods()) {
                org.springframework.ai.tool.annotation.Tool tool =
                        m.getAnnotation(org.springframework.ai.tool.annotation.Tool.class);
                if (tool == null) continue;
                names.add(tool.name() != null && !tool.name().isBlank() ? tool.name() : m.getName());
            }
        }
        return names;
    }

    // ════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("MỌI @Tool đều có nhãn riêng — thêm tool mà quên nhãn thì test này đỏ")
    void everyToolHasItsOwnLabel() {
        List<String> missing = allToolNames().stream()
                .filter(name -> !ToolProgress.hasLabel(name))
                .toList();

        assertThat(missing)
                .as("thiếu nhãn thì tool đó hiện chung chung 'Đang tra cứu dữ liệu' — không vỡ, "
                        + "nhưng mất đúng thứ khiến người dùng thấy trợ lý đang làm gì")
                .isEmpty();
    }

    @Test
    @DisplayName("nhãn nói theo nghiệp vụ, không rò tên tool ra giao diện")
    void labelsNeverLeakToolNames() {
        for (String name : allToolNames()) {
            assertThat(ToolProgress.label(name))
                    .as("nhãn của %s", name)
                    .doesNotContain(name)
                    .startsWith("Đang ");
        }
    }

    @Test
    @DisplayName("tool lạ rơi về nhãn chung thay vì để trống")
    void unknownToolFallsBackToGenericLabel() {
        assertThat(ToolProgress.label("tool_chua_ton_tai")).isEqualTo("Đang tra cứu dữ liệu");
    }

    @Test
    @DisplayName("phát được nhãn qua ToolContext — đường đi không phụ thuộc luồng nào đang chạy")
    void announcesThroughToolContext() {
        List<String> seen = new ArrayList<>();
        TurnListener listener = new TurnListener() {
            @Override public void stageStarted(String code, String label) { seen.add(code + "|" + label); }
        };
        Map<String, Object> ctx = new HashMap<>();
        ctx.put(ToolProgress.CONTEXT_KEY, listener);

        ToolProgress.announce(new ToolContext(ctx), "get_people");

        assertThat(seen).containsExactly("tool:get_people|Đang xem danh sách nhân sự");
    }

    @Test
    @DisplayName("lượt không có người nghe (đường JSON) thì không nổ")
    void silentWhenNoListener() {
        ToolProgress.announce(new ToolContext(Map.of("orgUnitId", "x")), "get_people");
        ToolProgress.announce(null, "get_people");
    }

    @Test
    @DisplayName("người nghe NÉM LỖI cũng không được làm hỏng lời gọi tool")
    void listenerFailureDoesNotBreakTheTool() {
        // Client đóng tab giữa chừng là chuyện thường; lúc đó mọi lời gửi đều ném. Tool vẫn phải
        // chạy nốt và trả dữ liệu cho model.
        TurnListener broken = new TurnListener() {
            @Override public void stageStarted(String code, String label) {
                throw new IllegalStateException("client đã ngắt");
            }
        };
        ToolProgress.announce(new ToolContext(Map.of(ToolProgress.CONTEXT_KEY, broken)), "get_kpi");
    }
}
