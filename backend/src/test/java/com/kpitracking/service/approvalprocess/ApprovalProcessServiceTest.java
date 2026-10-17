package com.kpitracking.service.approvalprocess;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.dto.request.approvalprocess.ApprovalProcessRequest;
import com.kpitracking.entity.approvalprocess.ApprovalProcess;
import com.kpitracking.entity.user.User;
import com.kpitracking.enums.approvalprocess.ApprovalObjectType;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.StaleStateException;
import com.kpitracking.repository.approvalprocess.ApprovalProcessRepository;
import com.kpitracking.repository.organization.OrgUnitRepository;
import com.kpitracking.repository.access.RoleRepository;
import com.kpitracking.repository.user.UserRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.kpi.approval.KpiApprovalChainService;
import com.kpitracking.workflow.KpiWorkflowConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.util.*;

import static com.kpitracking.service.approvalprocess.Graphs.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ApprovalProcessServiceTest {

    @Mock ApprovalProcessRepository repository;
    @Mock KpiWorkflowConfigService workflowConfigService;
    @Mock KpiApprovalChainService chainService;
    @Mock PermissionChecker permissionChecker;
    @Mock UserRepository userRepository;
    @Mock RoleRepository roleRepository;
    @Mock OrgUnitRepository orgUnitRepository;

    private final ProcessGraphCodec codec = new ProcessGraphCodec(new ObjectMapper());
    private ApprovalProcessService service;

    private final UUID orgId = UUID.randomUUID();
    private final User admin = User.builder().id(UUID.randomUUID()).fullName("Quản trị").email("a@x").build();
    private final List<ApprovalProcess> active = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new ApprovalProcessService(repository, codec, workflowConfigService, chainService, permissionChecker,
                userRepository, roleRepository, orgUnitRepository,
                org.mockito.Mockito.mock(com.kpitracking.repository.approvalform.ApprovalFormRepository.class),
                org.mockito.Mockito.mock(com.kpitracking.repository.approvalform.ApprovalFormGroupRepository.class));
        when(workflowConfigService.currentOrganizationId()).thenReturn(orgId);
        when(workflowConfigService.currentUser()).thenReturn(admin);
        when(permissionChecker.hasPermission(any(), eq("WORKFLOW:MANAGE"))).thenReturn(true);
        when(repository.findByOrganizationIdAndObjectTypeAndActiveTrue(eq(orgId), any())).thenAnswer(inv -> active);
        when(repository.save(any(ApprovalProcess.class))).thenAnswer(inv -> {
            ApprovalProcess p = inv.getArgument(0);
            if (p.getId() == null) p.setId(UUID.randomUUID());
            return p;
        });
        when(userRepository.findAllById(any())).thenReturn(List.of());
    }

    private ApprovalProcessRequest request(List<String> subs) {
        return ApprovalProcessRequest.builder()
                .title("Duyệt KPI")
                .objectType(ApprovalObjectType.KPI_CRITERIA)
                .subObjectTypes(subs)
                .definition(graph().step("a", 0, manager(0)).next("start", "a").build())
                .build();
    }

    private ApprovalProcess existing(String title, List<String> subs) {
        ApprovalProcess p = ApprovalProcess.builder().id(UUID.randomUUID()).organizationId(orgId).title(title)
                .objectType(ApprovalObjectType.KPI_CRITERIA).subObjectTypes(new ArrayList<>(subs)).active(true)
                .definition(codec.write(request(subs).getDefinition())).createdAt(Instant.now()).build();
        active.add(p);
        return p;
    }

    @Test
    @DisplayName("Tạo quy trình hợp lệ: lưu sơ đồ, người tạo, mặc định đang áp dụng")
    void createsProcess() {
        var res = service.create(request(List.of("QUALITATIVE")));
        assertThat(res.isActive()).isTrue();
        assertThat(res.getStepCount()).isEqualTo(1);
        assertThat(res.getSubObjectTypes()).containsExactly("QUALITATIVE");
    }

    @Test
    @DisplayName("Hai quy trình 'Tất cả' cùng đối tượng, hoặc chung một đối tượng con, bị chặn")
    void overlapBlocked() {
        existing("Quy trình chung", List.of());
        assertThatThrownBy(() -> service.create(request(List.of())))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode()).isEqualTo(ErrorCode.APPROVAL_PROCESS_OVERLAP);
        // Quy trình riêng cho một đối tượng con vẫn được, vì nó được ưu tiên hơn "Tất cả".
        assertThat(service.create(request(List.of("QUALITATIVE"))).getTitle()).isEqualTo("Duyệt KPI");

        existing("Định tính", List.of("QUALITATIVE"));
        assertThatThrownBy(() -> service.create(request(List.of("QUALITATIVE", "QUANTITATIVE"))))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode()).isEqualTo(ErrorCode.APPROVAL_PROCESS_OVERLAP);
    }

    @Test
    @DisplayName("Quy trình đang tắt không tính trùng; bật lại thì kiểm trùng")
    void inactiveDoesNotOverlap() {
        existing("Đang dùng", List.of());
        var req = request(List.of());
        req.setActive(false);
        var saved = service.create(req);
        assertThat(saved.isActive()).isFalse();

        ApprovalProcess off = ApprovalProcess.builder().id(saved.getId()).organizationId(orgId).title("Tắt")
                .objectType(ApprovalObjectType.KPI_CRITERIA).active(false)
                .definition(codec.write(req.getDefinition())).build();
        when(repository.findByIdAndOrganizationId(saved.getId(), orgId)).thenReturn(Optional.of(off));
        assertThatThrownBy(() -> service.setActive(saved.getId(), true))
                .extracting(e -> ((BusinessException) e).getErrorCode()).isEqualTo(ErrorCode.APPROVAL_PROCESS_OVERLAP);
    }

    @Test
    @DisplayName("Đối tượng con sai đối tượng, sơ đồ lỗi, người duyệt ngoài tổ chức — đều bị chặn")
    void invalidInputs() {
        assertThatThrownBy(() -> service.create(request(List.of("DEACTIVATE"))))
                .extracting(e -> ((BusinessException) e).getErrorCode()).isEqualTo(ErrorCode.APPROVAL_PROCESS_BAD_SUB_OBJECT);

        var broken = request(List.of());
        broken.setDefinition(graph().build());
        assertThatThrownBy(() -> service.create(broken))
                .extracting(e -> ((BusinessException) e).getErrorCode()).isEqualTo(ErrorCode.APPROVAL_PROCESS_INVALID);

        UUID outsider = UUID.randomUUID();
        var foreign = request(List.of());
        foreign.setDefinition(graph().step("a", 0, user(outsider)).next("start", "a").build());
        when(permissionChecker.isMemberOfOrganization(outsider, orgId)).thenReturn(false);
        assertThatThrownBy(() -> service.create(foreign))
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.APPROVAL_PROCESS_REFERENCE_OUTSIDE_ORGANIZATION);
    }

    @Test
    @DisplayName("Sửa từ bản cũ (version lệch) ⇒ 409")
    void staleVersion() {
        ApprovalProcess p = existing("Đang sửa", List.of());
        p.setVersion(3);
        when(repository.findByIdAndOrganizationId(p.getId(), orgId)).thenReturn(Optional.of(p));
        var req = request(List.of());
        req.setVersion(2L);
        assertThatThrownBy(() -> service.update(p.getId(), req)).isInstanceOf(StaleStateException.class);
    }
}
