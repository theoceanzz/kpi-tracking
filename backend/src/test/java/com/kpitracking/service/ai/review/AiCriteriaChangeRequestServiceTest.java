package com.kpitracking.service.ai.review;

import com.kpitracking.dto.request.ai.AiCriteriaSetMetaRequest;
import com.kpitracking.entity.AiCriteriaChangeRequest;
import com.kpitracking.entity.AiCriteriaSet;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.User;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.repository.AiCriteriaChangeRequestRepository;
import com.kpitracking.repository.AiCriteriaSetRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.notification.NotificationDispatcher;
import com.kpitracking.service.notification.NotificationRoutingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Cấp dưới gửi đề nghị đổi quy chế cấp trên đã áp → người đã áp nhận thông báo → đồng ý thì đơn vị chuyển hẳn
 * sang tài liệu của người đề nghị (họ thành người áp), từ chối thì báo lại kèm lý do.
 */
class AiCriteriaChangeRequestServiceTest {

    private final Organization org = new Organization();
    private final User head = user("Trưởng phòng IT");
    private final User director = user("Nguyễn Văn Director");
    private final OrgUnit unitIt = new OrgUnit();

    private AiCriteriaSetService sets;
    private AiCriteriaSetRepository setRepository;
    private AiCriteriaChangeRequestRepository requests;
    private AiCriteriaAuthority authority;
    private PermissionChecker permissions;
    private NotificationDispatcher dispatcher;
    private AiCriteriaChangeRequestService service;

    private AiCriteriaSet superiors;
    private AiCriteriaSet draft;

