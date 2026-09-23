package com.kpitracking.service.analytics;

import com.kpitracking.dto.response.stats.advanced.CompositionResponses.*;
import com.kpitracking.repository.KpiSubmissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Nhóm biểu đồ THÀNH PHẦN và THAY ĐỔI THEO THỜI GIAN.
 *
 * <p>Phạm vi lấy từ {@link StatsTierResolver}, phân giải đúng một lần đầu mỗi phương thức.
 */
@Service
@RequiredArgsConstructor
public class CompositionAnalyticsService {

    /** Thứ tự trạng thái bài nộp trong biểu đồ chồng: từ chưa xong đến đã xong. */
    private static final List<String> SUBMISSION_STATUSES = List.of("DRAFT", "PENDING", "REJECTED", "APPROVED");

    private static final Map<String, String> STATUS_LABELS = Map.of(
            "DRAFT", "Nháp",
            "PENDING", "Chờ duyệt",
            "REJECTED", "Từ chối",
            "APPROVED", "Đã duyệt");

    private static final Map<String, String> STATUS_COLORS = Map.of(
            "DRAFT", "#94a3b8",
            "PENDING", "#f59e0b",
            "REJECTED", "#ef4444",
            "APPROVED", "#10b981");

    private final StatsTierResolver tierResolver;
    private final KpiSubmissionRepository submissionRepository;

    // ============================================================
    // T1 - Cơ cấu bài nộp theo thời gian
    // ============================================================

    @Transactional(readOnly = true)
    public SubmissionCompositionResponse getSubmissionComposition(UUID orgUnitId, Collection<UUID> periodIds,
                                                                  Instant from, Instant to) {
        StatsTierResolver.TierScope scope = tierResolver.resolve(orgUnitId, periodIds);
        if (scope.unitIds().isEmpty()) {
            return SubmissionCompositionResponse.builder()
                    .statuses(statusMetas()).points(List.of()).totalCount(0).build();
        }

        // Không có mốc thời gian thì lấy 12 tháng gần nhất: đủ để thấy xu hướng mà không kéo cả
        // lịch sử của tổ chức chạy nhiều năm.
        Instant effTo = to != null ? to : Instant.now();
        Instant effFrom = from != null ? from : effTo.minus(365, java.time.temporal.ChronoUnit.DAYS);

        Map<String, Map<String, Integer>> byMonth = new LinkedHashMap<>();
        int total = 0;
        for (Object[] r : submissionRepository.submissionCompositionByMonth(scope.unitIds(), effFrom, effTo)) {
            String month = (String) r[0];
            String status = String.valueOf(r[1]);
            int count = r[2] == null ? 0 : ((Number) r[2]).intValue();
            byMonth.computeIfAbsent(month, k -> new LinkedHashMap<>()).merge(status, count, Integer::sum);
            total += count;
        }

        List<TimePoint> points = new ArrayList<>();
        for (Map.Entry<String, Map<String, Integer>> e : byMonth.entrySet()) {
            Map<String, Integer> values = new LinkedHashMap<>();
            // Điền đủ 0 cho trạng thái vắng mặt: thiếu khoá thì vùng chồng bị đứt đoạn.
            for (String st : SUBMISSION_STATUSES) values.put(st, e.getValue().getOrDefault(st, 0));
            points.add(TimePoint.builder().label(formatMonth(e.getKey())).values(values).build());
        }

        return SubmissionCompositionResponse.builder()
                .statuses(statusMetas()).points(points).totalCount(total).build();
    }

    // ============================================================
    // P4 - Cơ cấu trạng thái theo đơn vị (100%)
    // ============================================================

    @Transactional(readOnly = true)
    public SubmissionShareResponse getSubmissionShare(UUID orgUnitId, Collection<UUID> periodIds) {
        StatsTierResolver.TierScope scope = tierResolver.resolve(orgUnitId, periodIds);
        if (scope.unitIds().isEmpty() || scope.anonymize()) {
            return SubmissionShareResponse.builder().statuses(statusMetas()).units(List.of()).build();
        }

        record Acc(String name, Map<String, Integer> counts) {}
        Map<UUID, Acc> byUnit = new LinkedHashMap<>();
        for (Object[] r : submissionRepository.submissionCompositionByUnit(scope.unitIds())) {
            UUID unitId = (UUID) r[0];
            Acc acc = byUnit.computeIfAbsent(unitId, k -> new Acc((String) r[1], new LinkedHashMap<>()));
            acc.counts().merge(String.valueOf(r[2]), r[3] == null ? 0 : ((Number) r[3]).intValue(), Integer::sum);
        }

        List<UnitShare> units = new ArrayList<>();
        for (Map.Entry<UUID, Acc> e : byUnit.entrySet()) {
            int total = e.getValue().counts().values().stream().mapToInt(Integer::intValue).sum();
            if (total == 0) continue;
            Map<String, Double> percents = new LinkedHashMap<>();
            for (String st : SUBMISSION_STATUSES) {
                percents.put(st, round1(e.getValue().counts().getOrDefault(st, 0) * 100.0 / total));
            }
            units.add(UnitShare.builder()
                    .orgUnitId(e.getKey()).name(e.getValue().name())
                    .percents(percents).total(total).build());
        }

        return SubmissionShareResponse.builder().statuses(statusMetas()).units(units).build();
    }

    // ============================================================
    // Helpers
    // ============================================================

    private List<StatusMeta> statusMetas() {
        return SUBMISSION_STATUSES.stream()
                .map(c -> StatusMeta.builder()
                        .code(c).label(STATUS_LABELS.get(c)).color(STATUS_COLORS.get(c)).build())
                .toList();
    }

    /** "2026-03" thành "T3/26" cho gọn trục ngang. */
    private static String formatMonth(String yyyyMM) {
        if (yyyyMM == null || yyyyMM.length() < 7) return String.valueOf(yyyyMM);
        return "T" + Integer.parseInt(yyyyMM.substring(5, 7)) + "/" + yyyyMM.substring(2, 4);
    }

    private static String fmt(Double v) {
        return v == null ? "—" : (Math.round(v * 10.0) / 10.0) + "%";
    }

    private static Double dbl(Object o) {
        return o == null ? null : ((Number) o).doubleValue();
    }

    private static Double round1(Double v) {
        return v == null ? null : Math.round(v * 10.0) / 10.0;
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
