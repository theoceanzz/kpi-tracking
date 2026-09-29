package com.kpitracking.service.feedback360;

import com.kpitracking.dto.response.feedback360.F360ResultSnapshot;
import com.kpitracking.enums.F360Relationship;

import java.util.*;

/**
 * Tính kết quả 360 của MỘT người được đánh giá (§7). Thuần hàm, không đụng DB — dễ unit test.
 *
 * <pre>
 * Điểm câu q, nhóm g         = TB điểm (≠ N/A) của nhóm g cho câu q — chỉ khi ô (g, q) được hiện
 * Điểm năng lực c, nhóm g    = TB các câu HIỆN của nhóm g thuộc c
 * Điểm năng lực c "người khác" = Σ_{g ∈ G_c} w_g · Điểm_c_g / Σ_{g ∈ G_c} w_g
 * </pre>
 * {@code G_c} = các nhóm (trừ tự đánh giá) có điểm cho CHÍNH năng lực c — trọng số nhóm được chuẩn
 * hoá lại theo từng năng lực, nên năng lực chỉ vài nhóm được hỏi ("Lãnh đạo") không bị kéo về phía
 * nhóm vắng mặt. Tự đánh giá vào điểm tổng chỉ khi trọng số SELF > 0 (mặc định 0).
 */
public final class F360ScoreCalculator {

    private F360ScoreCalculator() {}

    public record QuestionDef(UUID id, UUID competencyKey, String competencyName, Double competencyWeight,
                              Integer competencyPosition, String text, Integer position) {}

    /** Một câu trả lời đã nộp cho câu RATING. {@code score} null = "Không đánh giá được". */
    public record Answer(F360Relationship relationship, UUID questionId, Double score) {}

    public record Input(List<QuestionDef> ratingQuestions,
                        List<Answer> answers,
                        Map<F360Relationship, Integer> submittedRaters,
                        int scaleMax,
                        int threshold,
                        boolean managerAnonymous,
                        Map<F360Relationship, Double> weights,
                        double blindSpotGap,
                        double dispersionFlag) {}

    private static final String SELF = F360Relationship.SELF.name();

