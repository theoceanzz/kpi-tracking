package com.kpitracking.service.ai.action;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Iterator;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Giữ các hành động đang chờ xác nhận, giữa lượt hỏi và lượt bấm nút.
 *
 * <p><b>Vì sao phải có kho riêng thay vì để client gửi lại mọi thứ.</b> Nếu client tự gửi lại danh
 * sách id khi bấm xác nhận thì bất kỳ ai cũng dựng được một danh sách tuỳ ý — trợ lý trở thành một
 * endpoint ghi không kiểm gì, đúng hình dạng lỗ hổng {@code bulk-review} vừa phải vá. Ở đây client
 * chỉ cầm một khoá; thứ sẽ chạy là thứ BACKEND đã giải nghĩa và đã kiểm quyền lúc dựng.
 *
 * <p><b>Chủ sở hữu là một phần của khoá.</b> Mỗi mục nhớ ai đã tạo ra nó, và {@link #take} chỉ trả
 * về khi đúng người đó xác nhận. Thiếu vế này thì biết được khoá là chạy được việc của người khác.
 *
 * <p><b>Lấy ra là XOÁ.</b> Xác nhận hai lần phải duyệt một lần — bấm đúp, tải lại trang, hay bấm
 * lại nút cũ trong lịch sử chat đều không được chạy lại. Đây là chốt chống lặp duy nhất, vì dịch vụ
 * bên dưới không biết gì về lời mời xác nhận.
 *
 * <p>Chỉ nằm trong bộ nhớ một máy, giống {@code FollowupContextStore}. Chấp nhận được vì vòng đời
 * chỉ vài phút và mất mát chỉ khiến người dùng phải hỏi lại — không phải mất dữ liệu. Chạy nhiều
 * bản backend thì phải chuyển sang kho dùng chung.
 */
@Component
@Slf4j
public class PendingActionStore {

    /**
     * Thời gian sống. Đủ dài để người dùng đọc và cân nhắc, đủ ngắn để một lời mời bị bỏ quên không
     * còn chạy được sau khi dữ liệu đã đổi — bản nộp có thể đã được người khác duyệt trong lúc đó.
     */
    static final Duration TTL = Duration.ofMinutes(10);

    /** Trần số mục, chặn kho phình vô hạn nếu có ai bắn liên tục. */
    private static final int MAX_ENTRIES = 500;

    /**
     * @param conversationId cuộc trò chuyện đã sinh ra lời mời; {@code null} với lượt không có bộ
     *                       nhớ. Chỉ dùng cho đường xác nhận BẰNG CHAT — xem {@link #takeLatestFor}.
     */
    private record Entry(PendingAction action, UUID ownerId, String conversationId) {}

    private final Map<String, Entry> entries = new ConcurrentHashMap<>();

    /** Cất một hành động và trả về chính nó (đã có id) để tầng trên gửi cho client. */
    public PendingAction put(PendingAction action, UUID ownerId, String conversationId) {
        evictExpired();
        if (entries.size() >= MAX_ENTRIES) {
            log.warn("Kho hành động chờ đã đầy ({}), bỏ mục cũ nhất", MAX_ENTRIES);
            entries.entrySet().stream()
                    .min((a, b) -> a.getValue().action().createdAt()
                            .compareTo(b.getValue().action().createdAt()))
                    .map(Map.Entry::getKey)
                    .ifPresent(entries::remove);
        }
        entries.put(action.id(), new Entry(action, ownerId, conversationId));
        return action;
    }

    /**
     * Có lời mời nào đang treo cho người này, trong chính cuộc trò chuyện này không.
     *
     * <p>Dùng để {@code RouteNode} quyết định có gửi tool xác nhận cho model hay không — không có
     * lời mời thì model không nhìn thấy tool, nên không thể gọi nhầm và cũng không tốn token mô tả
     * nó ở mọi lượt chat khác. Cùng khuôn với tool điền form.
     */
    public boolean hasPending(UUID ownerId, String conversationId) {
        return latestEntry(ownerId, conversationId) != null;
    }

    /**
     * Lấy lời mời MỚI NHẤT của người này trong cuộc trò chuyện này, và XOÁ nó đi.
     *
     * <p>Đây là đường xác nhận bằng CHAT: người dùng quên bấm nút, quay lại gõ "xác nhận". Client
     * không cầm id nào cả nên phải tra theo chủ sở hữu.
     *
     * <p><b>Buộc CÙNG cuộc trò chuyện.</b> Mở hai tab, hoặc quay lại bằng một chat mới, thì một chữ
     * "xác nhận" gõ nhầm chỗ sẽ chạy một việc người dùng không còn nhớ đã chuẩn bị. Đường bấm nút
     * không có rủi ro đó vì nút nằm ngay cạnh danh sách.
     *
     * <p>Lấy ra là XOÁ, giống {@link #take}: nhắn "xác nhận" hai lần chỉ chạy một lần.
     */
    public PendingAction takeLatestFor(UUID ownerId, String conversationId) {
        Map.Entry<String, Entry> found = latestEntry(ownerId, conversationId);
        if (found == null) return null;
        entries.remove(found.getKey());
        return found.getValue().action();
    }

    /** Mục còn hạn, mới nhất, của đúng người và đúng cuộc trò chuyện. */
    private Map.Entry<String, Entry> latestEntry(UUID ownerId, String conversationId) {
        evictExpired();
        if (ownerId == null || conversationId == null || conversationId.isBlank()) return null;
        return entries.entrySet().stream()
                .filter(e -> ownerId.equals(e.getValue().ownerId()))
                .filter(e -> conversationId.equals(e.getValue().conversationId()))
                .max((a, b) -> a.getValue().action().createdAt()
                        .compareTo(b.getValue().action().createdAt()))
                .orElse(null);
    }

    /**
     * Lấy ra để chạy, và XOÁ khỏi kho.
     *
     * @return hành động, hoặc {@code null} khi không có, đã hết hạn, hoặc người xác nhận không phải
     *         người đã tạo. Ba trường hợp trả về giống nhau là có chủ đích: phân biệt chúng cho
     *         người gọi là nói cho họ biết khoá nào có thật.
     */
    public PendingAction take(String actionId, UUID requesterId) {
        evictExpired();
        if (actionId == null || requesterId == null) return null;

        Entry entry = entries.get(actionId);
        if (entry == null) return null;
        if (!requesterId.equals(entry.ownerId())) {
            log.warn("Người dùng {} thử xác nhận hành động của người khác ({})", requesterId, actionId);
            return null;
        }
        entries.remove(actionId);
        return entry.action();
    }

    private void evictExpired() {
        Instant cutoff = Instant.now().minus(TTL);
        for (Iterator<Map.Entry<String, Entry>> it = entries.entrySet().iterator(); it.hasNext(); ) {
            if (it.next().getValue().action().createdAt().isBefore(cutoff)) it.remove();
        }
    }

    /** Số mục đang giữ — cho test và chẩn đoán. */
    public int size() {
        evictExpired();
        return entries.size();
    }
}
