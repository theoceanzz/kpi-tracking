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
    private static final String CONV = "conv-1";

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
        PendingAction a = store.put(action(), owner, CONV);
        assertThat(store.take(a.id(), owner)).isNotNull();
    }

    @Test
    @DisplayName("người KHÁC không lấy được, và mục vẫn còn nguyên cho chủ nhân")
    void otherUserCannotTake() {
        PendingAction a = store.put(action(), owner, CONV);

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
        PendingAction a = store.put(action(), owner, CONV);

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
        store.put(old, owner, CONV);

        assertThat(store.take(old.id(), owner)).isNull();
    }

    @Test
    @DisplayName("id không có thật -> null, không nổ")
    void unknownIdIsSafe() {
        assertThat(store.take("khong-co-that", owner)).isNull();
        assertThat(store.take(null, owner)).isNull();
        assertThat(store.take("x", null)).isNull();
    }

    // ── xác nhận bằng CHAT ───────────────────────────────────────────────────
    //
    // Người dùng quên bấm nút, quay lại gõ "xác nhận". Client không cầm id nào nên phải tra theo
    // chủ sở hữu — và đó chính là chỗ cần canh: một chữ "xác nhận" gõ nhầm chỗ không được phép
    // chạy việc mà người dùng đã quên mình chuẩn bị.

    @Test
    @DisplayName("CHAT: lấy được lời mời MỚI NHẤT của đúng người, đúng cuộc trò chuyện")
    void takesLatestInSameConversation() {
        store.put(action(Instant.now().minusSeconds(60)), owner, CONV);
        PendingAction newest = store.put(action(), owner, CONV);

        assertThat(store.takeLatestFor(owner, CONV)).isNotNull()
                .extracting(PendingAction::id).isEqualTo(newest.id());
    }

    @Test
    @DisplayName("CHAT: cuộc trò chuyện KHÁC thì KHÔNG lấy được")
    void otherConversationCannotTake() {
        // Mở hai tab, hoặc quay lại bằng một chat mới: gõ "xác nhận" ở đó không được chạy việc
        // đang treo ở chỗ khác.
        store.put(action(), owner, CONV);

        assertThat(store.takeLatestFor(owner, "conv-khac")).isNull();
        assertThat(store.takeLatestFor(owner, CONV))
                .as("lần thử ở hội thoại khác KHÔNG được tiêu mất lời mời")
                .isNotNull();
    }

    @Test
    @DisplayName("CHAT: người KHÁC không lấy được")
    void otherUserCannotTakeLatest() {
        store.put(action(), owner, CONV);

        assertThat(store.takeLatestFor(someoneElse, CONV)).isNull();
    }

    @Test
    @DisplayName("CHAT: lấy ra là XOÁ — nhắn 'xác nhận' hai lần chỉ chạy một lần")
    void takeLatestConsumes() {
        store.put(action(), owner, CONV);

        assertThat(store.takeLatestFor(owner, CONV)).isNotNull();
        assertThat(store.takeLatestFor(owner, CONV)).isNull();
    }

    @Test
    @DisplayName("CHAT: quá hạn thì không lấy được")
    void expiredIsNotTakenByChat() {
        store.put(action(Instant.now().minus(PendingActionStore.TTL).minusSeconds(1)), owner, CONV);

        assertThat(store.takeLatestFor(owner, CONV)).isNull();
    }

    @Test
    @DisplayName("hasPending: đúng người + đúng hội thoại mới là có")
    void hasPendingIsScoped() {
        store.put(action(), owner, CONV);

        assertThat(store.hasPending(owner, CONV)).isTrue();
        assertThat(store.hasPending(owner, "conv-khac")).isFalse();
        assertThat(store.hasPending(someoneElse, CONV)).isFalse();
        // Lượt không có bộ nhớ hội thoại thì không có chỗ nào để xác nhận bằng chat.
        assertThat(store.hasPending(owner, null)).isFalse();
    }

    @Test
    @DisplayName("mục quá hạn bị dọn khỏi kho, không tích lại")
    void expiredEntriesAreEvicted() {
        store.put(action(Instant.now().minus(PendingActionStore.TTL).minusSeconds(1)), owner, CONV);
        store.put(action(), owner, CONV);

        assertThat(store.size()).isEqualTo(1);
    }
}
