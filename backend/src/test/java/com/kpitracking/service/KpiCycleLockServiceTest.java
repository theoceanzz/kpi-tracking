package com.kpitracking.service;

import com.kpitracking.exception.ErrorCode;
import com.kpitracking.dto.request.kpi.lock.LockCycleRequest;
import com.kpitracking.dto.request.kpi.lock.LockCycleRequest.PeriodDecision;
import com.kpitracking.dto.response.kpi.lock.CycleLockPreviewResponse;
import com.kpitracking.dto.response.kpi.lock.CycleLockResultResponse;
import com.kpitracking.entity.*;
import com.kpitracking.enums.*;
import com.kpitracking.event.KpiCycleLockEvents.CycleLockedEvent;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.StaleStateException;
import com.kpitracking.mapper.KpiCriteriaMapper;
import com.kpitracking.repository.*;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.kpi.CycleStatusGuard;
import com.kpitracking.service.kpi.PeriodProgressClassifier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Khoá kỳ — các trường hợp nghiệp vụ §7 (1, 3–8, 11). Gia hạn (2, 10) đã bỏ theo quyết định 2026-09-25. Trường hợp đồng thời (9) và rollback thật
 * trên DB nằm ở {@code CycleLockConcurrencyIT}.
 */
class KpiCycleLockServiceTest {

    private static final Instant NOW = Instant.now();
    private static final Duration DAY = Duration.ofDays(1);

