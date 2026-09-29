package com.kpitracking.service;

import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.i18n.SupportedLanguages;
import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.dto.request.kpi.lock.LockCycleRequest;
import com.kpitracking.dto.request.kpi.lock.LockCycleRequest.PeriodDecision;
import com.kpitracking.dto.response.kpi.KpiCycleResponse;
import com.kpitracking.dto.response.kpi.lock.CycleLockPreviewResponse;
import com.kpitracking.dto.response.kpi.lock.CycleLockPreviewResponse.CycleRef;
import com.kpitracking.dto.response.kpi.lock.CycleLockPreviewResponse.PeriodPreview;
import com.kpitracking.dto.response.kpi.lock.CycleLockResultResponse;
import com.kpitracking.dto.response.kpi.lock.KpiCycleEventResponse;
import com.kpitracking.entity.*;
import com.kpitracking.enums.*;
import com.kpitracking.event.KpiCycleLockEvents.CycleLockedEvent;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.exception.StaleStateException;
import com.kpitracking.i18n.Terms;
import com.kpitracking.repository.*;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.kpi.PeriodProgressClassifier;
import com.kpitracking.service.kpi.PeriodProgressClassifier.PeriodSnapshot;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Khoá kỳ (và mở lại) — chỉ đi qua khoá / mở khoá kết quả ở đơn vị gốc.
 *
 * <p>Luồng khoá: xem trước ({@link #preview}) phân loại từng đợt → khoá kết quả ở đơn vị gốc kèm
 * một quyết định cho MỖI đợt dở ({@link #lockForRootFinalize}). Toàn bộ
 * thủ tục khoá chạy trong MỘT transaction: bất kỳ bước nào lỗi thì mọi đợt đã xử lý đều rollback.
 *
 * <p>Đồng thời: mọi thủ tục ở đây mở đầu bằng {@code FOR UPDATE} trên hàng kỳ, còn mọi thao tác
 * ghi vào kỳ giữ {@code FOR SHARE} qua {@link com.kpitracking.service.kpi.CycleStatusGuard} —
 * thao tác nào commit sau lúc khoá đều thấy LOCKED và bị từ chối. Sau khi đã giữ khoá, dữ liệu
 * được phân loại lại và so với token của bước xem trước; lệch thì trả 409 để người dùng xem lại.
 */
@Service
@RequiredArgsConstructor
public class KpiCycleLockService {

    /** Lý do do hệ thống ghi khi huỷ đợt lúc khoá kỳ — lưu dạng dịch được (reason_i18n). */
    private static final LocalizedText CANCEL_ON_LOCK = LocalizedText.of("cycleEvent.reason.cancelOnLock");

    /** Người khoá kết quả ở đơn vị gốc — cũng là người xem danh sách đợt và khoá kỳ. */
    static final String PERM_FINALIZE = "CYCLE_EVAL:FINALIZE";
    static final String PERM_VIEW = "KPI_CYCLE:VIEW";
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy")
            .withZone(ZoneId.of("Asia/Ho_Chi_Minh"));

    private final KpiCycleRepository kpiCycleRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final KpiCycleEventRepository eventRepository;
    private final UserRepository userRepository;
    private final PermissionChecker permissionChecker;
    private final PeriodProgressClassifier classifier;
    private final KpiCycleService kpiCycleService;
    private final ApplicationEventPublisher eventPublisher;
    /** KPI dở bị chốt thì chuỗi duyệt đang chạy của nó dừng theo. */
    private final com.kpitracking.service.kpi.approval.KpiApprovalChainService approvalChain;

    // =====================================================================
    // XEM TRƯỚC
    // =====================================================================

    @Transactional(readOnly = true)
    public CycleLockPreviewResponse preview(UUID cycleId) {
        KpiCycle cycle = findCycle(cycleId);
        requirePermission(currentUser(), PERM_FINALIZE, cycle);
        Instant now = Instant.now();

        List<PeriodSnapshot> snapshots = classifier.classify(periodsOf(cycle), now);
        List<PeriodSnapshot> unfinished = snapshots.stream().filter(s -> s.progress() != PeriodProgress.COMPLETED).toList();

        List<CycleRef> targets = targetCycles(cycle).stream().map(KpiCycleLockService::ref).toList();

        return CycleLockPreviewResponse.builder()
                .cycleId(cycle.getId())
                .cycleName(cycle.getName())
                .cycleType(cycle.getCycleType())
                .status(cycle.getStatus())
                .startDate(cycle.getStartDate())
                .endDate(cycle.getEndDate())
                .previewToken(token(cycle, snapshots))
                .totalPeriods(snapshots.size())
                .completedCount((int) snapshots.stream().filter(s -> s.progress() == PeriodProgress.COMPLETED).count())
                .inProgressCount((int) snapshots.stream().filter(s -> s.progress() == PeriodProgress.IN_PROGRESS).count())
                .notStartedCount((int) snapshots.stream().filter(s -> s.progress() == PeriodProgress.NOT_STARTED).count())
                .targetCycles(targets)
                .periods(snapshots.stream().map(this::toPreview).toList())
                .build();
    }

    private PeriodPreview toPreview(PeriodSnapshot s) {
        Map<KpiProgressBucket, Long> counts = new EnumMap<>(KpiProgressBucket.class);
        s.buckets().values().forEach(b -> counts.merge(b, 1L, Long::sum));
        KpiPeriod p = s.period();
        return PeriodPreview.builder()
                .periodId(p.getId())
                .name(p.getName())
                .startDate(p.getStartDate())
                .endDate(p.getEndDate())
                .status(p.getStatus())
                .progress(s.progress())
                .kpiCount(s.kpis().size())
                .bucketCounts(counts)
                .unfinishedKpiCount(s.unfinishedKpis().size())
                .willSplitOnTransfer(s.hasCompletedKpi())
                .canCancel(s.progress() == PeriodProgress.NOT_STARTED && p.getStatus() == KpiPeriodStatus.ACTIVE)
                .build();
    }

    // =====================================================================
    // KHOÁ
    // =====================================================================

    /**
     * Khoá kỳ với kiểm tra quyền CYCLE_EVAL:FINALIZE. KHÔNG có endpoint: kỳ chỉ khoá ở MỘT chỗ là khoá
     * kết quả ở đơn vị gốc ({@link #lockForRootFinalize}). Giữ public cho test và việc dùng nội bộ.
     */
    @Transactional
    public CycleLockResultResponse lock(UUID cycleId, LockCycleRequest request) {
        return lock(cycleId, request, true, null);
    }

    /**
     * Khoá kỳ như một phần của "khoá kết quả" ở đơn vị gốc — cùng transaction với việc khoá kết
     * quả. Quyền đã được kiểm ở bước khoá kết quả (CYCLE_EVAL:FINALIZE tại đơn vị gốc). Kỳ đã khoá
     * sẵn thì không làm gì.
     */
    @Transactional
    public void lockForRootFinalize(UUID cycleId, LockCycleRequest request, String rootUnitName) {
        if (KpiCycleStatus.LOCKED.name().equals(kpiCycleRepository.lockForUpdate(cycleId))) return;
        if (request == null || request.getPreviewToken() == null) {
            // Gọi không kèm quyết định (công cụ AI, API cũ): chỉ được khi không còn đợt dở nào.
            KpiCycle cycle = findCycle(cycleId);
            List<PeriodSnapshot> snapshots = classifier.classify(periodsOf(cycle), Instant.now());
            List<String> unfinished = snapshots.stream().filter(sn -> sn.progress() != PeriodProgress.COMPLETED)
                    .map(sn -> sn.period().getName()).toList();
            if (!unfinished.isEmpty()) {
                throw new StaleStateException(ErrorCode.LOCKING_RESULTS_ROOT_UNIT_ALSO_LOCKS_CYCLE, String.valueOf(unfinished.size()), String.join(", ", unfinished));
            }
            request = LockCycleRequest.builder().previewToken(token(cycle, snapshots)).decisions(new ArrayList<>()).build();
        }
        lock(cycleId, request, false, rootUnitName);
    }

    /**
     * Mở lại kỳ khi mở khoá kết quả ở đơn vị gốc. Không đòi quyền REOPEN và không áp luật "đã có
     * đơn vị khoá kết quả" (đơn vị con còn khoá là bình thường) — đây là lùi đúng bước vừa gộp.
     */
    @Transactional
    public void reopenForRootUnfinalize(UUID cycleId, String rootUnitName) {
        if (!KpiCycleStatus.LOCKED.name().equals(kpiCycleRepository.lockForUpdate(cycleId))) return;
        User actor = currentUser();
        KpiCycle cycle = findCycle(cycleId);
        LocalizedText reopenReason = LocalizedText.of("cycleEvent.reason.rootReopened", rootUnitName);
        String reason = reopenReason.render(SupportedLanguages.DEFAULT_LOCALE);
        cycle.setStatus(KpiCycleStatus.OPEN);
        cycle.setReopenedBy(actor);
        cycle.setReopenedAt(Instant.now());
        cycle.setReopenReason(reason);
        kpiCycleRepository.save(cycle);
        eventRepository.save(KpiCycleEvent.builder()
                .kpiCycle(cycle).action(KpiCycleEventAction.REOPEN).actor(actor).reason(reason).reasonI18n(reopenReason.toJson())
                .detail(Map.of("trigger", "ROOT_UNFINALIZE"))
                .build());
    }

    private CycleLockResultResponse lock(UUID cycleId, LockCycleRequest request, boolean checkPermission, String rootUnitName) {
        User actor = currentUser();
        KpiCycle cycle = lockCycleForUpdate(cycleId);
        if (checkPermission) requirePermission(actor, PERM_FINALIZE, cycle);
        requireOpen(cycle);
        Instant now = Instant.now();

        // Phân loại LẠI sau khi đã giữ khoá — đây mới là bức tranh thật lúc khoá.
        List<PeriodSnapshot> snapshots = classifier.classify(periodsOf(cycle), now);
        if (!token(cycle, snapshots).equals(request.getPreviewToken())) {
            throw new StaleStateException(ErrorCode.CYCLE_DATA_CHANGED_SINCE_CHECK);
        }

        Map<UUID, PeriodSnapshot> unfinished = new LinkedHashMap<>();
        snapshots.stream().filter(s -> s.progress() != PeriodProgress.COMPLETED)
                .forEach(s -> unfinished.put(s.period().getId(), s));
        Map<UUID, PeriodDecision> decisions = indexDecisions(request.getDecisions(), unfinished);

        CycleLockResultResponse.CycleLockResultResponseBuilder result = CycleLockResultResponse.builder();
        int transferred = 0, split = 0, closedPeriods = 0, cancelled = 0, movedKpis = 0, closedKpis = 0, deletedDrafts = 0;
        Map<UUID, UUID> movedKpiTarget = new LinkedHashMap<>();
        List<UUID> closedKpiIds = new ArrayList<>();
        List<Map<String, Object>> decisionLog = new ArrayList<>();

        for (PeriodSnapshot s : unfinished.values()) {
            PeriodDecision d = decisions.get(s.period().getId());
            Map<String, Object> logRow = new LinkedHashMap<>();
            logRow.put("periodId", s.period().getId());
            logRow.put("periodName", s.period().getName());
            logRow.put("action", d.getAction());
            switch (d.getAction()) {
                case CANCEL -> {
                    deletedDrafts += cancelPeriod(cycle, s, actor, now);
                    cancelled++;
                }
                case CLOSE -> {
                    List<UUID> ids = closePeriod(cycle, s, actor, now);
                    closedKpiIds.addAll(ids);
                    closedKpis += ids.size();
                    closedPeriods++;
                }
                case TRANSFER -> {
                    KpiCycle target = resolveTarget(cycle, d, s.period());
                    logRow.put("targetCycleId", target.getId());
                    logRow.put("targetCycleName", target.getName());
                    List<UUID> ids;
                    if (s.hasCompletedKpi()) {
                        ids = splitPeriod(cycle, target, s, d, actor);
                        split++;
                        logRow.put("mode", "SPLIT");
                    } else {
                        ids = transferPeriod(cycle, target, s, d, actor);
                        transferred++;
                        logRow.put("mode", "WHOLE");
                    }
                    ids.forEach(id -> movedKpiTarget.put(id, target.getId()));
                    movedKpis += ids.size();
                }
            }
            decisionLog.add(logRow);
        }

        cycle.setStatus(KpiCycleStatus.LOCKED);
        cycle.setLockedBy(actor);
        cycle.setLockedAt(now);
        kpiCycleRepository.save(cycle);

        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("option", unfinished.isEmpty() ? "ALL_COMPLETED" : "RESOLVE_PERIODS");
        detail.put("trigger", rootUnitName != null ? "ROOT_FINALIZE" : "MANUAL");
        if (rootUnitName != null) detail.put("rootUnitName", rootUnitName);
        detail.put("totalPeriods", snapshots.size());
        detail.put("decisions", decisionLog);
        detail.put("transferredPeriods", transferred);
        detail.put("splitPeriods", split);
        detail.put("closedPeriods", closedPeriods);
        detail.put("cancelledPeriods", cancelled);
        eventRepository.save(KpiCycleEvent.builder()
                .kpiCycle(cycle).action(KpiCycleEventAction.LOCK).actor(actor).detail(detail)
                .build());

        eventPublisher.publishEvent(new CycleLockedEvent(cycle.getId(), actor.getId(), !unfinished.isEmpty(),
                movedKpiTarget, closedKpiIds));

        return result.cycle(kpiCycleService.toResponse(cycle))
                .transferredPeriods(transferred).splitPeriods(split)
                .closedPeriods(closedPeriods).cancelledPeriods(cancelled)
                .movedKpis(movedKpis).closedKpis(closedKpis).deletedDraftKpis(deletedDrafts)
                .build();
    }

    /** Mỗi đợt dở đúng một quyết định; không nhận quyết định cho đợt đã xong hay đợt lạ. */
    private Map<UUID, PeriodDecision> indexDecisions(List<PeriodDecision> list, Map<UUID, PeriodSnapshot> unfinished) {
        Map<UUID, PeriodDecision> out = new HashMap<>();
        for (PeriodDecision d : list == null ? List.<PeriodDecision>of() : list) {
            if (!unfinished.containsKey(d.getPeriodId())) {
                throw new BusinessException(ErrorCode.PERIOD_NOT_UNFINISHED_PERIOD_CYCLE, String.valueOf(d.getPeriodId()));
            }
            if (out.put(d.getPeriodId(), d) != null) {
                throw new BusinessException(ErrorCode.PERIOD_MORE_THAN_ONE_HANDLING_OPTION, unfinished.get(d.getPeriodId()).period().getName());
            }
        }
        List<String> missing = unfinished.values().stream()
                .filter(s -> !out.containsKey(s.period().getId()))
                .map(s -> s.period().getName()).toList();
        if (!missing.isEmpty()) {
            throw new BusinessException(ErrorCode.NO_HANDLING_OPTION_CHOSEN_PERIODS, String.valueOf(missing.size()), String.join(", ", missing));
        }
        return out;
    }

    /** (c) Huỷ đợt chưa bắt đầu: xoá mềm KPI nháp, đợt → CANCELLED. */
    private int cancelPeriod(KpiCycle cycle, PeriodSnapshot s, User actor, Instant now) {
        KpiPeriod p = s.period();
        if (s.progress() != PeriodProgress.NOT_STARTED) {
            throw new BusinessException(ErrorCode.ONLY_PERIODS_NOT_STARTED_CAN_CANCELLED, p.getName());
        }
        List<UUID> ids = new ArrayList<>();
        for (KpiCriteria k : s.kpis()) {
            k.setDeletedAt(now);
            k.setClosedReason("Huỷ đợt khi khoá kỳ");
            kpiCriteriaRepository.save(k);
            ids.add(k.getId());
        }
        p.setStatus(KpiPeriodStatus.CANCELLED);
        kpiPeriodRepository.save(p);
        eventRepository.save(KpiCycleEvent.builder()
                .kpiCycle(cycle).action(KpiCycleEventAction.PERIOD_CANCEL).actor(actor).period(p)
                .affectedKpiIds(ids).reason(CANCEL_ON_LOCK.render(SupportedLanguages.DEFAULT_LOCALE)).reasonI18n(CANCEL_ON_LOCK.toJson())
                .build());
        return ids.size();
    }

    /** (b) Chốt tại hiện trạng: KPI dở → CLOSED_BY_LOCK, KPI đã xong giữ nguyên. */
    private List<UUID> closePeriod(KpiCycle cycle, PeriodSnapshot s, User actor, Instant now) {
        KpiPeriod p = s.period();
        LocalizedText closeReason = LocalizedText.of("cycleEvent.reason.closedByLock", cycle.getName());
        String reason = closeReason.render(SupportedLanguages.DEFAULT_LOCALE);
        List<UUID> ids = new ArrayList<>();
        Map<String, Object> before = new LinkedHashMap<>();
        for (KpiCriteria k : s.unfinishedKpis()) {
            before.put(k.getId().toString(), k.getStatus().name() + "/" + s.buckets().get(k.getId()).name());
            k.setStatus(KpiStatus.CLOSED_BY_LOCK);
            k.setClosedAt(now);
            k.setClosedReason(reason);
            kpiCriteriaRepository.save(k);
            ids.add(k.getId());
        }
        // KPI đang ở giữa chuỗi duyệt (chờ duyệt / chờ điều chỉnh) cũng là KPI dở: chuỗi đóng lại.
        approvalChain.closeByLock(ids, actor, closeReason);
        p.setStatus(KpiPeriodStatus.CLOSED_BY_LOCK);
        kpiPeriodRepository.save(p);
        eventRepository.save(KpiCycleEvent.builder()
                .kpiCycle(cycle).action(KpiCycleEventAction.PERIOD_CLOSE).actor(actor).period(p)
                .affectedKpiIds(ids).reason(reason).reasonI18n(closeReason.toJson())
                .detail(Map.of("previousState", before))
                .build());
        return ids;
    }

    /** Kỳ đích hợp lệ: cùng tổ chức, cùng loại, khác kỳ đang khoá, đang mở (giữ FOR SHARE tới hết transaction). */
    private KpiCycle resolveTarget(KpiCycle cycle, PeriodDecision d, KpiPeriod period) {
        if (d.getTargetCycleId() == null) {
            throw new BusinessException(ErrorCode.NO_TARGET_CYCLE_CHOSEN_PERIOD, period.getName());
        }
        KpiCycle target = findCycle(d.getTargetCycleId());
        if (target.getId().equals(cycle.getId())) {
            throw new BusinessException(ErrorCode.TARGET_CYCLE_MUST_DIFFERENT_CYCLE_BEING_LOCKED);
        }
        if (!target.getOrganization().getId().equals(cycle.getOrganization().getId())
                || target.getCycleType() != cycle.getCycleType()) {
            throw new BusinessException(ErrorCode.TARGET_CYCLE_MUST_SAME_ORGANIZATION_SAME_CYCLE, target.getName());
        }
        if (KpiCycleStatus.LOCKED.name().equals(kpiCycleRepository.lockStatusForShare(target.getId()))) {
            throw new BusinessException(ErrorCode.TARGET_CYCLE_LOCKED, target.getName());
        }
        Instant start = d.getNewStartDate() != null ? d.getNewStartDate() : period.getStartDate();
        Instant end = d.getNewEndDate() != null ? d.getNewEndDate() : period.getEndDate();
        if (start == null || end == null || !end.isAfter(start)) {
            throw new BusinessException(ErrorCode.NEW_DATES_PERIOD_INVALID, period.getName());
        }
        if (target.getStartDate() != null && target.getEndDate() != null
                && (start.isBefore(target.getStartDate()) || end.isAfter(target.getEndDate()))) {
            throw new BusinessException(ErrorCode.DATES_PERIOD, period.getName(), String.valueOf(DATE.format(start)), String.valueOf(DATE.format(end)), target.getName(), String.valueOf(DATE.format(target.getStartDate())), String.valueOf(DATE.format(target.getEndDate())));
        }
        return target;
    }

    /** (a) Chưa KPI nào được đánh giá: chuyển NGUYÊN đợt cùng mọi KPI, giữ nguyên trạng thái. */
    private List<UUID> transferPeriod(KpiCycle cycle, KpiCycle target, PeriodSnapshot s, PeriodDecision d, User actor) {
        KpiPeriod p = s.period();
        Instant oldStart = p.getStartDate(), oldEnd = p.getEndDate();
        applyDates(p, d);
        p.setKpiCycle(target);
        p.setOriginalCycle(cycle);
        kpiPeriodRepository.save(p);

        List<UUID> ids = new ArrayList<>();
        for (KpiCriteria k : s.kpis()) {
            clampDeadline(k, p);
            ids.add(k.getId());
        }
        eventRepository.save(KpiCycleEvent.builder()
                .kpiCycle(cycle).action(KpiCycleEventAction.PERIOD_TRANSFER).actor(actor).period(p).targetCycle(target)
                .affectedKpiIds(ids)
                .detail(dateChange(oldStart, oldEnd, p))
                .build());
        return ids;
    }

    /**
     * (a) Đã có KPI được đánh giá: TÁCH. KPI đã xong ở lại đợt cũ (đợt cũ đóng TRANSFERRED), KPI dở
     * sang một đợt mới ở kỳ đích (trỏ về đợt gốc). Đánh giá đợt (theo người + đợt) ở lại đợt cũ.
     */
    private List<UUID> splitPeriod(KpiCycle cycle, KpiCycle target, PeriodSnapshot s, PeriodDecision d, User actor) {
        KpiPeriod old = s.period();
        Instant start = d.getNewStartDate() != null ? d.getNewStartDate() : old.getStartDate();
        Instant end = d.getNewEndDate() != null ? d.getNewEndDate() : old.getEndDate();

        // Tên phải khác đợt gốc: nhập KPI từ Excel tra đợt theo tên, trùng tên thì tra không ra.
        KpiPeriod created = kpiPeriodRepository.save(KpiPeriod.builder()
                .organization(old.getOrganization())
                .kpiCycle(target)
                .name(old.getName() + " (chuyển từ " + cycle.getName() + ")")
                .periodType(old.getPeriodType())
                .startDate(start)
                .endDate(end)
                .notificationDate(notificationWithin(old.getNotificationDate(), start, end))
                .sourcePeriod(old)
                .build());

        List<UUID> ids = new ArrayList<>();
        for (KpiCriteria k : s.unfinishedKpis()) {
            k.setKpiPeriod(created);
            clampDeadline(k, created);
            kpiCriteriaRepository.save(k);
            ids.add(k.getId());
        }
        old.setStatus(KpiPeriodStatus.TRANSFERRED);
        old.setTransferredToCycle(target);
        kpiPeriodRepository.save(old);

        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("keptKpiIds", s.finishedKpis().stream().map(KpiCriteria::getId).toList());
        detail.put("newPeriodName", created.getName());
        eventRepository.save(KpiCycleEvent.builder()
                .kpiCycle(cycle).action(KpiCycleEventAction.PERIOD_SPLIT).actor(actor).period(old).newPeriod(created)
                .targetCycle(target).affectedKpiIds(ids).detail(detail)
                .build());
        return ids;
    }

    private void applyDates(KpiPeriod p, PeriodDecision d) {
        if (d.getNewStartDate() != null) p.setStartDate(d.getNewStartDate());
        if (d.getNewEndDate() != null) p.setEndDate(d.getNewEndDate());
        p.setNotificationDate(notificationWithin(p.getNotificationDate(), p.getStartDate(), p.getEndDate()));
    }

    /** Ngày thông báo phải nằm trong đợt — lệch ra ngoài (do đổi ngày) thì đặt lại giữa đợt như lúc tạo. */
    private static Instant notificationWithin(Instant current, Instant start, Instant end) {
        if (start == null || end == null) return current;
        if (current != null && current.isAfter(start) && current.isBefore(end)) return current;
        return Instant.ofEpochMilli((start.toEpochMilli() + end.toEpochMilli()) / 2);
    }

    /** Hạn riêng của KPI phải nằm trong đợt (như lúc tạo KPI) — ngày đợt đổi thì kéo hạn về cuối đợt. */
    private static void clampDeadline(KpiCriteria k, KpiPeriod p) {
        if (k.getDeadline() == null || p.getStartDate() == null || p.getEndDate() == null) return;
        if (k.getDeadline().isBefore(p.getStartDate()) || k.getDeadline().isAfter(p.getEndDate())) {
            k.setDeadline(p.getEndDate());
        }
    }

    private static Map<String, Object> dateChange(Instant oldStart, Instant oldEnd, KpiPeriod p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("oldStartDate", oldStart);
        m.put("oldEndDate", oldEnd);
        m.put("newStartDate", p.getStartDate());
        m.put("newEndDate", p.getEndDate());
        return m;
    }

    // =====================================================================
    // LỊCH SỬ
    // =====================================================================

    @Transactional(readOnly = true)
    public List<KpiCycleEventResponse> events(UUID cycleId) {
        KpiCycle cycle = findCycle(cycleId);
        requirePermission(currentUser(), PERM_VIEW, cycle);
        return eventRepository.findByKpiCycleIdOrderByCreatedAtDesc(cycle.getId()).stream()
                .map(e -> KpiCycleEventResponse.builder()
                        .id(e.getId())
                        .action(e.getAction())
                        .actorId(e.getActor() != null ? e.getActor().getId() : null)
                        .actorName(e.getActor() != null ? e.getActor().getFullName() : null)
                        .createdAt(e.getCreatedAt())
                        .periodId(e.getPeriod() != null ? e.getPeriod().getId() : null)
                        .periodName(e.getPeriod() != null ? e.getPeriod().getName() : null)
                        .newPeriodId(e.getNewPeriod() != null ? e.getNewPeriod().getId() : null)
                        .newPeriodName(e.getNewPeriod() != null ? e.getNewPeriod().getName() : null)
                        .targetCycleId(e.getTargetCycle() != null ? e.getTargetCycle().getId() : null)
                        .targetCycleName(e.getTargetCycle() != null ? e.getTargetCycle().getName() : null)
                        .oldEndDate(e.getOldEndDate())
                        .newEndDate(e.getNewEndDate())
                        .affectedKpiIds(e.getAffectedKpiIds())
                        .reason(LocalizedText.renderOr(e.getReasonI18n(), e.getReason(), ErrorMessages.currentLocale()))
                        .detail(e.getDetail())
                        .build())
                .toList();
    }

    // =====================================================================
    // DÙNG CHUNG
    // =====================================================================

    /** Khoá độc quyền hàng kỳ tới hết transaction, rồi mới nạp entity (để không đọc bản cũ). */
    private KpiCycle lockCycleForUpdate(UUID cycleId) {
        String status = kpiCycleRepository.lockForUpdate(cycleId);
        if (status == null) {
            throw new ResourceNotFoundException(Terms.of("resource.evaluationCycle"), "id", cycleId);
        }
        KpiCycle cycle = findCycle(cycleId);
        // Entity có thể đã nằm trong persistence context từ trước lúc chờ khoá (vd. khoá kết quả nạp
        // kỳ trước) — trạng thái vừa đọc dưới FOR UPDATE mới là thật.
        cycle.setStatus(KpiCycleStatus.valueOf(status));
        return cycle;
    }

    private KpiCycle findCycle(UUID id) {
        return kpiCycleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.evaluationCycle"), "id", id));
    }

    private static void requireOpen(KpiCycle cycle) {
        if (cycle.isLocked()) {
            throw new BusinessException(ErrorCode.CYCLE_LOCKED_2, cycle.getName());
        }
    }

    private List<KpiPeriod> periodsOf(KpiCycle cycle) {
        return kpiPeriodRepository.findByKpiCycleIdOrderByStartDateAsc(cycle.getId());
    }

    private List<KpiCycle> targetCycles(KpiCycle cycle) {
        return kpiCycleRepository.findByOrganizationIdAndCycleTypeAndStatusOrderByStartDateAsc(
                        cycle.getOrganization().getId(), cycle.getCycleType(), KpiCycleStatus.OPEN).stream()
                .filter(c -> !c.getId().equals(cycle.getId()))
                .toList();
    }

    private static CycleRef ref(KpiCycle c) {
        return CycleRef.builder().id(c.getId()).name(c.getName()).startDate(c.getStartDate()).endDate(c.getEndDate()).build();
    }

    /**
     * Dấu vân tay của bức tranh phân loại: đổi khi có KPI đổi nhóm tiến độ, đợt đổi tiến độ/ngày,
     * hay kỳ đổi ngày cuối. Không phải bí mật — chỉ để phát hiện dữ liệu đã cũ.
     */
    String token(KpiCycle cycle, List<PeriodSnapshot> snapshots) {
        StringBuilder sb = new StringBuilder();
        sb.append(cycle.getId()).append('|').append(cycle.getEndDate()).append('|').append(cycle.getStatus()).append('\n');
        snapshots.stream()
                .sorted(Comparator.comparing(s -> s.period().getId()))
                .forEach(s -> {
                    sb.append(s.period().getId()).append('|').append(s.progress()).append('|')
                            .append(s.period().getStatus()).append('|').append(s.period().getEndDate());
                    s.buckets().entrySet().stream()
                            .sorted(Map.Entry.comparingByKey())
                            .forEach(e -> sb.append('|').append(e.getKey()).append(':').append(e.getValue()));
                    sb.append('\n');
                });
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(sb.toString().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(h, 0, 16);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "email", email));
    }

    private void requirePermission(User user, String permission, KpiCycle cycle) {
        if (!permissionChecker.hasPermissionInOrganization(user.getId(), permission, cycle.getOrganization().getId())) {
            throw new ForbiddenException(PERM_VIEW.equals(permission) ? ErrorCode.NO_PERMISSION_VIEW_EVALUATION_CYCLE : ErrorCode.NO_PERMISSION_LOCK_EVALUATION_CYCLE);
        }
    }
}
