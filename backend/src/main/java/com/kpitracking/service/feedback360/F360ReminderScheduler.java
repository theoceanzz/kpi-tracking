package com.kpitracking.service.feedback360;

import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.entity.*;
import com.kpitracking.enums.F360CampaignStatus;
import com.kpitracking.event.F360NotificationEventListener;
import com.kpitracking.repository.EvaluationReminderRepository;
import com.kpitracking.repository.F360AssignmentRepository;
import com.kpitracking.repository.F360CampaignRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.notification.NotificationDispatcher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Nhắc hạn và tự đóng chiến dịch 360 (§9.4). Chạy mỗi giờ, lệch 45 phút so với hai lượt quét
 * nhắc hạn KPI để không cùng lúc nạp dữ liệu.
 *
 * <p>Mốc nhắc: mở được 3 ngày, còn 2 ngày, còn 1 ngày, quá hạn. Mỗi người chấm nhận MỘT thông
 * báo gộp mỗi mốc — chống gửi lặp bằng bảng {@code evaluation_reminders} sẵn có
 * ({@code scope = 'FEEDBACK360'}), không tạo bảng mới.
 *
 * <p>Mỗi chiến dịch chạy trong transaction riêng: một chiến dịch hỏng không kéo cả lượt quét.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class F360ReminderScheduler {

    private static final String SCOPE = "FEEDBACK360";
    /** Quá hạn bao lâu thì tự đóng (nếu chiến dịch bật tự đóng). */
    private static final Duration AUTO_CLOSE_GRACE = Duration.ofHours(24);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy")
            .withZone(ZoneId.of("Asia/Ho_Chi_Minh"));

    private final F360CampaignRepository campaignRepository;
    private final F360AssignmentRepository assignmentRepository;
    private final EvaluationReminderRepository reminderRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final NotificationDispatcher dispatcher;
    private final F360CampaignService campaignService;
    private final TransactionTemplate transactionTemplate;

    @Scheduled(cron = "0 45 * * * *")
    public void run() {
        Instant now = Instant.now();
        openScheduled(now);
        List<UUID> ids = campaignRepository.findByStatusIn(List.of(F360CampaignStatus.OPEN)).stream()
                .map(F360Campaign::getId).toList();
        for (UUID id : ids) {
            try {
                transactionTemplate.executeWithoutResult(tx -> process(id, now));
            } catch (Exception e) {
                log.warn("Bỏ qua lượt nhắc/đóng chiến dịch 360 {}: {}", id, e.getMessage());
            }
        }
    }

    /**
     * Tự khởi động nháp đã tới ngày mở. Nháp chưa đủ điều kiện (chưa có người, chưa sinh người chấm…)
     * thì bỏ qua và thử lại lượt sau; trang chi tiết chỉ cho HR bước còn thiếu.
     */
    private void openScheduled(Instant now) {
        for (F360Campaign draft : campaignRepository.findDraftsDueToOpen(now)) {
            UUID id = draft.getId();
            try {
                transactionTemplate.executeWithoutResult(tx -> {
                    F360Campaign c = campaignRepository.findById(id).orElse(null);
                    if (c == null || c.getStatus() != F360CampaignStatus.DRAFT) return;
                    if (!Boolean.TRUE.equals(c.getOrganization().getEnableFeedback360())) return;
                    campaignService.launchInternal(c, null);
                    log.info("Tự khởi động chiến dịch 360 {} theo ngày mở dự kiến", id);
                });
            } catch (Exception e) {
                log.warn("Chưa tự khởi động được chiến dịch 360 {}: {}", id, e.getMessage());
            }
        }
    }

    private void process(UUID campaignId, Instant now) {
        F360Campaign c = campaignRepository.findById(campaignId).orElse(null);
        if (c == null || c.getStatus() != F360CampaignStatus.OPEN || c.getDueAt() == null) return;
        if (!Boolean.TRUE.equals(c.getOrganization().getEnableFeedback360())) return;

        if (Boolean.TRUE.equals(c.getAutoClose()) && now.isAfter(c.getDueAt().plus(AUTO_CLOSE_GRACE))) {
            campaignService.closeInternal(c, null);
            log.info("Tự đóng chiến dịch 360 {} vì đã quá hạn", c.getId());
            return;
        }

        String milestone = milestone(c, now);
        if (milestone == null) return;

        Map<UUID, List<F360Assignment>> openByRater = new LinkedHashMap<>();
        for (F360Assignment a : assignmentRepository.findByCampaignId(c.getId())) {
            if (a.getStatus().open()) openByRater.computeIfAbsent(a.getRater().getId(), x -> new ArrayList<>()).add(a);
        }
        UUID orgId = c.getOrganization().getId();
        for (List<F360Assignment> list : openByRater.values()) {
            User rater = list.get(0).getRater();
            OrgUnit unit = primaryUnit(rater);
            if (unit == null) continue;
            if (reminderRepository.existsByScopeAndTargetIdAndOrgUnitIdAndUserIdAndMilestone(
                    SCOPE, c.getId(), unit.getId(), rater.getId(), milestone)) continue;

            boolean overdue = "OVERDUE".equals(milestone);
            LocalizedText title = LocalizedText.of(overdue ? "notif.f360.overdue.title" : "notif.f360.reminder.title");
            LocalizedText message = LocalizedText.of("notif.f360.scheduled.message",
                    list.size(), c.getName(),
                    LocalizedText.of(overdue ? "notif.f360.scheduled.overdue" : "notif.f360.scheduled.due", DATE.format(c.getDueAt())));
            dispatcher.dispatch(orgId, "f360_reminder", rater, unit, title, message,
                    F360NotificationEventListener.TYPE, c.getId());
            reminderRepository.save(EvaluationReminder.builder()
                    .scope(SCOPE).targetId(c.getId()).orgUnit(unit).user(rater)
                    .milestone(milestone).pendingCount(list.size()).build());
            list.forEach(a -> a.setLastRemindedAt(now));
            assignmentRepository.saveAll(list);
        }
    }

    /** Mốc nhắc hiện tại, hoặc null nếu chưa tới mốc nào. Mốc gần hạn hơn thắng mốc xa hơn. */
    static String milestone(F360Campaign c, Instant now) {
        Instant due = c.getDueAt();
        if (!now.isBefore(due)) return "OVERDUE";
        if (!now.isBefore(due.minus(Duration.ofDays(1)))) return "DUE_1D";
        if (!now.isBefore(due.minus(Duration.ofDays(2)))) return "DUE_2D";
        if (c.getLaunchedAt() != null && !now.isBefore(c.getLaunchedAt().plus(Duration.ofDays(3)))) return "OPEN_3D";
        return null;
    }

    private OrgUnit primaryUnit(User user) {
        return userRoleOrgUnitRepository.findByUserId(user.getId()).stream()
                .filter(a -> a.getOrgUnit() != null && a.getRole() != null)
                .min(Comparator.comparingInt(a -> a.getRole().getRank() == null ? Integer.MAX_VALUE : a.getRole().getRank()))
                .map(UserRoleOrgUnit::getOrgUnit)
                .orElse(null);
    }
}
