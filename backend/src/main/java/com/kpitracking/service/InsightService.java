package com.kpitracking.service;

import com.kpitracking.dto.response.ai.InsightCardResponse;
import com.kpitracking.dto.response.ai.InsightCardResponse.InsightContext;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.KpiSubmissionRepository;
import com.kpitracking.service.ManagerContextResolver.ManagerContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Rule-based insight engine (NO AI). When a manager opens the chat we run five
 * detection rules over their org-unit subtree using real KPI data, build the card
 * text from fixed templates, and return the top {@value #MAX_INSIGHTS} ordered by
 * priority: DEADLINE_RISK → BELOW → DROP → SPIKE → EXCEED.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InsightService {

    private final ManagerContextResolver managerContextResolver;
    private final KpiSubmissionRepository kpiSubmissionRepository;
    private final KpiPeriodRepository kpiPeriodRepository;

    private static final double EXCEED_THRESHOLD = 110.0;   // > 110% of target
    private static final double BELOW_THRESHOLD = 80.0;     // < 80% of target
    private static final double SPIKE_THRESHOLD = 20.0;     // > +20% vs previous period
    private static final double DROP_THRESHOLD = -15.0;     // < -15% vs previous period
    private static final double DEADLINE_COMPLETION_THRESHOLD = 90.0; // < 90% complete
    private static final int DEADLINE_DAYS = 7;             // period ends within 7 days
    private static final int MAX_INSIGHTS = 5;
    private static final int MAX_PER_UNIT_RULE = 2;

    /** Ordinal defines priority (lowest = highest priority). SUMMARY is a fallback only. */
    public enum InsightType { DEADLINE_RISK, BELOW, DROP, SPIKE, EXCEED, SUMMARY }

    public List<InsightCardResponse> getInsights() {
        ManagerContext ctx = managerContextResolver.resolve();
        if (ctx == null) return List.of();

        String path = ctx.orgUnitPath();
        Instant end = Instant.now();
        // Insight cards reflect the unit's CURRENT standing, so we scan all-time data
        // (matches how the rest of the codebase defaults date ranges to EPOCH..now).
        Instant start = Instant.EPOCH;

        List<InsightCardResponse> candidates = new ArrayList<>();
        safe("DEADLINE_RISK", () -> candidates.addAll(detectDeadlineRisk(ctx, end)));
        safe("BELOW/EXCEED", () -> candidates.addAll(detectBelowAndExceed(path, start, end)));
        safe("SPIKE/DROP", () -> candidates.addAll(detectSpikeAndDrop(path)));

        candidates.sort(Comparator.comparingInt(c -> InsightType.valueOf(c.getType()).ordinal()));

        // Fallback: no rule fired but the unit has data — still give the manager a
        // data-driven overview reminder (not random) so the cards are never empty.
        if (candidates.isEmpty()) {
            safe("SUMMARY", () -> {
                InsightCardResponse summary = buildSummary(path, start, end);
                if (summary != null) candidates.add(summary);
            });
        }

        return candidates.stream().limit(MAX_INSIGHTS).collect(Collectors.toList());
    }

    private InsightCardResponse buildSummary(String path, Instant start, Instant end) {
        Double avg = kpiSubmissionRepository.findAvgPerformanceInSubtree(path, start, end);
        if (avg == null) return null; // genuinely no KPI data — nothing to remind
        double perf = avg;
        InsightContext c = InsightContext.builder()
                .entityType("ORG_UNIT").metricKey("avg_performance").value(round(perf)).build();
        return card(InsightType.SUMMARY, "Tổng quan",
                String.format(Locale.US, "Đơn vị của bạn đang đạt trung bình %.0f%% mục tiêu KPI.", perf),
                "Cho tôi tổng quan hiệu suất KPI của đơn vị và những điểm cần lưu ý.",
                c);
    }

    // ── rules ────────────────────────────────────────────────────────────────

    private List<InsightCardResponse> detectDeadlineRisk(ManagerContext ctx, Instant now) {
        Instant soon = now.plus(DEADLINE_DAYS, ChronoUnit.DAYS);
        List<KpiPeriod> periods = kpiPeriodRepository.findEndingBetween(ctx.orgId(), now, soon);
        List<InsightCardResponse> out = new ArrayList<>();
        for (KpiPeriod p : periods) {
            Object[] row = kpiSubmissionRepository.sumActualAndTargetInSubtreeForPeriod(ctx.orgUnitPath(), p.getId());
            if (row == null || row.length < 2) continue;
            double actual = toDouble(row[0]);
            double target = toDouble(row[1]);
            if (target <= 0) continue;
            double completion = actual / target * 100.0;
            if (completion >= DEADLINE_COMPLETION_THRESHOLD) continue;
            int daysLeft = (int) Math.max(0, ChronoUnit.DAYS.between(now, p.getEndDate()));
            InsightContext c = InsightContext.builder()
                    .entityType("PERIOD").entityId(p.getId().toString()).entityName(p.getName())
                    .metricKey("completion").value(round(completion)).periodLabel(p.getName())
                    .daysLeft(daysLeft).build();
            out.add(card(InsightType.DEADLINE_RISK, "Nguy cơ trễ hạn",
                    String.format(Locale.US, "Kỳ \"%s\" còn %d ngày nhưng mới đạt %.0f%% mục tiêu.",
                            p.getName(), daysLeft, completion),
                    String.format(Locale.US, "Vì sao kỳ \"%s\" đang chậm tiến độ và cần ưu tiên xử lý gì?", p.getName()),
                    c));
        }
        return out;
    }

    private List<InsightCardResponse> detectBelowAndExceed(String path, Instant start, Instant end) {
        List<InsightCardResponse> out = new ArrayList<>();

        List<Object[]> low = kpiSubmissionRepository.findLowUnitsByPerformanceInSubtree(path, start, end, MAX_PER_UNIT_RULE);
        for (Object[] r : low) {
            double perf = toDouble(r[2]);
            if (perf >= BELOW_THRESHOLD) continue;
            String name = str(r[1]);
            InsightContext c = unitContext(r, perf);
            out.add(card(InsightType.BELOW, "Hiệu suất thấp",
                    String.format(Locale.US, "Đơn vị \"%s\" chỉ đạt %.0f%% mục tiêu, dưới ngưỡng cảnh báo 80%%.", name, perf),
                    String.format(Locale.US, "Vì sao \"%s\" có hiệu suất thấp và ai chịu trách nhiệm?", name),
                    c));
        }

        List<Object[]> top = kpiSubmissionRepository.findTopUnitsByPerformanceInSubtree(path, start, end, MAX_PER_UNIT_RULE);
        for (Object[] r : top) {
            double perf = toDouble(r[2]);
            if (perf <= EXCEED_THRESHOLD) continue;
            String name = str(r[1]);
            InsightContext c = unitContext(r, perf);
            out.add(card(InsightType.EXCEED, "Vượt mục tiêu",
                    String.format(Locale.US, "Đơn vị \"%s\" vượt mục tiêu, đạt %.0f%%.", name, perf),
                    String.format(Locale.US, "\"%s\" đã làm gì để vượt mục tiêu và có thể nhân rộng không?", name),
                    c));
        }
        return out;
    }

    private List<InsightCardResponse> detectSpikeAndDrop(String path) {
        List<Object[]> trend = kpiSubmissionRepository.trendStatsInSubtree(path, "YYYY-MM");
        if (trend.size() < 2) return List.of();
        Object[] prev = trend.get(trend.size() - 2);
        Object[] cur = trend.get(trend.size() - 1);
        double prevComp = completion(prev);
        double curComp = completion(cur);
        if (prevComp <= 0) return List.of();

        double delta = (curComp - prevComp) / prevComp * 100.0;
        String periodLabel = str(cur[0]);
        InsightContext c = InsightContext.builder()
                .entityType("PERIOD").entityName(periodLabel).metricKey("completion")
                .value(round(curComp)).deltaPct(round(delta)).periodLabel(periodLabel).build();

        if (delta > SPIKE_THRESHOLD) {
            return List.of(card(InsightType.SPIKE, "Tăng đột biến",
                    String.format(Locale.US, "Hiệu suất kỳ %s tăng %.0f%% so với kỳ trước.", periodLabel, delta),
                    String.format(Locale.US, "Yếu tố nào giúp hiệu suất kỳ %s tăng mạnh?", periodLabel),
                    c));
        }
        if (delta < DROP_THRESHOLD) {
            return List.of(card(InsightType.DROP, "Sụt giảm",
                    String.format(Locale.US, "Hiệu suất kỳ %s giảm %.0f%% so với kỳ trước.", periodLabel, Math.abs(delta)),
                    String.format(Locale.US, "Điều gì khiến hiệu suất kỳ %s sụt giảm?", periodLabel),
                    c));
        }
        return List.of();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private InsightContext unitContext(Object[] unitRow, double perf) {
        return InsightContext.builder()
                .entityType("ORG_UNIT")
                .entityId(unitRow[0] != null ? unitRow[0].toString() : null)
                .entityName(str(unitRow[1]))
                .metricKey("avg_performance")
                .value(round(perf))
                .build();
    }

    private InsightCardResponse card(InsightType type, String title, String insightText,
                                     String questionText, InsightContext context) {
        return InsightCardResponse.builder()
                .id(UUID.randomUUID().toString())
                .type(type.name())
                .severity(severity(type))
                .title(title)
                .insightText(insightText)
                .questionText(questionText)
                .context(context)
                .build();
    }

    private String severity(InsightType type) {
        switch (type) {
            case DEADLINE_RISK: return "critical";
            case BELOW: return "high";
            case DROP: return "medium";
            case SPIKE: return "info";
            case EXCEED: return "success";
            case SUMMARY: return "info";
            default: return "info";
        }
    }

    /** completion% from a trendStatsInSubtree row: actual(idx1) / target(idx2) * 100. */
    private double completion(Object[] row) {
        double target = toDouble(row[2]);
        return target <= 0 ? 0.0 : toDouble(row[1]) / target * 100.0;
    }

    private double toDouble(Object o) {
        return o instanceof Number ? ((Number) o).doubleValue() : 0.0;
    }

    private String str(Object o) {
        return o != null ? o.toString() : "";
    }

    private double round(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private void safe(String rule, Runnable r) {
        try {
            r.run();
        } catch (Exception e) {
            log.warn("Insight rule {} failed: {}", rule, e.getMessage());
        }
    }
}
