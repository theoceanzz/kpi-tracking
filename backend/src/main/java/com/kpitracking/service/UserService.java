package com.kpitracking.service;

import com.kpitracking.dto.request.user.CreateUserRequest;
import com.kpitracking.dto.request.user.UpdateUserRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.user.UserResponse;
<<<<<<< HEAD
import com.kpitracking.dto.response.user.UserMembershipResponse;
import com.kpitracking.entity.Company;
=======
>>>>>>> 7681c6edbb52597770fb6dc8246115573f68d03b
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.exception.DuplicateResourceException;
import com.kpitracking.exception.ResourceNotFoundException;
<<<<<<< HEAD
import com.kpitracking.mapper.UserMapper;
import com.kpitracking.repository.CompanyRepository;
import com.kpitracking.repository.DepartmentMemberRepository;
=======
>>>>>>> 7681c6edbb52597770fb6dc8246115573f68d03b
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
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
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final DepartmentMemberRepository departmentMemberRepository;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    private List<String> getUserRoleNames(UUID userId) {
        return userRoleOrgUnitRepository.findByUserId(userId).stream()
                .map(uro -> uro.getRole().getName())
                .distinct()
                .toList();
    }

    private UserResponse toResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .avatarUrl(user.getAvatarUrl())
                .roles(getUserRoleNames(user.getId()))
                .status(user.getStatus())
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
                .phone(request.getPhone())
<<<<<<< HEAD
                .role(request.getRole())
                .isEmailVerified(true)
=======
>>>>>>> 7681c6edbb52597770fb6dc8246115573f68d03b
                .build();

        user = userRepository.save(user);
        
        try {
            emailService.sendAccountDetailsEmail(user.getEmail(), user.getFullName(), request.getPassword());
        } catch (Exception e) {
            // Silently log and continue, as the user is already created
        }

<<<<<<< HEAD
        return enrichWithMemberships(userMapper.toResponse(user));
    }

    private UserResponse enrichWithMemberships(UserResponse response) {
        List<UserMembershipResponse> memberships = departmentMemberRepository.findByUserId(response.getId()).stream()
                .map(dm -> UserMembershipResponse.builder()
                        .departmentId(dm.getDepartment().getId())
                        .departmentName(dm.getDepartment().getName())
                        .position(dm.getPosition())
                        .build())
                .toList();
        response.setMemberships(memberships);
        return response;
    }

    @Transactional(readOnly = true)
    public PageResponse<UserResponse> getUsers(int page, int size, String keyword, UUID departmentId) {
        UUID companyId = getCurrentCompanyId();
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        Page<User> userPage;
        if (departmentId != null) {
            if (keyword != null && !keyword.isBlank()) {
                userPage = userRepository.searchByDepartmentId(companyId, departmentId, keyword, pageable);
            } else {
                userPage = userRepository.findByDepartmentId(companyId, departmentId, pageable);
            }
        } else {
            if (keyword != null && !keyword.isBlank()) {
                userPage = userRepository.searchByCompanyId(companyId, keyword, pageable);
            } else {
                userPage = userRepository.findByCompanyId(companyId, pageable);
            }
        }

        return PageResponse.<UserResponse>builder()
                .content(userPage.getContent().stream()
                        .map(userMapper::toResponse)
                        .map(this::enrichWithMemberships)
                        .toList())
=======
        return toResponse(user);
    }

    @Transactional(readOnly = true)
    public PageResponse<UserResponse> getUsers(int page, int size, String keyword) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        Page<User> userPage;
        if (keyword != null && !keyword.isBlank()) {
            userPage = userRepository.searchByKeyword(keyword, pageable);
        } else {
            userPage = userRepository.findAll(pageable);
        }

        return PageResponse.<UserResponse>builder()
                .content(userPage.getContent().stream().map(this::toResponse).toList())
>>>>>>> 7681c6edbb52597770fb6dc8246115573f68d03b
                .page(userPage.getNumber())
                .size(userPage.getSize())
                .totalElements(userPage.getTotalElements())
                .totalPages(userPage.getTotalPages())
                .last(userPage.isLast())
                .build();
    }

    @Transactional(readOnly = true)
    public UserResponse getUserById(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
<<<<<<< HEAD
        return enrichWithMemberships(userMapper.toResponse(user));
=======
        return toResponse(user);
>>>>>>> 7681c6edbb52597770fb6dc8246115573f68d03b
    }

    @Transactional
    public UserResponse updateUser(UUID userId, UpdateUserRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        if (request.getFullName() != null) {
            user.setFullName(request.getFullName());
        }
        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.getEmail())) {
                throw new DuplicateResourceException("User", "email", request.getEmail());
            }
            user.setEmail(request.getEmail());
        }
        if (request.getPhone() != null) {
            user.setPhone(request.getPhone());
        }
        if (request.getStatus() != null) {
            user.setStatus(request.getStatus());
        }

        user = userRepository.save(user);
