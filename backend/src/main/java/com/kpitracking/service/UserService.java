package com.kpitracking.service;

import com.kpitracking.dto.request.user.CreateUserRequest;
import com.kpitracking.dto.request.user.UpdateUserRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.user.UserResponse;

import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.exception.DuplicateResourceException;
import com.kpitracking.exception.ResourceNotFoundException;

import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.repository.OrgHierarchyLevelRepository;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.OrgHierarchyLevel;
import com.kpitracking.dto.response.user.UserMembershipResponse;
import java.util.stream.Collectors;
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
    private final PermissionChecker permissionChecker;

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
                    List<OrgHierarchyLevel> levels = orgHierarchyLevelRepository
                            .findByOrganizationIdOrderByLevelOrderAsc(unit.getOrgHierarchyLevel().getOrganization().getId());

                    String roleLabel = levels.stream()
                            .filter(l -> l.getLevelOrder().equals(unit.getOrgHierarchyLevel().getLevelOrder()))
                            .map(OrgHierarchyLevel::getManagerRoleLabel)
                            .findFirst()
                            .orElse(roleName);
                    
                    if (roleName.equals("DEPUTY")) {
                        if (roleLabel != null) {
                            if (roleLabel.contains("Trưởng")) {
                                roleLabel = roleLabel.replace("Trưởng", "Phó");
                            } else if (roleLabel.contains("trưởng")) {
                                roleLabel = roleLabel.replace("trưởng", "phó");
                            } else {
                                roleLabel = "Phó " + roleLabel;
                            }
                        }
                    } else if (roleName.equals("STAFF")) {
                        roleLabel = "Nhân viên";
                    }

                    return UserMembershipResponse.builder()
                        .orgUnitId(unit.getId())
                        .organizationId(unit.getOrgHierarchyLevel().getOrganization().getId())
                        .orgUnitName(unit.getName())
                        .organizationName(unit.getOrgHierarchyLevel().getOrganization().getName())
                        .roleName(roleName)
                        .roleLabel(roleLabel)
                        .unitTypeLabel(unit.getOrgHierarchyLevel().getUnitTypeName())
                        .build();
                })
                .collect(Collectors.toList());

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
                .build();
    }

    @Transactional
    public UserResponse createUser(CreateUserRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException("Email này đã tồn tại trong hệ thống: " + request.getEmail());
        }

        User user = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .employeeCode(request.getEmployeeCode())
                .phone(request.getPhone())
                .isEmailVerified(true)
                .build();

        user = userRepository.save(user);
        
        try {
            emailService.sendAccountDetailsEmail(user.getEmail(), user.getFullName(), request.getPassword());
        } catch (Exception e) {
            // Silently log and continue, as the user is already created
        }

        return toResponse(user);
    }

    @Transactional(readOnly = true)
    public PageResponse<UserResponse> getUsers(int page, int size, String keyword, UUID orgUnitId, String role, String sortBy, String direction) {
        User currentUser = getCurrentUser();
        boolean isGlobalAdmin = permissionChecker.isGlobalAdmin(currentUser.getId());
        List<UUID> allowedOrgUnitIds = permissionChecker.getOrgUnitsWithPermission(currentUser.getId(), "USER:VIEW");

        Sort sort = Sort.by(direction.equalsIgnoreCase("desc") ? Sort.Direction.DESC : Sort.Direction.ASC, sortBy != null ? sortBy : "createdAt");
        Pageable pageable = PageRequest.of(page, size, sort);

        String orgUnitPath = null;
        if (orgUnitId != null) {
            orgUnitPath = orgUnitRepository.findById(orgUnitId)
                    .map(OrgUnit::getPath)
                    .map(path -> path + "%")
                    .orElse(null);
        }

        String roleName = (role == null || role.equals("ALL")) ? null : role;
        Page<User> userPage = userRepository.searchUsers(isGlobalAdmin, allowedOrgUnitIds, keyword, roleName, orgUnitPath, pageable);

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
            user.setEmployeeCode(request.getEmployeeCode());
        }
        if (request.getStatus() != null) {
            user.setStatus(request.getStatus());
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
    public ImportUserResponse importUsers(MultipartFile file) {
        String filename = file.getOriginalFilename();
        if (filename == null || (!filename.endsWith(".csv") && !filename.endsWith(".xlsx"))) {
            throw new BusinessException("Chỉ hỗ trợ tập tin định dạng .csv và .xlsx");
        }

        List<String> errors = new ArrayList<>();
        int successfulImports = 0;
        int totalRows = 0;

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
                            processUserRow(email, fullName, phone, employeeCode);
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

                    int emailIdx = -1, nameIdx = -1, phoneIdx = -1, codeIdx = -1;
                    for (int i = 0; i < headerRow.getLastCellNum(); i++) {
                        String header = headerRow.getCell(i).getStringCellValue().trim();
                        if (header.equalsIgnoreCase("Email")) emailIdx = i;
                        else if (header.equalsIgnoreCase("FullName")) nameIdx = i;
                        else if (header.equalsIgnoreCase("Phone")) phoneIdx = i;
                        else if (header.equalsIgnoreCase("EmployeeCode")) codeIdx = i;

                    }

                    if (emailIdx == -1 || nameIdx == -1) {
                        throw new BusinessException("Thiếu các cột bắt buộc: Email, FullName");
                    }

                    for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                        Row row = sheet.getRow(i);
                        if (row == null) continue;
                        totalRows++;

                        try {
                            String email = row.getCell(emailIdx) != null ? row.getCell(emailIdx).getStringCellValue().trim() : "";
                            String fullName = row.getCell(nameIdx) != null ? row.getCell(nameIdx).getStringCellValue().trim() : "";
                            String phone = (phoneIdx != -1 && row.getCell(phoneIdx) != null) ?
                                    getCellValueAsString(row.getCell(phoneIdx)) : null;
                            String employeeCode = (codeIdx != -1 && row.getCell(codeIdx) != null) ?
                                    getCellValueAsString(row.getCell(codeIdx)) : null;
                            processUserRow(email, fullName, phone, employeeCode);
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

    private void processUserRow(String email, String fullName, String phone, String employeeCode) {
        if (email == null || email.isBlank()) {
            throw new BusinessException("Email là bắt buộc");
        }
        if (fullName == null || fullName.isBlank()) {
            throw new BusinessException("Họ tên là bắt buộc");
        }

        if (userRepository.existsByEmail(email)) {
             throw new BusinessException("Email này đã tồn tại trong hệ thống: " + email);
        }

        String rawPassword = generateRandomPassword();

        User user = User.builder()
                .email(email)
                .password(passwordEncoder.encode(rawPassword))
                .fullName(fullName)
                .phone(phone)
                .employeeCode(employeeCode)

                .build();

        userRepository.save(user);
        
        // Notify user of their credentials
        emailService.sendAccountDetailsEmail(email, fullName, rawPassword);
    }
}
