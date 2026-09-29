package com.kpitracking.event;

import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.entity.*;
import com.kpitracking.event.F360Events.*;
import com.kpitracking.repository.F360AssignmentRepository;
import com.kpitracking.repository.F360CampaignRepository;
import com.kpitracking.repository.F360SubjectRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.notification.NotificationDispatcher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Thông báo của đánh giá 360.
 *
 * <p>Một người thường được mời chấm cho nhiều người cùng lúc, nên lời mời/nhắc được GOM theo người
 * chấm: một chuông "bạn có 6 phiếu cần đánh giá" chứ không phải sáu chuông. Nội dung không bao giờ
 * nêu ai là người chấm của ai ngoài chính người nhận.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class F360NotificationEventListener {

    public static final String TYPE = "FEEDBACK360";
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy")
            .withZone(ZoneId.of("Asia/Ho_Chi_Minh"));

    private final NotificationDispatcher dispatcher;
    private final F360CampaignRepository campaignRepository;
    private final F360AssignmentRepository assignmentRepository;
    private final F360SubjectRepository subjectRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final com.kpitracking.security.PermissionChecker permissionChecker;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onRatersInvited(RatersInvitedEvent event) {
        notifyRaters(event.campaignId(), event.assignmentIds(), "f360_rate_request", false);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onRatersReminded(RatersRemindedEvent event) {
        notifyRaters(event.campaignId(), event.assignmentIds(), "f360_reminder", true);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onAssignmentReopened(AssignmentReopenedEvent event) {
        assignmentRepository.findById(event.assignmentId()).ifPresent(a -> {
            F360Campaign c = a.getSubject().getCampaign();
            String subjectName = a.getSubject().getUser().getFullName();
            LocalizedText title = LocalizedText.of("notif.f360.reopened.title");
            LocalizedText message = LocalizedText.of("notif.f360.reopened.message", subjectName, c.getName(), event.reason());
            send(c.getOrganization().getId(), "f360_rate_request", a.getRater(), title, message, a.getId());
        });
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onReportReleased(ReportReleasedEvent event) {
        campaignRepository.findById(event.campaignId()).ifPresent(c -> {
            if (!Boolean.TRUE.equals(c.getReleaseToSubject())) return;
            for (F360Subject s : subjectRepository.findByCampaignIdWithUser(c.getId())) {
                LocalizedText title = LocalizedText.of("notif.f360.reportReleased.title");
                LocalizedText message = LocalizedText.of("notif.f360.reportReleased.message", c.getName());
                send(c.getOrganization().getId(), "f360_report_released", s.getUser(), title, message, s.getId());
            }
        });
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onNominationOpened(NominationOpenedEvent event) {
        campaignRepository.findById(event.campaignId()).ifPresent(c -> {
            Object due = c.getNominationDeadline() != null
                    ? LocalizedText.of("notif.f360.nominationDue", DATE.format(c.getNominationDeadline())) : "";
            for (F360Subject s : subjectRepository.findByCampaignIdWithUser(c.getId())) {
                send(c.getOrganization().getId(), "f360_nomination", s.getUser(),
                        LocalizedText.of("notif.f360.nominationOpened.title"),
                        LocalizedText.of("notif.f360.nominationOpened.message", c.getName(), due),
                        s.getId());
            }
        });
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onNominationSubmitted(NominationSubmittedEvent event) {
        subjectRepository.findById(event.subjectId()).ifPresent(s -> {
            if (s.getApprover() == null) return;
            F360Campaign c = s.getCampaign();
            send(c.getOrganization().getId(), "f360_nomination", s.getApprover(),
                    LocalizedText.of("notif.f360.nominationSubmitted.title"),
                    LocalizedText.of("notif.f360.nominationSubmitted.message", s.getUser().getFullName(), c.getName()),
                    s.getId());
        });
    }

    /** Người chấm từ chối: báo người duyệt (nếu có) và người tạo chiến dịch để thay người. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onAssignmentDeclined(AssignmentDeclinedEvent event) {
        assignmentRepository.findById(event.assignmentId()).ifPresent(a -> {
            F360Subject s = a.getSubject();
            F360Campaign c = s.getCampaign();
            LocalizedText message = LocalizedText.of("notif.f360.declined.message",
                    a.getRater().getFullName(), s.getUser().getFullName(), c.getName(),
                    a.getDeclineReason() == null ? LocalizedText.of("notif.common.noReasonShort") : a.getDeclineReason());
            LocalizedText declinedTitle = LocalizedText.of("notif.f360.declined.title");
            Set<UUID> sent = new HashSet<>();
            // Không bao giờ báo cho CHÍNH người được đánh giá: họ không được biết ai chấm mình.
            sent.add(s.getUser().getId());
            int delivered = 0;
            for (User u : Arrays.asList(s.getApprover(), c.getCreatedBy())) {
                if (u != null && sent.add(u.getId())) {
                    send(c.getOrganization().getId(), "f360_declined", u, declinedTitle, message, c.getId());
                    delivered++;
                }
            }
            // Người được đánh giá chính là người tạo chiến dịch và không có người duyệt (vd giám đốc tự mở
            // chiến dịch cho cả mình): báo các quản trị 360 KHÁC để vẫn có người thay được người chấm.
            if (delivered == 0) {
                userRoleOrgUnitRepository.findUsersByOrganizationId(c.getOrganization().getId()).stream()
                        .filter(u -> !sent.contains(u.getId()))
                        .filter(u -> permissionChecker.hasPermission(u.getId(), "FEEDBACK360:MANAGE"))
                        .limit(3)
                        .forEach(u -> send(c.getOrganization().getId(), "f360_declined", u,
                                declinedTitle, message, c.getId()));
            }
        });
    }

    private void notifyRaters(UUID campaignId, List<UUID> assignmentIds, String eventCode, boolean reminder) {
        F360Campaign campaign = campaignRepository.findById(campaignId).orElse(null);
        if (campaign == null || assignmentIds == null || assignmentIds.isEmpty()) return;

        Map<UUID, List<F360Assignment>> byRater = new LinkedHashMap<>();
        for (F360Assignment a : assignmentRepository.findAllById(assignmentIds)) {
            if (!a.getStatus().open()) continue;
            byRater.computeIfAbsent(a.getRater().getId(), x -> new ArrayList<>()).add(a);
        }
        String due = campaign.getDueAt() != null ? DATE.format(campaign.getDueAt()) : null;
        for (List<F360Assignment> list : byRater.values()) {
            User rater = list.get(0).getRater();
            long others = list.stream().filter(a -> !a.getRater().getId().equals(a.getSubject().getUser().getId())).count();
            boolean hasSelf = others < list.size();
            String mode = reminder ? "reminder" : "invite";
            String what = others > 0 && hasSelf ? "both" : others > 0 ? "others" : "self";
            LocalizedText work = LocalizedText.of("notif.f360." + mode + ".work." + what, others);
            Object dueText = due != null ? LocalizedText.of("notif.f360.dueSuffix", due) : "";
            LocalizedText title = LocalizedText.of("notif.f360." + mode + ".title");
            LocalizedText message = LocalizedText.of("notif.f360." + mode + ".message", work, campaign.getName(), dueText);
            send(campaign.getOrganization().getId(), eventCode, rater, title, message, campaignId);
        }
        Instant now = Instant.now();
        if (reminder) {
            byRater.values().forEach(l -> l.forEach(a -> a.setLastRemindedAt(now)));
            assignmentRepository.saveAll(byRater.values().stream().flatMap(List::stream).toList());
        }
    }

    private void send(UUID orgId, String eventCode, User recipient, LocalizedText title, LocalizedText message, UUID referenceId) {
        OrgUnit unit = primaryUnit(recipient);
        if (unit == null) {
            // Bảng thông báo đòi đơn vị; người không thuộc đơn vị nào thì không có chỗ hiện chuông.
            log.warn("Bỏ qua thông báo 360 cho {}: không thuộc đơn vị nào", recipient.getId());
            return;
        }
        dispatcher.dispatch(orgId, eventCode, recipient, unit, title, message, TYPE, referenceId);
    }

    private OrgUnit primaryUnit(User user) {
        return userRoleOrgUnitRepository.findByUserId(user.getId()).stream()
                .filter(a -> a.getOrgUnit() != null && a.getRole() != null)
                .min(Comparator.comparingInt(a -> a.getRole().getRank() == null ? Integer.MAX_VALUE : a.getRole().getRank()))
                .map(UserRoleOrgUnit::getOrgUnit)
                .orElse(null);
    }
}
