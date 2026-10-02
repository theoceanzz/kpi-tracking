package com.kpitracking.service;

import java.util.ArrayDeque;
import java.util.Collection;
import java.util.Deque;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;

/**
 * Quy tắc thuần của phân rã cả bộ tiêu chí — tách khỏi service để kiểm thử không cần DB.
 */
public final class BscWholeCascadeRules {

    /** Đủ sâu cho mọi cây tổ chức thật; quá mức này coi như dữ liệu lỗi và DỪNG thay vì treo. */
    static final int MAX_DEPTH = 50;

    private BscWholeCascadeRules() {}

    /**
     * Giao kết quả của {@code sourceId} cho {@code targetId} có tạo vòng không.
     *
     * <p>{@code upstreamOf(x)} trả các thẻ mà {@code x} đang lấy số từ đó: thẻ cha trong cây và
     * thẻ nguồn của các dòng "Kết quả cấp trên" của nó. Vòng xảy ra khi {@code targetId} chính là
     * {@code sourceId}, hoặc đi ngược lên từ {@code sourceId} gặp lại {@code targetId} (A → B → A).
     * Duyệt có tập đã thăm và giới hạn độ sâu nên dữ liệu đã lỗi vòng sẵn cũng không làm treo.
     */
    public static boolean createsLoop(UUID sourceId, UUID targetId,
                                      Function<UUID, Collection<UUID>> upstreamOf) {
        if (sourceId == null || targetId == null) return false;
        if (sourceId.equals(targetId)) return true;

        Set<UUID> visited = new HashSet<>();
        Deque<UUID> frontier = new ArrayDeque<>();
        frontier.add(sourceId);
        int depth = 0;
        while (!frontier.isEmpty() && depth++ < MAX_DEPTH) {
            Deque<UUID> next = new ArrayDeque<>();
            for (UUID cur : frontier) {
                if (!visited.add(cur)) continue;
                for (UUID up : upstreamOf.apply(cur)) {
                    if (up == null) continue;
                    if (up.equals(targetId)) return true;
                    if (!visited.contains(up)) next.add(up);
                }
            }
            frontier = next;
        }
        return false;
    }

    /**
     * Các đợt thẻ con áp dụng mà thẻ nguồn KHÔNG áp dụng. Rỗng = khớp.
     *
     * <p>Điểm dòng "Kết quả cấp trên" của đợt X = kết quả đợt X của thẻ nguồn, nên mọi đợt của thẻ
     * con phải có mặt ở thẻ nguồn — công ty chấm theo quý mà phòng chấm theo tháng thì đợt tháng 8
     * không có con số nào để lấy. Chặn ngay lúc giao thay vì để dòng đó rỗng âm thầm.
     */
    public static Set<UUID> missingPeriods(Collection<UUID> childPeriodIds, Collection<UUID> sourcePeriodIds) {
        Set<UUID> source = new HashSet<>(sourcePeriodIds);
        Set<UUID> out = new LinkedHashSet<>();
        for (UUID id : childPeriodIds) {
            if (!source.contains(id)) out.add(id);
        }
        return out;
    }

    /** Trọng số giao xuống phải nằm trong (0, 100]. */
    public static boolean validWeight(Double weight) {
        return weight != null && weight > 0 && weight <= 100.0;
    }
}
