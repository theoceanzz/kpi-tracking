package com.kpitracking.util;

/**
 * Quy điểm hạnh kiểm về TRỤC CÒN THIẾU của ma trận xếp loại hiệu quả.
 *
 * Ma trận có hai trục cố định: hàng = điểm hành vi (0..5, vốn lấy từ KPI định tính),
 * cột = % hoàn thành KPI (vốn lấy từ KPI định lượng). Tổ chức nào chỉ dùng MỘT loại KPI
 * thì trục còn lại rỗng và không tra được ô nào — điểm hạnh kiểm lấp đúng chỗ đó:
 *
 * <ul>
 *   <li>chỉ có KPI định lượng (đã có trục cột) ⇒ hạnh kiểm quy về trục hàng: {@code điểm/thang × 5};</li>
 *   <li>chỉ có KPI định tính  (đã có trục hàng) ⇒ hạnh kiểm quy về trục cột: {@code điểm/thang × 100}%.</li>
 * </ul>
 *
 * Có ĐỦ cả hai loại KPI thì ma trận đã đủ hai trục, hạnh kiểm không chen vào — nó vẫn
 * được chấm và lưu như một phiếu độc lập.
 */
public final class ConductAxisResolver {

    private ConductAxisResolver() {}

    /** Cặp toạ độ đưa thẳng vào ma trận. */
    public record Axes(Double behaviorScore, Double completionPercent) {}

    /**
     * @param behaviorScore     điểm hành vi từ KPI định tính, {@code null} nếu tổ chức không dùng
     * @param completionPercent % hoàn thành từ KPI định lượng, {@code null} nếu không có KPI định lượng
     * @param conductScore      điểm hạnh kiểm đã tính trọng số (0..{@code conductMaxScore}), có thể {@code null}
     * @param conductMaxScore   thang điểm hạnh kiểm của phiếu
     */
    public static Axes resolve(Double behaviorScore, Double completionPercent,
                               Double conductScore, Double conductMaxScore) {
        double max = conductMaxScore != null && conductMaxScore > 0
                ? conductMaxScore : com.kpitracking.constant.ConductConstants.DEFAULT_MAX_SCORE;
        if (conductScore == null) return new Axes(behaviorScore, completionPercent);

        if (behaviorScore == null) {
            // Không có trục hàng ⇒ hạnh kiểm thành điểm hành vi (thang 0..5 của ma trận).
            return new Axes(conductScore / max * 5.0, completionPercent);
        }
        if (completionPercent == null) {
            // Có trục hàng nhưng thiếu trục cột ⇒ hạnh kiểm thành % của trục cột.
            return new Axes(behaviorScore, conductScore / max * 100.0);
        }
        return new Axes(behaviorScore, completionPercent);
    }
}