    private final KpiCycleRepository cycles = mock(KpiCycleRepository.class);
    private final KpiPeriodRepository periods = mock(KpiPeriodRepository.class);
    private final KpiCriteriaRepository kpis = mock(KpiCriteriaRepository.class);
    private final KpiCycleEventRepository events = mock(KpiCycleEventRepository.class);
    private final EvaluationRepository evaluations = mock(EvaluationRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final PermissionChecker permissions = mock(PermissionChecker.class);
    private final KpiCriteriaMapper mapper = mock(KpiCriteriaMapper.class);
    private final KpiCycleService cycleService = mock(KpiCycleService.class);
    private final ApplicationEventPublisher publisher = mock(ApplicationEventPublisher.class);

    private final com.kpitracking.service.kpi.approval.KpiApprovalChainService approvalChain =
            mock(com.kpitracking.service.kpi.approval.KpiApprovalChainService.class);

    private final PeriodProgressClassifier classifier = new PeriodProgressClassifier(kpis, evaluations, mapper);
    private final KpiCycleLockService service = new KpiCycleLockService(cycles, periods, kpis, events,
            users, permissions, classifier, cycleService, publisher, approvalChain);

    private Organization org;
    private User admin, manager, emp;
    private KpiCycle cycle, target;
    private final List<KpiPeriod> cyclePeriods = new ArrayList<>();
    private final List<KpiCriteria> allKpis = new ArrayList<>();
    private final List<Evaluation> allEvals = new ArrayList<>();
    private OrgUnit unit;

    @BeforeEach
    void setUp() {
        org = Organization.builder().id(UUID.randomUUID()).build();
        admin = User.builder().id(UUID.randomUUID()).email("admin@x.vn").fullName("Admin").build();
        manager = User.builder().id(UUID.randomUUID()).email("ql@x.vn").fullName("Quản lý").build();
        emp = User.builder().id(UUID.randomUUID()).email("nv@x.vn").fullName("Nhân viên").build();
        unit = OrgUnit.builder().id(UUID.randomUUID()).name("Phòng A").build();

        cycle = cycle("Quý 3", NOW.minus(DAY.multipliedBy(80)), NOW.plus(DAY.multipliedBy(10)));
        target = cycle("Quý 4", NOW.plus(DAY.multipliedBy(11)), NOW.plus(DAY.multipliedBy(100)));

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(admin.getEmail(), "x", List.of()));
        when(users.findByEmail(admin.getEmail())).thenReturn(Optional.of(admin));
        when(permissions.hasPermissionInOrganization(any(), any(), any())).thenReturn(true);
        when(mapper.calculateExpected(any(KpiCriteria.class))).thenReturn(1);

        when(cycles.lockForUpdate(any())).thenAnswer(i -> byId(i.getArgument(0)).getStatus().name());
        when(cycles.lockStatusForShare(any())).thenAnswer(i -> byId(i.getArgument(0)).getStatus().name());
        when(cycles.findById(any())).thenAnswer(i -> Optional.ofNullable(byId(i.getArgument(0))));
        when(cycles.findByOrganizationIdAndCycleTypeAndStatusOrderByStartDateAsc(any(), any(), eq(KpiCycleStatus.OPEN)))
                .thenAnswer(i -> List.of(cycle, target).stream().filter(c -> c.getStatus() == KpiCycleStatus.OPEN).toList());
        when(cycles.findOverlapping(any(), any(), any(), any(), any())).thenAnswer(i -> {
            Instant start = i.getArgument(3), end = i.getArgument(4);
            return target.getStartDate().isBefore(end) && target.getEndDate().isAfter(start) ? List.of(target) : List.of();
        });
        when(periods.findByKpiCycleIdOrderByStartDateAsc(any())).thenAnswer(i -> cyclePeriods.stream()
                .filter(p -> p.getKpiCycle() != null && p.getKpiCycle().getId().equals(i.getArgument(0))).toList());
        when(periods.save(any())).thenAnswer(i -> {
            KpiPeriod p = i.getArgument(0);
            if (p.getId() == null) { p.setId(UUID.randomUUID()); cyclePeriods.add(p); }
            return p;
        });
        when(kpis.findByKpiPeriodIdIn(any())).thenAnswer(i -> {
            Collection<UUID> ids = i.getArgument(0);
            return allKpis.stream().filter(k -> k.getDeletedAt() == null && ids.contains(k.getKpiPeriod().getId())).toList();
        });
        when(kpis.save(any())).thenAnswer(i -> i.getArgument(0));
        when(evaluations.findByKpiPeriodIdIn(any())).thenAnswer(i -> {
            Collection<UUID> ids = i.getArgument(0);
            return allEvals.stream().filter(e -> ids.contains(e.getKpiPeriod().getId())).toList();
        });
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    // ── fixture ─────────────────────────────────────────────────────────────

    private KpiCycle cycle(String name, Instant start, Instant end) {
        return KpiCycle.builder().id(UUID.randomUUID()).name(name).organization(org)
                .cycleType(KpiFrequency.QUARTERLY).startDate(start).endDate(end).build();
    }

    private KpiCycle byId(UUID id) {
        return id.equals(cycle.getId()) ? cycle : id.equals(target.getId()) ? target : null;
    }

    private KpiPeriod period(String name, int startDaysAgo, int endInDays) {
        KpiPeriod p = KpiPeriod.builder().id(UUID.randomUUID()).name(name).organization(org).kpiCycle(cycle)
                .periodType(KpiFrequency.MONTHLY)
                .startDate(NOW.minus(DAY.multipliedBy(startDaysAgo))).endDate(NOW.plus(DAY.multipliedBy(endInDays)))
                .build();
        cyclePeriods.add(p);
        return p;
    }

    private KpiCriteria kpi(KpiPeriod p, KpiStatus status) {
        KpiCriteria k = KpiCriteria.builder().id(UUID.randomUUID()).name("KPI " + allKpis.size()).orgUnit(unit)
                .kpiPeriod(p).status(status).frequency(KpiFrequency.MONTHLY).weight(50.0).targetValue(10.0)
                .assignees(new ArrayList<>(List.of(emp))).build();
        allKpis.add(k);
        return k;
    }

    private KpiSubmission submit(KpiCriteria k, SubmissionStatus status, int minutesAgo) {
        KpiSubmission s = KpiSubmission.builder().id(UUID.randomUUID()).kpiCriteria(k).submittedBy(emp)
                .status(status).actualValue(10.0).createdAt(NOW.minus(Duration.ofMinutes(minutesAgo))).build();
        k.getSubmissions().add(s);
        return s;
    }

    private void evaluate(KpiPeriod p, User evaluator) {
        allEvals.add(Evaluation.builder().id(UUID.randomUUID()).kpiPeriod(p).user(emp).evaluator(evaluator).build());
    }

    /** KPI đã duyệt + đã nộp (được duyệt) + đã được quản lý đánh giá. */
    private KpiCriteria completedKpi(KpiPeriod p) {
        KpiCriteria k = kpi(p, KpiStatus.APPROVED);
        submit(k, SubmissionStatus.APPROVED, 10);
        if (allEvals.stream().noneMatch(e -> e.getKpiPeriod() == p)) evaluate(p, manager);
        return k;
    }

    private String token() {
        return service.preview(cycle.getId()).getPreviewToken();
    }

    private LockCycleRequest request(PeriodDecision... ds) {
        return LockCycleRequest.builder().previewToken(token()).decisions(new ArrayList<>(List.of(ds))).build();
    }

    private static PeriodDecision decide(KpiPeriod p, PeriodLockAction a, KpiCycle to) {
        return PeriodDecision.builder().periodId(p.getId()).action(a).targetCycleId(to != null ? to.getId() : null).build();
    }

    private CycleLockedEvent publishedEvent() {
        ArgumentCaptor<Object> c = ArgumentCaptor.forClass(Object.class);
        verify(publisher).publishEvent(c.capture());
        return (CycleLockedEvent) c.getValue();
    }

    // ── 1 ───────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("1. Mọi đợt hoàn thành ⇒ khoá thành công, không cần quyết định nào, chỉ báo quản lý")
    void lockAllCompleted() {
        completedKpi(period("T7", 80, -50));
        completedKpi(period("T8", 50, -20));
        period("T9 trống, đã quá hạn", 30, -1);

        CycleLockPreviewResponse preview = service.preview(cycle.getId());
        assertThat(preview.getCompletedCount()).isEqualTo(3);
        assertThat(preview.getInProgressCount() + preview.getNotStartedCount()).isZero();

        CycleLockResultResponse r = service.lock(cycle.getId(), request());

        assertThat(cycle.getStatus()).isEqualTo(KpiCycleStatus.LOCKED);
        assertThat(cycle.getLockedBy()).isEqualTo(admin);
        assertThat(r.getClosedKpis() + r.getMovedKpis()).isZero();
        assertThat(publishedEvent().hadUnfinished()).isFalse();
        verify(events).save(argThat(e -> e.getAction() == KpiCycleEventAction.LOCK));
    }

    // ── 3, 4 ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("3. Chuyển đợt dở chưa KPI nào được đánh giá ⇒ chuyển NGUYÊN đợt + KPI, kỳ cũ khoá")
    void transferWholePeriod() {
        completedKpi(period("T7", 80, -60));
        KpiPeriod dở = period("T9", 20, 5);
        KpiCriteria a = kpi(dở, KpiStatus.APPROVED);
        KpiCriteria b = kpi(dở, KpiStatus.PENDING_APPROVAL);
        PeriodDecision d = decide(dở, PeriodLockAction.TRANSFER, target);
        d.setNewStartDate(target.getStartDate().plus(DAY));
        d.setNewEndDate(target.getStartDate().plus(DAY.multipliedBy(20)));

        CycleLockResultResponse r = service.lock(cycle.getId(), request(d));

        assertThat(dở.getKpiCycle()).isEqualTo(target);
        assertThat(dở.getOriginalCycle()).isEqualTo(cycle);
        assertThat(dở.getStatus()).isEqualTo(KpiPeriodStatus.ACTIVE);
        assertThat(a.getKpiPeriod()).isSameAs(dở);
        assertThat(a.getStatus()).isEqualTo(KpiStatus.APPROVED);   // giữ nguyên trạng thái
        assertThat(b.getStatus()).isEqualTo(KpiStatus.PENDING_APPROVAL);
        assertThat(cycle.getStatus()).isEqualTo(KpiCycleStatus.LOCKED);
        assertThat(r.getTransferredPeriods()).isEqualTo(1);
        assertThat(publishedEvent().movedKpiTargetCycle()).containsOnlyKeys(a.getId(), b.getId());
    }

    @Test
    @DisplayName("3b. Thời gian đợt nằm ngoài kỳ đích mà không chỉnh ngày ⇒ bắt điều chỉnh")
    void transferRequiresDateFit() {
        KpiPeriod dở = period("T9", 20, 5);
        kpi(dở, KpiStatus.APPROVED);
        assertThatThrownBy(() -> service.lock(cycle.getId(), request(decide(dở, PeriodLockAction.TRANSFER, target))))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.DATES_PERIOD);
        assertThat(cycle.getStatus()).isEqualTo(KpiCycleStatus.OPEN);
    }

