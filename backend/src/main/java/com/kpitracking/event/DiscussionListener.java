package com.kpitracking.event;

import com.kpitracking.entity.*;
import com.kpitracking.enums.DiscussionTargetType;
import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.repository.DiscussionCommentRepository;
import com.kpitracking.repository.NotificationRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.NotificationService;
import com.kpitracking.service.OrgNotificationConfigService;
import com.kpitracking.service.discussion.DiscussionTargets;
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
import java.util.*;

/**
 * Hậu xử lý của khung thảo luận, chạy SAU COMMIT:
 * <ul>
 *   <li>đẩy gói "có thay đổi" lên {@code /topic/discussion.{TYPE}.{id}} — chỉ mang id, client tự gọi REST lấy nội
 *       dung (quyền xem vẫn kiểm ở REST; kênh SUBSCRIBE cũng bị chặn với người không xem được);</li>
 *   <li>thông báo: người được nhắc tên và người được trả lời nhận riêng từng cái; người theo dõi (người tạo / thực
 *       hiện KPI, trưởng đơn vị, người đã bình luận — hoặc người thực hiện task) nhận thông báo "bình luận mới" được
 *       GỘP: trong {@link #GROUP_WINDOW} mà thông báo trước còn chưa đọc thì sửa nó thành "Có N bình luận mới".</li>
 * </ul>
 * Người nhận nào cũng phải còn xem được đối tượng tại thời điểm gửi.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DiscussionListener {

    public static final String NOTIFICATION_TYPE = "DISCUSSION";
    static final Duration GROUP_WINDOW = Duration.ofMinutes(5);
    private static final int SNIPPET = 80;

    private final SimpMessagingTemplate messagingTemplate;
    private final DiscussionCommentRepository commentRepository;
    private final DiscussionTargets targets;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final NotificationDispatcher dispatcher;
    private final NotificationService notificationService;
    private final NotificationRepository notificationRepository;
    private final OrgNotificationConfigService configService;
    private final com.kpitracking.repository.KpiTaskFollowerRepository taskFollowerRepository;

    public static String topic(DiscussionTargetType type, UUID targetId) {
        return "/topic/discussion." + type.name() + "." + targetId;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onChanged(DiscussionEvents.Changed e) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("action", e.action().name());
            payload.put("targetType", e.targetType().name());
            payload.put("targetId", e.targetId());
            payload.put("commentId", e.commentId());
            payload.put("parentId", e.parentId());
            messagingTemplate.convertAndSend(topic(e.targetType(), e.targetId()), payload);
        } catch (Exception ex) {
            log.warn("Không đẩy được thay đổi thảo luận {} qua WebSocket", e.commentId(), ex);
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onCommentCreated(DiscussionEvents.CommentCreated e) {
        DiscussionComment c = commentRepository.findById(e.commentId()).orElse(null);
        if (c == null || c.isDeleted() || c.getAuthor() == null) return;
        DiscussionTargets.Target t = targets.load(c.getTargetType(), c.getTargetId());
        User author = c.getAuthor();
        Set<UUID> done = new HashSet<>();
        done.add(author.getId());

        notifyMentions(c, t, author, e.mentionIds(), done);

        if (c.getParentId() != null) {
            commentRepository.findById(c.getParentId())
                    .filter(p -> p.getAuthor() != null && !done.contains(p.getAuthor().getId()))
                    .ifPresent(p -> {
                        User to = p.getAuthor();
                        done.add(to.getId());
                        if (!targets.canView(to.getId(), t)) return;
                        dispatcher.dispatch(t.organizationId(), "discussion_reply", to, unitFor(t, to),
                                LocalizedText.of("notif.discussion.reply.title"),
                                LocalizedText.of("notif.discussion.reply.message", author.getFullName(), t.title(), snippet(c)),
                                NOTIFICATION_TYPE, c.getId());
                    });
        }

        for (UUID uid : watchers(t)) {
            if (!done.add(uid)) continue;
            if (!targets.canView(uid, t)) continue;
            userRepository.findById(uid).ifPresent(to -> notifyGrouped(c, t, author, to));
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onMentionsAdded(DiscussionEvents.MentionsAdded e) {
        DiscussionComment c = commentRepository.findById(e.commentId()).orElse(null);
        if (c == null || c.isDeleted() || c.getAuthor() == null) return;
        DiscussionTargets.Target t = targets.load(c.getTargetType(), c.getTargetId());
        Set<UUID> done = new HashSet<>(Set.of(c.getAuthor().getId()));
        notifyMentions(c, t, c.getAuthor(), e.mentionIds(), done);
    }

    private void notifyMentions(DiscussionComment c, DiscussionTargets.Target t, User author, List<UUID> mentionIds,
                                Set<UUID> done) {
        for (UUID uid : mentionIds) {
            if (!done.add(uid)) continue;
            if (!targets.canView(uid, t)) continue;
            userRepository.findById(uid).ifPresent(to -> dispatcher.dispatch(t.organizationId(), "discussion_mention", to,
                    unitFor(t, to),
                    LocalizedText.of("notif.discussion.mention.title"),
                    LocalizedText.of("notif.discussion.mention.message", author.getFullName(), t.title(), snippet(c)),
                    NOTIFICATION_TYPE, c.getId()));
        }
    }

    /** "Bình luận mới" chỉ đi chuông; gộp vào thông báo chưa đọc còn trong cửa sổ thời gian. */
    private void notifyGrouped(DiscussionComment c, DiscussionTargets.Target t, User author, User to) {
        try {
            if (!configService.isSystemEnabled(t.organizationId(), "discussion_comment")) return;
            Optional<Notification> existing = notificationRepository.findGroupableDiscussion(to.getId(), NOTIFICATION_TYPE,
                    t.type().name(), t.id(), Instant.now().minus(GROUP_WINDOW));
            LocalizedText title = LocalizedText.of("notif.discussion.comment.title");
            if (existing.isPresent()) {
                Notification n = existing.get();
                Instant since = commentRepository.findById(n.getReferenceId())
                        .map(DiscussionComment::getCreatedAt).orElse(n.getCreatedAt());
                long count = commentRepository.countFromOthersSince(t.type().name(), t.id(), to.getId(), since);
                notificationService.refreshNotification(n, title,
                        LocalizedText.of("notif.discussion.commentGrouped.message", count, t.title()));
            } else {
                notificationService.createNotification(unitFor(t, to), to, title,
                        LocalizedText.of("notif.discussion.comment.message", author.getFullName(), t.title(), snippet(c)),
                        NOTIFICATION_TYPE, c.getId());
            }
        } catch (Exception ex) {
            log.error("Không phát được thông báo bình luận {} cho {}", c.getId(), to.getId(), ex);
        }
    }

    /** Người theo dõi một khung thảo luận. */
    private Collection<UUID> watchers(DiscussionTargets.Target t) {
        Set<UUID> ids = new LinkedHashSet<>();
        if (t.type() == DiscussionTargetType.KPI && t.kpi() != null) {
            KpiCriteria kpi = t.kpi();
            if (kpi.getCreatedBy() != null) ids.add(kpi.getCreatedBy().getId());
            kpi.getAssignees().forEach(u -> ids.add(u.getId()));
            // Trưởng đơn vị của KPI — người thường phải trả lời thắc mắc của nhân viên.
            userRoleOrgUnitRepository.findByOrgUnitIdAndRoleRank(kpi.getOrgUnit().getId(), 0)
                    .forEach(a -> ids.add(a.getUser().getId()));
        } else if (t.task() != null) {
            // Công việc: người phụ trách, người tạo, người theo dõi.
            ids.add(t.task().getOwner().getId());
            if (t.task().getCreatedBy() != null) ids.add(t.task().getCreatedBy());
            ids.addAll(taskFollowerRepository.findUserIds(t.task().getId()));
        }
        ids.addAll(commentRepository.findParticipantIds(t.type(), t.id()));
        return ids;
    }

    /** Thông báo bắt buộc gắn một đơn vị: đơn vị của KPI, không có thì đơn vị đầu tiên của người nhận. */
    private OrgUnit unitFor(DiscussionTargets.Target t, User to) {
        if (t.orgUnit() != null) return t.orgUnit();
        return userRoleOrgUnitRepository.findByUserId(to.getId()).stream()
                .map(UserRoleOrgUnit::getOrgUnit).findFirst().orElse(null);
    }

    private static String snippet(DiscussionComment c) {
        String b = c.getBody();
        if (b == null || b.isBlank()) return "📎";
        String one = b.replaceAll("\\s+", " ").strip();
        return one.length() <= SNIPPET ? one : one.substring(0, SNIPPET) + "…";
    }
}
