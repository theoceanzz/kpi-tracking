package com.kpitracking.service;

import com.kpitracking.dto.request.user.CreateUserRequest;
import com.kpitracking.dto.request.user.UpdateUserRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.user.UserResponse;
import com.kpitracking.entity.*;
import jakarta.persistence.EntityManager;

import com.kpitracking.exception.DuplicateResourceException;
import com.kpitracking.exception.ResourceNotFoundException;

import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.repository.RoleRepository;
import com.kpitracking.repository.OrgHierarchyLevelRepository;
import com.kpitracking.dto.response.user.UserMembershipResponse;
import java.util.stream.Collectors;
import java.util.Set;
import java.util.HashSet;
import java.util.UUID;
import java.util.List;
import java.util.ArrayList;
import java.util.Optional;

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
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.Collections;

import com.kpitracking.dto.response.user.ImportUserResponse;
import com.kpitracking.exception.BusinessException;
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
import java.util.ArrayList;
import java.util.Base64;

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
    private final EntityManager entityManager;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
    }


    private UserResponse toResponse(User user) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(user.getId());
        
        List<UserMembershipResponse> memberships = assignments.stream()
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
                        .organizationName(unit.getOrgHierarchyLevel() != null ? unit.getOrgHierarchyLevel().getOrganization().getName() : null)
                        .roleName(uro.getRole().getName())
                        .roleDisplayName(uro.getRole().getName())
                        .roleRank(uro.getRole().getRank())
                        .unitTypeLabel(unit.getOrgHierarchyLevel() != null ? unit.getOrgHierarchyLevel().getUnitTypeName() : null)
                        .levelOrder(unit.getOrgHierarchyLevel() != null ? unit.getOrgHierarchyLevel().getLevelOrder() : null)
                        .roleLevel(uro.getRole().getLevel())
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
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .requirePasswordChange(user.getRequirePasswordChange())
                .build();
    }

    @Transactional
    public UserResponse createUser(CreateUserRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException("Email này đã tồn tại trong hệ thống: " + request.getEmail());
        }

        if (request.getEmployeeCode() != null && !request.getEmployeeCode().isBlank()) {
            if (userRepository.existsByEmployeeCode(request.getEmployeeCode().trim())) {
                throw new BusinessException("Mã nhân viên '" + request.getEmployeeCode() + "' đã được sử dụng");
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
                    .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", request.getOrgUnitId()));
            
            UUID orgId = orgUnit.getOrgHierarchyLevel().getOrganization().getId();
            com.kpitracking.entity.Role role = resolveRole(request.getRole(), orgId);
            validateManagerAssignment(request.getOrgUnitId(), role, null);
            assignToUnitAndImmediateParent(user, orgUnit, role, getCurrentUser());
        }
        
        try {
            emailService.sendAccountDetailsEmail(user.getEmail(), user.getFullName(), request.getPassword());
        } catch (Exception e) {
            // Silently log and continue, as the user is already created
        }

        return toResponse(user);
    }

    private void assignToUnitAndImmediateParent(User user, OrgUnit orgUnit, com.kpitracking.entity.Role role, User assignedBy) {
        // Assign to the selected unit
        UserRoleOrgUnit assignment = UserRoleOrgUnit.builder()
                .user(user)
                .role(role)
                .orgUnit(orgUnit)
                .assignedBy(assignedBy)
                .assignedAt(Instant.now())
                .build();
        userRoleOrgUnitRepository.save(assignment);

        // If it's a child unit, also assign to its parent as "Nhân viên" (if not already assigned)
        if (orgUnit.getParent() != null) {
            UUID orgId = orgUnit.getOrgHierarchyLevel().getOrganization().getId();
            com.kpitracking.entity.Role staffRole = roleRepository.findByNameAndOrganizationId("Nhân viên", orgId)
                    .orElse(role); // Fallback to current role if "Nhân viên" not found

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
    public PageResponse<UserResponse> getUsers(int page, int size, String keyword, UUID orgUnitId, String role, String sortBy, String direction) {
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

        String orgUnitPath = null;
        if (orgUnitId != null) {
            orgUnitPath = orgUnitRepository.findById(orgUnitId)
                    .map(OrgUnit::getPath)
                    .map(path -> path + "%")
                    .orElse(null);
        }

        String roleName = (role == null || role.equals("ALL")) ? null : role;
        
        // Hierarchy filtering based on permissions
        boolean excludeAdmin = true; // Everyone except Global Admin (who shouldn't see themselves) excludes Admins? 
        // Wait, if I am a Director (Global Admin), I should see others BUT not myself.
        // If I am NOT a Director, I should NOT see Directors.
        excludeAdmin = !isGlobalAdmin;
        
        boolean isManager = permissionChecker.hasAnyPermission(currentUser.getId(), "KPI:APPROVE");
        boolean excludeManager = !isGlobalAdmin && isManager; // If I am a Head, I don't see other Heads
        boolean excludeSelf = isGlobalAdmin; // Director excludes self, Head includes self

        List<UserRoleOrgUnit> currentAssignments = userRoleOrgUnitRepository.findByUserId(currentUser.getId());
        UUID organizationId = null;
        Integer currentUserRank = currentAssignments.stream()
                .map(a -> a.getRole().getRank())
                .filter(java.util.Objects::nonNull)
                .min(Integer::compare)
                .orElse(2);

        if (!currentAssignments.isEmpty()) {
            organizationId = currentAssignments.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
        }

        Page<User> userPage = userRepository.searchUsers(
            isGlobalAdmin, 
            organizationId,
            allowedOrgUnitIds, 
            keyword, 
            roleName, 
            orgUnitPath, 
            currentUser.getId(),
            currentUserRank,
            excludeSelf,
            excludeAdmin,
            excludeManager,
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
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "id", userId));

        if (!currentUser.getId().equals(userId) && !permissionChecker.isGlobalAdmin(currentUser.getId())) {
            List<UserRoleOrgUnit> targetUserAssignments = userRoleOrgUnitRepository.findByUserId(userId);
            boolean hasAccess = targetUserAssignments.stream()
                    .anyMatch(a -> permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "USER:VIEW", a.getOrgUnit().getId()));
            
            if (!hasAccess) {
                throw new com.kpitracking.exception.ForbiddenException("Bạn không có quyền xem thông tin người dùng này");
            }
        }
        return toResponse(targetUser);
    }

    @Transactional
    public UserResponse updateUser(UUID userId, UpdateUserRequest request) {
        User currentUser = getCurrentUser();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "id", userId));

        if (!currentUser.getId().equals(userId) && !permissionChecker.isGlobalAdmin(currentUser.getId())) {
            List<UserRoleOrgUnit> targetUserAssignments = userRoleOrgUnitRepository.findByUserId(userId);
            boolean hasAccess = targetUserAssignments.stream()
                    .anyMatch(a -> permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "USER:UPDATE", a.getOrgUnit().getId()));
            
            if (!hasAccess) {
                throw new com.kpitracking.exception.ForbiddenException("Bạn không có quyền chỉnh sửa người dùng này");
            }
        }

        if (request.getFullName() != null) {
            user.setFullName(request.getFullName());
        }
        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.getEmail())) {
                throw new DuplicateResourceException("Người dùng", "email", request.getEmail());
            }
            user.setEmail(request.getEmail());
        }
        if (request.getPhone() != null) {
            user.setPhone(request.getPhone());
        }
        if (request.getEmployeeCode() != null) {
            String code = request.getEmployeeCode().trim();
            if (!code.isBlank() && userRepository.existsByEmployeeCodeAndIdNot(code, userId)) {
                throw new BusinessException("Mã nhân viên '" + code + "' đã được sử dụng bởi nhân sự khác");
            }
            user.setEmployeeCode(code);
        }
        if (request.getStatus() != null) {
            user.setStatus(request.getStatus());
        }

        if (request.getOrgUnitId() != null || request.getRole() != null) {
            List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
            OrgUnit unit = null;
            com.kpitracking.entity.Role role = null;

            if (request.getOrgUnitId() != null) {
                unit = orgUnitRepository.findById(request.getOrgUnitId())
                        .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", request.getOrgUnitId()));
            } else if (!assignments.isEmpty()) {
                unit = assignments.get(0).getOrgUnit();
            }

            if (request.getRole() != null) {
                UUID orgId = unit.getOrgHierarchyLevel().getOrganization().getId();
                role = resolveRole(request.getRole(), orgId);
            } else if (!assignments.isEmpty()) {
                role = assignments.get(0).getRole();
            }

            if (unit != null && role != null) {
                userRoleOrgUnitRepository.deleteByUserId(userId);
                validateManagerAssignment(unit.getId(), role, userId);
                validateManagerRequirement(unit, role);
                
                assignToUnitAndImmediateParent(user, unit, role, currentUser);
            }
        }

        user = userRepository.save(user);
        return toResponse(user);
    }

    @Transactional
    public void deleteUser(UUID userId) {
        User currentUser = getCurrentUser();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "id", userId));

        if (!permissionChecker.isGlobalAdmin(currentUser.getId())) {
            List<UserRoleOrgUnit> targetUserAssignments = userRoleOrgUnitRepository.findByUserId(userId);
            boolean hasAccess = targetUserAssignments.stream()
                    .anyMatch(a -> permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "USER:DELETE", a.getOrgUnit().getId()));
            
            if (!hasAccess) {
                throw new com.kpitracking.exception.ForbiddenException("Bạn không có quyền xoá người dùng này");
            }
        }

        user.setDeletedAt(Instant.now());
        userRepository.save(user);
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
            throw new BusinessException("Chỉ hỗ trợ tập tin định dạng .csv và .xlsx");
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

                    if (headerRow == null) throw new BusinessException("Tập tin Excel trống");

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
                        throw new BusinessException("Thiếu các cột bắt buộc: Email, FullName");
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
                                com.kpitracking.entity.Role role = resolveRoleInternal(roleName, organizationId);
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
                                throw new BusinessException(String.format(
                                    "Đơn vị '%s' (%s) chưa có nhân sự đảm nhiệm vai trò Trưởng đơn vị (Rank 0). Vui lòng bổ sung quản lý trong tệp tin hoặc hệ thống.",
                                    unit.getName(), unit.getCode()
                                ));
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
            throw new BusinessException("Xử lý tập tin thất bại: " + e.getMessage());
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
        if (email == null || email.isBlank()) throw new BusinessException("Email là bắt buộc");
        if (fullName == null || fullName.isBlank()) throw new BusinessException("Họ tên là bắt buộc");

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

        com.kpitracking.entity.Role role = resolveRoleInternal(roleIdStr, (UUID)organizationId);

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
                    .orElseThrow(() -> new BusinessException("Mã đơn vị không tồn tại: " + orgUnitCode));
            
            // Only assign if it's different from the default unit OR if we want to ensure the role is applied here
            // To be safe, if it's the same unit, the Role in Excel should override the Staff role
            assignUserToUnitInternal(user, role, specificUnit.getId());
            if (!assignedUnits.contains(specificUnit.getId())) {
                assignedUnits.add(specificUnit.getId());
            }
        }
        return assignedUnits;
    }

    private User createOrUpdateUserInternal(String email, String fullName, String phone, String employeeCode, String password) {
        Optional<User> existingUser = userRepository.findByEmail(email);
        if (existingUser.isPresent()) {
            User user = existingUser.get();
            if (fullName != null && !fullName.isBlank()) user.setFullName(fullName);
            if (phone != null) user.setPhone(phone);
            if (employeeCode != null && !employeeCode.isBlank()) {
                String code = employeeCode.trim();
                if (userRepository.existsByEmployeeCodeAndIdNot(code, user.getId())) {
                    throw new BusinessException("Mã nhân viên '" + code + "' đã được sử dụng bởi nhân sự khác (" + email + ")");
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
                if (userRepository.existsByEmployeeCode(code)) {
                    throw new BusinessException("Mã nhân viên '" + code + "' đã được sử dụng bởi nhân sự khác (" + email + ")");
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

    private void assignUserToUnitInternal(User user, com.kpitracking.entity.Role role, UUID orgUnitId) {
        OrgUnit unit = orgUnitRepository.findById(orgUnitId)
                .orElseThrow(() -> new BusinessException("Đơn vị không tồn tại"));
        
        UUID orgId = unit.getOrgHierarchyLevel().getOrganization().getId();
        // Root unit (Level 0) always gets Staff role by default in bulk operations
        com.kpitracking.entity.Role finalRole = (unit.getOrgHierarchyLevel() != null && unit.getOrgHierarchyLevel().getLevelOrder() == 0) 
            ? roleRepository.findByNameAndOrganizationId("Nhân viên", orgId).orElse(role) 
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

    private void validateManagerAssignment(UUID orgUnitId, com.kpitracking.entity.Role role, UUID excludeUserId) {
        if (role.getRank() != null && (role.getRank() == 0 || role.getRank() == 1)) {
            Integer rank = role.getRank();
            
            List<UserRoleOrgUnit> existing = (excludeUserId != null) 
                ? userRoleOrgUnitRepository.findByOrgUnitIdAndRoleRankAndUserIdNot(orgUnitId, rank, excludeUserId)
                : userRoleOrgUnitRepository.findByOrgUnitIdAndRoleRank(orgUnitId, rank);
            
            if (!existing.isEmpty()) {
                UserRoleOrgUnit first = existing.get(0);
                String currentName = first.getUser().getFullName();
                String currentRole = first.getRole().getName();
                String rankName = (rank == 0) ? "Cấp Trưởng" : "Cấp Phó";
                
                throw new BusinessException(String.format(
                    "Đơn vị '%s' đã có %s đảm nhiệm vai trò %s (%s). Mỗi đơn vị chỉ được phép có tối đa một nhân sự ở cấp độ này.",
                    first.getOrgUnit().getName(), currentName, currentRole, rankName
                ));
            }
        }
    }

    private com.kpitracking.entity.Role resolveRoleInternal(String identifier, UUID organizationId) {
        if (identifier == null || identifier.isBlank()) {
            return roleRepository.findByNameAndOrganizationId("Nhân viên", organizationId)
                    .orElseThrow(() -> new BusinessException("Vai trò mặc định 'Nhân viên' không tồn tại cho tổ chức này"));
        }

        if (identifier.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")) {
            return roleRepository.findById(UUID.fromString(identifier))
                    .orElseThrow(() -> new BusinessException("Mã vai trò (UUID) không tồn tại: " + identifier));
        }

        return resolveRole(identifier, organizationId);
    }

    private com.kpitracking.entity.Role resolveRole(String roleName, UUID organizationId) {
        String name = (roleName != null && !roleName.isBlank()) ? roleName.trim() : "Nhân viên";
        String mappedName = name;
        if (name.equalsIgnoreCase("STAFF") || name.equalsIgnoreCase("NHAN_VIEN")) mappedName = "Nhân viên";
        else if (name.equalsIgnoreCase("HEAD") || name.equalsIgnoreCase("TRUONG_PHONG")) mappedName = "Trưởng phòng";
        else if (name.equalsIgnoreCase("DEPUTY") || name.equalsIgnoreCase("PHO_PHONG")) mappedName = "Phó phòng";
        else if (name.equalsIgnoreCase("LEADER") || name.equalsIgnoreCase("TRUONG_NHOM")) mappedName = "Trưởng nhóm";
        else if (name.equalsIgnoreCase("DIRECTOR") || name.equalsIgnoreCase("GIAM_DOC")) mappedName = "Giám đốc";

        return roleRepository.findByNameAndOrganizationId(mappedName, organizationId)
                .or(() -> roleRepository.findByNameAndOrganizationId(name, organizationId))
                .or(() -> roleRepository.findByNameIgnoreCaseAndOrganizationId(name, organizationId))
                .orElseThrow(() -> new BusinessException("Chức danh '" + name + "' không tồn tại trong tổ chức này"));
    }

    private void validateManagerRequirement(OrgUnit orgUnit, com.kpitracking.entity.Role role) {
        if (role.getRank() != null && role.getRank() == 2) {
            if (orgUnit.getParent() != null && orgUnit.getOrgHierarchyLevel() != null) {
                if (!userRoleOrgUnitRepository.existsByOrgUnitIdAndRoleRank(orgUnit.getId(), 0)) {
                    throw new BusinessException("Đơn vị '" + orgUnit.getName() + "' chưa có người quản lý (Cấp trưởng - Rank 0).");
                }
            }
        }
    }

    private UUID getCurrentUserOrgId() {
        User cur = getCurrentUser();
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(cur.getId());
        if (assignments.isEmpty()) throw new BusinessException("Người dùng hiện tại không thuộc tổ chức nào");
        return assignments.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
    }
}
