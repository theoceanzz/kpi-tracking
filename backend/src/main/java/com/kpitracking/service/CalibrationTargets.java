package com.kpitracking.service;

/**
 * Số người ĐÍCH cho từng mức khi hiệu chỉnh theo khung bell curve — hàm thuần, không chạm DB.
 *
 * <p>Mức được đánh chỉ số cao → thấp (0 = mức tốt nhất). Đích xuất phát từ phân bố hiện tại rồi
 * kẹp vào [sàn, trần] của từng mức; số người thừa/thiếu sau khi kẹp được dồn sang mức CÒN CHỖ gần
 * mức gây lệch nhất. Nhờ vậy khi mức thấp nhất vượt trần, phần thừa đi lên mức kề trên (và dây
 * chuyền tiếp nếu mức đó cũng chạm trần) — điều mà cách "chỉ hạ người xuống mức kề dưới" cũ không
 * làm được, vì mức thấp nhất không có mức dưới nào để hạ.
 */
final class CalibrationTargets {

    private CalibrationTargets() {}

    /**
     * @param counts số người hiện có ở mỗi mức
     * @param lo     sàn (số người tối thiểu) — bị nới nếu tổng sàn vượt số người
     * @param hi     trần (số người tối đa) — bị nới nếu tổng trần không chứa hết số người
     * @param total  tổng số người có mức
     * @return số người đích từng mức, tổng đúng bằng {@code total}
     */
    static int[] targets(int[] counts, int[] lo, int[] hi, int total) {
        int n = counts.length;
        int[] low = lo.clone(), high = hi.clone();
        for (int i = 0; i < n; i++) high[i] = Math.max(high[i], low[i]);

        // Khung làm tròn có thể bất khả thi (tổng sàn > số người, tổng trần < số người): nới dần
        // ở mức có sàn/trần xa phân bố hiện tại nhất để vẫn có một đích dùng được.
        while (sum(low) > total) {
            int k = argmax(n, i -> low[i] > 0 ? low[i] - counts[i] : Integer.MIN_VALUE);
            if (k < 0 || low[k] <= 0) break;
            low[k]--;
        }
        while (sum(high) < total) {
            int k = argmax(n, i -> counts[i] - high[i]);
            high[k]++;
        }

        int[] t = new int[n];
        for (int i = 0; i < n; i++) t[i] = Math.min(high[i], Math.max(low[i], counts[i]));

        int diff = total - sum(t);
        while (diff != 0) {
            boolean add = diff > 0;
            int best = -1, bestDist = Integer.MAX_VALUE;
            for (int i = 0; i < n; i++) {
                if (add ? t[i] >= high[i] : t[i] <= low[i]) continue;
                int d = distanceToImbalance(i, counts, t, add);
                if (d < bestDist) { bestDist = d; best = i; }
            }
            if (best < 0) break;
            t[best] += add ? 1 : -1;
            diff += add ? -1 : 1;
        }
        return t;
    }

    /**
     * Khoảng cách tới mức gần nhất đang "đẩy" người đi (khi cần thêm chỗ: mức bị cắt vì vượt trần)
     * hoặc "hút" người về (khi cần bớt chỗ: mức được nâng lên vì dưới sàn).
     */
    private static int distanceToImbalance(int i, int[] counts, int[] t, boolean add) {
        int best = Integer.MAX_VALUE;
        for (int j = 0; j < counts.length; j++) {
            boolean source = add ? counts[j] > t[j] : counts[j] < t[j];
            if (source) best = Math.min(best, Math.abs(i - j));
        }
        return best == Integer.MAX_VALUE ? 0 : best;
    }

    private static int sum(int[] a) {
        int s = 0;
        for (int v : a) s += v;
        return s;
    }

    private static int argmax(int n, java.util.function.IntUnaryOperator score) {
        int best = -1, bestScore = Integer.MIN_VALUE;
        for (int i = 0; i < n; i++) {
            int sc = score.applyAsInt(i);
            if (best < 0 || sc > bestScore) { best = i; bestScore = sc; }
        }
        return best;
    }
}
