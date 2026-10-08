package com.kpitracking.event;

import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.entity.BscScorecard;
import com.kpitracking.entity.BscUnitResult;
import com.kpitracking.entity.Evaluation;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.enums.BscScorecardApplyScope;
import com.kpitracking.repository.BscScorecardRepository;
import com.kpitracking.repository.BscUnitResultRepository;
import com.kpitracking.repository.EvaluationRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.service.notification.NotificationDispatcher;
import com.kpitracking.service.notification.NotificationRoutingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Thông báo của luồng BSC — song song với {@link NotificationEventListener} của luồng KPI và dùng
 * đúng bộ hạ tầng đó: {@link NotificationRoutingService} chọn người nhận theo phân cấp,
 * {@link NotificationDispatcher} bật/tắt theo cấu hình tổ chức rồi đẩy chuông + xếp email chờ gộp.
 *
 * <p>Quy tắc người nhận giống KPI, chỉ đổi mã quyền:
 * <ul>
 *   <li>Trình bộ tiêu chí ⇒ chỉ cấp có {@code BSC:APPROVE} GẦN NHẤT phía trên nhận, không rải
 *       lên cả cây quản lý.</li>
 *   <li>Duyệt / trả lại ⇒ báo ngược về đúng người trình và chủ sở hữu thẻ.</li>
 *   <li>Phân rã chỉ tiêu ⇒ báo cho người phụ trách BSC của CHÍNH đơn vị nhận, vì họ là người phải
 *       chia trọng số rồi trình duyệt.</li>
 * </ul>
 *
 * <p>Thẻ cấp công ty không gắn đơn vị nào, nên đường định tuyến bắt đầu từ đơn vị GỐC của tổ chức —
 * nếu không thì mọi thao tác trên BSC công ty sẽ im lặng.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class BscNotificationEventListener {

    private final NotificationDispatcher dispatcher;
    private final NotificationRoutingService routing;
    private final BscScorecardRepository scorecardRepository;
    private final BscUnitResultRepository unitResultRepository;
    private final EvaluationRepository evaluationRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRepository userRepository;

    /** Nhãn kiểu thông báo — quyết định biểu tượng ở chuông. Ba nhóm là đủ để phân biệt. */
    private static final String TYPE_SCORECARD = "BSC_SCORECARD";
    private static final String TYPE_ASSIGNED = "BSC_ASSIGNED";
    private static final String TYPE_RESULT = "BSC_RESULT";

    // ============================================================
    // Vòng đời trình – duyệt
    // ============================================================

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleSubmitted(BscEvents.ScorecardSubmitted event) {
        BscScorecard s = find(event.scorecardId());
        if (s == null) return;

        Object actorName = nameOf(event.actorId(), LocalizedText.of("notif.bsc.actor.unit"));
        LocalizedText title = LocalizedText.of("notif.bsc.submitted.title");
        LocalizedText message = LocalizedText.of("notif.bsc.submitted.message", actorName, s.getName(), scopeOf(s));

        Set<UUID> notified = new HashSet<>();
        if (event.actorId() != null) notified.add(event.actorId());

        for (OrgUnit unit : routingUnits(s)) {
            for (User approver : routing.nearestWithPermission(unit, "BSC:APPROVE", notified)) {
                if (notified.add(approver.getId())) {
                    dispatcher.dispatch(orgIdOf(s), "bsc_scorecard_submitted", approver, unit,
                            title, message, TYPE_SCORECARD, s.getId());
                }
            }
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleApproved(BscEvents.ScorecardApproved event) {
        BscScorecard s = find(event.scorecardId());
        if (s == null) return;

        LocalizedText title = LocalizedText.of("notif.bsc.approved.title");
        LocalizedText message = LocalizedText.of("notif.bsc.approved.message",
                s.getName(), scopeOf(s), nameOf(event.actorId(), LocalizedText.of("notif.bsc.actor.superior")));

        notifyOwners(s, event.actorId(), "bsc_scorecard_approved", title, message);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleRejected(BscEvents.ScorecardRejected event) {
        BscScorecard s = find(event.scorecardId());
        if (s == null) return;

        LocalizedText title = LocalizedText.of("notif.bsc.rejected.title");
        LocalizedText message = LocalizedText.of("notif.bsc.rejected.message",
                s.getName(), scopeOf(s), nameOf(event.actorId(), LocalizedText.of("notif.bsc.actor.superior")),
                event.reason() == null || event.reason().isBlank() ? LocalizedText.of("notif.common.noReason") : event.reason());

        Set<UUID> notified = new HashSet<>();
        if (event.actorId() != null) notified.add(event.actorId());
        // Người trình đã bị xoá khỏi thẻ lúc trả lại nên phải lấy từ sự kiện; chủ sở hữu vẫn
        // nhận vì họ là người chịu trách nhiệm bộ tiêu chí của đơn vị.
        dispatchToUsers(s, Arrays.asList(userOrNull(event.submitterId()), s.getOwner()), notified,
                "bsc_scorecard_rejected", title, message, TYPE_SCORECARD, s.getId());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleActivated(BscEvents.ScorecardActivated event) {
        BscScorecard s = find(event.scorecardId());
        if (s == null) return;

        LocalizedText title = LocalizedText.of("notif.bsc.activated.title");
        LocalizedText message = LocalizedText.of("notif.bsc.activated.message",
                s.getName(), scopeOf(s), nameOf(event.actorId(), LocalizedText.of("notif.bsc.actor.superior")));

        notifyUnitOwners(s, event.actorId(), "bsc_scorecard_activated", title, message);
    }

    // ============================================================
    // Phân rã chỉ tiêu
    // ============================================================

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleCascaded(BscEvents.ScorecardCascaded event) {
        BscScorecard parent = find(event.parentScorecardId());
        if (parent == null || event.assignments() == null) return;

        UUID orgId = orgIdOf(parent);
        Object actorName = nameOf(event.actorId(), LocalizedText.of("notif.bsc.actor.superiorCapital"));

        for (BscEvents.CascadeAssignment target : event.assignments()) {
            OrgUnit unit = orgUnitRepository.findById(target.orgUnitId()).orElse(null);
            if (unit == null) continue;

            String amount = target.contributionValue() == null ? null
                    : String.format("%,.0f%s", target.contributionValue(),
                            target.unit() == null || target.unit().isBlank() ? "" : " " + target.unit());

            LocalizedText title = LocalizedText.of("notif.bsc.cascaded.title");
            LocalizedText message = LocalizedText.of("notif.bsc.cascaded.message",
                    actorName, event.itemName(), unit.getName(),
                    amount == null ? "" : LocalizedText.of("notif.bsc.cascaded.contribution", amount));

            Set<UUID> notified = new HashSet<>();
            if (event.actorId() != null) notified.add(event.actorId());
            for (User owner : routing.nearestWithPermission(unit, "BSC:MANAGE_UNIT", notified)) {
                if (notified.add(owner.getId())) {
                    dispatcher.dispatch(orgId, "bsc_cascaded", owner, unit,
                            title, message, TYPE_ASSIGNED, target.childScorecardId());
                }
            }
        }
    }

    // ============================================================
    // Kết quả & điểm
    // ============================================================

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleUnitResultFinalized(BscEvents.UnitResultFinalized event) {
        BscUnitResult result = unitResultRepository
                .findByScorecardIdAndKpiPeriodId(event.scorecardId(), event.kpiPeriodId())
                .orElse(null);
        if (result == null) return;

        BscScorecard s = find(event.scorecardId());
        if (s == null) return;

        Object periodName = result.getKpiPeriod() != null ? result.getKpiPeriod().getName() : LocalizedText.of("notif.bsc.currentPeriod");
        String achievement = result.getAchievementPercent() == null ? "—"
                : String.format("%.1f%%", result.getAchievementPercent());

        LocalizedText title = LocalizedText.of("notif.bsc.resultFinalized.title");
        LocalizedText message = LocalizedText.of("notif.bsc.resultFinalized.message",
                scopeOf(s), periodName, nameOf(event.actorId(), LocalizedText.of("notif.bsc.actor.superior")), achievement);

        notifyUnitOwners(s, event.actorId(), "bsc_unit_result_finalized", title, message, TYPE_RESULT);
    }

    /**
     * Ghi đè điểm là quyết định của con người áp lên điểm đã công bố của MỘT cá nhân — chính người
     * đó phải được biết, nếu không họ chỉ thấy con số đổi mà không hiểu vì sao.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleScoreOverridden(BscEvents.EvaluationScoreOverridden event) {
        Evaluation e = evaluationRepository.findById(event.evaluationId()).orElse(null);
        if (e == null || e.getUser() == null) return;
        if (event.actorId() != null && event.actorId().equals(e.getUser().getId())) return;

        UUID orgId = organizationIdOf(e);
        if (orgId == null) return;

        Object periodName = e.getKpiPeriod() != null ? e.getKpiPeriod().getName() : LocalizedText.of("notif.bsc.currentCycle");
        Object actorName = nameOf(event.actorId(), LocalizedText.of("notif.bsc.actor.manager"));

        LocalizedText title = LocalizedText.of(event.cleared() ? "notif.bsc.overrideCleared.title" : "notif.bsc.overridden.title");
        LocalizedText message = event.cleared()
                ? LocalizedText.of("notif.bsc.overrideCleared.message", actorName, periodName)
                : LocalizedText.of("notif.bsc.overridden.message", actorName, periodName,
                        String.format("%.1f", event.score() == null ? 0.0 : event.score()));

        dispatcher.dispatch(orgId, "bsc_score_overridden", e.getUser(), e.getOrgUnit(),
                title, message, TYPE_RESULT, e.getId());
    }

    // ============================================================
    // Helper
    // ============================================================

    private BscScorecard find(UUID id) {
        if (id == null) return null;
        BscScorecard s = scorecardRepository.findById(id).orElse(null);
        if (s == null) log.warn("Bỏ qua thông báo BSC: không còn bộ tiêu chí {}", id);
        return s;
    }

    private UUID orgIdOf(BscScorecard s) {
        return s.getOrganization().getId();
    }

    private User userOrNull(UUID id) {
        return id == null ? null : userRepository.findById(id).orElse(null);
    }

    /** Tên người (nguyên văn) hoặc cụm thay thế dịch được khi không tìm thấy người. */
    private Object nameOf(UUID userId, LocalizedText fallback) {
        return Optional.<Object>ofNullable(userOrNull(userId)).map(u -> (Object) ((User) u).getFullName()).orElse(fallback);
    }

    /** "phòng Kinh doanh, phòng Marketing" hoặc "toàn tổ chức" — đủ để người đọc biết thư nói về đâu. */
    private Object scopeOf(BscScorecard s) {
        List<OrgUnit> units = s.getOrgUnits();
        Object scope = units == null || units.isEmpty()
                ? LocalizedText.of("notif.bsc.wholeOrganization")
                : String.join(", ", units.stream().map(OrgUnit::getName).toList());
        String period = s.getApplyScope() == BscScorecardApplyScope.CYCLE && s.getKpiCycle() != null
                ? s.getKpiCycle().getName() : null;
        return period == null ? scope : LocalizedText.of("notif.bsc.scopeWithPeriod", scope, period);
    }

    /**
     * Đơn vị dùng để định tuyến thư. Thẻ cấp công ty không gắn đơn vị nào nên đi từ đơn vị GỐC —
     * bỏ qua thì mọi thao tác trên BSC công ty sẽ không báo cho ai.
     */
    private List<OrgUnit> routingUnits(BscScorecard s) {
        List<OrgUnit> units = s.getOrgUnits();
        if (units != null && !units.isEmpty()) return units;
        return orgUnitRepository.findRootsByOrganizationId(orgIdOf(s));
    }

    /** Báo ngược về người trình và chủ sở hữu thẻ (kết quả của việc họ vừa làm). */
    private void notifyOwners(BscScorecard s, UUID actorId, String eventCode, LocalizedText title, LocalizedText message) {
        Set<UUID> notified = new HashSet<>();
        if (actorId != null) notified.add(actorId);
        dispatchToUsers(s, Arrays.asList(s.getSubmittedBy(), s.getOwner()), notified,
                eventCode, title, message, TYPE_SCORECARD, s.getId());
    }

    private void notifyUnitOwners(BscScorecard s, UUID actorId, String eventCode, LocalizedText title, LocalizedText message) {
        notifyUnitOwners(s, actorId, eventCode, title, message, TYPE_SCORECARD);
    }

    /**
     * Báo cho những người sẽ phải LÀM VIỆC với thẻ sau thao tác này: chủ sở hữu, người trình, và
     * người phụ trách BSC của đơn vị (họ có thể không phải hai người trên).
     */
    private void notifyUnitOwners(BscScorecard s, UUID actorId, String eventCode,
                                  LocalizedText title, LocalizedText message, String type) {
        Set<UUID> notified = new HashSet<>();
        if (actorId != null) notified.add(actorId);

        List<User> recipients = new ArrayList<>();
        recipients.add(s.getOwner());
        recipients.add(s.getSubmittedBy());
        for (OrgUnit unit : routingUnits(s)) {
            recipients.addAll(routing.nearestWithPermission(unit, "BSC:MANAGE_UNIT", notified));
        }
        dispatchToUsers(s, recipients, notified, eventCode, title, message, type, s.getId());
    }

    private void dispatchToUsers(BscScorecard s, List<User> recipients, Set<UUID> notified,
                                 String eventCode, LocalizedText title, LocalizedText message,
                                 String type, UUID referenceId) {
        List<OrgUnit> units = routingUnits(s);
        OrgUnit unit = units.isEmpty() ? null : units.get(0);
        for (User user : recipients) {
            if (user == null || !notified.add(user.getId())) continue;
            dispatcher.dispatch(orgIdOf(s), eventCode, user, unit, title, message, type, referenceId);
        }
    }

    private UUID organizationIdOf(Evaluation e) {
        OrgUnit unit = e.getOrgUnit();
        if (unit != null && unit.getOrgHierarchyLevel() != null
                && unit.getOrgHierarchyLevel().getOrganization() != null) {
            return unit.getOrgHierarchyLevel().getOrganization().getId();
        }
        return null;
    }
}
