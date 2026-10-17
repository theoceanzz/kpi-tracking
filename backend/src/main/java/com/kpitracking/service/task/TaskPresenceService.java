package com.kpitracking.service.task;

import com.kpitracking.entity.task.KpiTask;
import com.kpitracking.entity.user.User;
import com.kpitracking.event.TaskNotificationListener;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * "Ai đang xem việc này" kiểu Lark: bảng chi tiết đang mở gửi nhịp {@code POST /kpi-tasks/{id}/presence} mỗi ~20s, đóng thì
 * {@code DELETE}. Lưu trong bộ nhớ (một máy chủ — prod chạy một bản; nhiều bản thì mỗi bản chỉ thấy người nối vào nó).
 * Quá {@link #TTL} không có nhịp ⇒ coi như đã rời. Có người vào / ra thì đẩy gói {@code kind=PRESENCE} (chỉ id) lên kênh
 * {@code /topic/task.{id}} để các bảng khác tải lại ngay. Chỉ người XEM được việc mới báo / thấy được.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TaskPresenceService {

    static final Duration TTL = Duration.ofSeconds(45);
    /** Chặn bộ nhớ phình nếu có ai mở hàng loạt việc: mỗi người tối đa ngần này việc cùng lúc. */
    static final int MAX_TASKS_PER_USER = 20;

    public record Viewer(UUID userId, String fullName, String avatarUrl) {}

    private final Map<UUID, Map<UUID, Instant>> seen = new ConcurrentHashMap<>();

    private final KpiTaskService taskService;
    private final KpiTaskAccess access;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    /** Ghi nhận mình đang xem; trả những NGƯỜI KHÁC đang xem. */
    @Transactional(readOnly = true)
    public List<Viewer> beat(UUID taskId) {
        User me = taskService.currentUser();
        KpiTask task = taskService.findTask(taskId);
        if (!access.canView(me.getId(), task)) throw new ForbiddenException(ErrorCode.TASK_NO_PERMISSION_VIEW);
        Instant now = Instant.now();
        if (openCount(me.getId(), now) >= MAX_TASKS_PER_USER && !seen.getOrDefault(taskId, Map.of()).containsKey(me.getId())) {
            return others(taskId, me.getId(), now);
        }
        Instant before = seen.computeIfAbsent(taskId, k -> new ConcurrentHashMap<>()).put(me.getId(), now);
        if (before == null || before.isBefore(now.minus(TTL))) push(taskId);
        return others(taskId, me.getId(), now);
    }

    /** Đóng bảng chi tiết. Không cần kiểm quyền: chỉ gỡ chính mình. */
    public void leave(UUID taskId) {
        UUID me = taskService.currentUser().getId();
        Map<UUID, Instant> m = seen.get(taskId);
        if (m != null && m.remove(me) != null) {
            if (m.isEmpty()) seen.remove(taskId, m);
            push(taskId);
        }
    }

    private List<Viewer> others(UUID taskId, UUID me, Instant now) {
        Map<UUID, Instant> m = seen.get(taskId);
        if (m == null) return List.of();
        Instant cutoff = now.minus(TTL);
        m.values().removeIf(t -> t.isBefore(cutoff));
        if (m.isEmpty()) seen.remove(taskId, m);
        List<UUID> ids = m.keySet().stream().filter(id -> !id.equals(me)).toList();
        if (ids.isEmpty()) return List.of();
        return userRepository.findAllById(ids).stream()
                .sorted(Comparator.comparing(u -> m.getOrDefault(u.getId(), now)))
                .map(u -> new Viewer(u.getId(), u.getFullName(), u.getAvatarUrl())).toList();
    }

    private long openCount(UUID userId, Instant now) {
        Instant cutoff = now.minus(TTL);
        return seen.values().stream().filter(m -> {
            Instant t = m.get(userId);
            return t != null && !t.isBefore(cutoff);
        }).count();
    }

    private void push(UUID taskId) {
        try {
            messagingTemplate.convertAndSend(TaskNotificationListener.topic(taskId), Map.of("taskId", taskId, "kind", "PRESENCE"));
        } catch (Exception e) {
            log.debug("Không đẩy được gói hiện diện cho việc {}", taskId);
        }
    }
}
