package com.kpitracking.service;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.User;
import com.kpitracking.enums.KpiFrequency;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiReminderRepository;
import com.kpitracking.repository.KpiSubmissionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Nhắc deadline KPI sau khi bỏ N+1 (3 truy vấn gộp thay cho 2 truy vấn / người được giao) phải nhắc ĐÚNG những người
 * như thuật toán cũ. So trên dữ liệu thật của DB local, ở nhiều mốc thời gian rải trong các đợt có KPI đã duyệt.
 * Chỉ đọc. Chạy tay: {@code ./mvnw test -Dtest=DeadlineReminderPlanIT}.
 */
@SpringBootTest
@Transactional(readOnly = true)
class DeadlineReminderPlanIT {

    @Autowired DeadlineReminderService service;
    @Autowired KpiCriteriaRepository kpiCriteriaRepository;
    @Autowired KpiSubmissionRepository kpiSubmissionRepository;
    @Autowired KpiReminderRepository kpiReminderRepository;

    /** Thuật toán cũ (trước 2026-10-07), chép nguyên luật, hỏi DB từng người một. Trả "kpiId|userId|lượt". */
    private Set<String> legacyPlan(Instant now) {
        Set<String> out = new HashSet<>();
        for (KpiCriteria kpi : kpiCriteriaRepository.findByStatus(KpiStatus.APPROVED)) {
            try {
                Instant effectiveDeadline = kpi.getEffectiveDeadline();
                if (kpi.getKpiPeriod() == null || kpi.getKpiPeriod().getStartDate() == null || effectiveDeadline == null) continue;
                if (EvaluationReminderService.isClosedForReminders(kpi.getKpiPeriod())) continue;
                if (kpi.getFrequency() == KpiFrequency.UNLIMITED) continue;
                long start = kpi.getKpiPeriod().getStartDate().toEpochMilli();
                long end = effectiveDeadline.toEpochMilli();
                int expected = kpi.getExpectedSubmissions() != null ? kpi.getExpectedSubmissions() : DeadlineReminderService.calculateExpected(kpi);
                long totalDuration = end - start;
                if (totalDuration <= 0) continue;
                long batchDuration = totalDuration / expected;
                for (User assignee : kpi.getAssignees()) {
                    long subCount = kpiSubmissionRepository.countByKpiCriteriaIdAndSubmittedByIdAndDeletedAtIsNull(kpi.getId(), assignee.getId());
                    if (subCount >= expected) continue;
                    int nextBatch = (int) subCount + 1;
                    long batchStart = start + (nextBatch - 1) * batchDuration;
                    long batchEnd = start + nextBatch * batchDuration;
                    Integer percentage = kpi.getOrgUnit().getOrgHierarchyLevel().getOrganization().getKpiReminderPercentage();
                    if (percentage == null) percentage = 50;
                    Instant reminderInstant = Instant.ofEpochMilli(batchStart + (batchDuration * percentage / 100));
                    if (now.isAfter(reminderInstant) && now.isBefore(Instant.ofEpochMilli(batchEnd))
                            && kpiReminderRepository.findByKpiCriteriaIdAndUserIdAndBatchNumber(kpi.getId(), assignee.getId(), nextBatch).isEmpty()) {
                        out.add(kpi.getId() + "|" + assignee.getId() + "|" + nextBatch);
                    }
                }
            } catch (jakarta.persistence.EntityNotFoundException ignored) {
                // như code cũ: KPI trỏ tới đợt/đơn vị đã xoá mềm thì bỏ qua
            }
        }
        return out;
    }

    private Set<String> newPlan(Instant now) {
        return service.findDueReminders(now).stream()
                .map(r -> r.kpi().getId() + "|" + r.user().getId() + "|" + r.batchNumber())
                .collect(Collectors.toSet());
    }

    /** Bây giờ + vài mốc trong các đợt có KPI đã duyệt (60%, 85%, 97% thời lượng đợt) — để có lời nhắc thật mà so. */
    private List<Instant> sampleInstants() {
        Set<Instant> instants = new LinkedHashSet<>();
        instants.add(Instant.now());
        kpiCriteriaRepository.findByStatus(KpiStatus.APPROVED).stream()
                .map(k -> {
                    try { return k.getKpiPeriod(); } catch (jakarta.persistence.EntityNotFoundException e) { return null; }
                })
                .filter(p -> p != null && p.getStartDate() != null && p.getEndDate() != null)
                .distinct()
                .limit(4)
                .forEach(p -> {
                    long s = p.getStartDate().toEpochMilli(), len = p.getEndDate().toEpochMilli() - s;
                    for (double f : new double[]{0.6, 0.85, 0.97}) instants.add(Instant.ofEpochMilli(s + (long) (len * f)));
                });
        return new ArrayList<>(instants);
    }

    @Test
    void sameRemindersAsLegacyAlgorithm_atManyInstants() {
        int nonEmpty = 0;
        for (Instant now : sampleInstants()) {
            Set<String> legacy = legacyPlan(now);
            assertThat(newPlan(now)).as("lúc %s", now).isEqualTo(legacy);
            if (!legacy.isEmpty()) nonEmpty++;
        }
        assertThat(nonEmpty).as("phải có ít nhất một mốc có lời nhắc thật, không thì phép so vô nghĩa").isPositive();
    }
}
