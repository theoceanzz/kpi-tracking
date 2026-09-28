package com.kpitracking.service.kpi;

import com.kpitracking.entity.Evaluation;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.entity.User;
import com.kpitracking.enums.KpiFrequency;
import com.kpitracking.enums.KpiParentRelationType;
import com.kpitracking.enums.KpiProgressBucket;
import com.kpitracking.enums.PeriodProgress;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.mapper.KpiCriteriaMapper;
import com.kpitracking.repository.EvaluationRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;

/**
 * Nguồn chân lý DUY NHẤT cho "đợt này xong chưa" khi khoá kỳ.
 *
 * <p>Một KPI ở trạng thái cuối khi đã duyệt + mọi người được giao đã nộp đủ kết quả (đã được duyệt)
 * + đã được QUẢN LÝ đánh giá đợt (bản tự đánh giá không tính — giống lượt nhắc hạn đánh giá). KPI
 * dừng/bị thay thế/đã chốt do khoá kỳ cũng coi là đã cuối.
 *
 * <p>Nộp kết quả: mỗi người được giao cần {@code expectedSubmissions} lần nộp còn hiệu lực. Bài nộp
 * cùng khoảng báo cáo (periodStart/periodEnd) chỉ xét LẦN MỚI NHẤT — bị từ chối rồi nộp lại thì bản
 * bị từ chối không còn tính; lần mới nhất bị từ chối thì khoảng đó coi như chưa nộp.
 */
@Component
@RequiredArgsConstructor
public class PeriodProgressClassifier {

    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final EvaluationRepository evaluationRepository;
    private final KpiCriteriaMapper kpiCriteriaMapper;

    /** Kết quả phân loại một đợt. */
    public record PeriodSnapshot(KpiPeriod period, PeriodProgress progress,
                                 List<KpiCriteria> kpis, Map<UUID, KpiProgressBucket> buckets) {

        public long count(KpiProgressBucket b) {
            return buckets.values().stream().filter(x -> x == b).count();
        }

        /** Có KPI nào đã hoàn thành (đã được đánh giá) — quyết định chuyển nguyên hay tách đợt. */
        public boolean hasCompletedKpi() {
            return buckets.containsValue(KpiProgressBucket.COMPLETED);
        }

        public List<KpiCriteria> unfinishedKpis() {
            return kpis.stream().filter(k -> !buckets.get(k.getId()).isFinal()).toList();
        }

        public List<KpiCriteria> finishedKpis() {
            return kpis.stream().filter(k -> buckets.get(k.getId()).isFinal()).toList();
        }

        public boolean isOnlyDrafts() {
            return !kpis.isEmpty() && kpis.stream().allMatch(k -> buckets.get(k.getId()) == KpiProgressBucket.DRAFT);
        }
    }

    /** Phân loại mọi đợt truyền vào — một truy vấn KPI + một truy vấn đánh giá cho cả lô. */
    public List<PeriodSnapshot> classify(List<KpiPeriod> periods, Instant now) {
        if (periods.isEmpty()) return List.of();
        List<UUID> ids = periods.stream().map(KpiPeriod::getId).toList();

        Map<UUID, List<KpiCriteria>> kpisByPeriod = new HashMap<>();
        for (KpiCriteria k : kpiCriteriaRepository.findByKpiPeriodIdIn(ids)) {
            kpisByPeriod.computeIfAbsent(k.getKpiPeriod().getId(), x -> new ArrayList<>()).add(k);
        }

        // period → những người đã được QUẢN LÝ đánh giá (evaluator khác chính họ).
        Map<UUID, Set<UUID>> evaluated = new HashMap<>();
        for (Evaluation e : evaluationRepository.findByKpiPeriodIdIn(ids)) {
            if (e.getUser() == null || e.getEvaluator() == null) continue;
            if (e.getEvaluator().getId().equals(e.getUser().getId())) continue;
            evaluated.computeIfAbsent(e.getKpiPeriod().getId(), x -> new HashSet<>()).add(e.getUser().getId());
        }

        List<PeriodSnapshot> result = new ArrayList<>();
        for (KpiPeriod p : periods) {
            List<KpiCriteria> kpis = kpisByPeriod.getOrDefault(p.getId(), List.of());
            kpis = kpis.stream().sorted(Comparator.comparing(KpiCriteria::getName, Comparator.nullsLast(String::compareTo))).toList();
            Set<UUID> evaluatedUsers = evaluated.getOrDefault(p.getId(), Set.of());
            Map<UUID, KpiProgressBucket> buckets = new LinkedHashMap<>();
            for (KpiCriteria k : kpis) buckets.put(k.getId(), bucketOf(k, evaluatedUsers));
            result.add(new PeriodSnapshot(p, progressOf(p, kpis, buckets, now), kpis, buckets));
        }
        return result;
    }

