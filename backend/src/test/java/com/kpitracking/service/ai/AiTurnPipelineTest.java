package com.kpitracking.service.ai;

import com.kpitracking.exception.AiQuotaExceededException;
import com.kpitracking.tool.DisambiguationGuard;
import com.kpitracking.tool.EscapeHatchTool;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

/**
 * Test cho KHUNG chạy chuỗi công đoạn — không phải cho nghiệp vụ của từng công đoạn.
 *
 * <p>Điều cần chứng minh: khung cho phép chèn ba dạng công đoạn mà thiết kế hứa hẹn —
 * cắt ngắn (bộ nhớ đệm), bọc ngoài để soi kết quả (kiểm duyệt), và gọi lại nhiều lần
 * (cửa thoát hiểm). Nếu ba điều này không đúng thì khung vô dụng, dù nghiệp vụ vẫn chạy.
 */
class AiTurnPipelineTest {

    private final List<String> log = new ArrayList<>();
    private final DisambiguationGuard guard = new DisambiguationGuard();
    private final ChatMemoryCleaner cleaner = mock(ChatMemoryCleaner.class);

    @AfterEach
    void tearDown() {
        EscapeHatchTool.clear();
    }

    private AiTurn turn() {
        return new AiTurn("câu hỏi", null, null);
    }

    /** Stage ghi nhật ký rồi chạy tiếp — đại diện cho công đoạn "chèn trước". */
    private AiStage passthrough(String name, int order) {
        return new AiStage() {
            @Override public String handle(AiTurn t, AiStageChain next) {
                log.add("vào:" + name);
                String out = next.proceed(t);
                log.add("ra:" + name);
                return out;
            }
            @Override public int getOrder() { return order; }
        };
    }

    /** Điểm cuối — không gọi next. */
    private AiStage terminal(String answer, int order) {
        return new AiStage() {
            @Override public String handle(AiTurn t, AiStageChain next) {
                log.add("điểm cuối");
                return answer;
            }
            @Override public int getOrder() { return order; }
        };
    }

    private AiTurnPipeline pipeline(AiStage... stages) {
        return new AiTurnPipeline(new ArrayList<>(List.of(stages)), guard, cleaner);
    }

    // ════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("chạy đúng thứ tự @Order, không phụ thuộc thứ tự truyền vào")
    void runsInOrderRegardlessOfInputOrder() {
        // Cố tình truyền lộn xộn
        AiTurnPipeline p = pipeline(terminal("xong", 300), passthrough("B", 200), passthrough("A", 100));

        assertThat(p.run(turn())).isEqualTo("xong");
        assertThat(log).containsExactly("vào:A", "vào:B", "điểm cuối", "ra:B", "ra:A");
    }

    @Test
    @DisplayName("stage CẮT NGẮN thì các stage sau không chạy — nền tảng của bộ nhớ đệm")
    void shortCircuitSkipsRest() {
        AiStage cache = new AiStage() {
            @Override public String handle(AiTurn t, AiStageChain next) {
                log.add("trúng đệm");
                return "câu trả lời từ đệm"; // KHÔNG gọi next
            }
            @Override public int getOrder() { return 100; }
        };
        AiTurnPipeline p = pipeline(cache, passthrough("sau", 200), terminal("gọi model", 300));

        assertThat(p.run(turn())).isEqualTo("câu trả lời từ đệm");
        assertThat(log).containsExactly("trúng đệm");
        assertThat(log).as("stage sau và điểm cuối phải không chạy").doesNotContain("vào:sau", "điểm cuối");
    }

    @Test
    @DisplayName("stage BỌC NGOÀI thấy và sửa được câu trả lời của stage sau — nền tảng của kiểm duyệt")
    void wrapperSeesAndRewritesAnswer() {
        AiStage validation = new AiStage() {
            @Override public String handle(AiTurn t, AiStageChain next) {
                String answer = next.proceed(t);
                return answer.contains("bịa") ? "[đã chặn] " + answer : answer;
            }
            @Override public int getOrder() { return 100; }
        };
        assertThat(pipeline(validation, terminal("số liệu bịa", 200)).run(turn()))
                .isEqualTo("[đã chặn] số liệu bịa");
        assertThat(pipeline(validation, terminal("số liệu thật", 200)).run(turn()))
                .isEqualTo("số liệu thật");
    }

    @Test
    @DisplayName("stage gọi next NHIỀU LẦN — nền tảng của cửa thoát hiểm")
    void stageMayProceedTwice() {
        AiStage retry = new AiStage() {
            @Override public String handle(AiTurn t, AiStageChain next) {
                String first = next.proceed(t);
                return first.equals("thiếu công cụ") ? next.proceed(t) : first;
            }
            @Override public int getOrder() { return 100; }
        };
        int[] calls = {0};
        AiStage model = new AiStage() {
            @Override public String handle(AiTurn t, AiStageChain next) {
                return ++calls[0] == 1 ? "thiếu công cụ" : "câu trả lời đầy đủ";
            }
            @Override public int getOrder() { return 200; }
        };

        assertThat(pipeline(retry, model).run(turn())).isEqualTo("câu trả lời đầy đủ");
        assertThat(calls[0]).isEqualTo(2);
    }

