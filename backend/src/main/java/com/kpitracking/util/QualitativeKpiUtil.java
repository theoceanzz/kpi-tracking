package com.kpitracking.util;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.entity.QualitativeLevel;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Tiện ích cho KPI ĐỊNH TÍNH: phân bố bài nộp theo MỨC (dùng cho biểu đồ phân bố trong drawer).
 */
public final class QualitativeKpiUtil {

    private QualitativeKpiUtil() {}

    /** 1 cột phân bố: tên mức, vị trí (thứ tự thấp→cao), màu, số bài nộp. */
    public record LevelBucket(String levelName, Integer position, String color, int count) {}

    /**
     * Phân bố bài nộp theo mức định tính (mọi bài nộp có {@code qualitativeLevel}), sắp theo {@code position} tăng dần.
     * Rỗng nếu KPI không có bài nộp mang mức.
     */
    public static List<LevelBucket> distribution(KpiCriteria kpi) {
        if (kpi == null || kpi.getSubmissions() == null) return List.of();
        Map<UUID, int[]> countByLevel = new LinkedHashMap<>();
        Map<UUID, QualitativeLevel> levelById = new LinkedHashMap<>();
        for (KpiSubmission s : kpi.getSubmissions()) {
            QualitativeLevel lv = s.getQualitativeLevel();
            if (lv == null) continue;
            levelById.putIfAbsent(lv.getId(), lv);
            countByLevel.computeIfAbsent(lv.getId(), k -> new int[1])[0]++;
        }
        return levelById.values().stream()
                .sorted(Comparator.comparing(QualitativeLevel::getPosition,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .map(lv -> new LevelBucket(lv.getName(), lv.getPosition(), lv.getColor(),
                        countByLevel.get(lv.getId())[0]))
                .collect(Collectors.toList());
    }

    /** Mức đại diện: bài nộp ĐÃ DUYỆT mới nhất có mức; nếu không có → bài mới nhất có mức. */
    public static String representativeLevelName(KpiCriteria kpi) {
        if (kpi == null || kpi.getSubmissions() == null) return null;
        Comparator<KpiSubmission> byTime = Comparator.comparing(
                (KpiSubmission s) -> s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt(),
                Comparator.nullsFirst(Comparator.naturalOrder()));
        return kpi.getSubmissions().stream()
                .filter(s -> s.getQualitativeLevel() != null
                        && s.getStatus() == com.kpitracking.enums.SubmissionStatus.APPROVED)
                .max(byTime)
                .or(() -> kpi.getSubmissions().stream()
                        .filter(s -> s.getQualitativeLevel() != null).max(byTime))
                .map(s -> s.getQualitativeLevel().getName())
                .orElse(null);
    }
}
