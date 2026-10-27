package com.kpitracking.event;


import com.kpitracking.i18n.LocalizedText;

import com.kpitracking.service.notification.NotificationService;
import com.kpitracking.service.notification.OrgNotificationConfigService;
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

import com.kpitracking.entity.kpi.KpiCriteria;
import com.kpitracking.entity.notification.Notification;
import com.kpitracking.entity.organization.OrgUnit;
import com.kpitracking.entity.task.KpiTask;
import com.kpitracking.entity.task.TaskList;
import com.kpitracking.entity.user.User;
import com.kpitracking.entity.user.UserRoleOrgUnit;
import com.kpitracking.repository.kpi.KpiCriteriaRepository;
import com.kpitracking.repository.notification.NotificationRepository;
import com.kpitracking.repository.task.KpiTaskAssigneeRepository;
import com.kpitracking.repository.task.KpiTaskFollowerRepository;
import com.kpitracking.repository.task.KpiTaskRepository;
import com.kpitracking.repository.task.TaskListRepository;
import com.kpitracking.repository.user.UserRepository;
import com.kpitracking.repository.user.UserRoleOrgUnitRepository;
/**
 * Hậu xử lý của công việc, chạy SAU COMMIT:
 * <ul>
 *   <li>WebSocket: {@code /topic/task.{id}} cho bảng chi tiết đang mở (SUBSCRIBE bị chặn với người không xem được), và
 *       {@code /user/queue/tasks} cho người phụ trách / người tạo / người theo dõi (+ người phụ trách cũ khi giao lại) để
 *       danh sách tự làm mới. Gói tin chỉ mang id.</li>
 *   <li>Thông báo: được giao việc, bị giao lại (người cũ), được thêm theo dõi — riêng từng cái; đổi hạn / đổi trạng
 *       thái / hoàn thành báo người phụ trách + người tạo + người theo dõi (trừ người làm), GỘP trong 5 phút.</li>
 *   <li>KPI cũ được thay ⇒ báo người còn việc dở ở KPI cũ.</li>
 *   <li>Đổi KPI làm người theo dõi bị gỡ (không xem được KPI mới) ⇒ báo người đó, gộp theo lượt đổi.</li>
 *   <li>Người được giao từ chối việc ⇒ báo người giao kèm lý do.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TaskNotificationListener {

    public static final String TYPE_KPI_REPLACED = "TASK_KPI_REPLACED";
    public static final String TYPE_TASK = "TASK";
    public static final String TYPE_FOLLOWER_REMOVED = "TASK_FOLLOWER_REMOVED";
    public static final String TYPE_TASK_LIST = "TASK_LIST";
    private static final Duration GROUP_WINDOW = Duration.ofMinutes(5);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final KpiTaskRepository taskRepository;
    private final KpiTaskFollowerRepository followerRepository;
    private final KpiTaskAssigneeRepository assigneeRepository;
    private final TaskListRepository taskListRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final com.kpitracking.service.PrimaryUnitResolver primaryUnits;
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
        KpiCriteria kpi = task.getKpiCriteriaId() == null ? null : kpiCriteriaRepository.findById(task.getKpiCriteriaId()).orElse(null);
        String kpiName = kpi != null ? kpi.getName() : task.getKpiNameSnapshot();
        UUID orgId = task.getOrganizationId();
        switch (e.kind()) {
            case ASSIGNED -> {
                // subject = người VỪA được giao; null + không có người cũ = sự kiện kiểu cũ ⇒ báo người chính.
                UUID to = e.subjectUserId() != null ? e.subjectUserId() : e.previousOwnerId() == null ? task.getOwner().getId() : null;
                if (to != null && !to.equals(e.actorId())) {
                    userRepository.findById(to).ifPresent(u -> dispatcher.dispatch(orgId, "task_assigned", u, unitFor(kpi, u),
                            LocalizedText.of("notif.task.assigned.title"),
                            kpiName != null
                                    ? LocalizedText.of("notif.task.assigned.message", actorName, task.getTitle(), kpiName)
                                    : LocalizedText.of("notif.task.assigned.messageNoKpi", actorName, task.getTitle()),
                            TYPE_TASK, task.getId()));
                }
                if (e.previousOwnerId() != null && !e.previousOwnerId().equals(e.actorId())) {
                    User owner = task.getOwner();
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
            case DUE_CHANGED, STATUS_CHANGED, COMPLETED, RESULT_ADDED -> {
                LocalizedText message = switch (e.kind()) {
                    case RESULT_ADDED -> LocalizedText.of("notif.task.changed.result", actorName, task.getTitle());
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

    /**
     * Bị gỡ khỏi người theo dõi vì việc chuyển sang KPI mình không xem được: làm mới danh sách "Tôi theo dõi" và báo MỘT
     * lần cho cả lượt đổi KPI. Không nêu tên KPI mới (họ không được xem) và không mở thẳng việc (họ không còn xem được) —
     * loại {@link #TYPE_FOLLOWER_REMOVED} chỉ dẫn về trang Công việc; {@code referenceId} vẫn là việc để tra cứu.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onFollowersRevoked(TaskEvents.FollowersRevoked e) {
        User user = userRepository.findById(e.userId()).orElse(null);
        if (user == null || e.taskIds().isEmpty()) return;
        for (UUID taskId : e.taskIds()) {
            Map<String, Object> payload = new HashMap<>();
            payload.put("taskId", taskId);
            payload.put("kind", TaskEvents.Kind.FOLLOWER_REMOVED.name());
            payload.put("actorId", e.actorId());
            try {
                messagingTemplate.convertAndSendToUser(user.getEmail(), "/queue/tasks", payload);
            } catch (Exception ex) {
                log.debug("Không đẩy được gói làm mới danh sách cho {}", user.getId());
            }
        }
        if (user.getId().equals(e.actorId())) return;
        KpiTask first = taskRepository.findById(e.taskIds().get(0)).orElse(null);
        if (first == null) return;
        String actorName = e.actorId() == null ? "" : userRepository.findById(e.actorId()).map(User::getFullName).orElse("");
        LocalizedText message = e.taskIds().size() == 1
                ? LocalizedText.of("notif.task.followerRevoked.message", actorName, first.getTitle())
                : LocalizedText.of("notif.task.followerRevoked.messageMany", actorName, e.taskIds().size(), first.getTitle());
        dispatcher.dispatchInAppOnly(first.getOrganizationId(), "task_follower_removed", user, unitFor(null, user),
                LocalizedText.of("notif.task.followerRevoked.title"), message, TYPE_FOLLOWER_REMOVED, first.getId());
    }

    /**
     * Người từ chối việc ⇒ báo người giao (người tạo) kèm lý do. Đi cả email gộp như "được giao": người giao cần biết để
     * giao lại.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onDeclined(TaskEvents.Declined e) {
        KpiTask task = taskRepository.findById(e.taskId()).orElse(null);
        User to = userRepository.findById(e.notifyUserId()).orElse(null);
        if (task == null || to == null || to.getId().equals(e.declinedBy())) return;
        String who = userRepository.findById(e.declinedBy()).map(User::getFullName).orElse("");
        LocalizedText message = e.reason() == null || e.reason().isBlank()
                ? LocalizedText.of("notif.task.declined.message", who, task.getTitle())
                : LocalizedText.of("notif.task.declined.messageReason", who, task.getTitle(), e.reason());
        dispatcher.dispatch(task.getOrganizationId(), "task_declined", to, unitFor(null, to),
                LocalizedText.of("notif.task.declined.title"), message, TYPE_TASK, task.getId());
    }

    /** Được thêm vào danh sách công việc ⇒ báo người đó (chỉ chuông). Liên kết mở thẳng danh sách. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onListMemberAdded(TaskListEvents.MemberAdded e) {
        TaskList list = taskListRepository.findById(e.listId()).orElse(null);
        User to = userRepository.findById(e.userId()).orElse(null);
        if (list == null || to == null || to.getId().equals(e.actorId())) return;
        String who = e.actorId() == null ? "" : userRepository.findById(e.actorId()).map(User::getFullName).orElse("");
        dispatcher.dispatchInAppOnly(list.getOrganizationId(), "task_list_shared", to, unitFor(null, to),
                LocalizedText.of("notif.taskList.shared.title"), LocalizedText.of("notif.taskList.shared.message", who, list.getName()),
                TYPE_TASK_LIST, list.getId());
    }

    /** Người thực hiện + người tạo + người theo dõi. */
    private Set<UUID> audience(KpiTask task) {
        Set<UUID> ids = new LinkedHashSet<>();
        ids.add(task.getOwner().getId());
        ids.addAll(assigneeRepository.findUserIds(task.getId()));
        if (task.getCreatedBy() != null) ids.add(task.getCreatedBy());
        ids.addAll(followerRepository.findUserIds(task.getId()));
        return ids;
    }

    private OrgUnit unitFor(KpiCriteria kpi, User to) {
        if (kpi != null && kpi.getOrgUnit() != null) return kpi.getOrgUnit();
        return primaryUnits.unitOf(to);
    }
}
