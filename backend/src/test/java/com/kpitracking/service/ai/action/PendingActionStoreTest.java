package com.kpitracking.service.ai.action;

import com.kpitracking.service.ai.action.PendingAction.Decision;
import com.kpitracking.service.ai.action.PendingAction.Item;
import com.kpitracking.service.ai.action.PendingAction.Kind;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Test cho kho hành động chờ xác nhận.
 *
 * <p>Đây là chốt chặn giữa "trợ lý đề nghị" và "hệ thống ghi", nên ba tính chất dưới đây là phần
 * bảo mật chứ không phải tiện ích:
 * <ul>
 *   <li><b>chỉ chủ nhân lấy được</b> — thiếu vế này thì biết id là chạy được việc của người khác;</li>
 *   <li><b>lấy ra là xoá</b> — bấm đúp hoặc tải lại trang không được duyệt hai lần;</li>
 *   <li><b>hết hạn thì thôi</b> — một lời mời bị bỏ quên không được chạy sau khi dữ liệu đã đổi.</li>
 * </ul>
 */
class PendingActionStoreTest {

    private final PendingActionStore store = new PendingActionStore();
    private final UUID owner = UUID.randomUUID();
    private final UUID someoneElse = UUID.randomUUID();

    private PendingAction action() {
        return action(Instant.now());
    }

    private PendingAction action(Instant createdAt) {
        return new PendingAction(UUID.randomUUID().toString(), Kind.SUBMISSION_REVIEW,
                "Duyệt 2 bản nộp", Decision.APPROVE, null,
                List.of(new Item(UUID.randomUUID(), null, "Staff A — KPI X", "kỳ Tháng 6/2026")),
                createdAt);
    }

    @Test
    @DisplayName("chủ nhân lấy được")
    void ownerCanTake() {
        PendingAction a = store.put(action(), owner);
        assertThat(store.take(a.id(), owner)).isNotNull();
    }

    @Test
    @DisplayName("người KHÁC không lấy được, và mục vẫn còn nguyên cho chủ nhân")
    void otherUserCannotTake() {
        PendingAction a = store.put(action(), owner);

        assertThat(store.take(a.id(), someoneElse))
                .as("biết được id cũng không chạy được việc của người khác")
                .isNull();
        assertThat(store.take(a.id(), owner))
                .as("lần thử của người lạ KHÔNG được tiêu mất lời mời của chủ nhân")
                .isNotNull();
    }

    @Test
    @DisplayName("lấy ra là XOÁ — bấm hai lần chỉ chạy một lần")
    void takeConsumes() {
        PendingAction a = store.put(action(), owner);

        assertThat(store.take(a.id(), owner)).isNotNull();
        assertThat(store.take(a.id(), owner))
                .as("bấm đúp / tải lại trang / bấm lại nút cũ đều không được duyệt lần hai")
                .isNull();
    }

    @Test
    @DisplayName("quá hạn thì không lấy được nữa")
    void expiredIsGone() {
        // Dữ liệu có thể đã đổi trong lúc chờ — bản nộp có khi đã được người khác duyệt rồi.
        PendingAction old = action(Instant.now().minus(PendingActionStore.TTL).minusSeconds(1));
        store.put(old, owner);

        assertThat(store.take(old.id(), owner)).isNull();
    }

    @Test
    @DisplayName("id không có thật -> null, không nổ")
    void unknownIdIsSafe() {
        assertThat(store.take("khong-co-that", owner)).isNull();
        assertThat(store.take(null, owner)).isNull();
        assertThat(store.take("x", null)).isNull();
    }

    @Test
    @DisplayName("mục quá hạn bị dọn khỏi kho, không tích lại")
    void expiredEntriesAreEvicted() {
        store.put(action(Instant.now().minus(PendingActionStore.TTL).minusSeconds(1)), owner);
        store.put(action(), owner);

        assertThat(store.size()).isEqualTo(1);
    }
}
