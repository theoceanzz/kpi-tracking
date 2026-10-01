package com.kpitracking.service.ai.hitl;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Chỗ chờ của human-in-the-loop: luồng của lượt đứng im tới khi người dùng bấm chọn.
 *
 * <p>Bốn đường ra đều phải trả về được, vì mỗi cái tương ứng một cách người dùng rời đi: trả lời,
 * bỏ qua, im lặng cho tới hết giờ, và trả lời nhầm câu hỏi của người khác.
 */
class PendingQuestionStoreTest {

    private final PendingQuestionStore store = new PendingQuestionStore();
    private final UUID asker = UUID.randomUUID();

    private PendingQuestion question(String turnId) {
        return PendingQuestion.single("q-1", turnId, asker, "Bạn muốn xem đơn vị nào?",
                List.of(PendingQuestion.Option.of("Phòng IT", "Phòng IT (Phòng — thuộc Công ty A)"),
                        PendingQuestion.Option.of("Phòng IT", "Phòng IT (Tổ — thuộc Khối CNTT)")),
                false);
    }

    @Test
    @DisplayName("người dùng chọn một lựa chọn -> lượt nhận đúng giá trị đó")
    void answerUnblocksTheTurn() throws Exception {
        PendingQuestion q = question("turn-1");
        CompletableFuture<String> slot = store.register(q);

        ScheduledExecutorService clock = Executors.newSingleThreadScheduledExecutor();
        clock.schedule(() -> store.answer("turn-1", "q-1", asker, "Phòng IT"), 50, TimeUnit.MILLISECONDS);

        assertThat(store.await(q, slot, 5)).isEqualTo("Phòng IT");
        assertThat(store.size()).isZero();
        clock.shutdownNow();
    }

    @Test
    @DisplayName("bỏ qua (câu trả lời rỗng) -> null, để lượt kết thúc lịch sự bằng chính câu hỏi")
    void blankAnswerMeansSkipped() {
        PendingQuestion q = question("turn-2");
        CompletableFuture<String> slot = store.register(q);
        store.answer("turn-2", "q-1", asker, "   ");

        assertThat(store.await(q, slot, 5)).isNull();
    }

    @Test
    @DisplayName("hết giờ -> null và dọn sạch chỗ chờ (không giữ luồng streaming mãi)")
    void timeoutReturnsNull() {
        PendingQuestion q = question("turn-3");
        CompletableFuture<String> slot = store.register(q);

        assertThat(store.await(q, slot, 0)).isNull();
        assertThat(store.size()).isZero();
    }

    @Test
    @DisplayName("người khác trả lời, hoặc trả lời câu hỏi đã cũ -> từ chối, lượt vẫn chờ")
    void rejectsWrongAskerOrWrongQuestion() {
        PendingQuestion q = question("turn-4");
        store.register(q);

        assertThat(store.answer("turn-4", "q-1", UUID.randomUUID(), "Phòng IT")).isFalse();
        assertThat(store.answer("turn-4", "q-cũ", asker, "Phòng IT")).isFalse();
        assertThat(store.answer("turn-khác", "q-1", asker, "Phòng IT")).isFalse();
        assertThat(store.peek("turn-4")).isPresent();
    }

    @Test
    @DisplayName("câu hỏi thứ hai của cùng lượt thay chỗ câu cũ, câu cũ được thả ra (không treo luồng)")
    void secondQuestionReplacesTheFirst() throws Exception {
        PendingQuestion first = question("turn-5");
        CompletableFuture<String> firstSlot = store.register(first);
        store.register(PendingQuestion.single("q-2", "turn-5", asker, "Kỳ nào?", List.of(), false));

        assertThat(firstSlot.get(1, TimeUnit.SECONDS)).isNull();
        assertThat(store.peek("turn-5")).get().extracting(PendingQuestion::questionId).isEqualTo("q-2");
    }
}
