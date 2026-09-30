package com.kpitracking.service.ai.review;

import com.kpitracking.dto.response.ai.AiSelfCheckAvailabilityResponse;
import com.kpitracking.dto.response.ai.AiSelfCheckResponse;
import com.kpitracking.entity.AiSelfCheck;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.OrgHierarchyLevel;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.AiReviewStatus;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.event.AiSelfCheckEvents;
import com.kpitracking.exception.AiTokenQuotaExceededException;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.AiSelfCheckRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiSubmissionRepository;
import com.kpitracking.repository.QualitativeLevelRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.AiQuotaService;
import com.kpitracking.service.AiRateLimiter;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Nhân viên tự soi bài (câu E3 — "có token thì được dùng"): chỉ người được giao chỉ tiêu, tổ chức và đơn vị đã
 * bật, hạn mức của CHÍNH nhân viên; bài y hệt không tốn token lần hai; chỉ chính chủ đọc được kết quả.
 */
class SubmissionSelfCheckServiceTest {

    private AiSelfCheckRepository repository;
    private KpiCriteriaRepository kpis;
    private AiReviewSettingsResolver resolver;
    private AiRateLimiter rateLimiter;
    private AiQuotaService quota;
    private ApplicationEventPublisher events;
    private SubmissionSelfCheckService service;

    private final User me = new User();
    private final Organization org = new Organization();
    private final KpiCriteria kpi = new KpiCriteria();
    private final List<AiSelfCheck> saved = new ArrayList<>();