    PeriodProgress progressOf(KpiPeriod p, List<KpiCriteria> kpis, Map<UUID, KpiProgressBucket> buckets, Instant now) {
        // Đợt đã đóng/chuyển/huỷ ở lần khoá trước (kỳ được mở lại) — không còn gì để xử lý.
        if (p.getStatus() != null && p.getStatus().isTerminal()) return PeriodProgress.COMPLETED;
        if (kpis.isEmpty()) {
            return p.getEndDate() != null && p.getEndDate().isBefore(now)
                    ? PeriodProgress.COMPLETED : PeriodProgress.NOT_STARTED;
        }
        if (buckets.values().stream().allMatch(KpiProgressBucket::isFinal)) return PeriodProgress.COMPLETED;
        if (buckets.values().stream().allMatch(b -> b == KpiProgressBucket.DRAFT)) return PeriodProgress.NOT_STARTED;
        return PeriodProgress.IN_PROGRESS;
    }

    public KpiProgressBucket bucketOf(KpiCriteria kpi, Set<UUID> evaluatedUsers) {
        switch (kpi.getStatus()) {
            case DRAFT: return KpiProgressBucket.DRAFT;
            case PENDING_APPROVAL:
            case EDIT: return KpiProgressBucket.PENDING_APPROVAL;
            case REJECTED: return KpiProgressBucket.REJECTED;
            case INACTIVE:
            case REPLACED:
            case CLOSED_BY_LOCK: return KpiProgressBucket.CLOSED;
            default: break; // APPROVED, EDITED — xét tiếp kết quả và đánh giá
        }

        // KPI cha phân rã không tự nộp/tự chấm: kết quả nằm ở các KPI con (được xét riêng).
        boolean decompositionParent = kpi.getChildren() != null && kpi.getChildren().stream()
                .anyMatch(c -> c.getParentRelationType() == KpiParentRelationType.DECOMPOSITION);
        if (decompositionParent) return KpiProgressBucket.COMPLETED;

        int required = requiredSubmissions(kpi);
        List<KpiSubmission> subs = kpi.getSubmissions() == null ? List.of() : kpi.getSubmissions().stream()
                .filter(s -> s.getDeletedAt() == null && s.getStatus() != SubmissionStatus.DRAFT
                        && s.getStatus() != SubmissionStatus.RETURNED)
                .toList();

        // KPI giao cho đơn vị (không có người được giao): xét bài nộp của bất kỳ ai, không đòi đánh giá cá nhân.
        List<User> assignees = kpi.getAssignees() == null ? List.of() : kpi.getAssignees();
        if (assignees.isEmpty()) {
            return submissionBucket(subs, required, true);
        }

        KpiProgressBucket worst = KpiProgressBucket.COMPLETED;
        for (User u : assignees) {
            List<KpiSubmission> mine = subs.stream()
                    .filter(s -> s.getSubmittedBy() != null && s.getSubmittedBy().getId().equals(u.getId()))
                    .toList();
            KpiProgressBucket b = submissionBucket(mine, required, evaluatedUsers.contains(u.getId()));
            if (b.ordinal() < worst.ordinal()) worst = b;
        }
        return worst;
    }

    private KpiProgressBucket submissionBucket(List<KpiSubmission> subs, int required, boolean evaluated) {
        // Lần mới nhất của mỗi khoảng báo cáo. Bài nộp không ghi khoảng thì mỗi bài là một khoảng riêng.
        Map<Object, KpiSubmission> latest = new HashMap<>();
        for (KpiSubmission s : subs) {
            Object key = s.getPeriodStart() != null && s.getPeriodEnd() != null
                    ? List.of(s.getPeriodStart(), s.getPeriodEnd()) : s.getId();
            latest.merge(key, s, (a, b) -> createdAt(b).isAfter(createdAt(a)) ? b : a);
        }
        long counted = latest.values().stream()
                .filter(s -> s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING)
                .count();
        if (counted < required) return KpiProgressBucket.NOT_SUBMITTED;
        boolean pending = latest.values().stream().anyMatch(s -> s.getStatus() == SubmissionStatus.PENDING);
        if (pending) return KpiProgressBucket.SUBMISSION_PENDING;
        return evaluated ? KpiProgressBucket.COMPLETED : KpiProgressBucket.AWAITING_EVALUATION;
    }

    private static Instant createdAt(KpiSubmission s) {
        return s.getCreatedAt() != null ? s.getCreatedAt() : Instant.EPOCH;
    }

    /** Số lần nộp cần có — cùng công thức với màn hình; KPI "không giới hạn" chỉ cần ít nhất một lần. */
    int requiredSubmissions(KpiCriteria kpi) {
        if (kpi.getExpectedSubmissions() != null && kpi.getExpectedSubmissions() > 0) return kpi.getExpectedSubmissions();
        if (kpi.getFrequency() == KpiFrequency.UNLIMITED) return 1;
        return Math.max(1, kpiCriteriaMapper.calculateExpected(kpi));
    }
}
