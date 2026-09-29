package com.kpitracking.event;

import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.entity.*;
import com.kpitracking.event.KpiCycleLockEvents.CycleLockedEvent;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiCycleRepository;
import com.kpitracking.repository.KpiPeriodRepository;
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

import java.util.*;

/**
 * Thông báo khi khoá kỳ.
 *
 * <ul>
 *   <li>Kỳ khoá khi mọi đợt đã xong: chỉ chuông cho quản lý các đơn vị có KPI trong kỳ.</li>
 *   <li>Kỳ khoá khi còn đợt dở:
 *     <ul>
 *       <li>người có KPI bị chuyển kỳ / bị chốt và trưởng đơn vị của KPI đó: chuông + email
 *           ({@value #EVENT_AFFECTED});</li>
 *       <li>mọi người liên quan khác (người được giao KPI trong kỳ, quản lý đơn vị): chỉ chuông
 *           ({@value #EVENT_LOCKED}).</li>
 *     </ul>
 *   </li>
 * </ul>
 * Mỗi người chỉ nhận MỘT thông báo gộp, không phải một cái cho từng KPI.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class KpiCycleLockNotificationListener {

    public static final String TYPE = "KPI_CYCLE_LOCKED";
    public static final String EVENT_LOCKED = "cycle_locked";
    public static final String EVENT_AFFECTED = "cycle_kpi_affected";

    private final NotificationDispatcher dispatcher;
    private final KpiCycleRepository kpiCycleRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onCycleLocked(CycleLockedEvent event) {
        KpiCycle cycle = kpiCycleRepository.findById(event.cycleId()).orElse(null);
        if (cycle == null) return;
        UUID orgId = cycle.getOrganization().getId();

        // KPI còn lại trong kỳ (kể cả đợt đã đóng/tách) — nguồn "người liên quan".
        List<UUID> periodIds = kpiPeriodRepository.findByKpiCycleIdOrderByStartDateAsc(cycle.getId())
                .stream().map(KpiPeriod::getId).toList();
        List<KpiCriteria> cycleKpis = periodIds.isEmpty() ? List.of() : kpiCriteriaRepository.findByKpiPeriodIdIn(periodIds);

        Set<UUID> unitIds = new LinkedHashSet<>();
        cycleKpis.forEach(k -> unitIds.add(k.getOrgUnit().getId()));

        if (!event.hadUnfinished()) {
            LocalizedText title = LocalizedText.of("notif.cycleLock.locked.title", cycle.getName());
            LocalizedText message = LocalizedText.of("notif.cycleLock.locked.allDone", cycle.getName());
            managersOf(unitIds).values().forEach(a ->
                    sendInApp(orgId, a.getUser(), a.getOrgUnit(), title, message, cycle.getId()));
            return;
        }

        // ── Có đợt dở: gom ảnh hưởng theo người ──
        Map<UUID, UUID> moved = event.movedKpiTargetCycle() == null ? Map.of() : event.movedKpiTargetCycle();
        List<UUID> closed = event.closedKpiIds() == null ? List.of() : event.closedKpiIds();
        Set<UUID> affectedIds = new LinkedHashSet<>(moved.keySet());
        affectedIds.addAll(closed);
        List<KpiCriteria> affected = affectedIds.isEmpty() ? List.of() : kpiCriteriaRepository.findAllById(affectedIds);

        Map<UUID, String> cycleNames = new HashMap<>();
        for (UUID target : new HashSet<>(moved.values())) {
            kpiCycleRepository.findById(target).ifPresent(c -> cycleNames.put(c.getId(), c.getName()));
        }

        // người → (đơn vị để hiện chuông, số KPI chuyển, số KPI chốt, tên kỳ đích)
        Map<UUID, Impact> byUser = new LinkedHashMap<>();
        Map<UUID, Impact> byUnit = new LinkedHashMap<>();
        for (KpiCriteria k : affected) {
            boolean isMoved = moved.containsKey(k.getId());
            String target = isMoved ? cycleNames.get(moved.get(k.getId())) : null;
            for (User u : k.getAssignees()) {
                byUser.computeIfAbsent(u.getId(), x -> new Impact(u, k.getOrgUnit())).add(isMoved, target);
            }
            byUnit.computeIfAbsent(k.getOrgUnit().getId(), x -> new Impact(null, k.getOrgUnit())).add(isMoved, target);
        }

        Set<UUID> notified = new HashSet<>();
        LocalizedText affectedTitle = LocalizedText.of("notif.cycleLock.affected.title.user", cycle.getName());
        byUser.forEach((userId, impact) -> {
            dispatcher.dispatch(orgId, EVENT_AFFECTED, impact.user, impact.unit, affectedTitle,
                    impact.describe(LocalizedText.of("notif.cycleLock.subject.you"), cycle.getName()), TYPE, cycle.getId());
            notified.add(userId);
        });

        // Trưởng đơn vị (rank 0) của KPI bị ảnh hưởng: chuông + email, một thông báo/đơn vị.
        for (Impact unitImpact : byUnit.values()) {
            for (UserRoleOrgUnit head : userRoleOrgUnitRepository.findByOrgUnitIdAndRoleRank(unitImpact.unit.getId(), 0)) {
                User u = head.getUser();
                if (u == null) continue;
                dispatcher.dispatch(orgId, EVENT_AFFECTED, u, unitImpact.unit,
                        LocalizedText.of("notif.cycleLock.affected.title.unit", unitImpact.unit.getName()),
                        unitImpact.describe(LocalizedText.of("notif.cycleLock.subject.unit", unitImpact.unit.getName()), cycle.getName()),
                        TYPE, cycle.getId());
                notified.add(u.getId());
            }
        }

        // Người liên quan còn lại: chỉ chuông.
        LocalizedText title = LocalizedText.of("notif.cycleLock.locked.title", cycle.getName());
        LocalizedText message = LocalizedText.of("notif.cycleLock.locked.withUnfinished", cycle.getName());
        for (KpiCriteria k : cycleKpis) {
            for (User u : k.getAssignees()) {
                if (notified.add(u.getId())) sendInApp(orgId, u, k.getOrgUnit(), title, message, cycle.getId());
            }
        }
        managersOf(unitIds).forEach((userId, a) -> {
            if (notified.add(userId)) sendInApp(orgId, a.getUser(), a.getOrgUnit(), title, message, cycle.getId());
        });
    }

    private void sendInApp(UUID orgId, User user, OrgUnit unit, LocalizedText title, LocalizedText message, UUID refId) {
        if (user == null) return;
        dispatcher.dispatchInAppOnly(orgId, EVENT_LOCKED, user, unit, title, message, TYPE, refId);
    }

    /** userId → vai trò quản lý (trưởng + phó, rank ≤ 1) ở một trong các đơn vị; mỗi người một lần. */
    private Map<UUID, UserRoleOrgUnit> managersOf(Set<UUID> unitIds) {
        Map<UUID, UserRoleOrgUnit> out = new LinkedHashMap<>();
        for (UUID unitId : unitIds) {
            for (UserRoleOrgUnit a : userRoleOrgUnitRepository.findManagersByOrgUnitId(unitId)) {
                if (a.getUser() != null) out.putIfAbsent(a.getUser().getId(), a);
            }
        }
        return out;
    }

    /** Gộp ảnh hưởng của khoá kỳ lên một người/đơn vị. */
    private static final class Impact {
        final User user;
        final OrgUnit unit;
        int moved;
        int closed;
        final Set<String> targets = new LinkedHashSet<>();

        Impact(User user, OrgUnit unit) {
            this.user = user;
            this.unit = unit;
        }

        void add(boolean isMoved, String target) {
            if (isMoved) {
                moved++;
                if (target != null) targets.add(target);
            } else {
                closed++;
            }
        }

        LocalizedText describe(LocalizedText subject, String cycleName) {
            LocalizedText movedPart = moved > 0 ? LocalizedText.of("notif.cycleLock.part.moved", moved,
                    String.join(", ", targets.stream().map(t -> "\"" + t + "\"").toList())) : null;
            LocalizedText closedPart = closed > 0 ? LocalizedText.of("notif.cycleLock.part.closed", closed) : null;
            Object parts = movedPart != null && closedPart != null
                    ? LocalizedText.of("notif.common.joinSemicolon", movedPart, closedPart)
                    : movedPart != null ? movedPart : closedPart;
            return LocalizedText.of("notif.cycleLock.affected.message", subject, parts, cycleName);
        }
    }
}
