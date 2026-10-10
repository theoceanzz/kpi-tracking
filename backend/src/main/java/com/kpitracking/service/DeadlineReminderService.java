package com.kpitracking.service;

import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiReminder;
import com.kpitracking.entity.User;
import com.kpitracking.enums.KpiFrequency;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiReminderRepository;
import com.kpitracking.repository.KpiSubmissionRepository;
import com.kpitracking.service.notification.NotificationDispatcher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeadlineReminderService {

    /** Số id tối đa trong một mệnh đề IN. */
    private static final int IN_CHUNK = 1000;

    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final KpiSubmissionRepository kpiSubmissionRepository;
    private final KpiReminderRepository kpiReminderRepository;
    private final NotificationDispatcher dispatcher;

    /** Một lời nhắc đến hạn: người được giao {@code user} của KPI {@code kpi}, lượt nộp thứ {@code batchNumber}. */
    public record DueReminder(KpiCriteria kpi, User user, int batchNumber, int percentage) {}

    // Chạy đầu mỗi giờ.
    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void processDeadlineReminders() {
        List<DueReminder> due = findDueReminders(Instant.now());
        for (DueReminder r : due) {
            try {
                sendReminder(r);
            } catch (jakarta.persistence.EntityNotFoundException e) {
                // Tham chiếu mồ côi (đã xoá mềm) -> bỏ qua lời nhắc này, không làm hỏng cả lượt.
                log.warn("Bỏ qua nhắc deadline KPI {}: tham chiếu đã bị xoá. {}", r.kpi().getId(), e.getMessage());
            }
        }
        if (!due.isEmpty()) log.info("Nhắc deadline KPI: đã gửi {} lời nhắc", due.size());
    }

    /**
     * Ai cần được nhắc lúc {@code now} — chỉ đọc, không gửi.
     *
     * <p>Trước đây: nạp MỌI KPI đã duyệt của mọi tổ chức, rồi với từng người được giao hỏi DB hai lần (đếm bài nộp,
     * đã nhắc chưa) — log prod 7–9s mỗi giờ. Giờ: một truy vấn lấy đúng KPI đang trong khung nộp (nạp sẵn đợt, đợt
     * đánh giá, đơn vị → tổ chức, người được giao), một truy vấn đếm bài nộp gộp theo (KPI, người), một truy vấn các
     * lời nhắc đã gửi — chỉ cho KPI có người đến hạn. Luật tính lượt/mốc nhắc giữ nguyên
     * ({@code DeadlineReminderPlanIT} so với thuật toán cũ trên dữ liệu thật).
     */
    @Transactional(readOnly = true)
    public List<DueReminder> findDueReminders(Instant now) {
        List<KpiCriteria> candidates = kpiCriteriaRepository.findDeadlineReminderCandidates(
                KpiStatus.APPROVED, KpiFrequency.UNLIMITED, now);
        if (candidates.isEmpty()) return List.of();

        Map<String, Long> submissionCounts = new HashMap<>();
        for (Object[] row : inChunks(candidates.stream().map(KpiCriteria::getId).toList(),
                kpiSubmissionRepository::countActiveByKpiAndSubmitter)) {
            submissionCounts.put(key(row[0], row[1]), ((Number) row[2]).longValue());
        }

        List<DueReminder> due = new ArrayList<>();
        for (KpiCriteria kpi : candidates) {
            // Kỳ đã khoá: KPI không nộp được nữa, nhắc hạn chỉ gây nhiễu.
            if (EvaluationReminderService.isClosedForReminders(kpi.getKpiPeriod())) continue;

            long start = kpi.getKpiPeriod().getStartDate().toEpochMilli();
            long end = kpi.getEffectiveDeadline().toEpochMilli();
            int expected = kpi.getExpectedSubmissions() != null ? kpi.getExpectedSubmissions() : calculateExpected(kpi);
            long totalDuration = end - start;
            if (totalDuration <= 0 || expected <= 0) continue; // truy vấn đã loại hạn ≤ bắt đầu; phòng hờ
            long batchDuration = totalDuration / expected;

            Integer pct = kpi.getOrgUnit().getOrgHierarchyLevel().getOrganization().getKpiReminderPercentage();
            int percentage = pct != null ? pct : 50;

            for (User assignee : kpi.getAssignees()) {
                long subCount = submissionCounts.getOrDefault(key(kpi.getId(), assignee.getId()), 0L);
                if (subCount >= expected) continue;
                int nextBatch = (int) subCount + 1;
                long batchStart = start + (nextBatch - 1) * batchDuration;
                long batchEnd = start + nextBatch * batchDuration;
                Instant reminderInstant = Instant.ofEpochMilli(batchStart + (batchDuration * percentage / 100));
                if (now.isAfter(reminderInstant) && now.isBefore(Instant.ofEpochMilli(batchEnd))) {
                    due.add(new DueReminder(kpi, assignee, nextBatch, percentage));
                }
            }
        }
        if (due.isEmpty()) return due;

        Set<String> alreadySent = new HashSet<>();
        for (Object[] row : inChunks(due.stream().map(r -> r.kpi().getId()).distinct().toList(),
                kpiReminderRepository::findSentKeys)) {
            alreadySent.add(key(row[0], row[1]) + "|" + row[2]);
        }
        due.removeIf(r -> alreadySent.contains(key(r.kpi().getId(), r.user().getId()) + "|" + r.batchNumber()));
        return due;
    }

    private void sendReminder(DueReminder r) {
        KpiCriteria kpi = r.kpi();
        LocalizedText title = LocalizedText.of("notif.reminder.deadline.title", kpi.getName());
        LocalizedText message = LocalizedText.of("notif.reminder.deadline.message",
                r.percentage(), r.batchNumber(), kpi.getName());

        UUID orgId = kpi.getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();

        // Lượt quét chạy mỗi giờ và duyệt qua TOÀN BỘ chỉ tiêu: một người đang trễ 8 chỉ
        // tiêu từng nhận đúng 8 lá thư trong cùng một phút. Qua dispatcher thì cả 8 gộp
        // thành một thư "8 chỉ tiêu sắp tới hạn".
        dispatcher.dispatch(orgId, "reminder_deadline", r.user(), kpi.getOrgUnit(),
                title, message, "DEADLINE_REMINDER", kpi.getId());

        kpiReminderRepository.save(KpiReminder.builder()
                .kpiCriteria(kpi)
                .user(r.user())
                .batchNumber(r.batchNumber())
                .build());
        log.debug("Sent {}% reminder to {} for KPI '{}' (Batch {})",
                r.percentage(), r.user().getEmail(), kpi.getName(), r.batchNumber());
    }

    private static String key(Object kpiId, Object userId) {
        return kpiId + "|" + userId;
    }

    private static List<Object[]> inChunks(List<UUID> ids, Function<Collection<UUID>, List<Object[]>> query) {
        List<Object[]> rows = new ArrayList<>();
        for (int i = 0; i < ids.size(); i += IN_CHUNK) {
            rows.addAll(query.apply(ids.subList(i, Math.min(ids.size(), i + IN_CHUNK))));
        }
        return rows;
    }

    static int calculateExpected(KpiCriteria kpi) {
        if (kpi.getFrequency() == null || kpi.getKpiPeriod() == null || kpi.getKpiPeriod().getPeriodType() == null) {
            return 1;
        }
        KpiFrequency kpiFreq = kpi.getFrequency();
        KpiFrequency periodType = kpi.getKpiPeriod().getPeriodType();

        if (kpiFreq == periodType) return 1;
        if (kpiFreq == KpiFrequency.DAILY) {
            if (periodType == KpiFrequency.MONTHLY) return 30;
            if (periodType == KpiFrequency.QUARTERLY) return 90;
            if (periodType == KpiFrequency.YEARLY) return 365;
        }
        if (kpiFreq == KpiFrequency.WEEKLY) {
            if (periodType == KpiFrequency.MONTHLY) return 4;
            if (periodType == KpiFrequency.QUARTERLY) return 13;
            if (periodType == KpiFrequency.YEARLY) return 52;
        }
        if (kpiFreq == KpiFrequency.MONTHLY) {
            if (periodType == KpiFrequency.QUARTERLY) return 3;
            if (periodType == KpiFrequency.YEARLY) return 12;
        }
        if (kpiFreq == KpiFrequency.QUARTERLY && periodType == KpiFrequency.YEARLY) return 4;
        return 1;
    }
}