    public static F360ResultSnapshot compute(Input in) {
        int k = Math.max(2, in.threshold());
        F360AnonymityGuard.Plan plan = F360AnonymityGuard.plan(
                in.submittedRaters(), k, in.managerAnonymous(), in.weights());

        // Gom điểm theo (câu, nhóm hiện). Câu trả lời của nhóm bị ẩn bị bỏ ngay tại đây —
        // từ bước này trở đi không phép tính nào nhìn thấy chúng.
        Map<UUID, Map<String, List<Double>>> cells = new HashMap<>();
        for (Answer a : in.answers()) {
            if (a.score() == null) continue;
            String g = plan.visibleGroupOf(a.relationship());
            if (g == null) continue;
            cells.computeIfAbsent(a.questionId(), x -> new LinkedHashMap<>())
                    .computeIfAbsent(g, x -> new ArrayList<>()).add(a.score());
        }

        List<String> visibleKeys = plan.groups().stream()
                .filter(g -> Boolean.TRUE.equals(g.getVisible())).map(F360ResultSnapshot.Group::getKey).toList();
        Map<String, Double> groupWeight = new HashMap<>();
        plan.groups().forEach(g -> groupWeight.put(g.getKey(), g.getWeight() == null ? 0.0 : g.getWeight()));
        double selfWeight = in.weights().getOrDefault(F360Relationship.SELF, 0.0);

        // ── Câu hỏi ──
        List<F360ResultSnapshot.QuestionScore> questionScores = new ArrayList<>();
        // Điểm thô từng câu trả lời của các ô HIỆN, để đo độ phân tán theo năng lực.
        Map<UUID, List<Double>> visibleRawByCompetency = new HashMap<>();
        for (QuestionDef q : sorted(in.ratingQuestions())) {
            F360ResultSnapshot.QuestionScore qs = F360ResultSnapshot.QuestionScore.builder()
                    .id(q.id()).competencyKey(q.competencyKey()).competencyName(q.competencyName())
                    .text(q.text()).position(q.position()).build();
            Map<String, List<Double>> byGroup = cells.getOrDefault(q.id(), Map.of());
            for (String g : visibleKeys) {
                List<Double> scores = byGroup.get(g);
                if (scores == null || scores.isEmpty()) continue;
                if (!F360AnonymityGuard.cellVisible(plan.isAnonymous(g), scores.size(), k)) {
                    qs.getHiddenGroups().add(g);
                    continue;
                }
                qs.getByGroup().put(g, round(mean(scores)));
                if (!SELF.equals(g) && q.competencyKey() != null) {
                    visibleRawByCompetency.computeIfAbsent(q.competencyKey(), x -> new ArrayList<>()).addAll(scores);
                }
            }
            qs.setSelf(qs.getByGroup().get(SELF));
            qs.setOthers(round(weightedOthers(qs.getByGroup(), groupWeight)));
            questionScores.add(qs);
        }

        // ── Năng lực ──
        Map<UUID, List<F360ResultSnapshot.QuestionScore>> byCompetency = new LinkedHashMap<>();
        Map<UUID, QuestionDef> competencyDef = new LinkedHashMap<>();
        for (QuestionDef q : sorted(in.ratingQuestions())) {
            if (q.competencyKey() == null) continue;
            competencyDef.putIfAbsent(q.competencyKey(), q);
        }
        for (F360ResultSnapshot.QuestionScore qs : questionScores) {
            if (qs.getCompetencyKey() == null) continue;
            byCompetency.computeIfAbsent(qs.getCompetencyKey(), x -> new ArrayList<>()).add(qs);
        }

        List<F360ResultSnapshot.CompetencyScore> competencies = new ArrayList<>();
        for (Map.Entry<UUID, QuestionDef> e : competencyDef.entrySet()) {
            QuestionDef def = e.getValue();
            F360ResultSnapshot.CompetencyScore cs = F360ResultSnapshot.CompetencyScore.builder()
                    .key(e.getKey()).name(def.competencyName())
                    .weight(def.competencyWeight()).position(def.competencyPosition()).build();
            List<F360ResultSnapshot.QuestionScore> qs = byCompetency.getOrDefault(e.getKey(), List.of());
            for (String g : visibleKeys) {
                List<Double> vals = qs.stream().map(x -> x.getByGroup().get(g)).filter(Objects::nonNull).toList();
                if (!vals.isEmpty()) cs.getByGroup().put(g, round(mean(vals)));
            }
            cs.setSelf(cs.getByGroup().get(SELF));
            cs.setOthers(round(weightedOthers(cs.getByGroup(), groupWeight)));
            cs.setGap(cs.getSelf() != null && cs.getOthers() != null ? round(cs.getSelf() - cs.getOthers()) : null);
            List<Double> raw = visibleRawByCompetency.getOrDefault(e.getKey(), List.of());
            cs.setDivergent(raw.size() >= 2 && stddev(raw) > in.dispersionFlag());
            competencies.add(cs);
        }

        // ── Điểm tổng ──
        Double othersScore = weightedByCompetency(competencies, F360ResultSnapshot.CompetencyScore::getOthers);
        Double selfScore = weightedByCompetency(competencies, F360ResultSnapshot.CompetencyScore::getSelf);
        Double overall = selfWeight > 0
                ? weightedByCompetency(competencies, c -> blendWithSelf(c, groupWeight, selfWeight))
                : othersScore;

        // ── Điểm mù / thế mạnh ẩn ──
        List<F360ResultSnapshot.Gap> blindSpots = new ArrayList<>();
        List<F360ResultSnapshot.Gap> hiddenStrengths = new ArrayList<>();
        for (F360ResultSnapshot.CompetencyScore c : competencies) {
            if (c.getGap() == null) continue;
            F360ResultSnapshot.Gap gap = F360ResultSnapshot.Gap.builder()
                    .name(c.getName()).self(c.getSelf()).others(c.getOthers()).gap(c.getGap()).build();
            if (c.getGap() >= in.blindSpotGap()) blindSpots.add(gap);
            else if (c.getGap() <= -in.blindSpotGap()) hiddenStrengths.add(gap);
        }

        // ── Cao nhất / thấp nhất: không để một câu vừa ở top vừa ở bottom khi ít câu ──
        List<F360ResultSnapshot.QuestionScore> ranked = questionScores.stream()
                .filter(q -> q.getOthers() != null)
                .sorted(Comparator.comparing(F360ResultSnapshot.QuestionScore::getOthers).reversed())
                .toList();
        int take = Math.min(3, ranked.size() / 2);
        List<F360ResultSnapshot.Highlight> top = ranked.subList(0, take).stream().map(F360ScoreCalculator::highlight).toList();
        List<F360ResultSnapshot.Highlight> bottom = new ArrayList<>(
                ranked.subList(ranked.size() - take, ranked.size()).stream().map(F360ScoreCalculator::highlight).toList());
        Collections.reverse(bottom);

        int responseCount = in.submittedRaters().entrySet().stream()
                .filter(en -> en.getKey() != F360Relationship.SELF).mapToInt(Map.Entry::getValue).sum();
        boolean anyOthersVisible = visibleKeys.stream().anyMatch(g -> !SELF.equals(g));

        return F360ResultSnapshot.builder()
                .scaleMax(in.scaleMax())
                .anonymityThreshold(k)
                .overallScore(round(overall))
                .selfScore(round(selfScore))
                .othersScore(round(othersScore))
                .responseCount(responseCount)
                .insufficient(!anyOthersVisible)
                .groups(new ArrayList<>(plan.groups()))
                .competencies(competencies)
                .questions(questionScores)
                .blindSpots(blindSpots)
                .hiddenStrengths(hiddenStrengths)
                .top(new ArrayList<>(top))
                .bottom(bottom)
                .build();
    }