    @Test
    @DisplayName("4. Đợt dở có một phần KPI đã đánh giá ⇒ tách: KPI xong ở lại, KPI dở sang đợt mới trỏ về đợt gốc")
    void splitPeriod() {
        KpiPeriod mixed = period("T9", 20, 5);
        KpiCriteria done = completedKpi(mixed);
        KpiCriteria notSubmitted = kpi(mixed, KpiStatus.APPROVED);
        // người được giao của KPI dở là người khác, chưa được đánh giá
        User emp2 = User.builder().id(UUID.randomUUID()).fullName("NV2").build();
        notSubmitted.setAssignees(new ArrayList<>(List.of(emp2)));
        PeriodDecision d = decide(mixed, PeriodLockAction.TRANSFER, target);
        d.setNewStartDate(target.getStartDate());
        d.setNewEndDate(target.getStartDate().plus(DAY.multipliedBy(25)));

        CycleLockResultResponse r = service.lock(cycle.getId(), request(d));

        assertThat(r.getSplitPeriods()).isEqualTo(1);
        assertThat(done.getKpiPeriod()).isSameAs(mixed);
        assertThat(mixed.getStatus()).isEqualTo(KpiPeriodStatus.TRANSFERRED);
        assertThat(mixed.getTransferredToCycle()).isEqualTo(target);
        assertThat(mixed.getKpiCycle()).isEqualTo(cycle);

        KpiPeriod created = notSubmitted.getKpiPeriod();
        assertThat(created).isNotSameAs(mixed);
        assertThat(created.getKpiCycle()).isEqualTo(target);
        assertThat(created.getSourcePeriod()).isSameAs(mixed);
        assertThat(created.getName()).isNotEqualTo(mixed.getName()).contains("chuyển từ");
        assertThat(created.getStartDate()).isEqualTo(d.getNewStartDate());
        verify(events).save(argThat(e -> e.getAction() == KpiCycleEventAction.PERIOD_SPLIT
                && e.getNewPeriod() == created && e.getAffectedKpiIds().equals(List.of(notSubmitted.getId()))));
    }

