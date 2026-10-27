package com.kpitracking.service.user;

import com.kpitracking.service.PrimaryUnitResolver;
import com.kpitracking.service.kpi.KpiEffortShares;

import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.dto.request.user.CreateUserRequest;
import com.kpitracking.dto.request.user.UpdateUserRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.user.UserResponse;
import com.kpitracking.enums.user.UserStatus;

import jakarta.persistence.EntityManager;

import com.kpitracking.exception.DuplicateResourceException;
import com.kpitracking.exception.ResourceNotFoundException;

import com.kpitracking.repository.organization.OrgUnitRepository;
import com.kpitracking.repository.user.UserRepository;
import com.kpitracking.repository.user.UserRoleOrgUnitRepository;
import com.kpitracking.repository.access.RoleRepository;
import com.kpitracking.repository.organization.OrgHierarchyLevelRepository;
import com.kpitracking.dto.response.user.UserMembershipResponse;
import java.util.stream.Collectors;
import java.util.*;

import com.kpitracking.security.PermissionChecker;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

import com.kpitracking.dto.response.user.ImportUserResponse;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.i18n.Terms;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.web.multipart.MultipartFile;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.security.SecureRandom;
import java.util.Base64;

import com.kpitracking.entity.access.Role;
import com.kpitracking.entity.organization.OrgHierarchyLevel;
import com.kpitracking.entity.organization.OrgUnit;
import com.kpitracking.entity.user.User;
import com.kpitracking.entity.user.UserRoleOrgUnit;
import com.kpitracking.service.email.EmailService;
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final OrgHierarchyLevelRepository orgHierarchyLevelRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final OrgUnitRepository orgUnitRepository;
    private final RoleRepository roleRepository;
    private final PermissionChecker permissionChecker;
    /** Người duyệt nghỉ việc / bị vô hiệu hoá: chuỗi duyệt đang chờ họ tự chuyển lên cấp trên. */
    private final com.kpitracking.service.kpi.approval.KpiApprovalChainService approvalChain;
    private final PrimaryUnitResolver primaryUnits;
    private final KpiEffortShares effortShares;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "email", email));
    }


    private UserResponse toResponse(User user) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(user.getId());
        UserRoleOrgUnit primary = PrimaryUnitResolver.pick(assignments, user.getPrimaryOrgUnitId());
        
        List<UserMembershipResponse> memberships = assignments.stream()
                // Đơn vị chính đứng đầu (giữ thứ tự rank → path cho phần còn lại).
                .sorted(java.util.Comparator.comparing((UserRoleOrgUnit uro) -> uro != primary))
                .map(uro -> {
                    OrgUnit unit = uro.getOrgUnit();
                    String roleName = uro.getRole().getName();


                    // Lookup custom labels from hierarchy
                    List<OrgHierarchyLevel> levels = unit.getOrgHierarchyLevel() != null 
                        ? orgHierarchyLevelRepository.findByOrganizationIdOrderByLevelOrderAsc(unit.getOrgHierarchyLevel().getOrganization().getId())
                        : java.util.Collections.emptyList();
                    
                    return UserMembershipResponse.builder()
                        .orgUnitId(unit.getId())
                        .organizationId(unit.getOrgHierarchyLevel() != null ? unit.getOrgHierarchyLevel().getOrganization().getId() : null)
                        .orgUnitName(unit.getName())
                        .orgUnitCode(unit.getCode())
                        .organizationName(unit.getOrgHierarchyLevel() != null ? unit.getOrgHierarchyLevel().getOrganization().getName() : null)
                        .roleName(uro.getRole().getName())
                        .roleDisplayName(uro.getRole().getName())
                        .roleRank(uro.getRole().getRank())
                        .unitTypeLabel(unit.getOrgHierarchyLevel() != null ? unit.getOrgHierarchyLevel().getUnitTypeName() : null)
                        .levelOrder(unit.getOrgHierarchyLevel() != null ? unit.getOrgHierarchyLevel().getLevelOrder() : null)
                        .roleLevel(uro.getRole().getLevel())
                        .primary(uro == primary)
                        .build();
                })
                .collect(Collectors.toList());

        // Just return memberships as they are
        UUID organizationId = memberships.isEmpty() ? null : memberships.get(0).getOrganizationId();

        return UserResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .employeeCode(user.getEmployeeCode())
                .phone(user.getPhone())
                .avatarUrl(user.getAvatarUrl())
                .roles(assignments.stream().map(uro -> uro.getRole().getName()).distinct().toList())
                .status(user.getStatus())
                .organizationId(organizationId)
                .memberships(memberships)
                .effortShares(effortShareLines(user, assignments))
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .requirePasswordChange(user.getRequirePasswordChange())
                .build();
    }

    @Transactional
    public UserResponse createUser(CreateUserRequest request) {
        if (userRepository.existsByEmailAndDeletedAtIsNull(request.getEmail())) {
            throw new DuplicateResourceException(ErrorCode.EMAIL_EXISTS_SYSTEM, request.getEmail());
        }

        if (request.getEmployeeCode() != null && !request.getEmployeeCode().isBlank()) {
            if (userRepository.existsByEmployeeCodeAndDeletedAtIsNull(request.getEmployeeCode().trim())) {
                throw new BusinessException(ErrorCode.EMPLOYEE_CODE_USE, String.valueOf(request.getEmployeeCode()));
            }
        }

        User user = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .employeeCode(request.getEmployeeCode())
                .phone(request.getPhone())
                .isEmailVerified(true)
                .requirePasswordChange(true)
                .build();

        user = userRepository.save(user);

        if (request.getOrgUnitId() != null && request.getRole() != null) {
            OrgUnit orgUnit = orgUnitRepository.findById(request.getOrgUnitId())
                    .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.unit"), "id", request.getOrgUnitId()));
            
            UUID orgId = orgUnit.getOrgHierarchyLevel().getOrganization().getId();
            com.kpitracking.entity.access.Role role = resolveRole(request.getRole(), orgId);
            validateManagerAssignment(request.getOrgUnitId(), role, null);
            assignToUnitAndImmediateParent(user, orgUnit, role, getCurrentUser());
            primaryUnits.pin(user, orgUnit.getId());
        }

        try {
            emailService.sendAccountDetailsEmail(user.getEmail(), user.getFullName(), request.getPassword());
        } catch (Exception e) {
            // Silently log and continue, as the user is already created
        }

        return toResponse(user);
    }

    /** "% công sức" từng nhánh — chỉ khi ≥ 2 nhánh, để form Sửa người dùng hiện ô nhập. */
    private List<com.kpitracking.dto.response.user.UserEffortShareResponse> effortShareLines(User user, List<UserRoleOrgUnit> assignments) {
        List<KpiEffortShares.Branch> branches = effortShares.branchesOf(user, user.getId(), assignments);
        if (branches.size() < 2) return null;
        return branches.stream().map(b -> com.kpitracking.dto.response.user.UserEffortShareResponse.builder()
                .orgUnitId(b.unit().getId())
                .orgUnitName(b.unit().getName())
                .sharePercent(Math.round(b.sharePercent() * 100.0) / 100.0)
                .configured(b.configured())
                .build()).toList();
    }

    /**
     * Đặt "% công sức" của người kiêm nhiệm (KpiEffortShares). Cùng luật quyền với sửa người dùng;
     * phải gồm đủ mọi nhánh hiện tại và cộng 100% (rỗng = về chia đều). Không chặn theo khoá kỳ: chỉ
     * đổi cách tính điểm XEM TRƯỚC — đánh giá đã lưu giữ điểm hệ thống đã chụp lúc chấm.
     */
    @Transactional
    public UserResponse updateEffortShares(UUID userId, com.kpitracking.dto.request.user.UpdateEffortSharesRequest request) {
        User currentUser = getCurrentUser();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "id", userId));
        if (!permissionChecker.isGlobalAdminOverUser(currentUser.getId(), userId)) {
            boolean hasAccess = userRoleOrgUnitRepository.findByUserId(userId).stream()
                    .anyMatch(a -> permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "USER:UPDATE", a.getOrgUnit().getId()));
            if (!hasAccess) throw new ForbiddenException(ErrorCode.NO_PERMISSION_EDIT_USER);
        }
        java.util.Map<UUID, String> branchNames = new java.util.LinkedHashMap<>();
        effortShares.branchesOf(userId).forEach(b -> branchNames.put(b.unit().getId(), b.unit().getName()));

        java.util.Map<UUID, Double> shares = new java.util.LinkedHashMap<>();
        for (var item : request.getShares()) {
            if (!branchNames.containsKey(item.getOrgUnitId())) {
                String name = orgUnitRepository.findById(item.getOrgUnitId()).map(OrgUnit::getName)
                        .orElse(String.valueOf(item.getOrgUnitId()));
                throw new BusinessException(ErrorCode.EFFORT_SHARE_UNIT_NOT_BRANCH, name);
            }
            shares.put(item.getOrgUnitId(), item.getSharePercent());
        }
        if (!shares.isEmpty()) {
            double total = shares.values().stream().mapToDouble(Double::doubleValue).sum();
            if (shares.size() != branchNames.size() || Math.abs(total - 100.0) > 0.05) {
                throw new BusinessException(ErrorCode.EFFORT_SHARES_TOTAL_NOT_100,
                        String.valueOf(Math.round(total * 100.0) / 100.0));
            }
        }
        effortShares.replace(userId, shares, currentUser.getId());
        return toResponse(user);
    }

    /**
     * Form "Sửa người dùng" đổi ĐƠN VỊ CHÍNH và VAI TRÒ CAO NHẤT ở đó, không đụng phân công khác
     * (kiêm nhiệm ở đơn vị khác, vai trò thứ hai cùng đơn vị, vai trò sinh từ uỷ quyền ký thay).
     * Trước đây chỗ này xoá sạch mọi phân công rồi gán lại một dòng, nên lưu form — kể cả chỉ sửa
     * số điện thoại — làm người kiêm nhiệm mất các đơn vị / vai trò còn lại.
     *
     * <p>Đơn vị chọn là nơi người đó ĐANG thuộc ⇒ chỉ đổi đơn vị chính (và vai trò cao nhất ở đó
     * nếu có gửi). Chưa thuộc ⇒ CHUYỂN: rời đơn vị chính cũ rồi vào đơn vị mới.
     */
    private void changePrimaryMembership(User user, UUID newUnitId, String roleName, User currentUser) {
        UserRoleOrgUnit primary = primaryUnits.assignmentOf(user);
        OrgUnit oldUnit = primary != null ? primary.getOrgUnit() : null;
        OrgUnit unit = newUnitId != null
                ? orgUnitRepository.findById(newUnitId)
                        .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.unit"), "id", newUnitId))
                : oldUnit;
        if (unit == null) return;
        UUID orgId = unit.getOrgHierarchyLevel().getOrganization().getId();

        UserRoleOrgUnit topAtTarget = userRoleOrgUnitRepository.findByUserIdAndOrgUnitId(user.getId(), unit.getId()).stream()
                .filter(a -> a.getDelegationId() == null)
                .min(java.util.Comparator.comparingInt(a -> a.getRole().getRank() != null ? a.getRole().getRank() : 99))
                .orElse(null);
        com.kpitracking.entity.access.Role role = roleName != null && !roleName.isBlank() ? resolveRole(roleName, orgId)
                : topAtTarget != null ? topAtTarget.getRole()
                : primary != null ? primary.getRole()
                : resolveRole(null, orgId);

        if (topAtTarget != null) {
            if (!topAtTarget.getRole().getId().equals(role.getId())) {
                // Gỡ trước rồi mới kiểm: hạ chính trưởng đơn vị xuống nhân viên phải bị chặn "đơn vị chưa có trưởng".
                userRoleOrgUnitRepository.deleteByUserIdAndRoleIdAndOrgUnitId(user.getId(), topAtTarget.getRole().getId(), unit.getId());
                validateManagerAssignment(unit.getId(), role, user.getId());
                validateManagerRequirement(unit, role);
                saveAssignmentIfAbsent(user, role, unit, currentUser);
            }
            primaryUnits.pin(user, unit.getId());
            return;
        }

        if (oldUnit != null) leavePrimaryUnit(user, oldUnit, unit);
        validateManagerAssignment(unit.getId(), role, user.getId());
        validateManagerRequirement(unit, role);
        assignToUnitAndImmediateParent(user, unit, role, currentUser);
        primaryUnits.pin(user, unit.getId());
    }

    /**
     * Rời đơn vị chính cũ khi chuyển sang {@code target}: gỡ mọi vai trò THẬT ở đó, và dòng nhân
     * viên tự sinh ở đơn vị cha của nó nếu đơn vị cha không còn liên quan (không phải đích / cha
     * của đích, và người này không còn phân công nào khác trong nhánh đó). Kiêm nhiệm ở nơi khác
     * và vai trò sinh từ uỷ quyền giữ nguyên.
     */
    private void leavePrimaryUnit(User user, OrgUnit oldUnit, OrgUnit target) {
        List<UserRoleOrgUnit> all = userRoleOrgUnitRepository.findByUserId(user.getId());
        for (UserRoleOrgUnit a : all) {
            if (a.getDelegationId() == null && a.getOrgUnit().getId().equals(oldUnit.getId())) {
                userRoleOrgUnitRepository.deleteByUserIdAndRoleIdAndOrgUnitId(user.getId(), a.getRole().getId(), oldUnit.getId());
            }
        }
        OrgUnit parent = oldUnit.getParent();
        if (parent == null || parent.getId().equals(target.getId())
                || (target.getParent() != null && parent.getId().equals(target.getParent().getId()))) {
            return;
        }
        boolean stillBelowParent = all.stream().anyMatch(a -> a.getDelegationId() == null
                && !a.getOrgUnit().getId().equals(oldUnit.getId())
                && !a.getOrgUnit().getId().equals(parent.getId())
                && a.getOrgUnit().getPath() != null && parent.getPath() != null
                && a.getOrgUnit().getPath().startsWith(parent.getPath()));
        if (stillBelowParent) return;
        for (UserRoleOrgUnit a : all) {
            if (a.getDelegationId() == null && a.getOrgUnit().getId().equals(parent.getId())
                    && a.getRole().getRank() != null && a.getRole().getRank() == 2) {
                userRoleOrgUnitRepository.deleteByUserIdAndRoleIdAndOrgUnitId(user.getId(), a.getRole().getId(), parent.getId());
            }
        }
    }

    private void saveAssignmentIfAbsent(User user, com.kpitracking.entity.access.Role role, OrgUnit unit, User assignedBy) {
        if (userRoleOrgUnitRepository.existsByUserIdAndRoleIdAndOrgUnitId(user.getId(), role.getId(), unit.getId())) return;
        userRoleOrgUnitRepository.save(UserRoleOrgUnit.builder()
                .user(user)
                .role(role)
                .orgUnit(unit)
                .assignedBy(assignedBy)
                .assignedAt(Instant.now())
                .build());
    }

    private void assignToUnitAndImmediateParent(User user, OrgUnit orgUnit, com.kpitracking.entity.access.Role role, User assignedBy) {
        // Assign to the selected unit
        saveAssignmentIfAbsent(user, role, orgUnit, assignedBy);

        // If it's a child unit, also assign to its parent as "Nhân viên" (if not already assigned)
        if (orgUnit.getParent() != null) {
            UUID orgId = orgUnit.getOrgHierarchyLevel().getOrganization().getId();
            com.kpitracking.entity.access.Role staffRole = roleRepository.findByOrganizationIdAndRank(orgId, 2)
                    .stream().findFirst()
                    .orElse(role); // Fallback to current role if no Staff role found

            // Only assign if not already present
            if (!userRoleOrgUnitRepository.existsByUserIdAndRoleIdAndOrgUnitId(user.getId(), staffRole.getId(), orgUnit.getParent().getId())) {
                UserRoleOrgUnit parentAssignment = UserRoleOrgUnit.builder()
                        .user(user)
                        .role(staffRole)
                        .orgUnit(orgUnit.getParent())
                        .assignedBy(assignedBy)
                        .assignedAt(Instant.now())
                        .build();
                userRoleOrgUnitRepository.save(parentAssignment);
            }
        }
    }

    @Transactional(readOnly = true)
    public PageResponse<UserResponse> getUsers(int page, int size, String keyword, List<UUID> orgUnitIds, String role, String sortBy, String direction, boolean includeInactive) {
        User currentUser = getCurrentUser();
        boolean isGlobalAdmin = permissionChecker.isGlobalAdmin(currentUser.getId());
        List<UUID> allowedOrgUnitIds = permissionChecker.getOrgUnitsWithPermission(currentUser.getId(), "USER:VIEW");
        if (allowedOrgUnitIds == null || allowedOrgUnitIds.isEmpty()) {
            allowedOrgUnitIds = permissionChecker.getOrgUnitsWithPermission(currentUser.getId(), "USER:VIEW_LIST");
        }
        
        if (!isGlobalAdmin && (allowedOrgUnitIds == null || allowedOrgUnitIds.isEmpty())) {
            return PageResponse.<UserResponse>builder()
                    .content(java.util.Collections.emptyList())
                    .page(page)
                    .size(size)
                    .totalElements(0)
                    .totalPages(0)
                    .build();
        }

        Sort sort = Sort.by((direction != null && direction.equalsIgnoreCase("desc")) ? Sort.Direction.DESC : Sort.Direction.ASC, sortBy != null ? sortBy : "createdAt");
        Pageable pageable = PageRequest.of(page, size, sort);

        String roleName = (role == null || role.equals("ALL")) ? null : role;
        
        // Hierarchy filtering based on permissions
        boolean excludeAdmin = !isGlobalAdmin;
        boolean isManager = permissionChecker.hasAnyPermission(currentUser.getId(), "KPI:APPROVE_CRITERIA", "KPI:APPROVE_ADJUSTMENT");
        boolean excludeManager = false; 
        boolean excludeSelf = isGlobalAdmin; 

        List<UserRoleOrgUnit> currentAssignments = userRoleOrgUnitRepository.findByUserId(currentUser.getId());
        UUID organizationId = null;
        Integer currentUserRank = 2;
        Integer currentUserLevel = 99;

        if (!currentAssignments.isEmpty()) {
            organizationId = currentAssignments.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
            currentUserRank = currentAssignments.stream()
                .map(a -> a.getRole().getRank())
                .filter(java.util.Objects::nonNull)
                .min(Integer::compare)
                .orElse(2);
            
            currentUserLevel = currentAssignments.stream()
                .map(a -> a.getOrgUnit().getOrgHierarchyLevel().getLevelOrder())
                .filter(java.util.Objects::nonNull)
                .min(Integer::compare)
                .orElse(99);
        }

        Page<User> userPage = userRepository.searchUsers(
            isGlobalAdmin, 
            organizationId,
            allowedOrgUnitIds, 
            keyword, 
            roleName, 
            orgUnitIds,
            currentUser.getId(),
            currentUserRank,
            currentUserLevel,
            excludeSelf,
            excludeAdmin,
            excludeManager,
            includeInactive,
            pageable
        );

        return PageResponse.<UserResponse>builder()
                .content(userPage.getContent().stream().map(this::toResponse).toList())
                .page(userPage.getNumber())
                .size(userPage.getSize())
                .totalElements(userPage.getTotalElements())
                .totalPages(userPage.getTotalPages())
                .last(userPage.isLast())
                .build();
    }

    @Transactional(readOnly = true)
    public UserResponse getUserById(UUID userId) {
        User currentUser = getCurrentUser();
        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "id", userId));

        if (!currentUser.getId().equals(userId) && !permissionChecker.isGlobalAdminOverUser(currentUser.getId(), userId)) {
            List<UserRoleOrgUnit> targetUserAssignments = userRoleOrgUnitRepository.findByUserId(userId);
            boolean hasAccess = targetUserAssignments.stream()
                    .anyMatch(a -> permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "USER:VIEW", a.getOrgUnit().getId()) ||
                                   permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "USER:VIEW_LIST", a.getOrgUnit().getId()));

            
            if (!hasAccess) {
                throw new ForbiddenException(ErrorCode.NO_PERMISSION_VIEW_USER_INFORMATION);
            }
        }
        return toResponse(targetUser);
    }

    @Transactional
    public UserResponse updateUser(UUID userId, UpdateUserRequest request) {
        User currentUser = getCurrentUser();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "id", userId));

        if (!currentUser.getId().equals(userId) && !permissionChecker.isGlobalAdminOverUser(currentUser.getId(), userId)) {
            List<UserRoleOrgUnit> targetUserAssignments = userRoleOrgUnitRepository.findByUserId(userId);
            boolean hasAccess = targetUserAssignments.stream()
                    .anyMatch(a -> permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "USER:UPDATE", a.getOrgUnit().getId()));
            
            if (!hasAccess) {
                throw new ForbiddenException(ErrorCode.NO_PERMISSION_EDIT_USER);
            }
        }

        if (request.getFullName() != null) {
            user.setFullName(request.getFullName());
        }
        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmailAndDeletedAtIsNull(request.getEmail())) {
                throw new DuplicateResourceException(Terms.of("resource.user"), "email", request.getEmail());
            }
            user.setEmail(request.getEmail());
        }
        if (request.getPhone() != null) {
            user.setPhone(request.getPhone());
        }
        if (request.getEmployeeCode() != null) {
            String code = request.getEmployeeCode().trim();
            if (!code.isBlank() && userRepository.existsByEmployeeCodeAndIdNotAndDeletedAtIsNull(code, userId)) {
                throw new BusinessException(ErrorCode.EMPLOYEE_CODE_USED_ANOTHER_PERSON, String.valueOf(code));
            }
            user.setEmployeeCode(code);
        }
        boolean deactivated = false;
        if (request.getStatus() != null) {
            boolean wasPaused = user.isPausedAccount();
            user.setStatus(request.getStatus());
            deactivated = !wasPaused && user.isPausedAccount();
            // Mốc đếm ngày tự xoá tài liệu cá nhân: ghi lúc vừa vô hiệu hoá, xoá khi mở lại.
            if (deactivated) user.setDeactivatedAt(Instant.now());
            else if (wasPaused && !user.isPausedAccount()) user.setDeactivatedAt(null);
        }

        if (request.getOrgUnitId() != null || request.getRole() != null) {
            changePrimaryMembership(user, request.getOrgUnitId(), request.getRole(), currentUser);
        }

        user = userRepository.save(user);
        if (deactivated) {
            approvalChain.onApproverDeactivated(user);
        }
        return toResponse(user);
    }

    @Transactional
    public void deleteUser(UUID userId) {
        User currentUser = getCurrentUser();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "id", userId));

        if (!permissionChecker.isGlobalAdminOverUser(currentUser.getId(), userId)) {
            List<UserRoleOrgUnit> targetUserAssignments = userRoleOrgUnitRepository.findByUserId(userId);
            boolean hasAccess = targetUserAssignments.stream()
                    .anyMatch(a -> permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "USER:DELETE", a.getOrgUnit().getId()));
            
            if (!hasAccess) {
                throw new ForbiddenException(ErrorCode.NO_PERMISSION_DELETE_USER);
            }
        }

        user.setDeletedAt(Instant.now());
        if (user.getDeactivatedAt() == null) user.setDeactivatedAt(user.getDeletedAt());
        userRepository.save(user);
        approvalChain.onApproverDeactivated(user);
    }

    private String generateRandomPassword() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[9];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes) + "A1@";
    }

    @Transactional
    public ImportUserResponse importUsers(MultipartFile file, UUID orgUnitId) {
        String filename = file.getOriginalFilename();
        if (filename == null || (!filename.endsWith(".csv") && !filename.endsWith(".xlsx"))) {
            throw new BusinessException(ErrorCode.ONLY_3);
        }

        List<String> errors = new ArrayList<>();
        int successfulImports = 0;
        int totalRows = 0;
        java.util.Set<UUID> modifiedUnitIds = new java.util.HashSet<>();

        try {
            if (filename.endsWith(".csv")) {
                try (BufferedReader fileReader = new BufferedReader(new InputStreamReader(file.getInputStream(), "UTF-8"));
                     CSVParser csvParser = new CSVParser(fileReader, CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).setIgnoreHeaderCase(true).setTrim(true).build())) {

                    Iterable<CSVRecord> csvRecords = csvParser.getRecords();
                    for (CSVRecord csvRecord : csvRecords) {
                        totalRows++;
                        try {
                            String email = csvRecord.get("Email");
                            String fullName = csvRecord.get("FullName");
                            String phone = csvRecord.isMapped("Phone") ? csvRecord.get("Phone") : null;
                            String employeeCode = csvRecord.isMapped("EmployeeCode") ? csvRecord.get("EmployeeCode") : null;
                            String roleName = csvRecord.isMapped("Role") ? csvRecord.get("Role") : null;
                            String password = csvRecord.isMapped("Password") ? csvRecord.get("Password") : null;
                            String orgUnitCode = csvRecord.isMapped("OrgUnitCode") ? csvRecord.get("OrgUnitCode") : null;
                            List<UUID> assignedTo = processUserRow(email, fullName, phone, employeeCode, roleName, password, orgUnitCode, orgUnitId);
                            modifiedUnitIds.addAll(assignedTo);
                            successfulImports++;
                        } catch (Exception e) {
                            errors.add("Row " + totalRows + ": " + e.getMessage());
                        }
                    }
                }
            } else if (filename.endsWith(".xlsx")) {
                try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
                    Sheet sheet = workbook.getSheetAt(0);
                    Row headerRow = sheet.getRow(0);

                    if (headerRow == null) throw new BusinessException(ErrorCode.EXCEL_FILE_EMPTY);

                    int emailIdx = -1, nameIdx = -1, phoneIdx = -1, codeIdx = -1, roleIdx = -1, passIdx = -1, orgCodeIdx = -1;
                    for (int i = 0; i < headerRow.getLastCellNum(); i++) {
                        String header = headerRow.getCell(i).getStringCellValue().trim();
                        if (header.equalsIgnoreCase("Email")) emailIdx = i;
                        else if (header.equalsIgnoreCase("FullName")) nameIdx = i;
                        else if (header.equalsIgnoreCase("Phone")) phoneIdx = i;
                        else if (header.equalsIgnoreCase("EmployeeCode")) codeIdx = i;
                        else if (header.equalsIgnoreCase("Role")) roleIdx = i;
                        else if (header.equalsIgnoreCase("Password")) passIdx = i;
                        else if (header.equalsIgnoreCase("OrgUnitCode")) orgCodeIdx = i;
                    }

                    if (emailIdx == -1 || nameIdx == -1) {
                        throw new BusinessException(ErrorCode.MISSING_REQUIRED_COLUMNS_4);
                    }

                    Set<String> orgCodesInFile = new HashSet<>();
                    Set<String> unitsWithManagerInFile = new HashSet<>();
                    UUID currentOrgId = getCurrentUserOrgId();

                    for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                        Row row = sheet.getRow(i);
                        if (row == null) continue;

                        String roleName = (roleIdx != -1 && row.getCell(roleIdx) != null) ? getCellValueAsString(row.getCell(roleIdx)) : null;
                        String orgUnitCode = (orgCodeIdx != -1 && row.getCell(orgCodeIdx) != null) ? getCellValueAsString(row.getCell(orgCodeIdx)) : null;

                        if (orgUnitCode != null && !orgUnitCode.isBlank()) {
                            String code = orgUnitCode.trim();
                            orgCodesInFile.add(code);

                            try {
                                UUID organizationId = (orgUnitId != null) ? orgUnitId : currentOrgId;
                                com.kpitracking.entity.access.Role role = resolveRoleInternal(roleName, organizationId);
                                if (role != null && role.getRank() != null && role.getRank() == 0) {
                                    unitsWithManagerInFile.add(code);
                                }
                            } catch (Exception e) { /* Ignore here */ }
                        }
                    }

                    // Validate managers for all sub-units in file
                    for (String code : orgCodesInFile) {
                        OrgUnit unit = orgUnitRepository.findByCode(code).orElse(null);
                        if (unit != null && unit.getOrgHierarchyLevel() != null && unit.getOrgHierarchyLevel().getLevelOrder() > 0) {
                            boolean hasManagerInFile = unitsWithManagerInFile.contains(code);
                            boolean hasManagerInDb = userRoleOrgUnitRepository.existsByOrgUnitIdAndRoleRank(unit.getId(), 0);

                            if (!hasManagerInFile && !hasManagerInDb) {
                                throw new BusinessException(ErrorCode.UNIT, unit.getName(), unit.getCode());
                            }
                        }
                    }

                    // Main processing loop
                    for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                        Row row = sheet.getRow(i);
                        if (row == null) continue;
                        totalRows++;

                        try {
                            String email = row.getCell(emailIdx) != null ? row.getCell(emailIdx).getStringCellValue().trim() : "";
                            String fullName = row.getCell(nameIdx) != null ? row.getCell(nameIdx).getStringCellValue().trim() : "";
                            String phone = (phoneIdx != -1 && row.getCell(phoneIdx) != null) ? getCellValueAsString(row.getCell(phoneIdx)) : null;
                            String employeeCode = (codeIdx != -1 && row.getCell(codeIdx) != null) ? getCellValueAsString(row.getCell(codeIdx)) : null;
                            String roleName = (roleIdx != -1 && row.getCell(roleIdx) != null) ? getCellValueAsString(row.getCell(roleIdx)) : null;
                            String password = (passIdx != -1 && row.getCell(passIdx) != null) ? getCellValueAsString(row.getCell(passIdx)) : null;
                            String orgUnitCode = (orgCodeIdx != -1 && row.getCell(orgCodeIdx) != null) ? getCellValueAsString(row.getCell(orgCodeIdx)) : null;

                            processUserRow(email, fullName, phone, employeeCode, roleName, password, orgUnitCode, orgUnitId);
                            successfulImports++;
                        } catch (Exception e) {
                            errors.add("Row " + totalRows + ": " + e.getMessage());
                        }
                    }
                }
            }
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.FILE_PROCESSING_FAILED, e.getMessage());
        }

        return ImportUserResponse.builder()
                .totalRows(totalRows)
                .successfulImports(successfulImports)
                .errors(errors)
                .build();
    }



    private String getCellValueAsString(org.apache.poi.ss.usermodel.Cell cell) {
        if (cell.getCellType() == org.apache.poi.ss.usermodel.CellType.NUMERIC) {
            return String.valueOf((long) cell.getNumericCellValue());
        }
        return cell.getStringCellValue().trim();
    }

    private List<UUID> processUserRow(String email, String fullName, String phone, String employeeCode, String roleIdStr, String password, String orgUnitCode, UUID orgUnitId) {
        if (email == null || email.isBlank()) throw new BusinessException(ErrorCode.EMAIL_REQUIRED);
        if (fullName == null || fullName.isBlank()) throw new BusinessException(ErrorCode.FULL_NAME_REQUIRED);

        // Người đã có tài khoản đang hoạt động + dòng có mã đơn vị ⇒ gán KIÊM NHIỆM ở đơn vị đó (không
        // đụng hồ sơ / mật khẩu). Cùng một người nhiều dòng trong một tệp: dòng đầu tạo tài khoản và là
        // đơn vị chính, các dòng sau là kiêm nhiệm.
        Optional<User> existing = userRepository.findByEmail(email.trim());
        if (existing.isPresent() && existing.get().getDeletedAt() == null
                && existing.get().getStatus() == UserStatus.ACTIVE
                && orgUnitCode != null && !orgUnitCode.isBlank()) {
            return addSecondaryMembership(existing.get(), roleIdStr, orgUnitCode.trim());
        }

        User user = createOrUpdateUserInternal(email, fullName, phone, employeeCode, password);
        UUID organizationId = orgUnitId; // Simplified, in processUserRow we might need to lookup the orgId from orgUnitId
        // Let's get the organization ID from the unit
        if (orgUnitId == null && orgUnitCode != null && !orgUnitCode.isBlank()) {
             OrgUnit u = orgUnitRepository.findByCode(orgUnitCode.trim()).orElse(null);
             if (u != null) organizationId = u.getOrgHierarchyLevel().getOrganization().getId();
        } else if (orgUnitId != null) {
             OrgUnit u = orgUnitRepository.findById(orgUnitId).orElse(null);
             if (u != null) organizationId = u.getOrgHierarchyLevel().getOrganization().getId();
        }

        if (organizationId == null) {
             // Fallback to current user's org
             User cur = getCurrentUser();
             organizationId = userRoleOrgUnitRepository.findByUserId(cur.getId()).get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
        }

        com.kpitracking.entity.access.Role role = resolveRoleInternal(roleIdStr, (UUID)organizationId);

        List<UUID> assignedUnits = new ArrayList<>();
        
        // 1. Assign to Default Unit (usually Root) as a Staff-level role ALWAYS
        if (orgUnitId != null) {
            // Find any role with Rank 2 (Staff) in this organization to use as the default root role
            Role staffRole = roleRepository.findByOrganizationIdAndRank(organizationId, 2)
                    .stream().findFirst()
                    .orElse(role); // Fallback to the role from Excel if no Rank 2 role exists
            
            assignUserToUnitInternal(user, staffRole, orgUnitId);
            assignedUnits.add(orgUnitId);
        }

        // 2. Assign to Specific Unit (from Excel) with the selected Role
        if (orgUnitCode != null && !orgUnitCode.isBlank()) {
            OrgUnit specificUnit = orgUnitRepository.findByCode(orgUnitCode.trim())
                    .orElseThrow(() -> new BusinessException(ErrorCode.UNIT_CODE_DOES_NOT_EXIST, String.valueOf(orgUnitCode)));
            
            // Only assign if it's different from the default unit OR if we want to ensure the role is applied here
            // To be safe, if it's the same unit, the Role in Excel should override the Staff role
            assignUserToUnitInternal(user, role, specificUnit.getId());
            if (!assignedUnits.contains(specificUnit.getId())) {
                assignedUnits.add(specificUnit.getId());
            }
            // Đơn vị ghi trong file là "nhà" của người này (đơn vị mặc định chỉ là chỗ treo chung).
            primaryUnits.pin(user, specificUnit.getId());
        } else {
            primaryUnits.ensurePinned(user);
        }
        return assignedUnits;
    }

    /**
     * Dòng import của người ĐÃ có tài khoản: thêm vai trò ở đơn vị {@code orgUnitCode} như màn Thành
     * viên đơn vị (cần ROLE:ASSIGN ở đơn vị đó, cùng tổ chức, chưa thuộc đơn vị đó). Đơn vị chính giữ
     * nguyên — ghim trước khi thêm (PrimaryUnitResolver.ensurePinned).
     */
    private List<UUID> addSecondaryMembership(User user, String roleIdStr, String orgUnitCode) {
        OrgUnit unit = orgUnitRepository.findByCode(orgUnitCode)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNIT_CODE_DOES_NOT_EXIST, orgUnitCode));
        UUID orgId = unit.getOrgHierarchyLevel().getOrganization().getId();
        OrgUnit home = primaryUnits.unitOf(user);
        if (home != null && !orgId.equals(home.getOrgHierarchyLevel().getOrganization().getId())) {
            throw new BusinessException(ErrorCode.EMAIL_EXISTS_ACTIVE_SYSTEM, user.getEmail());
        }
        User me = getCurrentUser();
        if (!permissionChecker.hasPermissionInOrgUnit(me.getId(), "ROLE:ASSIGN", unit.getId())) {
            throw new ForbiddenException(ErrorCode.NO_PERMISSION_ASSIGN_ROLES_UNIT);
        }
        boolean member = userRoleOrgUnitRepository.findByUserIdAndOrgUnitId(user.getId(), unit.getId()).stream()
                .anyMatch(a -> a.getDelegationId() == null);
        if (member) {
            throw new BusinessException(ErrorCode.USER_ALREADY_MEMBER_OF_UNIT, user.getEmail(), unit.getName());
        }
        com.kpitracking.entity.access.Role role = resolveRoleInternal(roleIdStr, orgId);
        validateManagerAssignment(unit.getId(), role, user.getId());
        primaryUnits.ensurePinned(user);
        saveAssignmentIfAbsent(user, role, unit, me);
        primaryUnits.ensurePinned(user);
        return List.of(unit.getId());
    }

    private User createOrUpdateUserInternal(String email, String fullName, String phone, String employeeCode, String password) {
        Optional<User> existingUser = userRepository.findByEmail(email);
        if (existingUser.isPresent()) {
            User user = existingUser.get();
            
            if (user.getStatus() == UserStatus.ACTIVE) {
                throw new BusinessException(ErrorCode.EMAIL_EXISTS_ACTIVE_SYSTEM, String.valueOf(email));
            }

            if (fullName != null && !fullName.isBlank()) user.setFullName(fullName);
            if (phone != null) user.setPhone(phone);
            if (employeeCode != null && !employeeCode.isBlank()) {
                String code = employeeCode.trim();
                if (userRepository.existsByEmployeeCodeAndIdNotAndDeletedAtIsNull(code, user.getId())) {
                    throw new BusinessException(ErrorCode.EMPLOYEE_CODE_USED_ANOTHER_PERSON_2, String.valueOf(code), String.valueOf(email));
                }
                user.setEmployeeCode(code);
            }
            
            if (password != null && !password.isBlank()) {
                user.setPassword(passwordEncoder.encode(password));
                try {
                    emailService.sendAccountDetailsEmail(email, user.getFullName(), password);
                } catch (Exception e) {}
            }
            return userRepository.save(user);
        } else {
            if (employeeCode != null && !employeeCode.isBlank()) {
                String code = employeeCode.trim();
                if (userRepository.existsByEmployeeCodeAndDeletedAtIsNull(code)) {
                    throw new BusinessException(ErrorCode.EMPLOYEE_CODE_USED_ANOTHER_PERSON_2, String.valueOf(code), String.valueOf(email));
                }
            }

            String rawPassword = (password != null && !password.isBlank()) ? password : generateRandomPassword();
            User user = User.builder()
                    .email(email)
                    .password(passwordEncoder.encode(rawPassword))
                    .fullName(fullName)
                    .phone(phone)
                    .employeeCode(employeeCode)
                    .isEmailVerified(true)
                    .requirePasswordChange(true)
                    .build();
            User saved = userRepository.save(user);
            emailService.sendAccountDetailsEmail(email, fullName, rawPassword);
            return saved;
        }
    }

    private void assignUserToUnitInternal(User user, com.kpitracking.entity.access.Role role, UUID orgUnitId) {
        OrgUnit unit = orgUnitRepository.findById(orgUnitId)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNIT_DOES_NOT_EXIST));
        
        UUID orgId = unit.getOrgHierarchyLevel().getOrganization().getId();
        // Root unit (Level 0) always gets Staff role by default in bulk operations
        com.kpitracking.entity.access.Role finalRole = (unit.getOrgHierarchyLevel() != null && unit.getOrgHierarchyLevel().getLevelOrder() == 0) 
            ? roleRepository.findByOrganizationIdAndRank(orgId, 2).stream().findFirst().orElse(role) 
            : role;

        if (!userRoleOrgUnitRepository.existsByUserIdAndRoleIdAndOrgUnitId(user.getId(), finalRole.getId(), unit.getId())) {
            validateManagerAssignment(unit.getId(), finalRole, user.getId());
            UserRoleOrgUnit assignment = UserRoleOrgUnit.builder()
                    .user(user)
                    .role(finalRole)
                    .orgUnit(unit)
                    .assignedAt(Instant.now())
                    .build();
            userRoleOrgUnitRepository.save(assignment);
        }
    }

    private void validateManagerAssignment(UUID orgUnitId, com.kpitracking.entity.access.Role role, UUID excludeUserId) {
        if (role.getRank() != null && (role.getRank() == 0 || role.getRank() == 1)) {
            Integer rank = role.getRank();
            
            List<UserRoleOrgUnit> existing = (excludeUserId != null) 
                ? userRoleOrgUnitRepository.findByOrgUnitIdAndRoleRankAndUserIdNot(orgUnitId, rank, excludeUserId)
                : userRoleOrgUnitRepository.findByOrgUnitIdAndRoleRank(orgUnitId, rank);
            // Đồng trưởng tạm thời sinh từ uỷ quyền không chặn bổ nhiệm trưởng thật.
            existing = existing.stream().filter(a -> a.getDelegationId() == null).toList();

            if (!existing.isEmpty()) {
                UserRoleOrgUnit first = existing.get(0);
                String currentName = first.getUser().getFullName();
                String currentRole = first.getRole().getName();
                String rankName = ErrorMessages.text(rank == 0 ? "role.rank.head" : "role.rank.deputy", "");
                
                throw new BusinessException(ErrorCode.UNIT_ROLE, first.getOrgUnit().getName(), String.valueOf(currentName), String.valueOf(currentRole), String.valueOf(rankName));
            }
        }
    }

    private com.kpitracking.entity.access.Role resolveRoleInternal(String identifier, UUID organizationId) {
        if (identifier == null || identifier.isBlank()) {
            return roleRepository.findByOrganizationIdAndRank(organizationId, 2)
                    .stream().findFirst()
                    .orElseThrow(() -> new BusinessException(ErrorCode.DEFAULT_EMPLOYEE_ROLE));
        }

        if (identifier.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")) {
            return roleRepository.findById(UUID.fromString(identifier))
                    .orElseThrow(() -> new BusinessException(ErrorCode.ROLE_CODE, String.valueOf(identifier)));
        }

        return resolveRole(identifier, organizationId);
    }

    private com.kpitracking.entity.access.Role resolveRole(String roleName, UUID organizationId) {
        if (roleName == null || roleName.isBlank()) {
            return roleRepository.findByOrganizationIdAndRank(organizationId, 2)
                    .stream().findFirst()
                    .orElseThrow(() -> new BusinessException(ErrorCode.DEFAULT_EMPLOYEE_ROLE_NOT_FOUND));
        }
        String name = roleName.trim();

        return roleRepository.findByNameAndOrganizationId(name, organizationId)
                .or(() -> roleRepository.findByNameIgnoreCaseAndOrganizationId(name, organizationId))
                .orElseThrow(() -> new BusinessException(ErrorCode.JOB_TITLE_DOES_NOT_EXIST_SYSTEM, String.valueOf(name)));
    }

    private void validateManagerRequirement(OrgUnit orgUnit, com.kpitracking.entity.access.Role role) {
        if (role.getRank() != null && role.getRank() == 2) {
            if (orgUnit.getParent() != null && orgUnit.getOrgHierarchyLevel() != null) {
                if (!userRoleOrgUnitRepository.existsByOrgUnitIdAndRoleRank(orgUnit.getId(), 0)) {
                    throw new BusinessException(ErrorCode.UNIT_NO_MANAGER, orgUnit.getName());
                }
            }
        }
    }

    private UUID getCurrentUserOrgId() {
        User cur = getCurrentUser();
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(cur.getId());
        if (assignments.isEmpty()) throw new BusinessException(ErrorCode.CURRENT_USER_OUTSIDE_ORGANIZATION_2);
        return assignments.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
    }
}