    @BeforeEach
    void setUp() {
        org.setId(UUID.randomUUID());
        unitIt.setId(UUID.randomUUID());
        unitIt.setName("Phòng IT");
        sets = mock(AiCriteriaSetService.class);
        setRepository = mock(AiCriteriaSetRepository.class);
        requests = mock(AiCriteriaChangeRequestRepository.class);
        authority = mock(AiCriteriaAuthority.class);
        permissions = mock(PermissionChecker.class);
        dispatcher = mock(NotificationDispatcher.class);
        OrgUnitRepository units = mock(OrgUnitRepository.class);
        UserRepository users = mock(UserRepository.class);
        service = new AiCriteriaChangeRequestService(sets, setRepository, requests, authority, units, users,
                permissions, mock(NotificationRoutingService.class), dispatcher);

        superiors = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId()).orgUnitId(unitIt.getId())
                .title("Quy chế vận hành").status(AiCriteriaSet.CONFIRMED).confirmedBy(director.getId()).build();
        draft = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId())
                .title("Quy chế phòng IT").status(AiCriteriaSet.DRAFT).createdBy(head.getId()).build();

        when(sets.organizationOf(any())).thenReturn(org);
        when(sets.unitLabel(org.getId(), unitIt.getId())).thenReturn("Phòng IT");
        when(sets.activeAt(org.getId(), unitIt.getId(), draft.getId())).thenReturn(superiors);
        when(sets.manageableSet(draft.getId())).thenReturn(draft);
        when(units.findById(unitIt.getId())).thenReturn(Optional.of(unitIt));
        when(users.findById(director.getId())).thenReturn(Optional.of(director));
        when(users.findById(head.getId())).thenReturn(Optional.of(head));
        when(setRepository.findById(draft.getId())).thenReturn(Optional.of(draft));
        when(setRepository.findById(superiors.getId())).thenReturn(Optional.of(superiors));
        when(authority.canManageUnit(any(), any(), any())).thenReturn(true);
        when(authority.lockedFor(head.getId(), superiors)).thenReturn(true);
        when(permissions.isMemberOfOrganization(director.getId(), org.getId())).thenReturn(true);
        when(permissions.isSuperiorTo(director.getId(), head.getId(), unitIt.getId())).thenReturn(true);
        when(permissions.getBestRoleNameInOrgUnit(head.getId(), unitIt.getId())).thenReturn("Trưởng phòng");
        when(requests.save(any())).thenAnswer(inv -> {
            AiCriteriaChangeRequest r = inv.getArgument(0);
            if (r.getId() == null) r.setId(UUID.randomUUID());
            return r;
        });
    }

    /** Thông báo lưu dạng khoá dịch — so theo chữ tiếng Việt hiển thị ra (kiểm luôn khoá trong notifications.properties). */
    private static LocalizedText rendered(String fragment) {
        return argThat(t -> t != null && t.render(Locale.forLanguageTag("vi")).contains(fragment));
    }

    private static User user(String name) {
        User u = new User();
        u.setId(UUID.randomUUID());
        u.setFullName(name);
        return u;
    }

    private AiCriteriaChangeRequest sent() {
        when(sets.currentUser()).thenReturn(head);
        service.create(draft.getId(), AiCriteriaSetMetaRequest.builder().orgUnitId(unitIt.getId()).note("Theo quy trình mới").build());
        ArgumentCaptor<AiCriteriaChangeRequest> saved = ArgumentCaptor.forClass(AiCriteriaChangeRequest.class);
        verify(requests).save(saved.capture());
        AiCriteriaChangeRequest r = saved.getValue();
        when(requests.findByIdAndOrganizationId(r.getId(), org.getId())).thenReturn(Optional.of(r));
        return r;
    }

    @Test
    @DisplayName("gửi đề nghị: đơn vị bị khoá → lưu đề nghị, người duyệt là người đã áp, người đó nhận thông báo")
    void requestNotifiesApplier() {
        AiCriteriaChangeRequest r = sent();

        assertThat(r.getStatus()).isEqualTo(AiCriteriaChangeRequest.PENDING);
        assertThat(r.getApproverId()).isEqualTo(director.getId());
        assertThat(r.getCurrentSetId()).isEqualTo(superiors.getId());
        assertThat(draft.getOrgUnitId()).isEqualTo(unitIt.getId());
        verify(dispatcher).dispatch(eq(org.getId()), eq(AiCriteriaChangeRequestService.EVENT_REQUESTED), eq(director),
                eq(unitIt), any(LocalizedText.class),
                rendered("Trưởng phòng IT (Trưởng phòng) đề nghị áp «Quy chế phòng IT» cho Phòng IT thay «Quy chế vận hành»"),
                eq("AI_CRITERIA"), eq(r.getId()));
    }

    @Test
    @DisplayName("đơn vị không bị khoá → không cần đề nghị; đã có đề nghị đang chờ → chặn")
    void requestOnlyWhenLockedAndOncePending() {
        when(sets.currentUser()).thenReturn(head);
        when(authority.lockedFor(head.getId(), superiors)).thenReturn(false);
        AiCriteriaSetMetaRequest req = AiCriteriaSetMetaRequest.builder().orgUnitId(unitIt.getId()).build();
        assertThatThrownBy(() -> service.create(draft.getId(), req))
                .isInstanceOf(BusinessException.class).hasMessageContaining("không bị khoá");

        when(authority.lockedFor(head.getId(), superiors)).thenReturn(true);
        when(requests.findByProposedSetIdAndStatus(draft.getId(), AiCriteriaChangeRequest.PENDING))
                .thenReturn(Optional.of(new AiCriteriaChangeRequest()));
        assertThatThrownBy(() -> service.create(draft.getId(), req))
                .isInstanceOf(BusinessException.class).hasMessageContaining("đang chờ");
    }

    @Test
    @DisplayName("đồng ý: áp tài liệu đề nghị cho đơn vị, người đề nghị thành người áp, báo lại người đề nghị")
    void approveAppliesProposalAndTransfersOwnership() {
        AiCriteriaChangeRequest r = sent();
        when(sets.currentUser()).thenReturn(director);
        when(sets.activeAt(org.getId(), unitIt.getId(), draft.getId())).thenReturn(superiors);

        service.approve(r.getId(), null);

        assertThat(r.getStatus()).isEqualTo(AiCriteriaChangeRequest.APPROVED);
        assertThat(r.getDecidedBy()).isEqualTo(director.getId());
        verify(sets).applyTo(draft, unitIt.getId(), director, true, head.getId());
        verify(dispatcher).dispatch(eq(org.getId()), eq(AiCriteriaChangeRequestService.EVENT_DECIDED), eq(head),
                eq(unitIt), rendered("đồng ý"), any(LocalizedText.class), eq("AI_CRITERIA"), eq(r.getId()));
    }

    @Test
    @DisplayName("từ chối: giữ tài liệu cũ, báo lại kèm lý do; người gửi / người không cao hơn không quyết được")
    void rejectAndDeciderRules() {
        AiCriteriaChangeRequest r = sent();

        when(sets.currentUser()).thenReturn(head);                      // tự quyết đề nghị của mình
        assertThatThrownBy(() -> service.approve(r.getId(), null)).isInstanceOf(ForbiddenException.class);

        when(sets.currentUser()).thenReturn(director);
        service.reject(r.getId(), "Giữ quy chế chung toàn chi nhánh");

        assertThat(r.getStatus()).isEqualTo(AiCriteriaChangeRequest.REJECTED);
        verify(sets, never()).applyTo(any(), any(), any(), anyBoolean(), any());
        verify(dispatcher).dispatch(eq(org.getId()), eq(AiCriteriaChangeRequestService.EVENT_DECIDED), eq(head),
                eq(unitIt), rendered("từ chối"), rendered("— lý do: Giữ quy chế chung toàn chi nhánh"), eq("AI_CRITERIA"), eq(r.getId()));
    }

    @Test
    @DisplayName("rút đề nghị: chỉ người gửi")
    void onlyRequesterCancels() {
        AiCriteriaChangeRequest r = sent();

        when(sets.currentUser()).thenReturn(director);
        assertThatThrownBy(() -> service.cancel(r.getId())).isInstanceOf(ForbiddenException.class);

        when(sets.currentUser()).thenReturn(head);
        service.cancel(r.getId());
        assertThat(r.getStatus()).isEqualTo(AiCriteriaChangeRequest.CANCELLED);
    }

    @Test
    @DisplayName("danh sách chờ duyệt: người đã áp thấy, người gửi không")
    void pendingListForDecidersOnly() {
        AiCriteriaChangeRequest r = sent();
        when(requests.findByOrganizationIdAndStatusOrderByCreatedAtDesc(org.getId(), AiCriteriaChangeRequest.PENDING))
                .thenReturn(List.of(r));

        when(sets.currentUser()).thenReturn(director);
        assertThat(service.pendingForMe()).singleElement().satisfies(x -> {
            assertThat(x.getProposedSetTitle()).isEqualTo("Quy chế phòng IT");
            assertThat(x.getCurrentSetTitle()).isEqualTo("Quy chế vận hành");
            assertThat(x.getRequestedByRole()).isEqualTo("Trưởng phòng");
        });

        when(sets.currentUser()).thenReturn(head);
        assertThat(service.pendingForMe()).isEmpty();
    }
}
