package com.kpitracking.service;

import com.kpitracking.dto.request.userrole.AssignRoleRequest;
import com.kpitracking.dto.request.userrole.BulkAssignRoleRequest;
import com.kpitracking.dto.response.userrole.UserRoleOrgUnitResponse;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Role;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.exception.DuplicateResourceException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.UserRoleOrgUnitMapper;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.RoleRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.security.audit.SecurityAuditEvent;
import com.kpitracking.security.audit.SecurityAuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserRoleService {

    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRoleOrgUnitMapper mapper;
    private final PermissionChecker permissionChecker;
    private final SecurityAuditService securityAudit;

    /**
     * {@code @PreAuthorize("hasAuthority('ROLE:ASSIGN')")} ở controller chỉ nói "người này có quyền
     * gán vai trò Ở ĐÂU ĐÓ". orgUnitId đến từ body/path nên phải kiểm lại: quyền đó phải có hiệu
     * lực ở chính đơn vị đích (theo thừa kế cây hoặc uỷ quyền), nếu không trưởng phòng của công
     * ty A gán được vai trò trong công ty B.
     */
    private User requireAssignScope(UUID orgUnitId) {
        User me = getCurrentUser();
        if (!permissionChecker.hasPermissionInOrgUnit(me.getId(), "ROLE:ASSIGN", orgUnitId)
                && !permissionChecker.isGlobalAdminIn(me.getId(), orgUnitId)) {
            securityAudit.record(SecurityAuditEvent.ACCESS_DENIED, SecurityAuditService.BLOCKED,
                    "ORG_UNIT", String.valueOf(orgUnitId), "Gán/gỡ vai trò ngoài phạm vi quản lý");
            throw new com.kpitracking.exception.ForbiddenException("Bạn không có quyền gán vai trò trong đơn vị này");
        }
        return me;
    }

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    @Transactional
    public UserRoleOrgUnitResponse assignRole(AssignRoleRequest request) {
        requireAssignScope(request.getOrgUnitId());
        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", request.getUserId()));
        Role role = roleRepository.findById(request.getRoleId())
                .orElseThrow(() -> new ResourceNotFoundException("Role", "id", request.getRoleId()));
        OrgUnit orgUnit = orgUnitRepository.findById(request.getOrgUnitId())
                .orElseThrow(() -> new ResourceNotFoundException("OrgUnit", "id", request.getOrgUnitId()));

        if (!orgUnit.getAllowedRoles().isEmpty() && !orgUnit.getAllowedRoles().contains(role)) {
            // Rank 2 is "Others/Staff" which should be allowed anywhere
            if (role.getRank() == null || role.getRank() != 2) {
                throw new com.kpitracking.exception.BusinessException("Vai trò '" + role.getName() + "' không được phép gán trong đơn vị '" + orgUnit.getName() + "'");
            }
        }

        if (userRoleOrgUnitRepository.existsByUserIdAndRoleIdAndOrgUnitId(
                request.getUserId(), request.getRoleId(), request.getOrgUnitId())) {
            throw new DuplicateResourceException("Người dùng đã có vai trò này tại đơn vị này");
        }

        validateManagerRequirement(orgUnit, role);
        validateManagerAssignment(orgUnit.getId(), role, user.getId());

        UserRoleOrgUnit assignment = UserRoleOrgUnit.builder()
                .user(user)
                .role(role)
                .orgUnit(orgUnit)
                .assignedBy(getCurrentUser())
                .expiresAt(request.getExpiresAt())
                .build();

    assignment = userRoleOrgUnitRepository.save(assignment);
        securityAudit.record(SecurityAuditEvent.ROLE_ASSIGNED, SecurityAuditService.OK,
                "USER", user.getId().toString(),
                "Gán vai trò " + role.getName() + " tại đơn vị " + orgUnit.getName());
        return mapper.toResponse(assignment);
    }

    @Transactional
    public List<UserRoleOrgUnitResponse> bulkAssignRole(BulkAssignRoleRequest request) {
        requireAssignScope(request.getOrgUnitId());
        Role role = roleRepository.findById(request.getRoleId())
                .orElseThrow(() -> new ResourceNotFoundException("Role", "id", request.getRoleId()));
        OrgUnit orgUnit = orgUnitRepository.findById(request.getOrgUnitId())
                .orElseThrow(() -> new ResourceNotFoundException("OrgUnit", "id", request.getOrgUnitId()));

        if (!orgUnit.getAllowedRoles().isEmpty() && !orgUnit.getAllowedRoles().contains(role)) {
            // Rank 2 is "Others/Staff" which should be allowed anywhere
            if (role.getRank() == null || role.getRank() != 2) {
                throw new com.kpitracking.exception.BusinessException("Vai trò '" + role.getName() + "' không được phép gán trong đơn vị '" + orgUnit.getName() + "'");
            }
        }

        validateManagerRequirement(orgUnit, role);

        User currentUser = getCurrentUser();
        List<UserRoleOrgUnit> assignments = new java.util.ArrayList<>();

        for (UUID userId : request.getUserIds()) {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

            if (!userRoleOrgUnitRepository.existsByUserIdAndRoleIdAndOrgUnitId(userId, request.getRoleId(), request.getOrgUnitId())) {
                UserRoleOrgUnit assignment = UserRoleOrgUnit.builder()
                        .user(user)
                        .role(role)
                        .orgUnit(orgUnit)
                        .assignedBy(currentUser)
                        .expiresAt(request.getExpiresAt())
                        .build();
                assignments.add(assignment);
            }
        }

        if (assignments.isEmpty()) {
            throw new com.kpitracking.exception.BusinessException("Tất cả người dùng đã có vai trò này tại đơn vị này");
        }

        List<UserRoleOrgUnit> saved = userRoleOrgUnitRepository.saveAll(assignments);
        return mapper.toResponseList(saved);
    }

    @Transactional
    public void revokeRole(UUID userId, UUID roleId, UUID orgUnitId) {
        requireAssignScope(orgUnitId);
        if (!userRoleOrgUnitRepository.existsByUserIdAndRoleIdAndOrgUnitId(userId, roleId, orgUnitId)) {
            throw new ResourceNotFoundException("Không tìm thấy thông tin phân quyền của người dùng");
        }
        userRoleOrgUnitRepository.deleteByUserIdAndRoleIdAndOrgUnitId(userId, roleId, orgUnitId);
        securityAudit.record(SecurityAuditEvent.ROLE_ASSIGNED, SecurityAuditService.OK,
                "USER", userId.toString(), "Thu hồi vai trò " + roleId + " tại đơn vị " + orgUnitId);
    }

    @Transactional
    public void removeBulkUsersFromOrgUnit(List<UUID> userIds, UUID orgUnitId) {
        requireAssignScope(orgUnitId);
        userRoleOrgUnitRepository.deleteByUserIdInAndOrgUnitId(userIds, orgUnitId);
        securityAudit.record(SecurityAuditEvent.ROLE_ASSIGNED, SecurityAuditService.OK,
                "ORG_UNIT", orgUnitId.toString(), "Gỡ " + userIds.size() + " người khỏi đơn vị");
    }

    @Transactional
    public void removeAllUsersFromOrgUnit(UUID orgUnitId) {
        requireAssignScope(orgUnitId);
        userRoleOrgUnitRepository.deleteByOrgUnitId(orgUnitId);
        securityAudit.record(SecurityAuditEvent.ROLE_ASSIGNED, SecurityAuditService.OK,
                "ORG_UNIT", orgUnitId.toString(), "Gỡ toàn bộ người khỏi đơn vị");
    }

    @Transactional(readOnly = true)
    public List<UserRoleOrgUnitResponse> getUserRoles(UUID userId) {
        userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        return mapper.toResponseList(userRoleOrgUnitRepository.findByUserId(userId));
    }

    @Transactional(readOnly = true)
    public List<UserRoleOrgUnitResponse> getUsersByOrgUnit(UUID orgUnitId) {
        orgUnitRepository.findById(orgUnitId)
                .orElseThrow(() -> new ResourceNotFoundException("OrgUnit", "id", orgUnitId));
        return mapper.toResponseList(userRoleOrgUnitRepository.findByOrgUnitId(orgUnitId));
    }

    private void validateManagerRequirement(OrgUnit orgUnit, Role role) {
        // Only check when adding Staff (Rank 2)
        if (role.getRank() != null && role.getRank() == 2) {
            // Skip check for the root unit (parent to nhất - no parent)
            if (orgUnit.getParent() != null && orgUnit.getOrgHierarchyLevel() != null) {
                // Check if unit has any Manager (Rank 0)
                boolean hasManager = userRoleOrgUnitRepository.existsByOrgUnitIdAndRoleRank(orgUnit.getId(), 0);
                if (!hasManager) {
                    throw new com.kpitracking.exception.BusinessException("Đơn vị '" + orgUnit.getName() + "' chưa có người quản lý (Cấp trưởng). Bạn phải chỉ định quản lý trước khi thêm nhân viên.");
                }
            }
        }
    }
    private void validateManagerAssignment(UUID orgUnitId, Role role, UUID excludeUserId) {
        if (role.getRank() != null && (role.getRank() == 0 || role.getRank() == 1)) {
            OrgUnit unit = orgUnitRepository.findById(orgUnitId).orElse(null);
            
            // Check "Only one manager/deputy" for ALL units (including Root)
            if (unit != null) {
                Integer rank = role.getRank();
                boolean exists = (excludeUserId != null) 
                    ? userRoleOrgUnitRepository.existsByOrgUnitIdAndRoleRankAndUserIdNot(orgUnitId, rank, excludeUserId)
                    : userRoleOrgUnitRepository.existsByOrgUnitIdAndRoleRank(orgUnitId, rank);
                
                if (exists) {
                    String rankName = (rank == 0) ? "Trưởng" : "Phó";
                    throw new com.kpitracking.exception.BusinessException("Đơn vị '" + unit.getName() + "' đã có nhân sự đảm nhiệm vai trò " + rankName + ". Mỗi đơn vị chỉ được phép có tối đa một " + rankName.toLowerCase() + ".");
                }
            }
        }
    }
}
