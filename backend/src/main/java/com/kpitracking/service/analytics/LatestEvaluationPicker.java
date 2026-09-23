package com.kpitracking.service.analytics;

import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

/**
 * Giữ lại mỗi người MỘT đánh giá — bản của đợt gần nhất trong phạm vi đang lọc.
 *
 * <p>Ma trận xếp loại là công cụ xếp NGƯỜI vào ô, nhưng bảng {@code evaluations} lưu mỗi (người,
 * đợt) một dòng. Gom thẳng cả phạm vi thì một người có bao nhiêu đợt sẽ được đếm bấy nhiêu lần:
 * đo trên dữ liệu thật, 18 nhân sự × 12 đợt cho ra 216 — và con số đó hiện lên dưới nhãn
 * "số nhân sự". Người xem không có cách nào biết "105 loại 2" là 105 người khác nhau hay chín
 * người lặp lại mười hai lần, nên không hành động được gì với nó.
 *
 * <p>Đặt ở đây vì cả heatmap lẫn biểu đồ phân tán đều là hai cách xem của CÙNG một khối. Chép hai
 * bản là mở đường cho hai màn hình cạnh nhau trả lời khác nhau về cùng một người.
 *
 * <p>Lọc về một đợt thì phép rút gọn này không đổi gì — mỗi người vốn chỉ có một dòng.
 */
public final class LatestEvaluationPicker {

    private LatestEvaluationPicker() {}

    /**
     * @param rows      các dòng đánh giá thô
     * @param userIdOf  lấy id người được đánh giá từ một dòng
     * @param startOf   lấy ngày bắt đầu đợt từ một dòng; null xếp sau mọi mốc có thật
     * @return mỗi người đúng một dòng, giữ nguyên thứ tự xuất hiện đầu tiên
     */
    public static <T> List<T> keepLatestPerUser(Collection<T> rows,
                                                Function<T, UUID> userIdOf,
                                                Function<T, Instant> startOf) {
        Map<UUID, T> best = new LinkedHashMap<>();
        for (T row : rows) {
            UUID userId = userIdOf.apply(row);
            // Dòng không rõ là của ai thì không gộp được với dòng nào — giữ nguyên để tổng không
            // hụt đi một cách âm thầm.
            if (userId == null) {
                best.put(UUID.randomUUID(), row);
                continue;
            }
            T current = best.get(userId);
            if (current == null || isNewer(startOf.apply(row), startOf.apply(current))) {
                best.put(userId, row);
            }
        }
        return List.copyOf(best.values());
    }

    /** Mốc null coi như cũ hơn mọi mốc có thật, nên dòng thiếu ngày không đè mất dòng có ngày. */
    private static boolean isNewer(Instant candidate, Instant current) {
        if (candidate == null) return false;
        if (current == null) return true;
        return candidate.isAfter(current);
    }
}