    // ── 5 ───────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("5. Chốt đợt ⇒ KPI dở CLOSED_BY_LOCK và bị loại khỏi điểm, KPI xong giữ nguyên")
    void closePeriod() {
        KpiPeriod p = period("T9", 20, 5);
        KpiCriteria done = completedKpi(p);
        KpiCriteria waitingEval = kpi(p, KpiStatus.APPROVED);
        User emp2 = User.builder().id(UUID.randomUUID()).build();
        waitingEval.setAssignees(new ArrayList<>(List.of(emp2)));
        waitingEval.getSubmissions().add(KpiSubmission.builder().id(UUID.randomUUID()).submittedBy(emp2)
                .status(SubmissionStatus.APPROVED).createdAt(NOW).build());

        CycleLockResultResponse r = service.lock(cycle.getId(), request(decide(p, PeriodLockAction.CLOSE, null)));

        assertThat(done.getStatus()).isEqualTo(KpiStatus.APPROVED);
        assertThat(waitingEval.getStatus()).isEqualTo(KpiStatus.CLOSED_BY_LOCK);
        assertThat(waitingEval.getClosedAt()).isNotNull();
        assertThat(waitingEval.getClosedReason()).contains("khoá kỳ");
        assertThat(p.getStatus()).isEqualTo(KpiPeriodStatus.CLOSED_BY_LOCK);
        assertThat(r.getClosedKpis()).isEqualTo(1);
        assertThat(publishedEvent().closedKpiIds()).containsExactly(waitingEval.getId());
        // KPI dở đang ở giữa chuỗi duyệt: chuỗi đóng theo.
        verify(approvalChain).closeByLock(eq(List.of(waitingEval.getId())), any(),
                argThat(reason -> "cycleEvent.reason.closedByLock".equals(reason.key())));

        KpiAchievementCalculator calc = new KpiAchievementCalculator(kpis);
        assertThat(calc.countsTowardQuantitativeScore(waitingEval)).isFalse();
        assertThat(calc.countsTowardBscScore(waitingEval)).isFalse();
        assertThat(calc.countsTowardQuantitativeScore(done)).isTrue();
    }