    @BeforeEach
    void setUp() {
        repository = mock(AiSelfCheckRepository.class);
        kpis = mock(KpiCriteriaRepository.class);
        resolver = mock(AiReviewSettingsResolver.class);
        rateLimiter = mock(AiRateLimiter.class);
        quota = mock(AiQuotaService.class);
        events = mock(ApplicationEventPublisher.class);
        UserRepository users = mock(UserRepository.class);
        UserRoleOrgUnitRepository assignments = mock(UserRoleOrgUnitRepository.class);
        service = new SubmissionSelfCheckService(repository, kpis, mock(KpiSubmissionRepository.class),
                mock(QualitativeLevelRepository.class), users, assignments, resolver, rateLimiter, quota, events);

        me.setId(UUID.randomUUID());
        me.setEmail("staff@demo.com");
        when(users.findByEmail("staff@demo.com")).thenReturn(Optional.of(me));

        org.setId(UUID.randomUUID());
        org.setEnableAi(true);
        org.setEnableAiReview(true);
        OrgHierarchyLevel level = new OrgHierarchyLevel();
        level.setOrganization(org);
        OrgUnit unit = new OrgUnit();
        unit.setOrgHierarchyLevel(level);
        UserRoleOrgUnit a = new UserRoleOrgUnit();
        a.setOrgUnit(unit);
        when(assignments.findByUserId(me.getId())).thenReturn(List.of(a));
        when(resolver.resolve(any(), any())).thenReturn(
                new AiReviewSettingsResolver.Effective(true, ReviewFixtures.W, null, "công ty"));

        kpi.setId(UUID.randomUUID());
        kpi.setStatus(KpiStatus.APPROVED);
        kpi.setAssignees(new ArrayList<>(List.of(me)));
        when(kpis.findById(kpi.getId())).thenReturn(Optional.of(kpi));

        when(repository.save(any())).thenAnswer(inv -> {
            AiSelfCheck c = inv.getArgument(0);
            if (c.getId() == null) c.setId(UUID.randomUUID());
            saved.add(c);
            return c;
        });
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("staff@demo.com", null, List.of()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private SubmissionSelfCheckService.Draft draft(String note) {
        return new SubmissionSelfCheckService.Draft(kpi.getId(), null, 99.7, null, note);
    }

    private static List<MultipartFile> file(String name, String content) {
        return List.of(new MockMultipartFile("files", name, "text/plain", content.getBytes()));
    }

    @Test
    @DisplayName("xếp hàng: kiểm tần suất + hạn mức của chính nhân viên, ghi QUEUED, sự kiện mang bài + byte tệp")
    void queuesAgainstOwnQuota() {
        AiSelfCheckResponse r = service.start(draft("Uptime tháng 10 đạt 99,7%"), file("bao-cao.txt", "log uptime"));

        assertThat(r.getStatus()).isEqualTo(AiReviewStatus.QUEUED);
        assertThat(r.isReused()).isFalse();
        verify(rateLimiter).check("staff@demo.com");
        verify(quota).checkAndThrow("staff@demo.com");
        assertThat(saved).singleElement().satisfies(c -> {
            assertThat(c.getUserId()).isEqualTo(me.getId());
            assertThat(c.getInputHash()).hasSize(64);
        });
        ArgumentCaptor<AiSelfCheckEvents.Requested> ev = ArgumentCaptor.forClass(AiSelfCheckEvents.Requested.class);
        verify(events).publishEvent(ev.capture());
        assertThat(ev.getValue().note()).isEqualTo("Uptime tháng 10 đạt 99,7%");
        assertThat(ev.getValue().files()).singleElement().satisfies(f -> {
            assertThat(f.name()).isEqualTo("bao-cao.txt");
            assertThat(new String(f.bytes())).isEqualTo("log uptime");
        });
    }

    @Test
    @DisplayName("hết token -> dừng trước khi ghi gì; bài y hệt lần trước -> trả kết quả cũ, không đụng tới hạn mức")
    void quotaGateAndReuse() {
        doThrow(new AiTokenQuotaExceededException("hết")).when(quota).checkAndThrow(anyString());
        assertThatThrownBy(() -> service.start(draft("Bài A"), List.of()))
                .isInstanceOf(AiTokenQuotaExceededException.class);
        assertThat(saved).isEmpty();
        verify(events, never()).publishEvent(any());

        AiSelfCheck done = AiSelfCheck.builder().id(UUID.randomUUID()).userId(me.getId()).kpiCriteriaId(kpi.getId())
                .status(AiReviewStatus.DONE).summary("Bài nêu uptime").build();
        when(repository.findFirstByUserIdAndKpiCriteriaIdAndInputHashOrderByCreatedAtDesc(any(), any(), anyString()))
                .thenReturn(Optional.of(done));
        AiSelfCheckResponse r = service.start(draft("Bài A"), List.of());
        assertThat(r.isReused()).isTrue();
        assertThat(r.getSummary()).isEqualTo("Bài nêu uptime");
        assertThat(saved).isEmpty();
    }

    @Test
    @DisplayName("băm: đổi chữ hoặc nội dung tệp là bài mới; y hệt thì cùng băm")
    void hashTracksContent() {
        var d = draft("Bài A");
        var f1 = List.of(com.kpitracking.ai.document.model.FileRef.of("a.txt", "một".getBytes()));
        var f2 = List.of(com.kpitracking.ai.document.model.FileRef.of("a.txt", "hai".getBytes()));
        String h = SubmissionSelfCheckService.hash(d, "Bài A", null, f1, List.of(), null);
        assertThat(SubmissionSelfCheckService.hash(d, "Bài A", null, f1, List.of(), null)).isEqualTo(h);
        assertThat(SubmissionSelfCheckService.hash(d, "Bài B", null, f1, List.of(), null)).isNotEqualTo(h);
        assertThat(SubmissionSelfCheckService.hash(d, "Bài A", null, f2, List.of(), null)).isNotEqualTo(h);
    }

    @Test
    @DisplayName("chỉ người được giao chỉ tiêu; tổ chức / đơn vị tắt thì chặn trước khi tốn token")
    void guards() {
        kpi.setAssignees(new ArrayList<>());
        assertThatThrownBy(() -> service.start(draft("x"), List.of()))
                .isInstanceOfSatisfying(ForbiddenException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_ASSIGNED_KPI));
        kpi.setAssignees(new ArrayList<>(List.of(me)));

        when(resolver.resolve(any(), any())).thenReturn(
                new AiReviewSettingsResolver.Effective(false, ReviewFixtures.W, null, "đơn vị"));
        assertThatThrownBy(() -> service.start(draft("x"), List.of()))
                .isInstanceOfSatisfying(ForbiddenException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.AI_REVIEW_UNIT_DISABLED));

        org.setEnableAiReview(false);
        assertThatThrownBy(() -> service.start(draft("x"), List.of()))
                .isInstanceOfSatisfying(ForbiddenException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.AI_REVIEW_NOT_ENABLED));
        verify(quota, never()).checkAndThrow(anyString());
    }

    @Test
    @DisplayName("bài trống (không chữ, không số, không tệp) -> báo cần nội dung, không tốn token")
    void nothingToRead() {
        var empty = new SubmissionSelfCheckService.Draft(kpi.getId(), null, null, null, "   ");
        assertThatThrownBy(() -> service.start(empty, List.of()))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.AI_SELF_CHECK_NOTHING_TO_READ));
        verify(quota, never()).checkAndThrow(anyString());
    }

    @Test
    @DisplayName("kết quả là của riêng người nộp: người khác (kể cả quản lý) đọc thì như không tồn tại")
    void onlyOwnerReads() {
        AiSelfCheck someoneElses = AiSelfCheck.builder().id(UUID.randomUUID()).userId(UUID.randomUUID())
                .kpiCriteriaId(kpi.getId()).status(AiReviewStatus.DONE).build();
        when(repository.findById(someoneElses.getId())).thenReturn(Optional.of(someoneElses));
        assertThatThrownBy(() -> service.get(someoneElses.getId())).isInstanceOf(ResourceNotFoundException.class);

        AiSelfCheck mine = AiSelfCheck.builder().id(UUID.randomUUID()).userId(me.getId())
                .kpiCriteriaId(kpi.getId()).status(AiReviewStatus.DONE).gaps("Thiếu log\nThiếu biên bản")
                .criteriaSetVersion(3).build();
        when(repository.findById(mine.getId())).thenReturn(Optional.of(mine));
        AiSelfCheckResponse r = service.get(mine.getId());
        assertThat(r.getGaps()).containsExactly("Thiếu log", "Thiếu biên bản");
        assertThat(r.getCriteriaSetVersion()).isEqualTo(3);
    }

    @Test
    @DisplayName("dùng được không: lý do theo đúng thứ tự chốt; còn token thì báo số còn lại")
    void availability() {
        when(quota.getStatus(me.getId())).thenReturn(new AiQuotaService.QuotaStatus(0, 0, 0, 0));
        assertThat(service.availability()).isEqualTo(new AiSelfCheckAvailabilityResponse(false, "NO_QUOTA", 0));

        when(quota.getStatus(me.getId())).thenReturn(new AiQuotaService.QuotaStatus(50_000, 0, 50_000, 50_000));
        assertThat(service.availability().reason()).isEqualTo("QUOTA_USED");

        when(quota.getStatus(me.getId())).thenReturn(new AiQuotaService.QuotaStatus(50_000, 0, 50_000, 12_000));
        assertThat(service.availability()).isEqualTo(new AiSelfCheckAvailabilityResponse(true, null, 38_000));

        org.setEnableAiReview(false);
        assertThat(service.availability().reason()).isEqualTo("REVIEW_OFF");
    }
}
