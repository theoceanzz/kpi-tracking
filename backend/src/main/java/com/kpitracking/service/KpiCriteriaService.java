package com.kpitracking.service;

import com.kpitracking.dto.request.kpi.CreateKpiCriteriaRequest;
import com.kpitracking.dto.request.kpi.RejectKpiRequest;
import com.kpitracking.dto.request.kpi.UpdateKpiCriteriaRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.kpi.KpiCriteriaResponse;
import com.kpitracking.dto.response.kpi.ImportKpiResponse;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.KpiFrequency;
import com.kpitracking.event.KpiCriteriaApprovedEvent;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.mapper.KpiCriteriaMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class KpiCriteriaService {

    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final UserRepository userRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final KpiCriteriaMapper kpiCriteriaMapper;
    private final ApplicationEventPublisher eventPublisher;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
    }

    private boolean hasRole(UUID userId, String roleName) {
        return userRoleOrgUnitRepository.findByUserId(userId).stream()
                .anyMatch(uro -> uro.getRole().getName().equalsIgnoreCase(roleName));
    }

    private boolean hasAnyRole(UUID userId, String... roleNames) {
        List<String> names = List.of(roleNames);
        return userRoleOrgUnitRepository.findByUserId(userId).stream()
                .anyMatch(uro -> names.stream().anyMatch(n -> n.equalsIgnoreCase(uro.getRole().getName())));
    }

    @Transactional
    public KpiCriteriaResponse createKpiCriteria(CreateKpiCriteriaRequest request) {
        User currentUser = getCurrentUser();
        boolean isDirector = hasRole(currentUser.getId(), "DIRECTOR");

        KpiStatus initialStatus = isDirector ? KpiStatus.APPROVED : KpiStatus.DRAFT;

        // Determine OrgUnit
        OrgUnit orgUnit = null;
        if (request.getOrgUnitId() != null) {
            orgUnit = orgUnitRepository.findById(request.getOrgUnitId())
                    .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", request.getOrgUnitId()));
        } else {
            List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(currentUser.getId());
            if (!assignments.isEmpty()) {
                orgUnit = assignments.get(0).getOrgUnit();
            } else {
                throw new BusinessException("Người dùng phải thuộc ít nhất một đơn vị để tạo KPI");
            }
        }

        // Logic check: only Director or Head of that OrgUnit can assign
        if (!isDirector) {
            boolean isHeadOfOrg = userRoleOrgUnitRepository.findByUserIdAndOrgUnitId(currentUser.getId(), orgUnit.getId())
                   .stream().anyMatch(uro -> uro.getRole().getName().equalsIgnoreCase("HEAD"));
            if (!isHeadOfOrg) {
                 throw new ForbiddenException("Trưởng phòng chỉ có thể thêm chỉ tiêu cho phòng ban của mình.");
            }
        }

        // Determine assignees
        java.util.List<User> assignees = new java.util.ArrayList<>();
        java.util.List<UUID> assigneeIds = new java.util.ArrayList<>();
        if (request.getAssignedToIds() != null && !request.getAssignedToIds().isEmpty()) {
            assigneeIds.addAll(request.getAssignedToIds());
        } else if (request.getAssignedToId() != null) {
            assigneeIds.add(request.getAssignedToId());
        }

        for (UUID assigneeId : assigneeIds) {
            User assignee = userRepository.findById(assigneeId)
                    .orElseThrow(() -> new ResourceNotFoundException("Người dùng (người được giao)", "id", assigneeId));

            if (!isDirector) {
                if (hasAnyRole(assignee.getId(), "DIRECTOR") || (hasAnyRole(assignee.getId(), "HEAD") && !assignee.getId().equals(currentUser.getId()))) {
                    throw new ForbiddenException("Trưởng phòng chỉ có thể giao chỉ tiêu cho bản thân hoặc cấp dưới.");
                }
            }
            assignees.add(assignee);
        }

        com.kpitracking.entity.KpiPeriod kpiPeriod = kpiPeriodRepository.findById(request.getKpiPeriodId())
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá (Đợt)", "id", request.getKpiPeriodId()));

        if (request.getFrequency().ordinal() > kpiPeriod.getPeriodType().ordinal()) {
            throw new BusinessException("Tần suất đánh giá (Tháng/Quý/Năm) phải nhỏ hơn hoặc bằng loại kỳ đánh giá (Đợt).");
        }

        KpiCriteria kpi = buildKpiEntity(request, orgUnit, assignees, currentUser, initialStatus, kpiPeriod);
        kpi = kpiCriteriaRepository.save(kpi);

        if (initialStatus == KpiStatus.APPROVED) {
            eventPublisher.publishEvent(new KpiCriteriaApprovedEvent(this, kpi));
        }

        return kpiCriteriaMapper.toResponse(kpi);
    }

    private KpiCriteria buildKpiEntity(CreateKpiCriteriaRequest request, OrgUnit orgUnit, java.util.List<User> assignees, User creator, KpiStatus status, com.kpitracking.entity.KpiPeriod kpiPeriod) {
        KpiCriteria kpi = KpiCriteria.builder()
                .orgUnit(orgUnit)
                .assignees(assignees)
                .name(request.getName())
                .description(request.getDescription())
                .weight(request.getWeight())
                .targetValue(request.getTargetValue())
                .minimumValue(request.getMinimumValue())
                .unit(request.getUnit())
                .frequency(request.getFrequency())
                .status(status)
                .createdBy(creator)
                .kpiPeriod(kpiPeriod)
                .build();

        if (status == KpiStatus.APPROVED) {
            kpi.setApprovedBy(creator);
            kpi.setApprovedAt(Instant.now());
        }
        return kpi;
    }

    @Transactional(readOnly = true)
    public PageResponse<KpiCriteriaResponse> getKpiCriteria(int page, int size, KpiStatus status, UUID orgUnitId, UUID createdById, UUID kpiPeriodId, String sortBy, String sortDir) {
        Sort sort = Sort.by(sortDir.equalsIgnoreCase("asc") ? Sort.Direction.ASC : Sort.Direction.DESC, sortBy != null ? sortBy : "createdAt");
        Pageable pageable = PageRequest.of(page, size, sort);

        String orgUnitPath = null;
        if (orgUnitId != null) {
            orgUnitPath = orgUnitRepository.findById(orgUnitId)
                    .map(com.kpitracking.entity.OrgUnit::getPath)
                    .map(path -> path + "%")
                    .orElse(null);
        }

        Page<KpiCriteria> kpiPage = kpiCriteriaRepository.findAllWithFilters(createdById, orgUnitPath, status, kpiPeriodId, pageable);

        return PageResponse.<KpiCriteriaResponse>builder()
                .content(kpiPage.getContent().stream().map(kpiCriteriaMapper::toResponse).toList())
                .page(kpiPage.getNumber())
                .size(kpiPage.getSize())
                .totalElements(kpiPage.getTotalElements())
                .totalPages(kpiPage.getTotalPages())
                .last(kpiPage.isLast())
                .build();
    }

    @Transactional(readOnly = true)
    public KpiCriteriaResponse getKpiCriteriaById(UUID kpiId) {
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", kpiId));
        return kpiCriteriaMapper.toResponse(kpi);
    }

    @Transactional
    public KpiCriteriaResponse updateKpiCriteria(UUID kpiId, UpdateKpiCriteriaRequest request) {
        User currentUser = getCurrentUser();
        boolean isDirector = hasRole(currentUser.getId(), "DIRECTOR");

        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", kpiId));

        if (!kpi.getCreatedBy().getId().equals(currentUser.getId()) && !isDirector) {
            throw new BusinessException("Chỉ người tạo hoặc GIÁM ĐỐC mới có quyền chỉnh sửa KPI này");
        }

        if (kpi.getStatus() != KpiStatus.DRAFT && kpi.getStatus() != KpiStatus.REJECTED) {
            throw new BusinessException("Chỉ có thể cập nhật KPI ở trạng thái NHÁP hoặc BỊ TỪ CHỐI");
        }

        if (request.getName() != null) kpi.setName(request.getName());
        if (request.getDescription() != null) kpi.setDescription(request.getDescription());
        if (request.getWeight() != null) kpi.setWeight(request.getWeight());
        if (request.getTargetValue() != null) kpi.setTargetValue(request.getTargetValue());
        if (request.getMinimumValue() != null) kpi.setMinimumValue(request.getMinimumValue());
        if (request.getUnit() != null) kpi.setUnit(request.getUnit());
        
        if (request.getKpiPeriodId() != null) {
            com.kpitracking.entity.KpiPeriod kpiPeriod = kpiPeriodRepository.findById(request.getKpiPeriodId())
                    .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá (Đợt)", "id", request.getKpiPeriodId()));
            kpi.setKpiPeriod(kpiPeriod);
        }

        if (request.getFrequency() != null) {
            if (request.getFrequency().ordinal() > kpi.getKpiPeriod().getPeriodType().ordinal()) {
                throw new BusinessException("Tần suất đánh giá (Tháng/Quý/Năm) phải nhỏ hơn hoặc bằng loại kỳ đánh giá (Đợt).");
            }
            kpi.setFrequency(request.getFrequency());
        }

        if (request.getOrgUnitId() != null) {
            OrgUnit orgUnit = orgUnitRepository.findById(request.getOrgUnitId())
                    .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", request.getOrgUnitId()));
            kpi.setOrgUnit(orgUnit);
        }

        if (request.getAssignedToIds() != null || request.getAssignedToId() != null) {
            java.util.List<UUID> assigneeIds = new java.util.ArrayList<>();
            if (request.getAssignedToIds() != null) {
                assigneeIds.addAll(request.getAssignedToIds());
            } else if (request.getAssignedToId() != null) {
                assigneeIds.add(request.getAssignedToId());
            }

            java.util.List<User> assignees = new java.util.ArrayList<>();
            for (UUID id : assigneeIds) {
                assignees.add(userRepository.findById(id)
                        .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "id", id)));
            }
            kpi.setAssignees(assignees);
        }

        kpi = kpiCriteriaRepository.save(kpi);
        return kpiCriteriaMapper.toResponse(kpi);
    }

    @Transactional
    public KpiCriteriaResponse submitForApproval(UUID kpiId) {
        User currentUser = getCurrentUser();
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", kpiId));

        if (!kpi.getCreatedBy().getId().equals(currentUser.getId())) {
             throw new BusinessException("Chỉ người tạo mới có quyền gửi duyệt KPI này");
        }

        if (kpi.getStatus() != KpiStatus.DRAFT && kpi.getStatus() != KpiStatus.REJECTED) {
            throw new BusinessException("Chỉ có thể gửi duyệt KPI ở trạng thái NHÁP hoặc BỊ TỪ CHỐI");
        }

        // Validate that total weight for this org unit and period is exactly 100%
        Double totalWeight = kpiCriteriaRepository.sumWeightByOrgUnitIdAndKpiPeriodIdAndStatusIn(
                kpi.getOrgUnit().getId(),
                kpi.getKpiPeriod().getId(),
                java.util.Arrays.asList(KpiStatus.DRAFT, KpiStatus.PENDING_APPROVAL, KpiStatus.APPROVED, KpiStatus.REJECTED)
        );

        if (totalWeight == null || Math.abs(totalWeight - 100.0) > 0.001) {
            throw new BusinessException("Tổng trọng số của tất cả KPI trong phòng ban/nhóm cho đợt này phải bằng chính xác 100%. Hiện tại: " + (totalWeight != null ? totalWeight : 0) + "%");
        }

        kpi.setStatus(KpiStatus.PENDING_APPROVAL);
        kpi.setSubmittedAt(Instant.now());
        kpi.setRejectReason(null);
        kpi = kpiCriteriaRepository.save(kpi);

        return kpiCriteriaMapper.toResponse(kpi);
    }

    @Transactional
    public KpiCriteriaResponse approveKpi(UUID kpiId) {
        User currentUser = getCurrentUser();

        if (!hasAnyRole(currentUser.getId(), "DIRECTOR", "HEAD")) {
            throw new ForbiddenException("Chỉ GIÁM ĐỐC hoặc TRƯỞNG PHÒNG mới có quyền phê duyệt chỉ tiêu KPI");
        }

        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", kpiId));

        if (kpi.getStatus() != KpiStatus.PENDING_APPROVAL) {
            throw new BusinessException("Chỉ có thể phê duyệt KPI ở trạng thái CHỜ PHÊ DUYỆT");
        }

        kpi.setStatus(KpiStatus.APPROVED);
        kpi.setApprovedBy(currentUser);
        kpi.setApprovedAt(Instant.now());
        kpi = kpiCriteriaRepository.save(kpi);

        eventPublisher.publishEvent(new KpiCriteriaApprovedEvent(this, kpi));

        return kpiCriteriaMapper.toResponse(kpi);
    }

    @Transactional
    public KpiCriteriaResponse rejectKpi(UUID kpiId, RejectKpiRequest request) {
        User currentUser = getCurrentUser();

        if (!hasAnyRole(currentUser.getId(), "DIRECTOR", "HEAD")) {
            throw new ForbiddenException("Chỉ GIÁM ĐỐC hoặc TRƯỞNG PHÒNG mới có quyền từ chối chỉ tiêu KPI");
        }

        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", kpiId));

        if (kpi.getStatus() != KpiStatus.PENDING_APPROVAL) {
            throw new BusinessException("Chỉ có thể từ chối KPI ở trạng thái CHỜ PHÊ DUYỆT");
        }

        kpi.setStatus(KpiStatus.REJECTED);
        kpi.setRejectReason(request.getReason());
        kpi.setApprovedBy(currentUser);
        kpi = kpiCriteriaRepository.save(kpi);

        return kpiCriteriaMapper.toResponse(kpi);
    }

    @Transactional
    public void deleteKpiCriteria(UUID kpiId) {
        User currentUser = getCurrentUser();
        boolean isDirector = hasRole(currentUser.getId(), "DIRECTOR");

        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", kpiId));

        if (!kpi.getCreatedBy().getId().equals(currentUser.getId()) && !isDirector) {
            throw new BusinessException("Chỉ người tạo hoặc GIÁM ĐỐC mới có quyền xóa KPI này");
        }
        kpi.setDeletedAt(Instant.now());
        kpiCriteriaRepository.save(kpi);
    }

    @Transactional(readOnly = true)
    public PageResponse<KpiCriteriaResponse> getMyKpi(int page, int size, UUID kpiPeriodId, String sortBy, String sortDir) {
        User currentUser = getCurrentUser();
        Sort sort = Sort.by(sortDir.equalsIgnoreCase("asc") ? Sort.Direction.ASC : Sort.Direction.DESC, sortBy != null ? sortBy : "createdAt");
        Pageable pageable = PageRequest.of(page, size, sort);

        Page<KpiCriteria> kpiPage;
        if (kpiPeriodId != null) {
            kpiPage = kpiCriteriaRepository.findByUserIdInAssigneesAndKpiPeriodId(
                    currentUser.getId(), kpiPeriodId, pageable);
        } else {
            kpiPage = kpiCriteriaRepository.findByUserIdInAssignees(
                    currentUser.getId(), pageable);
        }

        List<KpiCriteriaResponse> content = kpiPage.getContent().stream()
                .map(kpi -> {
                    KpiCriteriaResponse response = kpiCriteriaMapper.toResponse(kpi);
                    if (kpi.getSubmissions() != null) {
                        int userSubCount = (int) kpi.getSubmissions().stream()
                                .filter(s -> s.getDeletedAt() == null && 
                                        s.getSubmittedBy().getId().equals(currentUser.getId()) &&
                                        (s.getStatus() == com.kpitracking.enums.SubmissionStatus.PENDING || 
                                         s.getStatus() == com.kpitracking.enums.SubmissionStatus.APPROVED))
                                .count();
                        response.setSubmissionCount(userSubCount);
                    }
                    return response;
                })
                .toList();

        return PageResponse.<KpiCriteriaResponse>builder()
                .content(content)
                .page(kpiPage.getNumber())
                .size(kpiPage.getSize())
                .totalElements(kpiPage.getTotalElements())
                .totalPages(kpiPage.getTotalPages())
                .last(kpiPage.isLast())
                .build();
    }

    @Transactional(readOnly = true)
    public Double getTotalWeight(UUID orgUnitId, UUID kpiPeriodId) {
        return kpiCriteriaRepository.sumWeightByOrgUnitIdAndKpiPeriodIdAndStatusIn(
                orgUnitId,
                kpiPeriodId,
                java.util.Arrays.asList(KpiStatus.DRAFT, KpiStatus.PENDING_APPROVAL, KpiStatus.APPROVED, KpiStatus.REJECTED)
        );
    }

    @Transactional
    public ImportKpiResponse importKpis(MultipartFile file, UUID kpiPeriodId, UUID orgUnitId) {
        User currentUser = getCurrentUser();
        if (kpiPeriodId == null) throw new BusinessException("Vui lòng chọn Kỳ đánh giá trước khi import");
        if (orgUnitId == null) throw new BusinessException("Vui lòng chọn Đơn vị trước khi import");

        com.kpitracking.entity.KpiPeriod kpiPeriod = kpiPeriodRepository.findById(kpiPeriodId)
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá", "id", kpiPeriodId));
        OrgUnit orgUnit = orgUnitRepository.findById(orgUnitId)
                .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", orgUnitId));

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
                    for (CSVRecord record : csvParser) {
                        totalRows++;
                        try {
                            processKpiRow(record.get("Name"), record.get("Description"), record.get("Weight"), 
                                record.get("TargetValue"), record.isMapped("MinimumValue") ? record.get("MinimumValue") : null, 
                                record.get("Unit"), record.get("Frequency"), 
                                record.get("EmployeeCode"), kpiPeriod, orgUnit, currentUser);
                            successfulImports++;
                        } catch (Exception e) {
                            errors.add("Dòng " + totalRows + ": " + e.getMessage());
                        }
                    }
                }
            } else {
                try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
                    Sheet sheet = workbook.getSheetAt(0);
                    Row headerRow = sheet.getRow(0);
                    if (headerRow == null) throw new BusinessException("File Excel trống");

                    int nameIdx = -1, descIdx = -1, weightIdx = -1, targetIdx = -1, minIdx = -1, unitIdx = -1, freqIdx = -1, codeIdx = -1;
                    for (int i = 0; i < headerRow.getLastCellNum(); i++) {
                        String header = headerRow.getCell(i).getStringCellValue().trim();
                        if (header.equalsIgnoreCase("Name")) nameIdx = i;
                        else if (header.equalsIgnoreCase("Description")) descIdx = i;
                        else if (header.equalsIgnoreCase("Weight")) weightIdx = i;
                        else if (header.equalsIgnoreCase("TargetValue")) targetIdx = i;
                        else if (header.equalsIgnoreCase("MinimumValue")) minIdx = i;
                        else if (header.equalsIgnoreCase("Unit")) unitIdx = i;
                        else if (header.equalsIgnoreCase("Frequency")) freqIdx = i;
                        else if (header.equalsIgnoreCase("EmployeeCode")) codeIdx = i;
                    }

                    if (nameIdx == -1 || weightIdx == -1 || targetIdx == -1 || freqIdx == -1 || codeIdx == -1) {
                        throw new BusinessException("Thiếu các cột bắt buộc trong file Excel");
                    }

                    for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                        Row row = sheet.getRow(i);
                        if (row == null) continue;
                        totalRows++;
                        try {
                            processKpiRow(
                                getCellValueAsString(row.getCell(nameIdx)),
                                descIdx != -1 ? getCellValueAsString(row.getCell(descIdx)) : null,
                                getCellValueAsString(row.getCell(weightIdx)),
                                getCellValueAsString(row.getCell(targetIdx)),
                                minIdx != -1 ? getCellValueAsString(row.getCell(minIdx)) : null,
                                unitIdx != -1 ? getCellValueAsString(row.getCell(unitIdx)) : null,
                                getCellValueAsString(row.getCell(freqIdx)),
                                getCellValueAsString(row.getCell(codeIdx)),
                                kpiPeriod, orgUnit, currentUser
                            );
                            successfulImports++;
                        } catch (Exception e) {
                            errors.add("Dòng " + totalRows + ": " + e.getMessage());
                        }
                    }
                }
            }
        } catch (Exception e) {
            throw new BusinessException("Lỗi xử lý file: " + e.getMessage());
        }

        return ImportKpiResponse.builder()
                .totalRows(totalRows)
                .successfulImports(successfulImports)
                .errors(errors)
                .build();
    }

    private void processKpiRow(String name, String desc, String weight, String target, String min, String unit, String freq, String empCode, 
                              com.kpitracking.entity.KpiPeriod period, OrgUnit unitEntity, User creator) {
        if (name == null || name.isBlank()) throw new BusinessException("Tên chỉ tiêu là bắt buộc");
        
        User assignee = userRepository.findByEmployeeCode(empCode)
                .orElseThrow(() -> new BusinessException("Không tìm thấy nhân viên với mã: " + empCode));

        KpiFrequency frequency;
        try {
            frequency = KpiFrequency.valueOf(freq.toUpperCase());
        } catch (Exception e) {
            throw new BusinessException("Tần suất không hợp lệ: " + freq);
        }

        KpiCriteria kpi = KpiCriteria.builder()
                .name(name)
                .description(desc)
                .weight(Double.parseDouble(weight))
                .targetValue(Double.parseDouble(target))
                .minimumValue(min != null && !min.isBlank() ? Double.parseDouble(min) : null)
                .unit(unit)
                .frequency(frequency)
                .assignees(java.util.List.of(assignee))
                .orgUnit(unitEntity)
                .kpiPeriod(period)
                .createdBy(creator)
                .status(hasRole(creator.getId(), "DIRECTOR") ? KpiStatus.APPROVED : KpiStatus.DRAFT)
                .build();
        
        if (kpi.getStatus() == KpiStatus.APPROVED) {
            kpi.setApprovedBy(creator);
            kpi.setApprovedAt(Instant.now());
        }

        kpiCriteriaRepository.save(kpi);
    }

    private String getCellValueAsString(Cell cell) {
        if (cell == null) return null;
        switch (cell.getCellType()) {
            case STRING: return cell.getStringCellValue().trim();
            case NUMERIC: 
                if (DateUtil.isCellDateFormatted(cell)) return cell.getDateCellValue().toString();
                return String.valueOf((long) cell.getNumericCellValue());
            case BOOLEAN: return String.valueOf(cell.getBooleanCellValue());
            default: return "";
        }
    }
}