<<<<<<< HEAD
        return enrichWithMemberships(userMapper.toResponse(user));
=======
        return toResponse(user);
>>>>>>> 7681c6edbb52597770fb6dc8246115573f68d03b
    }

    @Transactional
    public void deleteUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
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
            throw new BusinessException("Only .csv and .xlsx files are supported");
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
<<<<<<< HEAD
                            String roleStr = csvRecord.isMapped("Role") ? csvRecord.get("Role") : "STAFF";
                            String password = csvRecord.isMapped("Password") ? csvRecord.get("Password") : null;

                            processUserRow(company, email, fullName, phone, roleStr, password);
=======

                            processUserRow(email, fullName, phone);
>>>>>>> 7681c6edbb52597770fb6dc8246115573f68d03b
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

                    if (headerRow == null) throw new BusinessException("Excel file is empty");

<<<<<<< HEAD
                    int emailIdx = -1, nameIdx = -1, phoneIdx = -1, roleIdx = -1, passIdx = -1;
=======
                    int emailIdx = -1, nameIdx = -1, phoneIdx = -1;
>>>>>>> 7681c6edbb52597770fb6dc8246115573f68d03b
                    for (int i = 0; i < headerRow.getLastCellNum(); i++) {
                        String header = headerRow.getCell(i).getStringCellValue().trim();
                        if (header.equalsIgnoreCase("Email")) emailIdx = i;
                        else if (header.equalsIgnoreCase("FullName")) nameIdx = i;
                        else if (header.equalsIgnoreCase("Phone")) phoneIdx = i;
<<<<<<< HEAD
                        else if (header.equalsIgnoreCase("Role")) roleIdx = i;
                        else if (header.equalsIgnoreCase("Password")) passIdx = i;
=======
>>>>>>> 7681c6edbb52597770fb6dc8246115573f68d03b
                    }

                    if (emailIdx == -1 || nameIdx == -1) {
                        throw new BusinessException("Missing required columns: Email, FullName");
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
<<<<<<< HEAD
                            String roleStr = (roleIdx != -1 && row.getCell(roleIdx) != null) ?
                                    row.getCell(roleIdx).getStringCellValue().trim() : "STAFF";
                            String password = (passIdx != -1 && row.getCell(passIdx) != null) ?
                                    row.getCell(passIdx).getStringCellValue().trim() : null;

                            processUserRow(company, email, fullName, phone, roleStr, password);
=======

                            processUserRow(email, fullName, phone);
>>>>>>> 7681c6edbb52597770fb6dc8246115573f68d03b
                            successfulImports++;
                        } catch (Exception e) {
                            errors.add("Row " + totalRows + ": " + e.getMessage());
                        }
                    }
                }
            }
        } catch (Exception e) {
            throw new BusinessException("Failed to process file: " + e.getMessage());
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

<<<<<<< HEAD
    private void processUserRow(Company company, String email, String fullName, String phone, String roleStr, String password) {
=======
    private void processUserRow(String email, String fullName, String phone) {
>>>>>>> 7681c6edbb52597770fb6dc8246115573f68d03b
        if (email == null || email.isBlank()) {
            throw new BusinessException("Email is required");
        }
        if (fullName == null || fullName.isBlank()) {
            throw new BusinessException("FullName is required");
        }

        if (userRepository.existsByEmail(email)) {
             throw new BusinessException("Email này đã tồn tại trong hệ thống: " + email);
        }

<<<<<<< HEAD
        UserRole role;
        try {
             role = UserRole.valueOf(roleStr.toUpperCase());
        } catch (IllegalArgumentException e) {
             role = UserRole.STAFF; // Default
        }

        String rawPassword = (password != null && !password.isBlank()) ? password : generateRandomPassword();
=======
        String rawPassword = generateRandomPassword();
>>>>>>> 7681c6edbb52597770fb6dc8246115573f68d03b

        User user = User.builder()
                .email(email)
                .password(passwordEncoder.encode(rawPassword))
                .fullName(fullName)
                .phone(phone)
<<<<<<< HEAD
                .role(role)
                .isEmailVerified(true)
=======
>>>>>>> 7681c6edbb52597770fb6dc8246115573f68d03b
                .build();

        userRepository.save(user);
        
        // Notify user of their credentials
        emailService.sendAccountDetailsEmail(email, fullName, rawPassword);
    }
}
