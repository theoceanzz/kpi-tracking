package com.kpitracking.service;

import com.kpitracking.dto.request.delegation.DelegationRequest;
import com.kpitracking.dto.response.delegation.DelegationResponse;
import com.kpitracking.entity.OrgHierarchyLevel;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.OrgUnitDelegation;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.OrgUnitDelegationRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.PermissionChecker;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Uỷ quyền quản lý CHÉO đơn vị.
 *
 * <p>Bài toán: quyền chỉ chảy xuống theo cây, nên trưởng đơn vị A không với sang được đơn
 * vị B cùng cấp. Cách cũ là gán thêm cho họ một vai trò TẠI B — bế tắc khi B đã có trưởng
 * (mỗi đơn vị chỉ được một trưởng, một phó), mà lách bằng vai trò rank 2 thì lại mất quyền
 * chấm hạnh kiểm.
 *
 * <p>Ở đây tách hẳn PHẠM VI khỏi VAI TRÒ: người được uỷ quyền giữ nguyên bộ quyền của vai
 * trò họ đang có, chỉ được nới chỗ dùng sang đơn vị đích. Không phát quyền mới — ai không
 * có {@code CYCLE_EVAL:FINALIZE} ở đâu cả thì được uỷ quyền cũng vẫn không chốt được kỳ.
 */
@Service
@RequiredArgsConstructor
public class OrgUnitDelegationService {