    @Test
    @DisplayName("ngữ cảnh lượt đi xuyên suốt: stage sau đọc được thứ stage trước ghi")
    void turnCarriesStateAcrossStages() {
        AiStage writer = new AiStage() {
            @Override public String handle(AiTurn t, AiStageChain next) {
                t.setCurrentDateTime("14/08/2026");
                return next.proceed(t);
            }
            @Override public int getOrder() { return 100; }
        };
        AiStage reader = new AiStage() {
            @Override public String handle(AiTurn t, AiStageChain next) {
                return "thấy: " + t.getCurrentDateTime();
            }
            @Override public int getOrder() { return 200; }
        };
        assertThat(pipeline(writer, reader).run(turn())).isEqualTo("thấy: 14/08/2026");
    }

    // ── phần dùng chung mà khung phải lo ─────────────────────────────────────

    @Test
    @DisplayName("lỗi bất kỳ được dịch thành câu trả lời thân thiện, không ném ra ngoài")
    void unexpectedErrorBecomesFriendlyAnswer() {
        AiStage boom = new AiStage() {
            @Override public String handle(AiTurn t, AiStageChain next) {
                throw new RuntimeException("provider trả 400");
            }
            @Override public int getOrder() { return 100; }
        };
        assertThat(pipeline(boom).run(turn())).contains("Xin lỗi");
    }

    @Test
    @DisplayName("lỗi hạn mức PHẢI nổi lên tầng trên, không bị nuốt thành câu trả lời")
    void quotaErrorPropagates() {
        AiStage overQuota = new AiStage() {
            @Override public String handle(AiTurn t, AiStageChain next) {
                throw new AiQuotaExceededException("hết hạn mức", new RuntimeException("gốc"));
            }
            @Override public int getOrder() { return 100; }
        };
        assertThatThrownBy(() -> pipeline(overQuota).run(turn()))
                .isInstanceOf(AiQuotaExceededException.class);
    }

    @Test
    @DisplayName("mọi ngoại lệ NGHIỆP VỤ phải nổi lên, không bị nuốt thành câu xin lỗi chung chung")
    void businessExceptionsPropagate() {
        // Nuốt chúng thì người hết hạn mức hoặc bị chặn tần suất nhận câu "mình gặp trục trặc"
        // và không hiểu vì sao — đã xảy ra thật sau khi tách pipeline.
        record Case(String ten, RuntimeException loi) {}
        List<Case> cases = List.of(
                new Case("hạn mức token", new com.kpitracking.exception.AiTokenQuotaExceededException("hết hạn mức")),
                new Case("chặn tần suất", new com.kpitracking.exception.AiRateLimitException("quá nhanh")),
                new Case("không có quyền", new com.kpitracking.exception.ForbiddenException("AI đã tắt")));

        for (Case c : cases) {
            AiStage thrower = new AiStage() {
                @Override public String handle(AiTurn t, AiStageChain next) { throw c.loi(); }
                @Override public int getOrder() { return 100; }
            };
            assertThatThrownBy(() -> pipeline(thrower).run(turn()))
                    .as("ngoại lệ nghiệp vụ '%s' phải nổi lên GlobalExceptionHandler", c.ten())
                    .isInstanceOf(c.loi().getClass());
        }
    }

    @Test
    @DisplayName("ThreadLocal được dọn kể cả khi lượt ném lỗi — nếu không sẽ rò sang lượt người khác")
    void threadLocalsAlwaysCleared() {
        UUID id = UUID.randomUUID();
        AiStage dirty = new AiStage() {
            @Override public String handle(AiTurn t, AiStageChain next) {
                guard.arm("user", java.util.Set.of(id));
                EscapeHatchTool.wasRequested(); // chạm vào ThreadLocal
                throw new RuntimeException("hỏng giữa chừng");
            }
            @Override public int getOrder() { return 100; }
        };
        pipeline(dirty).run(turn());

        assertThat(guard.isArmed("user", id))
                .as("luồng request dùng chung — quên dọn là lượt sau thừa hưởng trạng thái này")
                .isFalse();
        assertThat(EscapeHatchTool.wasRequested()).isFalse();
    }

    @Test
    @DisplayName("lượt lỗi thì dọn câu hỏi mồ côi trong bộ nhớ hội thoại")
    void cleansOrphanQuestionOnError() {
        AiStage boom = new AiStage() {
            @Override public String handle(AiTurn t, AiStageChain next) {
                throw new RuntimeException("hỏng");
            }
            @Override public int getOrder() { return 100; }
        };
        AiTurn withMemory = new AiTurn("hỏi", "conv-1", null);
        pipeline(boom).run(withMemory);
        verify(cleaner).dropOrphanUserMessage("conv-1");
    }

    @Test
    @DisplayName("chuỗi kết thúc mà không stage nào trả lời -> báo lỗi rõ, không trả null")
    void missingTerminalStageFailsLoudly() {
        // Chỉ có stage chèn trước, không có điểm cuối
        assertThat(pipeline(passthrough("A", 100)).run(turn()))
                .as("lỗi cấu hình chuỗi bị bắt và dịch thành câu trả lời thân thiện")
                .contains("Xin lỗi");
    }
}
