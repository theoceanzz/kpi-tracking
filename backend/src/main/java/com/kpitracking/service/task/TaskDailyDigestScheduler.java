package com.kpitracking.service.task;

import com.kpitracking.entity.organization.OrgUnit;
import com.kpitracking.entity.user.User;
import com.kpitracking.entity.user.UserRoleOrgUnit;
import com.kpitracking.enums.user.UserStatus;
import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.repository.task.KpiTaskRepository;
import com.kpitracking.repository.notification.NotificationRepository;
import com.kpitracking.repository.user.UserRepository;
import com.kpitracking.repository.user.UserRoleOrgUnitRepository;
import com.kpitracking.service.notification.NotificationDispatcher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Bản tóm tắt buổi sáng như Task Assistant của Lark: 10:00 giờ Việt Nam mỗi người thực hiện nhận MỘT thông báo "X việc
 * quá hạn, Y việc đến hạn hôm nay, Z việc đến hạn ngày mai" (bấm mở "Tôi phụ trách"). Không có việc nào thì không gửi. Số liệu lấy bằng một truy vấn
 * gộp; mỗi người tối đa một bản mỗi ngày (chạy lại / nhiều máy chủ không gửi trùng). Tổ chức tắt được qua mã
 * {@code task_daily_digest} trong cấu hình thông báo.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TaskDailyDigestScheduler {

    public static final String NOTIFICATION_TYPE = "TASK_DIGEST";
    public static final String EVENT_CODE = "task_daily_digest";

    private final KpiTaskRepository taskRepository;
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final com.kpitracking.service.PrimaryUnitResolver primaryUnits;
    private final NotificationDispatcher dispatcher;

    @Scheduled(cron = "${app.tasks.digest-cron:0 0 10 * * *}", zone = "Asia/Ho_Chi_Minh")
    public void run() {
        int sent = send(KpiTaskService.today());
        if (sent > 0) log.info("Tóm tắt việc buổi sáng: gửi {} người", sent);
    }

    /** Gửi bản tóm tắt cho ngày {@code today}; trả số người đã gửi. */
    public int send(LocalDate today) {
        return send(today, id -> true);
    }

    /** Như trên nhưng chỉ cho những người {@code only} nhận (test chạy trên DB dev không gửi cho người thật). */
    int send(LocalDate today, java.util.function.Predicate<UUID> only) {
        Instant startOfDay = today.atStartOfDay(KpiTaskService.ZONE).toInstant();
        Set<UUID> already = new HashSet<>(notificationRepository.usersNotifiedSince(NOTIFICATION_TYPE, startOfDay));
        List<Object[]> rows = taskRepository.digestCounts(today).stream()
                .filter(r -> only.test((UUID) r[0]) && !already.contains((UUID) r[0])).toList();
        if (rows.isEmpty()) return 0;
        Map<UUID, User> users = userRepository.findAllById(rows.stream().map(r -> (UUID) r[0]).collect(Collectors.toSet())).stream()
                .filter(u -> u.getDeletedAt() == null && u.getStatus() == UserStatus.ACTIVE)
                .collect(Collectors.toMap(User::getId, Function.identity()));
        Set<UUID> done = new HashSet<>();
        int sent = 0;
        for (Object[] r : rows) {
            UUID userId = (UUID) r[0];
            User u = users.get(userId);
            long dueToday = ((Number) r[2]).longValue(), overdue = ((Number) r[3]).longValue(), tomorrow = ((Number) r[4]).longValue();
            // Người thuộc nhiều tổ chức: mỗi người một bản (tổ chức đầu tiên có việc).
            if (u == null || dueToday + overdue + tomorrow == 0 || !done.add(userId)) continue;
            try {
                dispatcher.dispatchInAppOnly((UUID) r[1], EVENT_CODE, u, unitOf(u),
                        LocalizedText.of("notif.task.digest.title"),
                        LocalizedText.of("notif.task.digest.message", overdue, dueToday, tomorrow), NOTIFICATION_TYPE, null);
                sent++;
            } catch (Exception e) {
                log.error("Không gửi được tóm tắt việc cho {}", userId, e);
            }
        }
        return sent;
    }

    private OrgUnit unitOf(User u) {
        return primaryUnits.unitOf(u);
    }
}