    // ── 6 ───────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("6. Huỷ đợt chưa bắt đầu ⇒ xoá mềm KPI nháp, đợt CANCELLED")
    void cancelNotStarted() {
        KpiPeriod p = period("T10", 1, 25);
        KpiCriteria draft = kpi(p, KpiStatus.DRAFT);

        CycleLockResultResponse r = service.lock(cycle.getId(), request(decide(p, PeriodLockAction.CANCEL, null)));

        assertThat(p.getStatus()).isEqualTo(KpiPeriodStatus.CANCELLED);
        assertThat(draft.getDeletedAt()).isNotNull();
        assertThat(r.getDeletedDraftKpis()).isEqualTo(1);
        verify(events).save(argThat(e -> e.getAction() == KpiCycleEventAction.PERIOD_CANCEL
                && "Huỷ đợt khi khoá kỳ".equals(e.getReason())));
    }

    @Test
    @DisplayName("6b. Không cho huỷ đợt đã có KPI thật")
    void cannotCancelRealPeriod() {
        KpiPeriod p = period("T9", 20, 5);
        KpiCriteria real = kpi(p, KpiStatus.APPROVED);

        assertThat(service.preview(cycle.getId()).getPeriods().get(0).isCanCancel()).isFalse();
        assertThatThrownBy(() -> service.lock(cycle.getId(), request(decide(p, PeriodLockAction.CANCEL, null))))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.ONLY_PERIODS_NOT_STARTED_CAN_CANCELLED);
        assertThat(real.getDeletedAt()).isNull();
        assertThat(cycle.getStatus()).isEqualTo(KpiCycleStatus.OPEN);
    }

    // ── 7 ───────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("7. Không có kỳ đích hợp lệ ⇒ preview không đưa kỳ nào, chuyển bị từ chối")
    void noValidTarget() {
        target.setStatus(KpiCycleStatus.LOCKED);
        KpiPeriod p = period("T9", 20, 5);
        kpi(p, KpiStatus.APPROVED);

        assertThat(service.preview(cycle.getId()).getTargetCycles()).isEmpty();
        assertThatThrownBy(() -> service.lock(cycle.getId(), request(decide(p, PeriodLockAction.TRANSFER, target))))
                .isInstanceOf(BusinessException.class).extracting("errorCode").isEqualTo(ErrorCode.TARGET_CYCLE_LOCKED);
    }

    @Test
    @DisplayName("7b. Kỳ đích khác loại ⇒ từ chối")
    void targetMustShareType() {
        target.setCycleType(KpiFrequency.YEARLY);
        KpiPeriod p = period("T9", 20, 5);
        kpi(p, KpiStatus.APPROVED);
        assertThatThrownBy(() -> service.lock(cycle.getId(), request(decide(p, PeriodLockAction.TRANSFER, target))))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.TARGET_CYCLE_MUST_SAME_ORGANIZATION_SAME_CYCLE);
    }

    // ── Luật chung của lệnh khoá ───────────────────────────────────────────

    @Test
    @DisplayName("Chưa chọn cách xử lý cho mọi đợt dở ⇒ không khoá")
    void everyUnfinishedPeriodNeedsDecision() {
        KpiPeriod a = period("T8", 40, 5);
        KpiPeriod b = period("T9", 20, 5);
        kpi(a, KpiStatus.APPROVED);
        kpi(b, KpiStatus.APPROVED);
        assertThatThrownBy(() -> service.lock(cycle.getId(), request(decide(a, PeriodLockAction.CLOSE, null))))
                .isInstanceOf(BusinessException.class).hasMessageContaining("T9")
                .extracting("errorCode").isEqualTo(ErrorCode.NO_HANDLING_OPTION_CHOSEN_PERIODS);
        assertThat(cycle.getStatus()).isEqualTo(KpiCycleStatus.OPEN);
    }

    @Test
    @DisplayName("Dữ liệu đổi sau bước kiểm tra ⇒ 409, không khoá theo bức tranh cũ")
    void staleTokenRejected() {
        KpiPeriod p = period("T9", 20, 5);
        KpiCriteria k = kpi(p, KpiStatus.APPROVED);
        String token = token();
        submit(k, SubmissionStatus.PENDING, 0); // có người vừa nộp

        assertThatThrownBy(() -> service.lock(cycle.getId(), LockCycleRequest.builder().previewToken(token)
                .decisions(new ArrayList<>(List.of(decide(p, PeriodLockAction.CLOSE, null)))).build()))
                .isInstanceOf(StaleStateException.class);
        assertThat(k.getStatus()).isEqualTo(KpiStatus.APPROVED);
    }

    @Test
    @DisplayName("Kỳ đã khoá thì không khoá lại")
    void cannotLockTwice() {
        cycle.setStatus(KpiCycleStatus.LOCKED);
        assertThatThrownBy(() -> service.lock(cycle.getId(), LockCycleRequest.builder().previewToken("x").build()))
                .isInstanceOf(BusinessException.class).extracting("errorCode").isEqualTo(ErrorCode.CYCLE_LOCKED_2);
    }

    // ── 11 ──────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("11. Lỗi giữa chừng khi xử lý nhiều đợt ⇒ ném ra trước khi đánh dấu khoá/phát sự kiện (transaction rollback)")
    void failureMidwayAbortsBeforeLocking() {
        KpiPeriod first = period("T8", 40, 5);
        KpiPeriod second = period("T9", 20, 5);
        kpi(first, KpiStatus.APPROVED);
        kpi(second, KpiStatus.APPROVED);
        String token = token();
        // Kỳ đích bị khoá bởi người khác sau bước kiểm tra — đợt thứ hai chuyển sang đó sẽ lỗi.
        target.setStatus(KpiCycleStatus.LOCKED);
        PeriodDecision d2 = decide(second, PeriodLockAction.TRANSFER, target);
        d2.setNewStartDate(target.getStartDate());
        d2.setNewEndDate(target.getEndDate());

        assertThatThrownBy(() -> service.lock(cycle.getId(), LockCycleRequest.builder().previewToken(token)
                .decisions(new ArrayList<>(List.of(decide(first, PeriodLockAction.CLOSE, null), d2))).build()))
                .isInstanceOf(BusinessException.class);

        assertThat(cycle.getStatus()).isEqualTo(KpiCycleStatus.OPEN);
        verify(publisher, never()).publishEvent(any());
        verify(events, never()).save(argThat(e -> e.getAction() == KpiCycleEventAction.LOCK));
    }

    // ── Gộp: khoá kết quả ở đơn vị gốc = khoá kỳ ───────────────────────────

    @Nested
    @DisplayName("Khoá/mở khoá kết quả ở đơn vị gốc")
    class RootFinalize {

        @Test
        @DisplayName("mọi đợt đã xong, không kèm quyết định ⇒ tự khoá kỳ (quyền đã kiểm ở bước khoá kết quả)")
        void autoLocksWhenAllCompleted() {
            completedKpi(period("T7", 80, -60));
            when(permissions.hasPermissionInOrganization(any(), any(), any())).thenReturn(false);

            service.lockForRootFinalize(cycle.getId(), null, "KeyPerson");

            assertThat(cycle.getStatus()).isEqualTo(KpiCycleStatus.LOCKED);
            verify(events).save(argThat(e -> e.getAction() == KpiCycleEventAction.LOCK
                    && "ROOT_FINALIZE".equals(e.getDetail().get("trigger"))));
        }

        @Test
        @DisplayName("còn đợt dở mà không kèm quyết định ⇒ 409, kỳ vẫn mở")
        void unfinishedWithoutDecisionsRejected() {
            kpi(period("T9", 20, 5), KpiStatus.APPROVED);
            assertThatThrownBy(() -> service.lockForRootFinalize(cycle.getId(), null, "KeyPerson"))
                    .isInstanceOf(StaleStateException.class).hasMessageContaining("T9");
            assertThat(cycle.getStatus()).isEqualTo(KpiCycleStatus.OPEN);
        }

        @Test
        @DisplayName("còn đợt dở, kèm quyết định ⇒ xử lý đợt rồi khoá")
        void unfinishedWithDecisionsLocks() {
            KpiPeriod p = period("T9", 20, 5);
            KpiCriteria k = kpi(p, KpiStatus.APPROVED);
            service.lockForRootFinalize(cycle.getId(), request(decide(p, PeriodLockAction.CLOSE, null)), "KeyPerson");
            assertThat(cycle.getStatus()).isEqualTo(KpiCycleStatus.LOCKED);
            assertThat(k.getStatus()).isEqualTo(KpiStatus.CLOSED_BY_LOCK);
        }

        @Test
        @DisplayName("kỳ đã khoá sẵn ⇒ không làm gì")
        void alreadyLockedNoop() {
            cycle.setStatus(KpiCycleStatus.LOCKED);
            service.lockForRootFinalize(cycle.getId(), null, "KeyPerson");
            verify(events, never()).save(any());
            verify(publisher, never()).publishEvent(any());
        }

        @Test
        @DisplayName("mở khoá kết quả gốc ⇒ mở lại kỳ, ghi lịch sử")
        void unfinalizeReopensCycle() {
            cycle.setStatus(KpiCycleStatus.LOCKED);
            service.reopenForRootUnfinalize(cycle.getId(), "KeyPerson");

            assertThat(cycle.getStatus()).isEqualTo(KpiCycleStatus.OPEN);
            assertThat(cycle.getReopenReason()).contains("KeyPerson");
            verify(events).save(argThat(e -> e.getAction() == KpiCycleEventAction.REOPEN));
        }

        @Test
        @DisplayName("kỳ đang mở thì mở khoá kết quả gốc không ghi gì vào lịch sử kỳ")
        void unfinalizeOpenCycleNoop() {
            service.reopenForRootUnfinalize(cycle.getId(), "KeyPerson");
            verify(events, never()).save(any());
        }
    }

    // ── 8 ───────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("8. Guard: mọi đường ghi vào kỳ đã khoá bị từ chối với tên kỳ")
    void guardRejectsLockedCycle() {
        CycleStatusGuard guard = new CycleStatusGuard(cycles);
        KpiPeriod p = period("T9", 20, 5);
        KpiCriteria k = kpi(p, KpiStatus.APPROVED);
        assertThatCode(() -> guard.assertWritable(k)).doesNotThrowAnyException();

        cycle.setStatus(KpiCycleStatus.LOCKED);
        assertThatThrownBy(() -> guard.assertWritable(k)).hasMessageContaining("Quý 3").extracting("errorCode").isEqualTo(ErrorCode.CYCLE_LOCKED);
        assertThatThrownBy(() -> guard.assertWritable(p)).extracting("errorCode").isEqualTo(ErrorCode.CYCLE_LOCKED);
        assertThatThrownBy(() -> guard.assertWritable(cycle)).extracting("errorCode").isEqualTo(ErrorCode.CYCLE_LOCKED);
    }

    @Test
    @DisplayName("8b. Guard: KPI đã chốt / đợt đã đóng vẫn bị chặn sau khi mở lại kỳ")
    void guardRejectsClosedAfterReopen() {
        CycleStatusGuard guard = new CycleStatusGuard(cycles);
        KpiPeriod p = period("T9", 20, 5);
        p.setStatus(KpiPeriodStatus.CLOSED_BY_LOCK);
        assertThatThrownBy(() -> guard.assertWritable(p)).extracting("errorCode").isEqualTo(ErrorCode.PERIOD_CLOSED_WHEN_CYCLE_LOCKED);

        KpiPeriod open = period("T10", 5, 20);
        KpiCriteria closed = kpi(open, KpiStatus.CLOSED_BY_LOCK);
        assertThatThrownBy(() -> guard.assertWritable(closed)).extracting("errorCode").isEqualTo(ErrorCode.KPI_CLOSED_CYCLE_LOCK);
    }

    @Test
    @DisplayName("8c. Đợt không thuộc kỳ nào thì luôn ghi được")
    void guardIgnoresPeriodWithoutCycle() {
        CycleStatusGuard guard = new CycleStatusGuard(cycles);
        KpiPeriod loose = KpiPeriod.builder().id(UUID.randomUUID()).name("Lẻ").build();
        assertThatCode(() -> guard.assertWritable(loose)).doesNotThrowAnyException();
        verify(cycles, never()).lockStatusForShare(any());
    }
}
