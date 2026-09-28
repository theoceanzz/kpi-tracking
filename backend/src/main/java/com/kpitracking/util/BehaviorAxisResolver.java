package com.kpitracking.util;

import com.kpitracking.enums.F360ScoringMode;

/**
 * Trục HÀNH VI của ma trận xếp loại khi có thêm nguồn đánh giá 360 (docs/FEEDBACK_360_DESIGN.md §7.2).
 *
 * <p>Tổng quát hoá {@link ConductAxisResolver}: chạy đúng luật hạnh kiểm cũ trước, rồi mới cho 360
 * chen vào — và chỉ chen vào TRỤC HÀNH VI khi nó không đến từ KPI định tính. Không có điểm 360
 * (hoặc chiến dịch chỉ để phát triển) thì kết quả trùng khít {@link ConductAxisResolver}, nên các
 * tổ chức không dùng 360 không thấy thay đổi nào.
 *
 * <ul>
 *   <li>{@code BEHAVIOR_AXIS}: trục hành vi còn trống (không định tính, không hạnh kiểm) ⇒ lấy 360.</li>
 *   <li>{@code BLEND_CONDUCT}: trục hành vi đang lấy từ hạnh kiểm ⇒ trộn {@code a%} hạnh kiểm +
 *       {@code (100−a)%} 360; không có hạnh kiểm thì lấy 360 như BEHAVIOR_AXIS.</li>
 * </ul>
 */
public final class BehaviorAxisResolver {

    private BehaviorAxisResolver() {}

    public static final int DEFAULT_BLEND_CONDUCT_PERCENT = 60;

    /** Nguồn của trục hành vi — để bảng đánh giá kỳ nói được con số lấy từ đâu. */
    public enum Source { QUALITATIVE, CONDUCT, FEEDBACK360, BLENDED, NONE }

    public record Result(Double behaviorScore, Double completionPercent, Source behaviorSource) {}

    /**
     * @param qualScore        điểm hành vi từ KPI định tính (0..5), null nếu không có
     * @param completionPercent % hoàn thành KPI định lượng, null nếu không có
     * @param conductScore     điểm hạnh kiểm (thang {@code conductMaxScore}), có thể null
     * @param feedback360Score điểm 360 ĐÃ QUY VỀ thang 0..5, có thể null
     * @param mode             chế độ của chiến dịch 360; null = không có chiến dịch ảnh hưởng điểm
     * @param blendPercent     phần trăm của hạnh kiểm khi trộn; null = mặc định 60
     */
    public static Result resolve(Double qualScore, Double completionPercent,
                                 Double conductScore, Double conductMaxScore,
                                 Double feedback360Score, F360ScoringMode mode, Integer blendPercent) {
        ConductAxisResolver.Axes axes = ConductAxisResolver.resolve(qualScore, completionPercent, conductScore, conductMaxScore);
        Double behavior = axes.behaviorScore();
        Source source = qualScore != null ? Source.QUALITATIVE
                : behavior != null ? Source.CONDUCT : Source.NONE;

        boolean use360 = feedback360Score != null && mode != null && mode != F360ScoringMode.DEVELOPMENT_ONLY;
        if (use360 && qualScore == null) {
            if (source == Source.CONDUCT && mode == F360ScoringMode.BLEND_CONDUCT) {
                double a = clampPercent(blendPercent) / 100.0;
                behavior = a * behavior + (1 - a) * feedback360Score;
                source = Source.BLENDED;
            } else if (source == Source.NONE) {
                behavior = feedback360Score;
                source = Source.FEEDBACK360;
            }
        }
        return new Result(behavior, axes.completionPercent(), source);
    }

    /** Quy điểm 360 thang 1..scaleMax về trục 1..5 của ma trận. */
    public static Double normalize360(Double score, Integer scaleMax) {
        if (score == null) return null;
        int max = scaleMax == null || scaleMax < 2 ? 5 : scaleMax;
        if (max == 5) return score;
        return 1 + (score - 1) * 4.0 / (max - 1);
    }

    private static int clampPercent(Integer p) {
        if (p == null) return DEFAULT_BLEND_CONDUCT_PERCENT;
        return Math.max(0, Math.min(100, p));
    }
}
