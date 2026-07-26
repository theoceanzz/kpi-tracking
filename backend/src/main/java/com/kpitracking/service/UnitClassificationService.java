package com.kpitracking.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.constant.EvaluationConstants;
import com.kpitracking.dto.response.stats.UnitClassificationResponses.*;
import com.kpitracking.entity.*;
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
 * Xếp loại ĐƠN VỊ theo phân bố % xếp loại thành viên — phục vụ tab Phân cấp.
 *
 * <p>Mức của mỗi người/kỳ suy từ đánh giá ĐẠI DIỆN ({@link EvaluationService#getEffectiveEvaluation}):
 * không matrix → {@code score} map theo ngưỡng {@code evaluationLevels}; có matrix → {@code matrix_rating}
 * map theo {@code qualitativeLevels} (position). Luật ({@code Organization.unitClassificationRules} hoặc
 * preset) duyệt cao→thấp, đơn vị nhận mức đầu tiên mà TẤT CẢ điều kiện đúng (AND).
 */
@Service
@RequiredArgsConstructor
public class UnitClassificationService {

    private final UserRepository userRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final EvaluationService evaluationService;
    private final ObjectMapper objectMapper;

    private record LevelDef(String name, String color) {}
    private record Cond(String level, String scope, String op, double percent) {}
    private record Rule(String levelName, String color, List<Cond> conditions) {}

    @Transactional(readOnly = true)
    public OverviewResponse getOverview(UUID orgUnitId, Collection<UUID> periodIds) {
        OrgUnit unit = resolveUnit(orgUnitId);
        if (unit == null) return empty(null);
        Organization org = unit.getOrgHierarchyLevel().getOrganization();
        UUID orgId = org.getId();
        boolean matrix = Boolean.TRUE.equals(org.getEnableQualitative());

        List<LevelDef> levels = levelDefs(org, matrix); // cao → thấp
        if (levels.isEmpty()) return empty(unit);
        // Luật: dùng cấu hình org nếu CÙNG THANG hiện tại; nếu chưa cấu hình / lệch thang (vd rule cũ theo
        // Xuất sắc/Tốt nhưng org đã bật ma trận → mức là "Loại N") → dùng preset của thang hiện tại.
        Set<String> validNames = levels.stream().map(LevelDef::name).collect(Collectors.toSet());
        List<Rule> rules = null;
        if (org.getUnitClassificationRules() != null) {
            List<Rule> saved = parseRules(org.getUnitClassificationRules());
            if (!saved.isEmpty() && saved.stream().anyMatch(r -> validNames.contains(r.levelName()))) rules = saved;
        }
        if (rules == null) {
            rules = matrix ? defaultMatrixRules(levels) : parseRules(EvaluationConstants.DEFAULT_UNIT_RULES_SCORE);
        }
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

        // Xu hướng: mỗi kỳ 1 điểm — % người theo mức.
        List<TrendPoint> trend = new ArrayList<>();
        Map<String, Integer> lastCounts = null;
        int lastEvaluated = 0;
        String lastPeriodName = null;
        UUID lastPeriodId = null;
        for (KpiPeriod p : periods) {
            Map<String, Integer> counts = countByLevel(memberIds, p.getId(), classifier, levels);
            int evaluated = counts.values().stream().mapToInt(Integer::intValue).sum();
            Map<String, Double> pct = new LinkedHashMap<>();
            for (LevelDef ld : levels) pct.put(ld.name(), evaluated > 0 ? round1(counts.get(ld.name()) * 100.0 / evaluated) : 0.0);
            trend.add(TrendPoint.builder().periodName(p.getName()).percents(pct).build());
            lastCounts = counts; lastEvaluated = evaluated; lastPeriodName = p.getName(); lastPeriodId = p.getId();
        }

        // Phân bố + xếp loại đơn vị theo kỳ HIỆN TẠI (kỳ gần nhất trong phạm vi).
        List<Bucket> distribution = new ArrayList<>();
        if (lastCounts != null) {
            for (LevelDef ld : levels) {
                int c = lastCounts.getOrDefault(ld.name(), 0);
                distribution.add(Bucket.builder().level(ld.name()).color(ld.color())
                        .count(c).percent(lastEvaluated > 0 ? round1(c * 100.0 / lastEvaluated) : 0.0).build());
            }
        }
        Classification classification = (lastCounts != null && lastEvaluated > 0)
                ? classify(rules, lastCounts, lastEvaluated, levels) : null;

        // Xếp loại nhanh các đơn vị con trực tiếp (kỳ hiện tại).
        List<ChildClassification> children = new ArrayList<>();
        for (OrgUnit child : orgUnitRepository.findByParentId(unit.getId())) {
            List<UUID> cMembers = distinctMemberIds(subtreeIds(child, orgId));
            Classification cc = null;
            int cEval = 0;
            if (lastPeriodId != null && !cMembers.isEmpty()) {
                Map<String, Integer> cCounts = countByLevel(cMembers, lastPeriodId, classifier, levels);
                cEval = cCounts.values().stream().mapToInt(Integer::intValue).sum();
                if (cEval > 0) cc = classify(rules, cCounts, cEval, levels);
            }
            children.add(ChildClassification.builder()
                    .orgUnitId(child.getId()).orgUnitName(child.getName())
                    .classification(cc != null ? cc.getLevel() : null)
                    .color(cc != null ? cc.getColor() : null)
                    .evaluatedMembers(cEval).build());
        }

        return OverviewResponse.builder()
                .orgUnitId(unit.getId()).orgUnitName(unit.getName())
                .levels(levels.stream().map(l -> LevelInfo.builder().name(l.name()).color(l.color()).build()).collect(Collectors.toList()))
                .totalMembers(memberIds.size()).evaluatedMembers(lastEvaluated).currentPeriodName(lastPeriodName)
                .distribution(distribution).classification(classification).trend(trend).children(children)
                .build();
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
        List<EvaluationLevel> lv = safeList(org.getEvaluationLevels()).stream()
                .sorted(Comparator.comparingDouble(EvaluationLevel::getThreshold).reversed())
                .collect(Collectors.toList());
        return e -> {
            Double s = e.getScore();
            if (s == null) return null;
            for (EvaluationLevel l : lv) if (s >= l.getThreshold()) return l.getName();
            return lv.isEmpty() ? null : lv.get(lv.size() - 1).getName();
        };
    }

    /** Bộ mức (cao → thấp): matrix → các HẠNG đầu ra ma trận (Loại N); không matrix → evaluationLevels. */
    private List<LevelDef> levelDefs(Organization org, boolean matrix) {
        if (matrix) {
            return matrixGrades(org).stream()
                    .map(n -> new LevelDef("Loại " + n, ratingColor(n)))
                    .collect(Collectors.toList());
        }
        return safeList(org.getEvaluationLevels()).stream()
                .sorted(Comparator.comparingDouble(EvaluationLevel::getThreshold).reversed())
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

    private List<Rule> parseRules(String json) {
        List<Rule> out = new ArrayList<>();
        try {
            JsonNode arr = objectMapper.readTree(json).path("rules");
            if (arr.isArray()) {
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
        } catch (Exception ignored) {
            // JSON hỏng → không luật (đơn vị sẽ nhận mức thấp nhất).
        }
        return out;
    }

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
