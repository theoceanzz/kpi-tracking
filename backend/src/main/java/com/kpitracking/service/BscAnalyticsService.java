package com.kpitracking.service;

import com.kpitracking.dto.response.stats.BscAnalyticsResponses.*;
import com.kpitracking.repository.EvaluationPerspectiveScoreRepository;
import com.kpitracking.repository.EvaluationRepository;
import com.kpitracking.service.analytics.AnalyticsScopeResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Xếp hạng nhân sự theo điểm BSC — ô duy nhất của tab "Hạng mục BSC" còn đọc điểm đánh giá cá
 * nhân; các ô tổng quan khác đi qua {@link BscOverviewService} (mô hình thẻ điểm).
 *
 * <p>Nguyên tắc: GỘP điểm ĐÃ LƯU ({@code evaluations.bsc_score} + {@code evaluation_perspective_scores}),
 * KHÔNG tính lại. Vì trọng số BSC đóng băng theo kỳ và {@code weighted_score} đã cố định lúc chấm,
 * nên số liệu tự khớp với chỉ số "hiệu suất theo đánh giá".
 */
@Service
@RequiredArgsConstructor
public class BscAnalyticsService {

    private final AnalyticsScopeResolver scopeResolver;
    private final EvaluationRepository evaluationRepository;
    private final EvaluationPerspectiveScoreRepository perspectiveScoreRepository;

    // ============================================================
    // 5) Xếp hạng nhân sự theo điểm BSC + breakdown lĩnh vực
    // ============================================================

    @Transactional(readOnly = true)
    public RankingResponse getRankings(UUID orgUnitId, Collection<UUID> periodIds,
                                       String sortBy, String sortDir, int page, int size) {
        var s = scopeResolver.resolve(orgUnitId, periodIds);
        if (s.isEmpty()) return emptyRanking(page, size);

        // breakdown lĩnh vực theo nhân sự
        Map<UUID, Map<String, Double>> breakdown = new LinkedHashMap<>();
        Map<UUID, PerspectiveMeta> metas = new LinkedHashMap<>();
        for (Object[] r : perspectiveScoreRepository.aggregateByUserAndPerspective(s.unitIds(), s.periodIds())) {
            UUID uid = (UUID) r[0];
            UUID persId = (UUID) r[1];
            metas.putIfAbsent(persId, PerspectiveMeta.builder()
                    .id(persId).name((String) r[2]).color((String) r[3]).displayOrder(intg(r[4])).build());
            Double avg = dbl(r[5]);
            if (avg != null) breakdown.computeIfAbsent(uid, k -> new LinkedHashMap<>()).put(persId.toString(), round1(avg));
        }

        List<RankingRow> all = new ArrayList<>();
        for (Object[] r : evaluationRepository.bscOverallByUser(s.unitIds(), s.periodIds())) {
            UUID uid = (UUID) r[0];
            all.add(RankingRow.builder()
                    .userId(uid).fullName((String) r[1]).email((String) r[2])
                    .bscScore(round1(dbl(r[3]))).systemScore(round1(dbl(r[4])))
                    .evaluationCount(r[5] == null ? 0 : ((Number) r[5]).intValue())
                    .perspectiveScores(breakdown.getOrDefault(uid, Collections.emptyMap()))
                    .build());
        }

        boolean asc = "asc".equalsIgnoreCase(sortDir);
        java.util.function.Function<RankingRow, Double> key =
                "systemScore".equalsIgnoreCase(sortBy) ? RankingRow::getSystemScore : RankingRow::getBscScore;
        all.sort((a, b) -> {
            Double va = key.apply(a), vb = key.apply(b);
            if (va == null && vb == null) return 0;
            if (va == null) return 1;   // null luôn xuống cuối
            if (vb == null) return -1;
            return asc ? Double.compare(va, vb) : Double.compare(vb, va);
        });

        List<PerspectiveMeta> orderedMetas = metas.values().stream()
                .sorted(java.util.Comparator.comparing(m -> m.getDisplayOrder() == null ? 0 : m.getDisplayOrder()))
                .collect(Collectors.toList());

        long total = all.size();
        int from = Math.min(page * size, all.size());
        int to = Math.min(from + size, all.size());
        List<RankingRow> content = all.subList(from, to);
        int totalPages = size > 0 ? (int) Math.ceil((double) total / size) : 0;
        return RankingResponse.builder()
                .perspectives(orderedMetas)
                .content(content)
                .page(page).size(size).totalElements(total).totalPages(totalPages)
                .first(page == 0).last(page >= totalPages - 1)
                .build();
    }

    private RankingResponse emptyRanking(int page, int size) {
        return RankingResponse.builder()
                .perspectives(Collections.emptyList()).content(Collections.emptyList())
                .page(page).size(size).totalElements(0).totalPages(0).first(true).last(true)
                .build();
    }

    // ============================================================
    // Helpers
    // ============================================================

    private static Double dbl(Object o) {
        return o == null ? null : ((Number) o).doubleValue();
    }

    private static Integer intg(Object o) {
        return o == null ? null : ((Number) o).intValue();
    }

    private static Double round1(Double v) {
        return v == null ? null : Math.round(v * 10.0) / 10.0;
    }
}
