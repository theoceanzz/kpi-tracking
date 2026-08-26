package com.kpitracking.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.constant.EvaluationConstants;
import com.kpitracking.dto.response.stats.UnitClassificationResponses.*;
import com.kpitracking.entity.*;
import com.kpitracking.repository.CycleUserEvaluationRepository;
import com.kpitracking.repository.KpiCycleRepository;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.util.PerformanceMatrixResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Xếp loại ĐƠN VỊ theo phân bố % xếp loại thành viên — phục vụ tab Phân cấp và đánh giá theo KỲ.
 *
 * <p>Hai phạm vi tính, dùng chung một bộ luật:
 * <ul>
 *   <li><b>Theo ĐỢT</b> ({@link #getOverview}): mức của mỗi người suy từ đánh giá ĐẠI DIỆN của đợt
 *       ({@link EvaluationService#getEffectiveEvaluation}) — không matrix → {@code score} map theo
 *       ngưỡng {@code evaluationLevels}; có matrix → {@code matrix_rating} → nhãn "Loại N".</li>
 *   <li><b>Theo KỲ</b> ({@link #getCycleOverview}): mức của mỗi người suy từ số CHỐT KỲ — điểm chốt
 *       kỳ / xếp loại ma trận đã chấm ở {@code cycle_user_evaluations}, chưa chấm thì lấy trung bình
 *       các đợt trong kỳ. Giống hệt cách {@code KpiCycleEvaluationService} tổng hợp điểm kỳ.</li>
 * </ul>
 *
 * <p>Luật ({@code Organization.unitClassificationRules} hoặc preset) duyệt cao→thấp, đơn vị nhận mức
 * đầu tiên mà TẤT CẢ điều kiện đúng (AND). Mỗi hồ sơ luật gán theo ĐƠN VỊ và (tuỳ chọn) theo KỲ.
 */
@Service
@RequiredArgsConstructor
public class UnitClassificationService {

    private final UserRepository userRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final KpiCycleRepository kpiCycleRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final CycleUserEvaluationRepository cycleUserEvaluationRepository;
    private final EvaluationService evaluationService;
    private final ObjectMapper objectMapper;

    private record LevelDef(String name, String color) {}
    private record Cond(String level, String scope, String op, double percent) {}
    private record Rule(String levelName, String color, List<Cond> conditions) {}
    /**
     * Hồ sơ luật xếp loại: một bộ rule gán cho (các) đơn vị và (tuỳ chọn) (các) kỳ.
     * Đơn vị con kế thừa hồ sơ của cha; {@code kpiCycleIds} rỗng nghĩa là áp cho MỌI kỳ.
     */
    private record Profile(String name, boolean isDefault, List<UUID> orgUnitIds,
                           List<UUID> kpiCycleIds, List<Rule> rules) {}

    /** Số chốt kỳ của một người: điểm chốt kỳ và xếp loại ma trận (một trong hai có thể null). */
    public record CycleMemberScore(Double finalScore, Double matrixRating) {}

    /** Kết quả xếp loại một đơn vị: mức + màu + hồ sơ luật đã áp (null nếu dùng preset). */
    public record UnitClassResult(String level, String color, String profileName, int evaluatedMembers) {}

    // ── Theo ĐỢT (tab Phân cấp) ──────────────────────────────────────────────

    @Transactional(readOnly = true)
    public OverviewResponse getOverview(UUID orgUnitId, Collection<UUID> periodIds) {
        OrgUnit unit = resolveUnit(orgUnitId);
        if (unit == null) return empty(null);
        Organization org = unit.getOrgHierarchyLevel().getOrganization();
        UUID orgId = org.getId();
        boolean matrix = com.kpitracking.util.PerformanceMatrixResolver.usesMatrix(org);

        List<LevelDef> levels = levelDefs(org, matrix); // cao → thấp
        if (levels.isEmpty()) return empty(unit);
        RuleContext ctx = ruleContext(org, levels);
        Function<Evaluation, String> classifier = memberClassifier(org, matrix);

        List<UUID> subtreeIds = subtreeIds(unit, orgId);
        List<UUID> memberIds = distinctMemberIds(subtreeIds);

        // Kỳ: dùng tập được chọn (giao với các kỳ của cây con), nếu rỗng thì lấy tất cả kỳ của cây con (sắp theo thời gian).
        List<KpiPeriod> ordered = evaluationService.subtreePeriodsOrdered(unit);
        List<KpiPeriod> periods = ordered;
        if (periodIds != null && !periodIds.isEmpty()) {
            Set<UUID> sel = new HashSet<>(periodIds);
            List<KpiPeriod> f = ordered.stream().filter(p -> sel.contains(p.getId())).collect(Collectors.toList());
            if (!f.isEmpty()) periods = f;
        }

        // Xu hướng: mỗi đợt 1 điểm — % người theo mức.
        List<TrendPoint> trend = new ArrayList<>();
        Map<String, Integer> lastCounts = null;
        int lastEvaluated = 0;
        String lastPeriodName = null;
        UUID lastPeriodId = null;
        KpiPeriod lastPeriod = null;
        for (KpiPeriod p : periods) {
            Map<String, Integer> counts = countByLevel(memberIds, p.getId(), classifier, levels);
            int evaluated = counts.values().stream().mapToInt(Integer::intValue).sum();
            trend.add(TrendPoint.builder().periodName(p.getName()).percents(percents(counts, evaluated, levels)).build());
            lastCounts = counts; lastEvaluated = evaluated; lastPeriodName = p.getName(); lastPeriodId = p.getId();
            lastPeriod = p;
        }

        // Đợt thuộc kỳ nào thì luật riêng của kỳ đó cũng có hiệu lực ở đây — nếu không,
        // cùng một đơn vị sẽ xếp loại khác nhau chỉ vì người dùng đang mở tab nào.
        UUID cycleId = lastPeriod != null && lastPeriod.getKpiCycle() != null
                ? lastPeriod.getKpiCycle().getId() : null;

        List<Bucket> distribution = distribution(lastCounts, lastEvaluated, levels);
        Profile mainProfile = resolveProfile(unit, ctx, cycleId);
        Classification classification = (lastCounts != null && lastEvaluated > 0)
                ? classify(rulesOf(mainProfile, ctx), lastCounts, lastEvaluated, levels) : null;

        // Xếp loại nhanh các đơn vị con trực tiếp (đợt hiện tại).
        List<ChildClassification> children = new ArrayList<>();
        for (OrgUnit child : orgUnitRepository.findByParentId(unit.getId())) {
            List<UUID> cMembers = distinctMemberIds(subtreeIds(child, orgId));
            Classification cc = null;
            int cEval = 0;
            Profile cProfile = resolveProfile(child, ctx, cycleId);
            if (lastPeriodId != null && !cMembers.isEmpty()) {
                Map<String, Integer> cCounts = countByLevel(cMembers, lastPeriodId, classifier, levels);
                cEval = cCounts.values().stream().mapToInt(Integer::intValue).sum();
                if (cEval > 0) cc = classify(rulesOf(cProfile, ctx), cCounts, cEval, levels);
            }
            children.add(childOf(child, cc, cProfile, cEval));
        }

        return OverviewResponse.builder()
                .orgUnitId(unit.getId()).orgUnitName(unit.getName())
                .levels(levelInfos(levels))
                .totalMembers(memberIds.size()).evaluatedMembers(lastEvaluated).currentPeriodName(lastPeriodName)
                .distribution(distribution).classification(classification)
                .appliedProfileName(mainProfile != null ? mainProfile.name() : null)
                .trend(trend).children(children)
                .build();
    }

    // ── Theo KỲ ──────────────────────────────────────────────────────────────

    /**
     * Xếp loại đơn vị cho một KỲ: phân bố mức dựa trên số CHỐT KỲ của từng thành viên,
     * xu hướng vẫn vẽ theo từng đợt trong kỳ để thấy diễn biến bên trong kỳ.
     */
    @Transactional(readOnly = true)
    public OverviewResponse getCycleOverview(UUID orgUnitId, UUID cycleId) {
        OrgUnit unit = resolveUnit(orgUnitId);
        if (unit == null) return empty(null);
        KpiCycle cycle = kpiCycleRepository.findById(cycleId).orElse(null);
        if (cycle == null) return empty(unit);

        Organization org = unit.getOrgHierarchyLevel().getOrganization();
        UUID orgId = org.getId();
        boolean matrix = com.kpitracking.util.PerformanceMatrixResolver.usesMatrix(org);

        List<LevelDef> levels = levelDefs(org, matrix);
        if (levels.isEmpty()) return empty(unit);
        RuleContext ctx = ruleContext(org, levels);

        List<KpiPeriod> periods = kpiPeriodRepository.findByKpiCycleIdOrderByStartDateAsc(cycleId);
        List<UUID> memberIds = distinctMemberIds(subtreeIds(unit, orgId));

        // Tính một lần cho cả cây con rồi lọc lại cho từng đơn vị con — đơn vị con là tập
        // con của cây cha, tính lại từng nhánh sẽ lặp đúng những truy vấn vừa chạy.
        Map<UUID, CycleMemberScore> scores = cycleScores(cycle, periods, memberIds);
        Function<CycleMemberScore, String> classifier = cycleMemberClassifier(org, matrix);

        Map<String, Integer> counts = countCycleLevels(memberIds, scores, classifier, levels);
        int evaluated = counts.values().stream().mapToInt(Integer::intValue).sum();

        // Xu hướng trong kỳ: mỗi đợt 1 điểm (dùng đánh giá đợt, không phải số chốt kỳ).
        Function<Evaluation, String> periodClassifier = memberClassifier(org, matrix);
        List<TrendPoint> trend = new ArrayList<>();
        for (KpiPeriod p : periods) {
            Map<String, Integer> c = countByLevel(memberIds, p.getId(), periodClassifier, levels);
            int n = c.values().stream().mapToInt(Integer::intValue).sum();
            trend.add(TrendPoint.builder().periodName(p.getName()).percents(percents(c, n, levels)).build());
        }

        Profile mainProfile = resolveProfile(unit, ctx, cycleId);
        Classification classification = evaluated > 0
                ? classify(rulesOf(mainProfile, ctx), counts, evaluated, levels) : null;

        List<ChildClassification> children = new ArrayList<>();
        for (OrgUnit child : orgUnitRepository.findByParentId(unit.getId())) {
            List<UUID> cMembers = distinctMemberIds(subtreeIds(child, orgId));
            Profile cProfile = resolveProfile(child, ctx, cycleId);
            Map<String, Integer> cCounts = countCycleLevels(cMembers, scores, classifier, levels);
            int cEval = cCounts.values().stream().mapToInt(Integer::intValue).sum();
            Classification cc = cEval > 0 ? classify(rulesOf(cProfile, ctx), cCounts, cEval, levels) : null;
            children.add(childOf(child, cc, cProfile, cEval));
        }

        return OverviewResponse.builder()
                .orgUnitId(unit.getId()).orgUnitName(unit.getName())
                .levels(levelInfos(levels))
                .totalMembers(memberIds.size()).evaluatedMembers(evaluated)
                .cycleId(cycle.getId()).cycleName(cycle.getName())
                .distribution(distribution(counts, evaluated, levels))
                .classification(classification)
                .appliedProfileName(mainProfile != null ? mainProfile.name() : null)
                .trend(trend).children(children)
                .build();
    }

    /**
     * Xếp loại một đơn vị trong một kỳ từ danh sách số chốt kỳ ĐÃ TÍNH SẴN của thành viên.
     *
     * <p>Dành cho {@code KpiCycleEvaluationService}: ở đó điểm kỳ của từng người vừa được tính
     * xong để dựng bảng tổng hợp, truyền thẳng vào đây rẻ hơn nhiều so với tính lại từ đầu, và
     * chắc chắn khớp với con số đang hiển thị trên màn đánh giá kỳ.
     */
    @Transactional(readOnly = true)
    public UnitClassResult classifyCycleUnit(UUID cycleId, OrgUnit unit, List<CycleMemberScore> members) {
        if (unit == null || unit.getOrgHierarchyLevel() == null) return null;
        Organization org = unit.getOrgHierarchyLevel().getOrganization();
        boolean matrix = com.kpitracking.util.PerformanceMatrixResolver.usesMatrix(org);
        List<LevelDef> levels = levelDefs(org, matrix);
        if (levels.isEmpty()) return null;

        RuleContext ctx = ruleContext(org, levels);
        Function<CycleMemberScore, String> classifier = cycleMemberClassifier(org, matrix);

        Map<String, Integer> counts = new LinkedHashMap<>();
        for (LevelDef ld : levels) counts.put(ld.name(), 0);
        for (CycleMemberScore s : safeList(members)) {
            String lvl = classifier.apply(s);
            if (lvl != null && counts.containsKey(lvl)) counts.merge(lvl, 1, Integer::sum);
        }
        int evaluated = counts.values().stream().mapToInt(Integer::intValue).sum();

        Profile profile = resolveProfile(unit, ctx, cycleId);
        if (evaluated == 0) return new UnitClassResult(null, null, profile != null ? profile.name() : null, 0);

        Classification c = classify(rulesOf(profile, ctx), counts, evaluated, levels);
        return new UnitClassResult(c != null ? c.getLevel() : null, c != null ? c.getColor() : null,
                profile != null ? profile.name() : null, evaluated);
    }

    /**
     * Số chốt kỳ của từng người: ưu tiên giá trị đã chấm ở {@code cycle_user_evaluations},
     * chưa chấm thì lấy TRUNG BÌNH các đợt trong kỳ — đúng mặc định mà màn đánh giá kỳ đang dùng.
     */
    private Map<UUID, CycleMemberScore> cycleScores(KpiCycle cycle, List<KpiPeriod> periods, List<UUID> memberIds) {
        Map<UUID, CycleUserEvaluation> saved = new HashMap<>();
        if (!memberIds.isEmpty()) {
            for (CycleUserEvaluation e : cycleUserEvaluationRepository
                    .findByKpiCycleIdAndUserIdIn(cycle.getId(), memberIds)) {
                if (e.getUser() != null) saved.put(e.getUser().getId(), e);
            }
        }

        Map<UUID, CycleMemberScore> out = new HashMap<>();
        for (UUID uid : memberIds) {
            double scoreSum = 0; int scoreN = 0;
            double ratingSum = 0; int ratingN = 0;
            for (KpiPeriod p : periods) {
                Evaluation e = evaluationService.getEffectiveEvaluation(uid, p.getId());
                if (e == null) continue;
                if (e.getScore() != null) { scoreSum += e.getScore(); scoreN++; }
                if (e.getMatrixRating() != null) { ratingSum += e.getMatrixRating(); ratingN++; }
            }
            Double avgScore = scoreN > 0 ? scoreSum / scoreN : null;
            Double avgRating = ratingN > 0 ? ratingSum / ratingN : null;

            CycleUserEvaluation s = saved.get(uid);
            if (s != null && s.getFinalScore() != null) avgScore = s.getFinalScore();
            if (s != null && s.getMatrixRating() != null) avgRating = s.getMatrixRating().doubleValue();

            out.put(uid, new CycleMemberScore(avgScore, avgRating));
        }
        return out;
    }

    private Map<String, Integer> countCycleLevels(List<UUID> memberIds, Map<UUID, CycleMemberScore> scores,
                                                  Function<CycleMemberScore, String> classifier, List<LevelDef> levels) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (LevelDef ld : levels) counts.put(ld.name(), 0);
        for (UUID uid : memberIds) {
            CycleMemberScore s = scores.get(uid);
            if (s == null) continue;
            String lvl = classifier.apply(s);
            if (lvl != null && counts.containsKey(lvl)) counts.merge(lvl, 1, Integer::sum);
        }
        return counts;
    }

    /**
     * Số chốt kỳ → tên mức.
     * - Matrix: làm tròn xếp loại ma trận kỳ → nhãn "Loại N".
     * - Không matrix: điểm chốt kỳ map theo ngưỡng {@code evaluationLevels}.
     */
    private Function<CycleMemberScore, String> cycleMemberClassifier(Organization org, boolean matrix) {
        if (matrix) {
            return s -> s == null || s.matrixRating() == null
                    ? null : "Loại " + (int) Math.round(s.matrixRating());
        }
        List<EvaluationLevel> lv = sortedLevels(org);
        return s -> s == null ? null : levelOfScore(s.finalScore(), lv);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Map<String, Integer> countByLevel(List<UUID> memberIds, UUID periodId,
                                              Function<Evaluation, String> classifier, List<LevelDef> levels) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (LevelDef ld : levels) counts.put(ld.name(), 0);
        for (UUID uid : memberIds) {
            Evaluation e = evaluationService.getEffectiveEvaluation(uid, periodId);
            if (e == null) continue;
            String lvl = classifier.apply(e);
            if (lvl != null && counts.containsKey(lvl)) counts.merge(lvl, 1, Integer::sum);
        }
        return counts;
    }

    private Map<String, Double> percents(Map<String, Integer> counts, int evaluated, List<LevelDef> levels) {
        Map<String, Double> pct = new LinkedHashMap<>();
        for (LevelDef ld : levels) {
            pct.put(ld.name(), evaluated > 0 ? round1(counts.getOrDefault(ld.name(), 0) * 100.0 / evaluated) : 0.0);
        }
        return pct;
    }

    private List<Bucket> distribution(Map<String, Integer> counts, int evaluated, List<LevelDef> levels) {
        List<Bucket> out = new ArrayList<>();
        if (counts == null) return out;
        for (LevelDef ld : levels) {
            int c = counts.getOrDefault(ld.name(), 0);
            out.add(Bucket.builder().level(ld.name()).color(ld.color())
                    .count(c).percent(evaluated > 0 ? round1(c * 100.0 / evaluated) : 0.0).build());
        }
        return out;
    }

    private List<LevelInfo> levelInfos(List<LevelDef> levels) {
        return levels.stream().map(l -> LevelInfo.builder().name(l.name()).color(l.color()).build())
                .collect(Collectors.toList());
    }

    private ChildClassification childOf(OrgUnit child, Classification cc, Profile profile, int evaluated) {
        return ChildClassification.builder()
                .orgUnitId(child.getId()).orgUnitName(child.getName())
                .classification(cc != null ? cc.getLevel() : null)
                .color(cc != null ? cc.getColor() : null)
                .appliedProfileName(profile != null ? profile.name() : null)
                .evaluatedMembers(evaluated).build();
    }

    /** Xếp loại đơn vị: duyệt luật cao→thấp, nhận mức đầu tiên mà mọi điều kiện (AND) đúng. */
    private Classification classify(List<Rule> rules, Map<String, Integer> counts, int total, List<LevelDef> levels) {
        List<String> order = levels.stream().map(LevelDef::name).collect(Collectors.toList()); // cao→thấp
        for (Rule r : rules) {
            boolean all = true;
            for (Cond c : r.conditions()) {
                double pct = percentForScope(counts, total, order, c.level(), c.scope());
                if (!compare(pct, c.op(), c.percent())) { all = false; break; }
            }
            if (all) return Classification.builder().level(r.levelName()).color(r.color()).build();
        }
        // Không luật nào khớp → mức thấp nhất.
        if (!levels.isEmpty()) {
            LevelDef low = levels.get(levels.size() - 1);
            return Classification.builder().level(low.name()).color(low.color()).build();
        }
        return null;
    }

    /** % người theo mức + phạm vi cộng dồn (this / orAbove / orBelow) trên tổng người có đánh giá. */
    private double percentForScope(Map<String, Integer> counts, int total, List<String> order, String level, String scope) {
        if (total <= 0) return 0.0;
        int idx = order.indexOf(level);
        int sum = 0;
        if (idx < 0) {
            sum = counts.getOrDefault(level, 0); // mức không có trong bộ hiện tại → coi như 0
        } else if ("orAbove".equalsIgnoreCase(scope)) {
            for (int i = 0; i <= idx; i++) sum += counts.getOrDefault(order.get(i), 0);
        } else if ("orBelow".equalsIgnoreCase(scope)) {
            for (int i = idx; i < order.size(); i++) sum += counts.getOrDefault(order.get(i), 0);
        } else { // this
            sum = counts.getOrDefault(level, 0);
        }
        return sum * 100.0 / total;
    }

    private boolean compare(double actual, String op, double target) {
        return switch (op == null ? "gte" : op) {
            case "lte" -> actual <= target + 1e-6;
            case "gt" -> actual > target;
            case "lt" -> actual < target;
            case "eq" -> Math.abs(actual - target) < 1e-6;
            default -> actual >= target - 1e-6; // gte
        };
    }

    /**
     * Đánh giá đại diện → tên mức.
     * - Matrix: mức = HẠNG đầu ra của ma trận = {@code matrix_rating} → nhãn "Loại N" (không dùng thang hành vi).
     * - Không matrix: mức = xếp loại theo {@code score} + ngưỡng {@code evaluationLevels}.
     */
    private Function<Evaluation, String> memberClassifier(Organization org, boolean matrix) {
        if (matrix) {
            return e -> e.getMatrixRating() == null ? null : "Loại " + e.getMatrixRating();
        }
        List<EvaluationLevel> lv = sortedLevels(org);
        return e -> levelOfScore(e.getScore(), lv);
    }

    private List<EvaluationLevel> sortedLevels(Organization org) {
        return safeList(org.getEvaluationLevels()).stream()
                .sorted(Comparator.comparingDouble(EvaluationLevel::getThreshold).reversed())
                .collect(Collectors.toList());
    }

    /** Điểm → tên mức theo ngưỡng (đã sắp cao→thấp); dưới mọi ngưỡng thì nhận mức thấp nhất. */
    private String levelOfScore(Double score, List<EvaluationLevel> sorted) {
        if (score == null) return null;
        for (EvaluationLevel l : sorted) if (score >= l.getThreshold()) return l.getName();
        return sorted.isEmpty() ? null : sorted.get(sorted.size() - 1).getName();
    }

    /** Bộ mức (cao → thấp): matrix → các HẠNG đầu ra ma trận (Loại N); không matrix → evaluationLevels. */
    private List<LevelDef> levelDefs(Organization org, boolean matrix) {
        if (matrix) {
            return matrixGrades(org).stream()
                    .map(n -> new LevelDef("Loại " + n, ratingColor(n)))
                    .collect(Collectors.toList());
        }
        return sortedLevels(org).stream()
                .map(l -> new LevelDef(l.getName(), l.getColor()))
                .collect(Collectors.toList());
    }

    /** Các HẠNG đầu ra phân biệt của ma trận (giá trị ô), sắp GIẢM dần (cao → thấp). Fallback ma trận mặc định khi org chưa lưu. */
    private List<Integer> matrixGrades(Organization org) {
        PerformanceMatrixResolver.Matrix m = PerformanceMatrixResolver.parse(org.getPerformanceMatrix());
        if (m == null) m = PerformanceMatrixResolver.parse(com.kpitracking.constant.PerformanceMatrixConstants.DEFAULT_MATRIX_JSON);
        if (m == null) return List.of();
        java.util.TreeSet<Integer> set = new java.util.TreeSet<>(Comparator.reverseOrder());
        for (int[] row : m.cells()) for (int v : row) set.add(v);
        return new ArrayList<>(set);
    }

    private static final Map<Integer, String> RATING_COLORS =
            Map.of(1, "#ef4444", 2, "#f97316", 3, "#f59e0b", 4, "#84cc16", 5, "#10b981");

    private static String ratingColor(int n) { return RATING_COLORS.getOrDefault(n, "#8b5cf6"); }

    /** Preset khi chưa cấu hình (matrix): đơn vị nhận Loại G nếu ≥50% người ở Loại G trở lên; hạng thấp nhất là mặc định. */
    private List<Rule> defaultMatrixRules(List<LevelDef> levels) {
        List<Rule> rules = new ArrayList<>();
        for (int i = 0; i < levels.size(); i++) {
            LevelDef l = levels.get(i);
            List<Cond> conds = (i == levels.size() - 1)
                    ? List.of()
                    : List.of(new Cond(l.name(), "orAbove", "gte", 50));
            rules.add(new Rule(l.name(), l.color(), conds));
        }
        return rules;
    }

    // ── Hồ sơ luật ──────────────────────────────────────────────────────────

    /** Mọi thứ cần để chọn & kiểm luật cho một tổ chức, nạp một lần cho cả request. */
    private record RuleContext(List<Profile> profiles, Map<UUID, String> pathById,
                               Set<String> validNames, List<Rule> presetRules) {}

    private RuleContext ruleContext(Organization org, List<LevelDef> levels) {
        // validNames: chỉ nhận rule ĐÚNG THANG hiện tại (matrix "Loại N" vs thang điểm); lệch/không có → preset.
        Set<String> validNames = levels.stream().map(LevelDef::name).collect(Collectors.toSet());
        List<Profile> profiles = parseProfiles(org.getUnitClassificationRules());
        List<Rule> preset = com.kpitracking.util.PerformanceMatrixResolver.usesMatrix(org)
                ? defaultMatrixRules(levels)
                : parseRules(EvaluationConstants.DEFAULT_UNIT_RULES_SCORE);
        return new RuleContext(profiles, loadPaths(profiles), validNames, preset);
    }

    private List<Rule> parseRules(String json) {
        try { return parseRulesNode(objectMapper.readTree(json).path("rules")); }
        catch (Exception ignored) { return new ArrayList<>(); } // JSON hỏng → không luật (đơn vị nhận mức thấp nhất)
    }

    private List<Rule> parseRulesNode(JsonNode arr) {
        List<Rule> out = new ArrayList<>();
        if (arr != null && arr.isArray()) {
            for (JsonNode r : arr) {
                List<Cond> conds = new ArrayList<>();
                JsonNode cs = r.path("conditions");
                if (cs.isArray()) {
                    for (JsonNode c : cs) {
                        conds.add(new Cond(
                                c.path("level").asText(null),
                                c.path("scope").asText("this"),
                                c.path("op").asText("gte"),
                                c.path("percent").asDouble(0)));
                    }
                }
                out.add(new Rule(r.path("levelName").asText(null), r.path("color").asText("#64748b"), conds));
            }
        }
        return out;
    }

    /**
     * Parse danh sách HỒ SƠ. Hình dạng mới: {@code {"profiles":[{name,isDefault,orgUnitIds,kpiCycleIds,rules}]}}.
     * Tương thích ngược: {@code {"rules":[...]}} (cũ) → coi như 1 hồ sơ Mặc định áp cho toàn bộ;
     * hồ sơ thiếu {@code kpiCycleIds} (lưu trước khi có tính năng gắn kỳ) → áp cho mọi kỳ.
     */
    private List<Profile> parseProfiles(String json) {
        List<Profile> out = new ArrayList<>();
        if (json == null || json.isBlank()) return out;
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode profs = root.path("profiles");
            if (profs.isArray() && profs.size() > 0) {
                for (JsonNode p : profs) {
                    out.add(new Profile(
                            p.path("name").asText(null),
                            p.path("isDefault").asBoolean(false),
                            parseIds(p.path("orgUnitIds")),
                            parseIds(p.path("kpiCycleIds")),
                            parseRulesNode(p.path("rules"))));
                }
            } else if (root.path("rules").isArray()) {
                out.add(new Profile("Mặc định", true, List.of(), List.of(), parseRulesNode(root.path("rules"))));
            }
        } catch (Exception ignored) { /* JSON hỏng → rỗng → preset */ }
        return out;
    }

    private List<UUID> parseIds(JsonNode arr) {
        List<UUID> ids = new ArrayList<>();
        if (arr != null && arr.isArray()) {
            for (JsonNode n : arr) {
                try { ids.add(UUID.fromString(n.asText())); } catch (Exception ignored) { /* bỏ id lỗi */ }
            }
        }
        return ids;
    }

    /** Nạp path của mọi đơn vị được gán (id → path) — dùng để dò tổ tiên gần nhất. */
    private Map<UUID, String> loadPaths(List<Profile> profiles) {
        Set<UUID> ids = profiles.stream().flatMap(p -> p.orgUnitIds().stream()).collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        Map<UUID, String> m = new HashMap<>();
        for (OrgUnit u : orgUnitRepository.findAllById(ids)) m.put(u.getId(), u.getPath());
        return m;
    }

    /** Hồ sơ có hiệu lực trong kỳ đang xét: không gán kỳ nào → mọi kỳ; có gán → phải trùng. */
    private boolean appliesToCycle(Profile p, UUID cycleId) {
        return p.kpiCycleIds().isEmpty() || (cycleId != null && p.kpiCycleIds().contains(cycleId));
    }

    /**
     * Hồ sơ áp cho đơn vị {@code u} trong kỳ {@code cycleId}: trong số hồ sơ CÒN HIỆU LỰC ở kỳ đó,
     * chọn đơn vị-được-gán có path là TIỀN TỐ DÀI NHẤT của {@code u.path} (tổ tiên gần nhất, gồm
     * chính nó → con ghi đè cha); cùng độ sâu thì hồ sơ gắn RIÊNG cho kỳ thắng hồ sơ áp cho mọi kỳ.
     * Không có → hồ sơ mặc định (ưu tiên bản riêng cho kỳ); vẫn không → null (preset).
     */
    private Profile resolveProfile(OrgUnit u, RuleContext ctx, UUID cycleId) {
        List<Profile> candidates = ctx.profiles().stream()
                .filter(p -> appliesToCycle(p, cycleId)).collect(Collectors.toList());

        String upath = u.getPath();
        Profile best = null;
        int bestLen = -1;
        boolean bestCycleScoped = false;
        if (upath != null) {
            for (Profile p : candidates) {
                boolean cycleScoped = !p.kpiCycleIds().isEmpty();
                for (UUID id : p.orgUnitIds()) {
                    String ap = ctx.pathById().get(id);
                    if (ap == null || !upath.startsWith(ap)) continue;
                    if (ap.length() > bestLen || (ap.length() == bestLen && cycleScoped && !bestCycleScoped)) {
                        bestLen = ap.length(); best = p; bestCycleScoped = cycleScoped;
                    }
                }
            }
        }
        if (best != null) return best;
        return candidates.stream().filter(Profile::isDefault)
                .max(Comparator.comparing((Profile p) -> !p.kpiCycleIds().isEmpty()))
                .orElse(null);
    }

    /** Rule của hồ sơ nếu ĐÚNG thang hiện tại; nếu không (lệch thang / null / rỗng) → preset. */
    private List<Rule> rulesOf(Profile p, RuleContext ctx) {
        if (p != null && p.rules() != null && !p.rules().isEmpty()
                && p.rules().stream().anyMatch(r -> ctx.validNames().contains(r.levelName()))) {
            return p.rules();
        }
        return ctx.presetRules();
    }

    // ── Truy vấn cây đơn vị / thành viên ────────────────────────────────────

    private List<UUID> subtreeIds(OrgUnit unit, UUID orgId) {
        List<UUID> ids = orgUnitRepository.findSubtree(unit.getPath(), orgId).stream().map(OrgUnit::getId).collect(Collectors.toList());
        return ids.isEmpty() ? List.of(unit.getId()) : ids;
    }

    private List<UUID> distinctMemberIds(List<UUID> unitIds) {
        return userRoleOrgUnitRepository.findByOrgUnitIdIn(unitIds).stream()
                .map(uro -> uro.getUser().getId()).distinct().collect(Collectors.toList());
    }

    private OrgUnit resolveUnit(UUID orgUnitId) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) return null;
        List<UserRoleOrgUnit> roles = userRoleOrgUnitRepository.findByUserId(user.getId());
        if (roles.isEmpty()) return null;
        UUID orgId = roles.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
        if (orgUnitId == null) return roles.get(0).getOrgUnit();
        OrgUnit u = orgUnitRepository.findById(orgUnitId).orElse(null);
        if (u == null || !u.getOrgHierarchyLevel().getOrganization().getId().equals(orgId)) return null;
        return u;
    }

    private static <T> List<T> safeList(List<T> l) { return l == null ? List.of() : l; }

    private static double round1(double v) { return Math.round(v * 10.0) / 10.0; }

    private OverviewResponse empty(OrgUnit unit) {
        return OverviewResponse.builder()
                .orgUnitId(unit != null ? unit.getId() : null)
                .orgUnitName(unit != null ? unit.getName() : null)
                .levels(List.of()).totalMembers(0).evaluatedMembers(0)
                .distribution(List.of()).classification(null).trend(List.of()).children(List.of())
                .build();
    }
}
