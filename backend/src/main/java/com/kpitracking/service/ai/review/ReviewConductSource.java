package com.kpitracking.service.ai.review;

import com.kpitracking.entity.ConductCriteriaSet;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.Organization;
import com.kpitracking.repository.ConductCriteriaRepository;
import com.kpitracking.repository.ConductCriteriaSetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Tiêu chí hạnh kiểm áp cho đợt đang chấm (chỉ khi tổ chức bật hạnh kiểm): bộ gắn với kỳ của đợt, không có
 * thì bộ mặc định — cùng luật chọn bộ với màn đánh giá hạnh kiểm.
 */
@Component
@RequiredArgsConstructor
public class ReviewConductSource {

    private static final int MAX_DESCRIPTION = 300;

    private final ConductCriteriaSetRepository setRepository;
    private final ConductCriteriaRepository criteriaRepository;

    public List<ReviewContext.ConductRow> forPeriod(Organization org, KpiPeriod period) {
        if (org == null || !Boolean.TRUE.equals(org.getEnableConduct())) return List.of();
        ConductCriteriaSet set = null;
        if (period != null && period.getKpiCycle() != null) {
            set = setRepository.findByCycle(org.getId(), period.getKpiCycle().getId()).orElse(null);
        }
        if (set == null) set = setRepository.findByOrganizationIdAndIsDefaultTrue(org.getId()).orElse(null);
        if (set == null) return List.of();
        return criteriaRepository.findByCriteriaSetIdOrderByPositionAsc(set.getId()).stream()
                .filter(c -> c.getDeletedAt() == null)
                .map(c -> new ReviewContext.ConductRow(c.getName(), cut(c.getDescription()), c.getWeight()))
                .toList();
    }

    private static String cut(String s) {
        if (s == null) return null;
        String t = s.strip();
        return t.length() <= MAX_DESCRIPTION ? t : t.substring(0, MAX_DESCRIPTION) + "…";
    }
}