    private final OrgUnitDelegationRepository delegationRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final PermissionChecker permissionChecker;

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
    }

    @Transactional(readOnly = true)
    public List<DelegationResponse> list(UUID organizationId) {
        Instant now = Instant.now();
        return delegationRepository.findByOrganization(organizationId).stream()
                .map(d -> toResponse(d, now))
                .toList();
    }

    /**
     * Giao MỘT người quản lý thêm một hoặc nhiều đơn vị.
     *
     * <p>Cả lô nằm trong một giao dịch: một đơn vị vướng lỗi thì không đơn vị nào được tạo.
     * Gửi lần lượt từng đơn vị sẽ để lại một nửa số uỷ quyền khi cái thứ ba hỏng, và người
     * trao không có cách nào biết nó dừng ở đâu.
     */
    @Transactional
    public List<DelegationResponse> create(UUID organizationId, DelegationRequest request) {
        User actor = currentUser();

        User delegate = userRepository.findById(request.getDelegateUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "id", request.getDelegateUserId()));

        List<UserRoleOrgUnit> delegateRoles = userRoleOrgUnitRepository.findByUserId(delegate.getId());
        if (delegateRoles.isEmpty()) {
            throw new BusinessException("Người được uỷ quyền chưa có vai trò nào trong tổ chức — "
                    + "uỷ quyền chỉ nới phạm vi của quyền sẵn có, không cấp quyền mới.");
        }

        // Những đơn vị người này THỰC SỰ đứng đầu (trưởng/phó). Uỷ quyền là giao việc quản
        // lý, nên người chưa quản lý gì thì không có gì để nới phạm vi.
        List<UserRoleOrgUnit> managerRoles = delegateRoles.stream()
                .filter(r -> r.getRole() != null && r.getRole().getRank() != null && r.getRole().getRank() <= 1)
                .filter(r -> r.getOrgUnit() != null)
                .toList();
        if (managerRoles.isEmpty()) {
            throw new BusinessException("Chỉ uỷ quyền được cho người đang là trưởng hoặc phó của một đơn vị. "
                    + "Người này hiện chỉ có vai trò nhân viên.");
        }

        // Cấp CAO NHẤT mà người này đang đứng đầu — dùng làm trần cho đơn vị được giao.
        //
        // CỐ Ý chỉ tính vai trò quản lý, không tính mọi membership: UserService
        // .assignToUnitAndImmediateParent tự sinh thêm cho mỗi người một membership NHÂN
        // VIÊN ở đơn vị CHA. Lấy cả nó vào thì một tổ trưởng cũng "thuộc" công ty và được
        // uỷ quyền quản lý cả tập đoàn.
        Integer delegateLevel = managerRoles.stream()
                .map(r -> r.getOrgUnit().getOrgHierarchyLevel())
                .filter(Objects::nonNull)
                .map(OrgHierarchyLevel::getLevelOrder)
                .filter(Objects::nonNull)
                .min(Integer::compare)
                .orElse(null);

        // Kiểm mốc thời gian một lần cho cả lô: chúng dùng chung cho mọi đơn vị được chọn.
        if (request.getStartsAt() != null && request.getExpiresAt() != null
                && !request.getExpiresAt().isAfter(request.getStartsAt())) {
            throw new BusinessException("Ngày hết hiệu lực phải sau ngày bắt đầu");
        }
        if (request.getExpiresAt() != null && request.getExpiresAt().isBefore(Instant.now())) {
            throw new BusinessException("Ngày hết hiệu lực đã ở quá khứ");
        }

        OrgUnit from = request.getFromOrgUnitId() != null
                ? orgUnitRepository.findById(request.getFromOrgUnitId()).orElse(null)
                : primaryUnit(delegateRoles);

        List<DelegationResponse> created = new ArrayList<>();
        Instant now = Instant.now();

        // Bỏ trùng trước khi chạy: cùng một đơn vị gửi lên hai lần sẽ đâm vào unique index
        // và làm hỏng cả lô vì một lỗi hoàn toàn vô hại.
        for (UUID orgUnitId : new LinkedHashSet<>(request.getOrgUnitIds())) {
            OrgUnit target = orgUnitRepository.findById(orgUnitId)
                    .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", orgUnitId));

            // Đơn vị đích phải thuộc đúng tổ chức trên đường dẫn: id đơn vị đến từ thân yêu
            // cầu nên nếu không đối chiếu, đây là một đường trao quyền xuyên tổ chức.
            Organization org = target.getOrgHierarchyLevel().getOrganization();
            if (!org.getId().equals(organizationId)) {
                throw new BusinessException("Đơn vị \"" + target.getName() + "\" không thuộc tổ chức này");
            }

            // Người trao phải thật sự quản được đơn vị đích, nếu không thì đây là đường vòng
            // để tự trao cho mình quyền ở một phòng chẳng liên quan.
            if (!permissionChecker.isGlobalAdminOfOrganization(actor.getId(), organizationId)
                    && !permissionChecker.hasPermissionInOrgUnit(actor.getId(), "ROLE:ASSIGN", target.getId())) {
                throw new ForbiddenException("Bạn không có quyền uỷ quyền quản lý đơn vị \""
                        + target.getName() + "\"");
            }

            // Uỷ quyền vào chính cây của mình là vô nghĩa: quyền đã tới đó sẵn theo thừa kế.
            boolean alreadyInScope = delegateRoles.stream()
                    .anyMatch(r -> r.getOrgUnit() != null && target.getPath().startsWith(r.getOrgUnit().getPath()));
            if (alreadyInScope) {
                throw new BusinessException("Người này vốn đã quản lý được đơn vị \"" + target.getName()
                        + "\" theo cây tổ chức — không cần uỷ quyền.");
            }

            // ── TRẦN CẤP BẬC ──
            // Chỉ giao được đơn vị NGANG CẤP hoặc THẤP HƠN đơn vị mà người đó đang đứng đầu.
            //
            // Không có luật này thì uỷ quyền thành đường thăng chức tắt: một tổ trưởng được
            // "uỷ quyền" cả phòng là có ngay quyền chốt kỳ, chấm hạnh kiểm và xem lương của
            // những người vốn ở trên mình — mà không qua một lần đổi vai trò nào.
            OrgHierarchyLevel targetLevel = target.getOrgHierarchyLevel();
            if (delegateLevel != null && targetLevel != null && targetLevel.getLevelOrder() != null
                    && targetLevel.getLevelOrder() < delegateLevel) {
                String delegateLevelName = managerRoles.stream()
                        .map(r -> r.getOrgUnit().getOrgHierarchyLevel())
                        .filter(Objects::nonNull)
                        .filter(l -> delegateLevel.equals(l.getLevelOrder()))
                        .map(OrgHierarchyLevel::getUnitTypeName)
                        .findFirst()
                        .orElse("đơn vị hiện tại");
                throw new BusinessException(String.format(
                        "Không uỷ quyền được: \"%s\" là cấp %s, cao hơn cấp %s mà %s đang phụ trách. "
                                + "Chỉ giao được đơn vị ngang cấp hoặc thấp hơn.",
                        target.getName(), targetLevel.getUnitTypeName(), delegateLevelName,
                        delegate.getFullName()));
            }

            delegationRepository.findByDelegateUserIdAndOrgUnitId(delegate.getId(), target.getId())
                    .ifPresent(existing -> {
                        throw new BusinessException("Người này đã được uỷ quyền quản lý đơn vị \""
                                + target.getName() + "\". Hãy thu hồi bản cũ trước khi tạo bản mới.");
                    });

            OrgUnitDelegation saved = delegationRepository.save(OrgUnitDelegation.builder()
                    .organization(org)
                    .delegateUser(delegate)
                    .orgUnit(target)
                    .fromOrgUnit(from)
                    .includeSubtree(request.getIncludeSubtree() == null || request.getIncludeSubtree())
                    .canActAsLeader(request.getCanActAsLeader() == null || request.getCanActAsLeader())
                    .reason(request.getReason())
                    .startsAt(request.getStartsAt())
                    .expiresAt(request.getExpiresAt())
                    .createdBy(actor)
                    .build());

            created.add(toResponse(saved, now));
        }

        return created;
    }

    @Transactional
    public void revoke(UUID id) {
        OrgUnitDelegation delegation = delegationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Uỷ quyền", "id", id));

        User actor = currentUser();
        if (!permissionChecker.isGlobalAdminIn(actor.getId(), delegation.getOrgUnit().getId())
                && !permissionChecker.hasPermissionInOrgUnit(actor.getId(), "ROLE:ASSIGN",
                        delegation.getOrgUnit().getId())) {
            throw new ForbiddenException("Bạn không có quyền thu hồi uỷ quyền của đơn vị này");
        }

        // Xoá mềm: uỷ quyền là dấu vết cần đối chiếu khi ai đó hỏi "sao người ngoài phòng
        // lại chốt được đánh giá của tôi".
        delegation.setDeletedAt(Instant.now());
        delegationRepository.save(delegation);
    }

    /** Đơn vị chính của một người: vai trò cấp cao nhất (level rồi rank nhỏ nhất). */
    private OrgUnit primaryUnit(List<UserRoleOrgUnit> roles) {
        return roles.stream()
                .min(Comparator
                        .comparingInt((UserRoleOrgUnit r) -> r.getRole().getLevel() != null ? r.getRole().getLevel() : 4)
                        .thenComparingInt(r -> r.getRole().getRank() != null ? r.getRole().getRank() : 2))
                .map(UserRoleOrgUnit::getOrgUnit)
                .orElse(null);
    }

    private DelegationResponse toResponse(OrgUnitDelegation d, Instant now) {
        User u = d.getDelegateUser();
        OrgUnit from = d.getFromOrgUnit();
        boolean scheduled = d.getStartsAt() != null && now.isBefore(d.getStartsAt());
        boolean expired = d.getExpiresAt() != null && !now.isBefore(d.getExpiresAt());

        return DelegationResponse.builder()
                .id(d.getId())
                .delegateUserId(u != null ? u.getId() : null)
                .delegateUserName(u != null ? u.getFullName() : null)
                .delegateUserEmail(u != null ? u.getEmail() : null)
                .delegateUserAvatarUrl(u != null ? u.getAvatarUrl() : null)
                .delegateRoleName(u != null && from != null
                        ? permissionChecker.getBestRoleNameInOrgUnit(u.getId(), from.getId()) : null)
                .orgUnitId(d.getOrgUnit() != null ? d.getOrgUnit().getId() : null)
                .orgUnitName(d.getOrgUnit() != null ? d.getOrgUnit().getName() : null)
                .fromOrgUnitId(from != null ? from.getId() : null)
                .fromOrgUnitName(from != null ? from.getName() : null)
                .includeSubtree(d.getIncludeSubtree())
                .canActAsLeader(d.getCanActAsLeader())
                .reason(d.getReason())
                .startsAt(d.getStartsAt())
                .expiresAt(d.getExpiresAt())
                .active(d.isActiveAt(now))
                .scheduled(scheduled)
                .expired(expired)
                .createdByName(d.getCreatedBy() != null ? d.getCreatedBy().getFullName() : null)
                .createdAt(d.getCreatedAt())
                .build();
    }
}
