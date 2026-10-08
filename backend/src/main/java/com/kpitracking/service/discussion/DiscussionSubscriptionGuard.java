package com.kpitracking.service.discussion;

import com.kpitracking.enums.DiscussionTargetType;
import com.kpitracking.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Chặn SUBSCRIBE vào {@code /topic/discussion.{TYPE}.{id}} và {@code /topic/task.{id}} của người không xem được đối tượng. Simple broker của
 * Spring không tự kiểm quyền theo destination, nên thiếu chốt này thì ai đăng nhập cũng nghe được kênh của KPI bất
 * kỳ (dù gói tin chỉ mang id, vẫn lộ nhịp trao đổi).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DiscussionSubscriptionGuard {

    public static final String PREFIX = "/topic/discussion.";
    /** Kênh của bảng chi tiết công việc: {@code /topic/task.{id}}. */
    public static final String TASK_PREFIX = "/topic/task.";

    private final UserRepository userRepository;
    private final DiscussionTargets targets;
    private final com.kpitracking.service.task.KpiTaskAccess taskAccess;
    private final com.kpitracking.repository.KpiTaskRepository taskRepository;

    public static boolean applies(String destination) {
        return destination != null && (destination.startsWith(PREFIX) || destination.startsWith(TASK_PREFIX));
    }

    @Transactional(readOnly = true)
    public boolean canSubscribe(String email, String destination) {
        if (destination.startsWith(TASK_PREFIX)) return canSubscribeTask(email, destination);
        try {
            String[] parts = destination.substring(PREFIX.length()).split("\\.");
            if (parts.length != 2) return false;
            DiscussionTargetType type = DiscussionTargetType.valueOf(parts[0]);
            UUID id = UUID.fromString(parts[1]);
            UUID userId = userRepository.findByEmail(email).map(u -> u.getId()).orElse(null);
            if (userId == null) return false;
            return targets.canView(userId, targets.load(type, id));
        } catch (RuntimeException e) {
            log.debug("Từ chối SUBSCRIBE {}: {}", destination, e.getMessage());
            return false;
        }
    }

    private boolean canSubscribeTask(String email, String destination) {
        try {
            UUID id = UUID.fromString(destination.substring(TASK_PREFIX.length()));
            UUID userId = userRepository.findByEmail(email).map(u -> u.getId()).orElse(null);
            return userId != null && taskRepository.findById(id).map(t -> taskAccess.canView(userId, t)).orElse(false);
        } catch (RuntimeException e) {
            log.debug("Từ chối SUBSCRIBE {}: {}", destination, e.getMessage());
            return false;
        }
    }
}
