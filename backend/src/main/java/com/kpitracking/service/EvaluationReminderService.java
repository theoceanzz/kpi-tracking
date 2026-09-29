package com.kpitracking.service;

import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.entity.*;
import com.kpitracking.enums.CycleUnitEvalStatus;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.repository.*;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.notification.NotificationDispatcher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Nhắc TRƯỞNG ĐƠN VỊ chấm/chốt trước khi đợt hoặc kỳ đóng lại.
 *
 * <p>{@link DeadlineReminderService} chỉ nhắc NHÂN VIÊN nộp báo cáo. Phía chấm không có gì
 * nhắc cả: đợt hết hạn trong im lặng, và người ta chỉ phát hiện khi đi đối chiếu số cuối kỳ.
 *
 * <p>Hai mốc gửi, mỗi mốc đúng một lần cho mỗi người ở mỗi đơn vị (chống lặp bằng
 * {@link EvaluationReminder}, vì lượt quét chạy mỗi giờ và tính lại từ đầu):
 * <ul>
 *   <li><b>BEFORE_DUE</b> — còn ≤ {@code evaluationReminderDays} ngày là đóng mà vẫn còn tồn.</li>
 *   <li><b>OVERDUE</b> — đã quá hạn mà vẫn chưa xong; im lặng ở mốc này là tệ nhất, vì
 *       lúc đó tồn đọng đã thành nợ chứ không còn là việc đang làm.</li>
 * </ul>
 *
 * <p>Người nhận là trưởng/phó của chính đơn vị còn tồn, CỘNG người đang được uỷ quyền quản
 * lý đơn vị đó ({@link OrgUnitDelegation}). Đơn vị không có ai đứng đầu thì leo lên đơn vị
 * cha gần nhất — bỏ qua sẽ đúng vào trường hợp cần nhắc nhất.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EvaluationReminderService {

    /** Vẫn nhắc tiếp trong bao lâu sau khi đợt/kỳ đã đóng. */
    private static final Duration OVERDUE_GRACE = Duration.ofDays(7);
    /** Cửa sổ quét tối đa; lọc chính xác theo cấu hình của từng tổ chức ở vòng trong. */
    private static final int SCAN_AHEAD_DAYS = 60;
    /** Chặn leo cây vô hạn khi dữ liệu đơn vị có vòng lặp. */
    private static final int MAX_ANCESTOR_WALK = 10;

    private static final String BEFORE_DUE = "BEFORE_DUE";
    private static final String OVERDUE = "OVERDUE";

    private final KpiPeriodRepository kpiPeriodRepository;
    private final KpiCycleRepository kpiCycleRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final EvaluationRepository evaluationRepository;
    private final CycleUnitEvaluationRepository cycleUnitEvaluationRepository;
    private final EvaluationReminderRepository reminderRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final OrgUnitDelegationRepository delegationRepository;
    private final PermissionChecker permissionChecker;
    private final NotificationDispatcher dispatcher;

    /**
     * Lệch 30 phút so với {@link DeadlineReminderService} để hai lượt quét không cùng lúc
     * nạp toàn bộ chỉ tiêu lên.
     */
    @Scheduled(cron = "0 30 * * * *")
    @Transactional
    public void processEvaluationReminders() {
        Instant now = Instant.now();
        Instant from = now.minus(OVERDUE_GRACE);
        Instant to = now.plus(SCAN_AHEAD_DAYS, ChronoUnit.DAYS);

        try {
            for (KpiPeriod period : kpiPeriodRepository.findAllEndingBetween(from, to)) {
                try {
                    remindPeriod(period, now);
                } catch (Exception e) {
                    // Một đợt hỏng (tham chiếu mồ côi, đơn vị đã xoá) không được làm chết
                    // cả lượt quét của những đợt còn lại.
                    log.warn("Bỏ qua nhắc hạn đánh giá đợt {}: {}", period.getId(), e.getMessage());
                }
            }
            for (KpiCycle cycle : kpiCycleRepository.findAllEndingBetween(from, to)) {
                try {
                    remindCycle(cycle, now);
                } catch (Exception e) {
                    log.warn("Bỏ qua nhắc hạn chốt kỳ {}: {}", cycle.getId(), e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Lượt quét nhắc hạn đánh giá thất bại", e);
        }
    }

    // ============================================================
    // ĐỢT
    // ============================================================

    /** Đợt thuộc kỳ đã khoá, hoặc đã đóng/chuyển/huỷ khi khoá kỳ. */
    static boolean isClosedForReminders(KpiPeriod period) {
        if (period == null) return true;
        if (period.getStatus() != null && period.getStatus().isTerminal()) return true;
        return period.getKpiCycle() != null && period.getKpiCycle().isLocked();
    }

    private void remindPeriod(KpiPeriod period, Instant now) {
        // Kỳ đã khoá / đợt đã đóng khi khoá kỳ: không còn chấm được nên không nhắc.
        if (isClosedForReminders(period)) return;
        Organization org = period.getOrganization();
        String milestone = milestoneFor(org, period.getEndDate(), now);
        if (milestone == null) return;

        // Người phải được chấm trong đợt = người được giao chỉ tiêu ĐÃ DUYỆT của đợt đó.
        List<KpiCriteria> criteria = kpiCriteriaRepository
                .findByKpiPeriodIdAndStatusIn(period.getId(), List.of(KpiStatus.APPROVED));
        if (criteria.isEmpty()) return;

        // Một truy vấn cho cả đợt rồi lọc trong bộ nhớ — hỏi từng người là N+1 ngay giữa
        // một lượt quét chạy mỗi giờ.
        Set<UUID> evaluatedByManager = new HashSet<>();
        for (Evaluation e : evaluationRepository.findByKpiPeriodId(period.getId())) {
            if (e.getUser() == null || e.getEvaluator() == null) continue;
            // Bản tự đánh giá không tính: nó không thay được việc quản lý phải chấm.
            if (!e.getEvaluator().getId().equals(e.getUser().getId())) {
                evaluatedByManager.add(e.getUser().getId());
            }
        }

        // Gom người còn tồn theo ĐƠN VỊ CỦA CHỈ TIÊU: đó chính là đơn vị chịu trách nhiệm chấm.
        Map<UUID, OrgUnit> units = new LinkedHashMap<>();
        Map<UUID, Set<UUID>> pendingByUnit = new LinkedHashMap<>();
        for (KpiCriteria k : criteria) {
            OrgUnit unit = k.getOrgUnit();
            if (unit == null) continue;
            for (User assignee : k.getAssignees()) {
                if (assignee == null || evaluatedByManager.contains(assignee.getId())) continue;
                units.putIfAbsent(unit.getId(), unit);
                pendingByUnit.computeIfAbsent(unit.getId(), x -> new HashSet<>()).add(assignee.getId());
            }
        }

        for (Map.Entry<UUID, Set<UUID>> entry : pendingByUnit.entrySet()) {
            OrgUnit unit = units.get(entry.getKey());
            int pending = entry.getValue().size();
            if (pending == 0) continue;

            boolean overdue = OVERDUE.equals(milestone);
            LocalizedText title = LocalizedText.of(overdue ? "notif.evalReminder.period.overdue.title" : "notif.evalReminder.period.due.title",
                    period.getName());
            LocalizedText message = LocalizedText.of("notif.evalReminder.period.message",
                    unit.getName(), pending, period.getName(),
                    overdue
                            ? LocalizedText.of("notif.evalReminder.period.overdue", humanizeAgo(period.getEndDate(), now))
                            : LocalizedText.of("notif.evalReminder.period.due", humanizeUntil(period.getEndDate(), now)));

            notifyUnitLeaders(org, unit, "EVALUATION:CREATE", "evaluation_period_due",
                    "PERIOD", period.getId(), milestone, pending, title, message);
        }
    }

    // ============================================================
    // KỲ
    // ============================================================

    private void remindCycle(KpiCycle cycle, Instant now) {
        if (cycle.isLocked()) return;
        Organization org = cycle.getOrganization();
        String milestone = milestoneFor(org, cycle.getEndDate(), now);
        if (milestone == null) return;

        // Đơn vị "có hoạt động" trong kỳ = đơn vị của những người đã có đánh giá đợt nào đó
        // thuộc kỳ. Lấy theo dấu vết thật thay vì duyệt cả cây tổ chức, vì phần lớn đơn vị
        // trong cây không tham gia kỳ này.
        List<UUID> activeUnitIds = evaluationRepository.findOrgUnitIdsActiveInCycle(cycle.getId());
        if (activeUnitIds.isEmpty()) return;

        Map<UUID, CycleUnitEvalStatus> statusByUnit = new HashMap<>();
        for (CycleUnitEvaluation cue : cycleUnitEvaluationRepository.findByKpiCycleId(cycle.getId())) {
            if (cue.getOrgUnit() != null) statusByUnit.put(cue.getOrgUnit().getId(), cue.getStatus());
        }

        for (UUID unitId : activeUnitIds) {
            if (statusByUnit.get(unitId) == CycleUnitEvalStatus.FINALIZED) continue;
            OrgUnit unit = orgUnitRepository.findById(unitId).orElse(null);
            if (unit == null) continue;

            boolean overdue = OVERDUE.equals(milestone);
            LocalizedText title = LocalizedText.of(overdue ? "notif.evalReminder.cycle.overdue.title" : "notif.evalReminder.cycle.due.title",
                    cycle.getName());
            LocalizedText message = LocalizedText.of("notif.evalReminder.cycle.message",
                    unit.getName(), cycle.getName(),
                    overdue
                            ? LocalizedText.of("notif.evalReminder.cycle.overdue", humanizeAgo(cycle.getEndDate(), now))
                            : LocalizedText.of("notif.evalReminder.cycle.due", humanizeUntil(cycle.getEndDate(), now)));

            notifyUnitLeaders(org, unit, "CYCLE_EVAL:FINALIZE", "evaluation_cycle_due",
                    "CYCLE", cycle.getId(), milestone, 1, title, message);
        }
    }

    // ============================================================
    // GỬI
    // ============================================================

    /**
     * Gửi cho những người thật sự chấm được đơn vị này: trưởng/phó tại chỗ, cộng người đang
     * được uỷ quyền quản lý đơn vị. Không có ai thì leo lên đơn vị cha — đơn vị trống trưởng
     * chính là chỗ dễ bị bỏ quên nhất.
     */
    private void notifyUnitLeaders(Organization org, OrgUnit unit, String permissionCode,
                                   String eventCode, String scope, UUID targetId,
                                   String milestone, int pendingCount, LocalizedText title, LocalizedText message) {
        if (org == null) return;
        Collection<User> recipients = findResponsible(unit, permissionCode);
        if (recipients.isEmpty()) {
            log.info("Không tìm được người chịu trách nhiệm để nhắc hạn ở đơn vị {}", unit.getId());
            return;
        }

        for (User recipient : recipients) {
            boolean alreadySent = reminderRepository
                    .existsByScopeAndTargetIdAndOrgUnitIdAndUserIdAndMilestone(
                            scope, targetId, unit.getId(), recipient.getId(), milestone);
            if (alreadySent) continue;

            dispatcher.dispatch(org.getId(), eventCode, recipient, unit, title, message,
                    "EVALUATION_REMINDER", targetId);

            reminderRepository.save(EvaluationReminder.builder()
                    .scope(scope)
                    .targetId(targetId)
                    .orgUnit(unit)
                    .user(recipient)
                    .milestone(milestone)
                    .pendingCount(pendingCount)
                    .build());
        }
    }

    private Collection<User> findResponsible(OrgUnit unit, String permissionCode) {
        Map<UUID, User> found = new LinkedHashMap<>();

        // Người được uỷ quyền quản lý đơn vị này — tính trước vì đây thường là lý do đơn vị
        // không có trưởng tại chỗ.
        for (OrgUnitDelegation d : delegationRepository.findAllActive()) {
            OrgUnit scope = d.getOrgUnit();
            User delegate = d.getDelegateUser();
            if (scope == null || delegate == null) continue;
            boolean covered = Boolean.TRUE.equals(d.getIncludeSubtree())
                    ? unit.getPath().startsWith(scope.getPath())
                    : unit.getId().equals(scope.getId());
            if (covered && permissionChecker.hasPermissionInOrgUnit(delegate.getId(), permissionCode, unit.getId())) {
                found.putIfAbsent(delegate.getId(), delegate);
            }
        }

        OrgUnit current = unit;
        for (int depth = 0; depth < MAX_ANCESTOR_WALK && current != null && found.isEmpty(); depth++) {
            for (UserRoleOrgUnit uro : userRoleOrgUnitRepository.findByOrgUnitIdIn(List.of(current.getId()))) {
                User candidate = uro.getUser();
                Integer rank = uro.getRole() != null ? uro.getRole().getRank() : null;
                if (candidate == null || rank == null || rank > 1) continue;
                if (permissionChecker.hasPermissionInOrgUnit(candidate.getId(), permissionCode, unit.getId())) {
                    found.putIfAbsent(candidate.getId(), candidate);
                }
            }
            current = current.getParent();
        }
        return found.values();
    }

    // ============================================================
    // MỐC & CHỮ
    // ============================================================

    /** BEFORE_DUE / OVERDUE, hoặc null khi chưa tới lúc nhắc (hoặc tổ chức đã tắt). */
    private String milestoneFor(Organization org, Instant endDate, Instant now) {
        if (org == null || endDate == null) return null;
        Integer days = org.getEvaluationReminderDays();
        if (days == null || days <= 0) return null;

        if (now.isBefore(endDate)) {
            return endDate.isBefore(now.plus(days, ChronoUnit.DAYS)) ? BEFORE_DUE : null;
        }
        return now.isBefore(endDate.plus(OVERDUE_GRACE)) ? OVERDUE : null;
    }

    private LocalizedText humanizeUntil(Instant endDate, Instant now) {
        long hours = Duration.between(now, endDate).toHours();
        if (hours < 1) return LocalizedText.of("notif.time.withinAnHour");
        if (hours < 24) return LocalizedText.of("notif.time.inHours", hours);
        return LocalizedText.of("notif.time.inDays", hours / 24);
    }

    private LocalizedText humanizeAgo(Instant endDate, Instant now) {
        long hours = Duration.between(endDate, now).toHours();
        if (hours < 24) return LocalizedText.of("notif.time.hoursAgo", hours);
        return LocalizedText.of("notif.time.daysAgo", hours / 24);
    }
}
