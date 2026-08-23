package com.kpitracking.service.ai;

import com.kpitracking.exception.AiQuotaExceededException;
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
import com.kpitracking.service.ai.agent.AgentState;

/**
 * Test cho KHUNG chạy chuỗi công đoạn — không phải cho nghiệp vụ của từng công đoạn.
 *
 * <p>Điều cần chứng minh: khung cho phép chèn ba dạng công đoạn mà thiết kế hứa hẹn —
 * cắt ngắn (bộ nhớ đệm), bọc ngoài để soi kết quả (kiểm duyệt), và gọi lại nhiều lần
 * (cửa thoát hiểm). Nếu ba điều này không đúng thì khung vô dụng, dù nghiệp vụ vẫn chạy.
 */
class AiTurnPipelineTest {

    private final List<String> log = new ArrayList<>();
    private final ChatMemoryCleaner cleaner = mock(ChatMemoryCleaner.class);


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
        return new AiTurnPipeline(new ArrayList<>(List.of(stages)), cleaner);
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
    @DisplayName("trạng thái sống theo lượt — lượt sau không thể thừa hưởng gì của lượt trước")
    void turnStateDoesNotLeakBetweenTurns() {
        UUID id = UUID.randomUUID();
        AiStage dirty = new AiStage() {
            @Override public String handle(AiTurn t, AiStageChain next) {
                AgentState s = new AgentState(t);
                t.setAgentState(s);
                s.arm("user", java.util.Set.of(id));
                s.setEscapeReason("thiếu công cụ");
                throw new RuntimeException("hỏng giữa chừng");
            }
            @Override public int getOrder() { return 100; }
        };
        pipeline(dirty).run(turn());

        // Bản trước phải DỌN sáu kho ThreadLocal ở khối finally, và quên một cái là rò sang lượt
        // của người khác trên cùng luồng Tomcat. Nay trạng thái gắn vào chính AiTurn, nên lượt mới
        // bắt đầu rỗng theo CẤU TRÚC chứ không nhờ ai đó nhớ dọn.
        AiTurn sau = turn();
        assertThat(sau.getAgentState())
                .as("lượt mới không dính gì của lượt trước")
                .isNull();
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

    // ── báo tiến độ công đoạn ────────────────────────────────────────────────
    //
    // Hai điều cần chứng minh: tiến độ do PIPELINE phát chứ không do stage tự gọi, và stage KHÔNG
    // khai nhãn thì im lặng. Vế thứ hai quan trọng ngang vế thứ nhất: nhãn này người dùng cuối đọc,
    // nên mặc định phải là không hiện chứ không phải hiện tên lớp Java.

    /** Ghi lại các sự kiện tiến độ nhận được, dạng "mã|nhãn". */
    private static class RecordingListener implements TurnListener {
        final List<String> events = new ArrayList<>();
        @Override public void stageStarted(String code, String label) { events.add(code + "|" + label); }
    }

    /** Stage có tên lớp thật (không ẩn danh) để kiểm được phần "mã" của sự kiện. */
    private static class NamedStage implements AiStage {
        private final int order;
        private final String label;
        NamedStage(int order, String label) { this.order = order; this.label = label; }
        @Override public String handle(AiTurn t, AiStageChain next) { return next.proceed(t); }
        @Override public String label() { return label; }
        @Override public int getOrder() { return order; }
    }

    /** Stage KHÔNG ghi đè label() — mô phỏng công đoạn mới thêm mà tác giả không đặt nhãn. */
    private static class UnlabelledStage implements AiStage {
        @Override public String handle(AiTurn t, AiStageChain next) { return next.proceed(t); }
        @Override public int getOrder() { return 150; }
    }

    private AiTurn turnListenedBy(TurnListener listener) {
        AiTurn t = turn();
        t.setListener(listener);
        return t;
    }

    @Test
    @DisplayName("phát đúng một sự kiện mỗi lần VÀO stage, đúng thứ tự chạy")
    void emitsOneEventPerStageEntry() {
        RecordingListener listener = new RecordingListener();
        AiTurnPipeline p = pipeline(
                new NamedStage(100, "Đang xác thực thông tin"),
                new NamedStage(200, "Đang chọn công cụ phù hợp"),
                terminal("xong", 300));

        assertThat(p.run(turnListenedBy(listener))).isEqualTo("xong");
        assertThat(listener.events)
                .as("mã là tên lớp, nhãn là chữ tiếng Việt hiện cho người dùng; điểm cuối không "
                        + "khai nhãn nên không có mặt")
                .containsExactly("NamedStage|Đang xác thực thông tin",
                        "NamedStage|Đang chọn công cụ phù hợp");
    }

    @Test
    @DisplayName("stage KHÔNG khai nhãn thì KHÔNG phát gì — không rò tên lớp Java ra giao diện")
    void unlabelledStageStaysSilent() {
        RecordingListener listener = new RecordingListener();
        pipeline(new UnlabelledStage(), new NamedStage(200, "Đang chọn công cụ phù hợp"),
                terminal("xong", 300)).run(turnListenedBy(listener));

        assertThat(listener.events)
                .as("chỉ công đoạn có nhãn mới hiện; phần lớn công đoạn không đáng cho người dùng đọc")
                .containsExactly("NamedStage|Đang chọn công cụ phù hợp");
    }

    @Test
    @DisplayName("công đoạn bọc ngoài tự báo ĐÚNG LÚC làm việc, không phải lúc vào chuỗi")
    void wrapperAnnouncesWhenItActuallyWorks() {
        // Không có chỗ này thì "Đang kiểm tra lại câu trả lời" hiện ngay đầu lượt, tức 10-15 giây
        // trước khi việc đó thực sự xảy ra.
        RecordingListener listener = new RecordingListener();
        AiStage wrapper = new AiStage() {
            @Override public String handle(AiTurn t, AiStageChain next) {
                String answer = next.proceed(t);
                t.progress(this, "Đang kiểm tra lại câu trả lời");
                return answer;
            }
            @Override public int getOrder() { return 100; }
        };
        pipeline(wrapper, new NamedStage(200, "Đang tra cứu dữ liệu"), terminal("xong", 300))
                .run(turnListenedBy(listener));

        assertThat(listener.events)
                .as("nhãn của công đoạn bọc ngoài phải đến SAU nhãn của công đoạn bên trong")
                .containsExactly("NamedStage|Đang tra cứu dữ liệu", "|Đang kiểm tra lại câu trả lời");
    }

    @Test
    @DisplayName("stage gọi next HAI lần thì các stage sau báo tiến độ lại — đúng sự thật là chạy lại")
    void reentryEmitsAgain() {
        RecordingListener listener = new RecordingListener();
        int[] calls = {0};
        AiStage retry = new AiStage() {
            @Override public String handle(AiTurn t, AiStageChain next) {
                next.proceed(t);
                return next.proceed(t);
            }
            @Override public int getOrder() { return 100; }
        };
        AiStage model = new NamedStage(300, "Đang tra cứu dữ liệu") {
            @Override public String handle(AiTurn t, AiStageChain next) {
                calls[0]++;
                return "xong";
            }
        };
        pipeline(retry, new NamedStage(200, "Đang chọn công cụ phù hợp"), model).run(turnListenedBy(listener));

        assertThat(calls[0]).isEqualTo(2);
        assertThat(listener.events.stream().filter(e -> e.endsWith("|Đang chọn công cụ phù hợp")).count())
                .as("vào lần hai phải phát lại, không lặng lẽ bỏ qua")
                .isEqualTo(2);
    }

    @Test
    @DisplayName("người nghe NÉM LỖI cũng không được làm hỏng lượt hỏi")
    void listenerFailureDoesNotBreakTurn() {
        // Client đóng tab giữa chừng là chuyện thường; lúc đó mọi lời gửi đều ném. Lượt vẫn phải
        // chạy nốt để ghi token và dọn ThreadLocal cho đúng.
        TurnListener broken = new TurnListener() {
            @Override public void stageStarted(String code, String label) {
                throw new IllegalStateException("client đã ngắt");
            }
        };

        assertThat(pipeline(passthrough("A", 100), terminal("xong", 200)).run(turnListenedBy(broken)))
                .isEqualTo("xong");
        assertThat(log).containsExactly("vào:A", "điểm cuối", "ra:A");
    }

    @Test
    @DisplayName("lượt không truyền người nghe dùng NOOP — đường JSON chạy y như trước")
    void defaultListenerIsNoop() {
        AiTurn t = turn();
        assertThat(t.getListener()).isSameAs(TurnListener.NOOP);
        assertThat(pipeline(passthrough("A", 100), terminal("xong", 200)).run(t)).isEqualTo("xong");
    }
}
