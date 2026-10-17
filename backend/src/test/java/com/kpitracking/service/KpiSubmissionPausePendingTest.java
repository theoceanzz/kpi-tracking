package com.kpitracking.service;

import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.submission.SubmissionResponse;
import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.entity.User;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.mapper.SubmissionMapper;
import com.kpitracking.repository.KpiAdjustmentRequestRepository;
import com.kpitracking.repository.KpiSubmissionRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.kpi.CycleStatusGuard;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Dòng bài nộp mang cờ "chỉ tiêu đang xin tạm dừng" — phiếu chấm dùng nó để AI không chấm chỉ tiêu đó. Trong lúc chờ
 * duyệt, KPI ở {@code EDIT} giống hệt yêu cầu đổi chỉ tiêu, nên cờ phải hỏi bảng yêu cầu (một truy vấn cho cả trang).
 */
class KpiSubmissionPausePendingTest {

    private final KpiSubmissionRepository submissions = mock(KpiSubmissionRepository.class);
    private final KpiAdjustmentRequestRepository adjustments = mock(KpiAdjustmentRequestRepository.class);
    private final SubmissionMapper mapper = mock(SubmissionMapper.class);
    private final UserRepository users = mock(UserRepository.class);
    private final KpiSubmissionService service = new KpiSubmissionService(submissions, null, null, users, null, mapper,
            null, mock(PermissionChecker.class), null, null, null, mock(CycleStatusGuard.class), null, null, mock(com.kpitracking.service.kpi.approval.KpiApprovalChainService.class), mock(com.kpitracking.service.kpi.approval.KpiApprovalViewService.class),  adjustments);

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private PageResponse<SubmissionResponse> myPage(SubmissionResponse... rows) {
        User me = new User();
        me.setId(UUID.randomUUID());
        me.setEmail("nv@demo.com");
        when(users.findByEmail("nv@demo.com")).thenReturn(Optional.of(me));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("nv@demo.com", null, List.of()));
        List<KpiSubmission> subs = new java.util.ArrayList<>();
        java.util.Iterator<SubmissionResponse> it = List.of(rows).iterator();
        for (SubmissionResponse ignored : rows) subs.add(new KpiSubmission());
        when(mapper.toResponse(any())).thenAnswer(inv -> it.next());
        when(submissions.findAllWithFilters(any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(subs));
        return service.getMySubmissions(0, 20, null, null, "createdAt", "desc");
    }

    private static SubmissionResponse row(KpiStatus kpiStatus) {
        SubmissionResponse r = new SubmissionResponse();
        r.setId(UUID.randomUUID());
        r.setKpiCriteriaId(UUID.randomUUID());
        r.setKpiCriteriaStatus(kpiStatus);
        return r;
    }

    @Test
    @DisplayName("KPI EDIT có yêu cầu xin tạm dừng chờ duyệt -> cờ bật; KPI EDIT đổi chỉ tiêu thì không")
    void flagsOnlyPendingPauseRequests() {
        SubmissionResponse pausing = row(KpiStatus.EDIT);
        SubmissionResponse retargeting = row(KpiStatus.EDIT);
        SubmissionResponse normal = row(KpiStatus.APPROVED);
        when(adjustments.findPendingDeactivationCriteriaIds(anyCollection())).thenReturn(List.of(pausing.getKpiCriteriaId()));

        List<SubmissionResponse> out = myPage(pausing, retargeting, normal).getContent();

        assertThat(out).extracting(SubmissionResponse::isKpiPausePending).containsExactly(true, false, false);
    }

    @Test
    @DisplayName("không có KPI nào đang EDIT -> không hỏi bảng yêu cầu")
    void skipsQueryWhenNothingIsEditing() {
        myPage(row(KpiStatus.APPROVED), row(KpiStatus.INACTIVE));

        verify(adjustments, never()).findPendingDeactivationCriteriaIds(anyCollection());
    }
}
