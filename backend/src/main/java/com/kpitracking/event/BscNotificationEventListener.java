package com.kpitracking.event;

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

        String actorName = nameOf(event.actorId(), "Đơn vị");
        String title = "Bộ tiêu chí BSC cần duyệt";
        String message = String.format(
                "%s vừa trình bộ tiêu chí BSC '%s' (%s) để chờ duyệt. Vào hệ thống để xem và duyệt.",
                actorName, s.getName(), scopeOf(s));

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

        String title = "Bộ tiêu chí BSC đã được duyệt";
        String message = String.format(
                "Bộ tiêu chí BSC '%s' (%s) đã được %s duyệt và áp dụng — từ giờ KPI của đơn vị chấm theo bộ này.",
                s.getName(), scopeOf(s), nameOf(event.actorId(), "cấp trên"));

        notifyOwners(s, event.actorId(), "bsc_scorecard_approved", title, message);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleRejected(BscEvents.ScorecardRejected event) {
        BscScorecard s = find(event.scorecardId());
        if (s == null) return;

        String title = "Bộ tiêu chí BSC bị trả lại";
        String message = String.format(
                "Bộ tiêu chí BSC '%s' (%s) đã bị %s trả lại để sửa. Lý do: %s",
                s.getName(), scopeOf(s), nameOf(event.actorId(), "cấp trên"),
                event.reason() == null || event.reason().isBlank() ? "(không ghi)" : event.reason());

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

        String title = "Bộ tiêu chí BSC đã được áp dụng";
        String message = String.format(
                "Bộ tiêu chí BSC '%s' (%s) đã được %s áp dụng. Từ giờ KPI của đơn vị bám theo các chỉ tiêu trong bộ này.",
                s.getName(), scopeOf(s), nameOf(event.actorId(), "cấp trên"));

        notifyUnitOwners(s, event.actorId(), "bsc_scorecard_activated", title, message);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleLockChanged(BscEvents.ScorecardLockChanged event) {
        BscScorecard s = find(event.scorecardId());
        if (s == null) return;

        String title = event.locked() ? "Bộ tiêu chí BSC đã bị khoá" : "Bộ tiêu chí BSC đã được mở khoá";
        String message = event.locked()
                ? String.format("Bộ tiêu chí BSC '%s' (%s) đã được %s khoá — không sửa chỉ tiêu hay trọng số được nữa.",
                        s.getName(), scopeOf(s), nameOf(event.actorId(), "cấp trên"))
                : String.format("Bộ tiêu chí BSC '%s' (%s) đã được %s mở khoá để sửa lại.",
                        s.getName(), scopeOf(s), nameOf(event.actorId(), "cấp trên"));

        notifyUnitOwners(s, event.actorId(), "bsc_scorecard_locked", title, message);
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
        String actorName = nameOf(event.actorId(), "Cấp trên");

        for (BscEvents.CascadeAssignment target : event.assignments()) {
            OrgUnit unit = orgUnitRepository.findById(target.orgUnitId()).orElse(null);
            if (unit == null) continue;

            String amount = target.contributionValue() == null ? null
                    : String.format("%,.0f%s", target.contributionValue(),
                            target.unit() == null || target.unit().isBlank() ? "" : " " + target.unit());

            String title = "Được giao chỉ tiêu BSC mới";
            String message = String.format(
                    "%s vừa giao chỉ tiêu '%s' cho %s%s. Mở bộ tiêu chí của đơn vị để chia trọng số cho đủ 100%% rồi trình duyệt.",
                    actorName, event.itemName(), unit.getName(),
                    amount == null ? "" : " với mức đóng góp " + amount);

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

        String periodName = result.getKpiPeriod() != null ? result.getKpiPeriod().getName() : "đợt đang xét";
        String achievement = result.getAchievementPercent() == null ? "—"
                : String.format("%.1f%%", result.getAchievementPercent());

        String title = "Kết quả BSC của đợt đã được chốt";
        String message = String.format(
                "Kết quả BSC của %s trong %s đã được %s chốt: %s. Muốn đổi thì phải mở khoá và tính lại.",
                scopeOf(s), periodName, nameOf(event.actorId(), "cấp trên"), achievement);

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

        String periodName = e.getKpiPeriod() != null ? e.getKpiPeriod().getName() : "kỳ đang xét";
        String actorName = nameOf(event.actorId(), "Quản lý");

        String title = event.cleared() ? "Điểm BSC đã huỷ ghi đè" : "Điểm BSC của bạn được điều chỉnh";
        String message = event.cleared()
                ? String.format("%s đã huỷ ghi đè điểm BSC %s của bạn — điểm quay về con số hệ thống tính.",
                        actorName, periodName)
                : String.format("%s đã điều chỉnh điểm BSC %s của bạn thành %.1f. Mở màn hình diễn giải điểm để xem lý do.",
                        actorName, periodName, event.score() == null ? 0.0 : event.score());

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

    private String nameOf(UUID userId, String fallback) {
        return Optional.ofNullable(userOrNull(userId)).map(User::getFullName).orElse(fallback);
    }

    /** "phòng Kinh doanh, phòng Marketing" hoặc "toàn tổ chức" — đủ để người đọc biết thư nói về đâu. */
    private String scopeOf(BscScorecard s) {
        List<OrgUnit> units = s.getOrgUnits();
        String scope = units == null || units.isEmpty()
                ? "toàn tổ chức"
                : String.join(", ", units.stream().map(OrgUnit::getName).toList());
        String period = s.getApplyScope() == BscScorecardApplyScope.CYCLE && s.getKpiCycle() != null
                ? s.getKpiCycle().getName() : null;
        return period == null ? scope : scope + " · " + period;
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
    private void notifyOwners(BscScorecard s, UUID actorId, String eventCode, String title, String message) {
        Set<UUID> notified = new HashSet<>();
        if (actorId != null) notified.add(actorId);
        dispatchToUsers(s, Arrays.asList(s.getSubmittedBy(), s.getOwner()), notified,
                eventCode, title, message, TYPE_SCORECARD, s.getId());
    }

    private void notifyUnitOwners(BscScorecard s, UUID actorId, String eventCode, String title, String message) {
        notifyUnitOwners(s, actorId, eventCode, title, message, TYPE_SCORECARD);
    }

    /**
     * Báo cho những người sẽ phải LÀM VIỆC với thẻ sau thao tác này: chủ sở hữu, người trình, và
     * người phụ trách BSC của đơn vị (họ có thể không phải hai người trên).
     */
    private void notifyUnitOwners(BscScorecard s, UUID actorId, String eventCode,
                                  String title, String message, String type) {
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
                                 String eventCode, String title, String message,
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
