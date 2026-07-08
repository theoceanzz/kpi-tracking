package com.kpitracking.service;

import com.kpitracking.dto.response.ai.InsightCardResponse;
import com.kpitracking.dto.response.ai.InsightCardResponse.InsightContext;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.KpiSubmissionRepository;
import com.kpitracking.repository.OrgUnitRepository;
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
import java.util.Set;
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
    private final OrgUnitRepository orgUnitRepository;
    private final EvaluationService evaluationService;

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

        Instant end = Instant.now();
        // Đơn vị của manager để tính hiệu suất ĐÁNH GIÁ (theo cùng công thức phần thống kê).
        OrgUnit unit = ctx.orgUnitId() != null ? orgUnitRepository.findById(ctx.orgUnitId()).orElse(null) : null;

        List<InsightCardResponse> candidates = new ArrayList<>();
        safe("DEADLINE_RISK", () -> candidates.addAll(detectDeadlineRisk(ctx, end)));
        if (unit != null) {
            safe("BELOW/EXCEED", () -> candidates.addAll(detectBelowAndExceed(unit)));
            safe("SPIKE/DROP", () -> candidates.addAll(detectSpikeAndDrop(unit)));
        }

        candidates.sort(Comparator.comparingInt(c -> InsightType.valueOf(c.getType()).ordinal()));

        // Fallback: no rule fired but the unit has data — still give the manager a
        // data-driven overview reminder (not random) so the cards are never empty.
        if (candidates.isEmpty() && unit != null) {
            safe("SUMMARY", () -> {
                InsightCardResponse summary = buildSummary(unit);
                if (summary != null) candidates.add(summary);
            });
        }

        return candidates.stream().limit(MAX_INSIGHTS).collect(Collectors.toList());
    }

    private InsightCardResponse buildSummary(OrgUnit unit) {
        // Hiệu suất ĐÁNH GIÁ trung bình của đơn vị (0 = chưa có đánh giá → không nhắc).
        double perf = evaluationService.unitEvaluationPerformance(unit, null);
        if (perf <= 0) return null;
        InsightContext c = InsightContext.builder()
                .entityType("ORG_UNIT").metricKey("avg_performance").value(round(perf)).build();
        return card(InsightType.SUMMARY, "Tổng quan",
                String.format(Locale.US, "Đơn vị của bạn đang đạt hiệu suất đánh giá trung bình %.0f%%.", perf),
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

    private List<InsightCardResponse> detectBelowAndExceed(OrgUnit unit) {
        // Ngưỡng theo thang điểm đánh giá của tổ chức (mặc định 100): điểm đánh giá bị chặn
        // trần bởi evaluationMaxScore nên không dùng ngưỡng "vượt 110%" kiểu actual/target.
        double maxScore = evaluationMaxScore(unit);
        double belowCut = 0.8 * maxScore;   // hiệu suất đánh giá thấp
        double highCut = 0.9 * maxScore;    // hiệu suất đánh giá cao

        // Hiệu suất ĐÁNH GIÁ của từng đơn vị con (mỗi đơn vị tính độc lập trên subtree của nó);
        // bỏ chính đơn vị gốc để so sánh giữa các đơn vị con, bỏ đơn vị chưa có đánh giá (0).
        UUID orgId = unit.getOrgHierarchyLevel().getOrganization().getId();
        List<UnitPerf> perfs = new ArrayList<>();
        for (OrgUnit u : orgUnitRepository.findSubtree(unit.getPath(), orgId)) {
            if (u.getId().equals(unit.getId())) continue;
            double p = evaluationService.unitEvaluationPerformance(u, null);
            if (p > 0) perfs.add(new UnitPerf(u, p));
        }

        List<InsightCardResponse> out = new ArrayList<>();

        perfs.stream()
                .filter(up -> up.perf() < belowCut)
                .sorted(Comparator.comparingDouble(UnitPerf::perf))
                .limit(MAX_PER_UNIT_RULE)
                .forEach(up -> out.add(card(InsightType.BELOW, "Hiệu suất thấp",
                        String.format(Locale.US, "Đơn vị \"%s\" chỉ đạt hiệu suất đánh giá %.0f%%, dưới ngưỡng cảnh báo %.0f%%.",
                                up.unit().getName(), up.perf(), belowCut),
                        String.format(Locale.US, "Vì sao \"%s\" có hiệu suất thấp và ai chịu trách nhiệm?", up.unit().getName()),
                        unitContext(up.unit(), up.perf()))));

        perfs.stream()
                .filter(up -> up.perf() >= highCut)
                .sorted(Comparator.comparingDouble(UnitPerf::perf).reversed())
                .limit(MAX_PER_UNIT_RULE)
                .forEach(up -> out.add(card(InsightType.EXCEED, "Hiệu suất cao",
                        String.format(Locale.US, "Đơn vị \"%s\" đạt hiệu suất đánh giá cao: %.0f%%.", up.unit().getName(), up.perf()),
                        String.format(Locale.US, "\"%s\" đã làm gì để đạt hiệu suất cao và có thể nhân rộng không?", up.unit().getName()),
                        unitContext(up.unit(), up.perf()))));
        return out;
    }

    private List<InsightCardResponse> detectSpikeAndDrop(OrgUnit unit) {
        // Xu hướng hiệu suất ĐÁNH GIÁ theo ĐỢT KPI (điểm đánh giá gắn với người×đợt, không theo tháng).
        List<KpiPeriod> periods = evaluationService.subtreePeriodsOrdered(unit);
        if (periods.size() < 2) return List.of();
        KpiPeriod prevP = periods.get(periods.size() - 2);
        KpiPeriod curP = periods.get(periods.size() - 1);
        double prevPerf = evaluationService.unitEvaluationPerformance(unit, Set.of(prevP.getId()));
        double curPerf = evaluationService.unitEvaluationPerformance(unit, Set.of(curP.getId()));
        if (prevPerf <= 0) return List.of();

        double delta = (curPerf - prevPerf) / prevPerf * 100.0;
        String periodLabel = curP.getName();
        InsightContext c = InsightContext.builder()
                .entityType("PERIOD").entityId(curP.getId().toString()).entityName(periodLabel)
                .metricKey("avg_performance")
                .value(round(curPerf)).deltaPct(round(delta)).periodLabel(periodLabel).build();

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

    private InsightContext unitContext(OrgUnit u, double perf) {
        return InsightContext.builder()
                .entityType("ORG_UNIT")
                .entityId(u.getId().toString())
                .entityName(u.getName())
                .metricKey("avg_performance")
                .value(round(perf))
                .build();
    }

    /** Thang điểm đánh giá của tổ chức (mặc định 100). */
    private double evaluationMaxScore(OrgUnit unit) {
        Double max = unit.getOrgHierarchyLevel() != null && unit.getOrgHierarchyLevel().getOrganization() != null
                ? unit.getOrgHierarchyLevel().getOrganization().getEvaluationMaxScore() : null;
        return max != null && max > 0 ? max : 100.0;
    }

    /** Cặp (đơn vị, hiệu suất đánh giá) để xếp hạng trong rule BELOW/EXCEED. */
    private record UnitPerf(OrgUnit unit, double perf) {}

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

    private double toDouble(Object o) {
        return o instanceof Number ? ((Number) o).doubleValue() : 0.0;
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