    // ────────────────────────────────────────────────────────────

    private static List<QuestionDef> sorted(List<QuestionDef> qs) {
        return qs.stream().sorted(Comparator
                .comparing((QuestionDef q) -> q.competencyPosition() == null ? Integer.MAX_VALUE : q.competencyPosition())
                .thenComparing(q -> q.position() == null ? Integer.MAX_VALUE : q.position())).toList();
    }

    /** TB có trọng số các nhóm (trừ tự đánh giá); tổng trọng số 0 thì rơi về TB thường. */
    static Double weightedOthers(Map<String, Double> byGroup, Map<String, Double> groupWeight) {
        double sum = 0, wsum = 0;
        List<Double> plain = new ArrayList<>();
        for (Map.Entry<String, Double> e : byGroup.entrySet()) {
            if (SELF.equals(e.getKey()) || e.getValue() == null) continue;
            double w = groupWeight.getOrDefault(e.getKey(), 0.0);
            sum += w * e.getValue();
            wsum += w;
            plain.add(e.getValue());
        }
        if (plain.isEmpty()) return null;
        return wsum > 0 ? sum / wsum : mean(plain);
    }

    private static Double blendWithSelf(F360ResultSnapshot.CompetencyScore c, Map<String, Double> groupWeight,
                                        double selfWeight) {
        if (c.getOthers() == null) return c.getSelf();
        if (c.getSelf() == null) return c.getOthers();
        double othersWeight = c.getByGroup().keySet().stream()
                .filter(g -> !SELF.equals(g)).mapToDouble(g -> groupWeight.getOrDefault(g, 0.0)).sum();
        if (othersWeight <= 0) return c.getOthers();
        return (c.getOthers() * othersWeight + c.getSelf() * selfWeight) / (othersWeight + selfWeight);
    }

    private static Double weightedByCompetency(List<F360ResultSnapshot.CompetencyScore> cs,
                                               java.util.function.Function<F360ResultSnapshot.CompetencyScore, Double> f) {
        double sum = 0, wsum = 0;
        List<Double> plain = new ArrayList<>();
        for (F360ResultSnapshot.CompetencyScore c : cs) {
            Double v = f.apply(c);
            if (v == null) continue;
            double w = c.getWeight() == null ? 0.0 : c.getWeight();
            sum += w * v;
            wsum += w;
            plain.add(v);
        }
        if (plain.isEmpty()) return null;
        return wsum > 0 ? sum / wsum : mean(plain);
    }

    private static F360ResultSnapshot.Highlight highlight(F360ResultSnapshot.QuestionScore q) {
        return F360ResultSnapshot.Highlight.builder()
                .competencyName(q.getCompetencyName()).text(q.getText()).score(q.getOthers()).build();
    }

    private static double mean(List<Double> xs) {
        return xs.stream().mapToDouble(Double::doubleValue).average().orElse(0);
    }

    private static double stddev(List<Double> xs) {
        double m = mean(xs);
        double v = xs.stream().mapToDouble(x -> (x - m) * (x - m)).sum() / xs.size();
        return Math.sqrt(v);
    }

    static Double round(Double v) {
        return v == null ? null : Math.round(v * 100.0) / 100.0;
    }
}
