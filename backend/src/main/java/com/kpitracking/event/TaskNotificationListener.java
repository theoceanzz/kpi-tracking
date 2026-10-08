package com.kpitracking.event;

import com.kpitracking.entity.*;
import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.repository.*;
import com.kpitracking.service.NotificationService;
import com.kpitracking.service.OrgNotificationConfigService;
import com.kpitracking.service.kpi.KpiAccessPolicy;
import com.kpitracking.service.notification.NotificationDispatcher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Hậu xử lý của công việc, chạy SAU COMMIT:
 * <ul>
 *   <li>WebSocket: {@code /topic/task.{id}} cho bảng chi tiết đang mở (SUBSCRIBE bị chặn với người không xem được), và
 *       {@code /user/queue/tasks} cho người phụ trách / người tạo / người theo dõi (+ người phụ trách cũ khi giao lại) để
 *       danh sách tự làm mới. Gói tin chỉ mang id.</li>
 *   <li>Thông báo: được giao việc, bị giao lại (người cũ), được thêm theo dõi — riêng từng cái; đổi hạn / đổi trạng
 *       thái / hoàn thành báo người phụ trách + người tạo + người theo dõi (trừ người làm), GỘP trong 5 phút.</li>
 *   <li>KPI cũ được thay ⇒ báo người còn việc dở ở KPI cũ.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TaskNotificationListener {

    public static final String TYPE_KPI_REPLACED = "TASK_KPI_REPLACED";
    public static final String TYPE_TASK = "TASK";
    private static final Duration GROUP_WINDOW = Duration.ofMinutes(5);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final KpiTaskRepository taskRepository;
    private final KpiTaskFollowerRepository followerRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final NotificationDispatcher dispatcher;
    private final NotificationService notificationService;
    private final NotificationRepository notificationRepository;
    private final OrgNotificationConfigService configService;
    private final SimpMessagingTemplate messagingTemplate;

    public static String topic(UUID taskId) {
        return "/topic/task." + taskId;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onChanged(TaskEvents.Changed e) {
        // Task đã xoá mềm không nạp lại được (SQLRestriction) — vẫn đẩy gói "đã xoá" để màn đang mở tự đóng.
        KpiTask task = taskRepository.findById(e.taskId()).orElse(null);
        Map<String, Object> payload = new HashMap<>();
        payload.put("taskId", e.taskId());
        payload.put("kind", e.kind().name());
        payload.put("actorId", e.actorId());
        try {
            messagingTemplate.convertAndSend(topic(e.taskId()), payload);
        } catch (Exception ex) {
            log.warn("Không đẩy được thay đổi công việc {} qua WebSocket", e.taskId(), ex);
        }
        if (task == null) return;

        Set<UUID> audience = audience(task);
        if (e.previousOwnerId() != null) audience.add(e.previousOwnerId());
        if (e.subjectUserId() != null) audience.add(e.subjectUserId());
        for (User u : userRepository.findAllById(audience)) {
            try {
                messagingTemplate.convertAndSendToUser(u.getEmail(), "/queue/tasks", payload);
            } catch (Exception ex) {
                log.debug("Không đẩy được gói làm mới danh sách cho {}", u.getId());
            }
        }
        notify(task, e);
    }

    private void notify(KpiTask task, TaskEvents.Changed e) {
        User actor = e.actorId() == null ? null : userRepository.findById(e.actorId()).orElse(null);
        String actorName = actor != null ? actor.getFullName() : "";
        KpiCriteria kpi = kpiCriteriaRepository.findById(task.getKpiCriteriaId()).orElse(null);
        String kpiName = kpi != null ? kpi.getName() : task.getKpiNameSnapshot();
        UUID orgId = task.getOrganizationId();
        switch (e.kind()) {
            case ASSIGNED -> {
                User owner = task.getOwner();
                if (!owner.getId().equals(e.actorId())) {
                    dispatcher.dispatch(orgId, "task_assigned", owner, unitFor(kpi, owner),
                            LocalizedText.of("notif.task.assigned.title"),
                            LocalizedText.of("notif.task.assigned.message", actorName, task.getTitle(), kpiName),
                            TYPE_TASK, task.getId());
                }
                if (e.previousOwnerId() != null && !e.previousOwnerId().equals(e.actorId())) {
                    userRepository.findById(e.previousOwnerId()).ifPresent(old -> dispatcher.dispatch(orgId, "task_assigned", old,
                            unitFor(kpi, old), LocalizedText.of("notif.task.unassigned.title"),
                            LocalizedText.of("notif.task.unassigned.message", actorName, task.getTitle(), owner.getFullName()),
                            TYPE_TASK, task.getId()));
                }
            }
            case FOLLOWER_ADDED -> {
                if (e.subjectUserId() != null && !e.subjectUserId().equals(e.actorId())) {
                    userRepository.findById(e.subjectUserId()).ifPresent(f -> dispatcher.dispatchInAppOnly(orgId, "task_follower_added", f,
                            unitFor(kpi, f), LocalizedText.of("notif.task.followerAdded.title"),
                            LocalizedText.of("notif.task.followerAdded.message", actorName, task.getTitle()),
                            TYPE_TASK, task.getId()));
                }
            }
            case DUE_CHANGED, STATUS_CHANGED, COMPLETED -> {
                LocalizedText message = switch (e.kind()) {
                    case DUE_CHANGED -> LocalizedText.of("notif.task.changed.due", actorName, task.getTitle(),
                            task.getDueDate() == null ? LocalizedText.of("task.noDue")
                                    : task.getDueTime() == null ? DATE.format(task.getDueDate())
                                    : DATE.format(task.getDueDate()) + " " + task.getDueTime());
                    case COMPLETED -> LocalizedText.of("notif.task.changed.done", actorName, task.getTitle());
                    default -> LocalizedText.of("notif.task.changed.status", actorName, task.getTitle(),
                            LocalizedText.of("task.status." + task.getStatus().name()));
                };
                Set<UUID> to = audience(task);
                to.remove(e.actorId());
                for (User u : userRepository.findAllById(to)) notifyGrouped(task, kpi, u, message);
            }
            default -> { }
        }
    }

    /** Đổi hạn / trạng thái liên tiếp ⇒ sửa thông báo chưa đọc trong 5 phút thành "N thay đổi mới", không rải chuông. */
    private void notifyGrouped(KpiTask task, KpiCriteria kpi, User to, LocalizedText message) {
        try {
            if (!configService.isSystemEnabled(task.getOrganizationId(), "task_changed")) return;
            LocalizedText title = LocalizedText.of("notif.task.changed.title");
            Optional<Notification> existing = notificationRepository.findRecentUnread(to.getId(), "TASK_CHANGED", task.getId(),
                    Instant.now().minus(GROUP_WINDOW));
            if (existing.isPresent()) {
                Notification n = existing.get();
                long count = countGrouped(n) + 1;
                notificationService.refreshNotification(n, title,
                        LocalizedText.of("notif.task.changed.grouped", task.getTitle(), count));
            } else {
                notificationService.createNotification(unitFor(kpi, to), to, title, message, "TASK_CHANGED", task.getId());
            }
        } catch (Exception ex) {
            log.error("Không phát được thông báo thay đổi công việc {} cho {}", task.getId(), to.getId(), ex);
        }
    }

    /** Thông báo gộp đang mang số đếm ở tham số cuối; thông báo đơn = 1. */
    private static long countGrouped(Notification n) {
        LocalizedText t = LocalizedText.fromJson(n.getMessageI18n());
        if (t != null && "notif.task.changed.grouped".equals(t.key()) && t.args().size() > 1
                && t.args().get(1) instanceof Number num) {
            return num.longValue();
        }
        return 1;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onKpiReplaced(TaskEvents.KpiReplaced e) {
        KpiCriteria oldKpi = kpiCriteriaRepository.findById(e.oldKpiId()).orElse(null);
        KpiCriteria newKpi = kpiCriteriaRepository.findById(e.newKpiId()).orElse(null);
        if (oldKpi == null || newKpi == null) return;
        UUID orgId = KpiAccessPolicy.organizationIdOf(newKpi);
        for (Object[] row : taskRepository.countOpenByOwner(oldKpi.getId())) {
            UUID ownerId = row[0] instanceof UUID u ? u : UUID.fromString(row[0].toString());
            long count = ((Number) row[1]).longValue();
            userRepository.findById(ownerId).ifPresent(owner -> dispatcher.dispatchInAppOnly(orgId, "task_kpi_replaced",
                    owner, newKpi.getOrgUnit(),
                    LocalizedText.of("notif.task.kpiReplaced.title"),
                    LocalizedText.of("notif.task.kpiReplaced.message", oldKpi.getName(), newKpi.getName(), count),
                    TYPE_KPI_REPLACED, newKpi.getId()));
        }
    }

    /** Người phụ trách + người tạo + người theo dõi. */
    private Set<UUID> audience(KpiTask task) {
        Set<UUID> ids = new LinkedHashSet<>();
        ids.add(task.getOwner().getId());
        if (task.getCreatedBy() != null) ids.add(task.getCreatedBy());
        ids.addAll(followerRepository.findUserIds(task.getId()));
        return ids;
    }

    private OrgUnit unitFor(KpiCriteria kpi, User to) {
        if (kpi != null && kpi.getOrgUnit() != null) return kpi.getOrgUnit();
        return userRoleOrgUnitRepository.findByUserId(to.getId()).stream()
                .map(UserRoleOrgUnit::getOrgUnit).findFirst().orElse(null);
    }
}
