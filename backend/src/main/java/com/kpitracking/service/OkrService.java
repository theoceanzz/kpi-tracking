package com.kpitracking.service;

import com.kpitracking.dto.request.okr.KeyResultRequest;
import com.kpitracking.dto.request.okr.ObjectiveRequest;
import com.kpitracking.dto.response.okr.ImportOkrResponse;
import com.kpitracking.dto.response.okr.KeyResultResponse;
import com.kpitracking.dto.response.okr.ObjectiveResponse;
import com.kpitracking.entity.KeyResult;
import com.kpitracking.entity.Objective;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.enums.OkrStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.DuplicateResourceException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.KeyResultRepository;
import com.kpitracking.repository.KpiSubmissionRepository;
import com.kpitracking.repository.ObjectiveRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.enums.SubmissionStatus;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OkrService {

    private final ObjectiveRepository objectiveRepository;
    private final KeyResultRepository keyResultRepository;
    private final KpiSubmissionRepository submissionRepository;
    private final OrganizationRepository organizationRepository;
    private final OrgUnitRepository orgUnitRepository;

    @Transactional(readOnly = true)
    public List<ObjectiveResponse> getObjectivesByOrganization(UUID organizationId) {
        return objectiveRepository.findByOrganizationId(organizationId).stream()
                .map(this::mapToObjectiveResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ObjectiveResponse> getObjectivesByOrgUnit(UUID orgUnitId) {
        return objectiveRepository.findByOrgUnitId(orgUnitId).stream()
                .map(this::mapToObjectiveResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public ObjectiveResponse createObjective(UUID organizationId, ObjectiveRequest request) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization not found"));

        OrgUnit orgUnit = null;
        if (request.getOrgUnitId() != null) {
            orgUnit = orgUnitRepository.findById(request.getOrgUnitId())
                    .orElseThrow(() -> new ResourceNotFoundException("OrgUnit not found"));
        }

        if (orgUnit != null && objectiveRepository.existsByOrganizationIdAndCodeAndOrgUnit(organizationId, request.getCode(), orgUnit)) {
            throw new DuplicateResourceException("Mục tiêu", "mã", request.getCode() + " tại đơn vị " + orgUnit.getName());
        } else if (orgUnit == null && objectiveRepository.existsByOrganizationIdAndCode(organizationId, request.getCode())) {
            // If no unit, fall back to organization-wide uniqueness (for root/general objectives)
            throw new DuplicateResourceException("Mục tiêu", "mã", request.getCode());
        }

        Objective objective = Objective.builder()
                .organization(organization)
                .orgUnit(orgUnit)
                .code(request.getCode())
                .name(request.getName())
                .description(request.getDescription())
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .status(request.getStatus())
                .build();

        return mapToObjectiveResponse(objectiveRepository.save(objective));
    }

    @Transactional
    public ObjectiveResponse updateObjective(UUID objectiveId, ObjectiveRequest request) {
        Objective objective = objectiveRepository.findById(objectiveId)
                .orElseThrow(() -> new ResourceNotFoundException("Objective not found"));

        OrgUnit nextOrgUnit = null;
        if (request.getOrgUnitId() != null) {
            nextOrgUnit = orgUnitRepository.findById(request.getOrgUnitId())
                    .orElseThrow(() -> new ResourceNotFoundException("OrgUnit not found"));
        }

        if (nextOrgUnit != null && objectiveRepository.existsByOrganizationIdAndCodeAndOrgUnitAndIdNot(objective.getOrganization().getId(), request.getCode(), nextOrgUnit, objectiveId)) {
            throw new DuplicateResourceException("Mục tiêu", "mã", request.getCode() + " tại đơn vị " + nextOrgUnit.getName());
        } else if (nextOrgUnit == null && objectiveRepository.existsByOrganizationIdAndCodeAndIdNot(objective.getOrganization().getId(), request.getCode(), objectiveId)) {
            throw new DuplicateResourceException("Mục tiêu", "mã", request.getCode());
        }

        objective.setCode(request.getCode());
        objective.setName(request.getName());
        objective.setDescription(request.getDescription());
        objective.setStartDate(request.getStartDate());
        objective.setEndDate(request.getEndDate());
        
        if (request.getOrgUnitId() != null) {
            OrgUnit orgUnit = orgUnitRepository.findById(request.getOrgUnitId())
                    .orElseThrow(() -> new ResourceNotFoundException("OrgUnit not found"));
            objective.setOrgUnit(orgUnit);
        } else {
            objective.setOrgUnit(null);
        }

        if (request.getStatus() != null) {
            objective.setStatus(request.getStatus());
        }

        return mapToObjectiveResponse(objectiveRepository.save(objective));
    }

    @Transactional
    public void deleteObjective(UUID objectiveId) {
        Objective objective = objectiveRepository.findById(objectiveId)
                .orElseThrow(() -> new ResourceNotFoundException("Objective not found"));
        objectiveRepository.delete(objective);
    }

    @Transactional
    public KeyResultResponse createKeyResult(KeyResultRequest request) {
        Objective objective = objectiveRepository.findById(request.getObjectiveId())
                .orElseThrow(() -> new ResourceNotFoundException("Objective not found"));

        if (keyResultRepository.existsByObjectiveOrganizationIdAndCode(objective.getOrganization().getId(), request.getCode())) {
            throw new DuplicateResourceException("Kết quả then chốt", "mã", request.getCode());
        }

        KeyResult keyResult = KeyResult.builder()
                .objective(objective)
                .code(request.getCode())
                .name(request.getName())
                .description(request.getDescription())
                .targetValue(request.getTargetValue())
                .currentValue(request.getCurrentValue() != null ? request.getCurrentValue() : 0.0)
                .unit(request.getUnit())
                .build();

        return mapToKeyResultResponse(keyResultRepository.save(keyResult));
    }

    @Transactional
    public KeyResultResponse updateKeyResult(UUID keyResultId, KeyResultRequest request) {
        KeyResult keyResult = keyResultRepository.findById(keyResultId)
                .orElseThrow(() -> new ResourceNotFoundException("Key Result not found"));

        if (keyResultRepository.existsByObjectiveOrganizationIdAndCodeAndIdNot(keyResult.getObjective().getOrganization().getId(), request.getCode(), keyResultId)) {
            throw new DuplicateResourceException("Kết quả then chốt", "mã", request.getCode());
        }

        keyResult.setCode(request.getCode());
        keyResult.setName(request.getName());
        keyResult.setDescription(request.getDescription());
        keyResult.setTargetValue(request.getTargetValue());
        keyResult.setCurrentValue(request.getCurrentValue());
        keyResult.setUnit(request.getUnit());

        return mapToKeyResultResponse(keyResultRepository.save(keyResult));
    }

    @Transactional
    public void deleteKeyResult(UUID keyResultId) {
        KeyResult keyResult = keyResultRepository.findById(keyResultId)
                .orElseThrow(() -> new ResourceNotFoundException("Key Result not found"));
        keyResultRepository.delete(keyResult);
    }

    @Transactional
    public ImportOkrResponse importOkrs(UUID organizationId, MultipartFile file) {
        String filename = file.getOriginalFilename();
        if (filename == null || !filename.endsWith(".xlsx")) {
            throw new BusinessException("Chỉ hỗ trợ tập tin định dạng .xlsx");
        }

        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization not found"));

        List<String> errors = new ArrayList<>();
        int successfulImports = 0;
        int totalRows = 0;

        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            Row headerRow = sheet.getRow(0);

            if (headerRow == null) throw new BusinessException("Tập tin Excel trống");

            // Mapping columns
            int objCodeIdx = -1, objNameIdx = -1, objDescIdx = -1, objStartIdx = -1, objEndIdx = -1, objOrgUnitCodeIdx = -1;
            int krCodeIdx = -1, krNameIdx = -1, krDescIdx = -1, krTargetIdx = -1, krUnitIdx = -1;

            for (int i = 0; i < headerRow.getLastCellNum(); i++) {
                String header = getCellValueAsString(headerRow.getCell(i));
                if (header.equalsIgnoreCase("ObjectiveCode")) objCodeIdx = i;
                else if (header.equalsIgnoreCase("ObjectiveName")) objNameIdx = i;
                else if (header.equalsIgnoreCase("ObjectiveDescription")) objDescIdx = i;
                else if (header.equalsIgnoreCase("ObjectiveStartDate")) objStartIdx = i;
                else if (header.equalsIgnoreCase("ObjectiveEndDate")) objEndIdx = i;
                else if (header.equalsIgnoreCase("ObjectiveOrgUnitCode") || header.equalsIgnoreCase("OrgUnitCode")) objOrgUnitCodeIdx = i;
                else if (header.equalsIgnoreCase("KeyResultCode")) krCodeIdx = i;
                else if (header.equalsIgnoreCase("KeyResultName")) krNameIdx = i;
                else if (header.equalsIgnoreCase("KeyResultDescription")) krDescIdx = i;
                else if (header.equalsIgnoreCase("KeyResultTarget")) krTargetIdx = i;
                else if (header.equalsIgnoreCase("KeyResultUnit")) krUnitIdx = i;
            }

            if (objCodeIdx == -1 || objNameIdx == -1 || krCodeIdx == -1 || krNameIdx == -1) {
                throw new BusinessException("Thiếu các cột bắt buộc: ObjectiveCode, ObjectiveName, KeyResultCode, KeyResultName");
            }

            List<Objective> currentObjectives = new ArrayList<>();

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null || isRowEmpty(row)) continue;
                totalRows++;

                try {
                    String objCode = getCellValueAsString(row.getCell(objCodeIdx));
                    String krCode = getCellValueAsString(row.getCell(krCodeIdx));

                    // 1. Process Objective if objCode is provided
                    if (objCode != null && !objCode.isBlank()) {
                        String objName = getCellValueAsString(row.getCell(objNameIdx));
                        String objDesc = getCellValueAsString(row.getCell(objDescIdx));
                        LocalDate startDate = getCellValueAsLocalDate(row.getCell(objStartIdx));
                        LocalDate endDate = getCellValueAsLocalDate(row.getCell(objEndIdx));

                        String objOrgUnitCode = objOrgUnitCodeIdx != -1 ? getCellValueAsString(row.getCell(objOrgUnitCodeIdx)) : null;
                        
                        List<OrgUnit> targetUnits = new java.util.ArrayList<>();
                        if (objOrgUnitCode != null && !objOrgUnitCode.isBlank()) {
                            String[] codes = objOrgUnitCode.split(",");
                            for (String code : codes) {
                                String trimmedCode = code.trim();
                                if (trimmedCode.isEmpty()) continue;
                                
                                Optional<OrgUnit> unitOpt = orgUnitRepository.findByCodeSmart(trimmedCode, organizationId);
                                if (unitOpt.isPresent()) {
                                    OrgUnit unit = unitOpt.get();
                                    if (unit.getParent() == null) {
                                        // Root unit: add it and all sub-units
                                        targetUnits.addAll(orgUnitRepository.findByOrgHierarchyLevel_Organization_IdAndDeletedAtIsNull(organizationId));
                                    } else {
                                        targetUnits.add(unit);
                                    }
                                }
                            }
                        }
                        
                        // Default to Root unit if no valid units found
                        if (targetUnits.isEmpty()) {
                            List<OrgUnit> roots = orgUnitRepository.findRootsByOrganizationId(organizationId);
                            if (!roots.isEmpty()) {
                                targetUnits.add(roots.get(0));
                            }
                        }

                        // Dedup target units
                        targetUnits = targetUnits.stream().distinct().collect(Collectors.toList());
                        currentObjectives.clear();

                        for (OrgUnit targetUnit : targetUnits) {
                            Optional<Objective> existingObj = objectiveRepository.findByOrganizationIdAndCodeAndOrgUnit(organizationId, objCode, targetUnit);

                            Objective objective;
                            if (existingObj.isPresent()) {
                                objective = existingObj.get();
                                objective.setName(objName);
                                if (objDesc != null) objective.setDescription(objDesc);
                                if (startDate != null) objective.setStartDate(startDate);
                                if (endDate != null) objective.setEndDate(endDate);
                            } else {
                                objective = Objective.builder()
                                        .organization(organization)
                                        .code(objCode)
                                        .name(objName)
                                        .description(objDesc)
                                        .startDate(startDate)
                                        .endDate(endDate)
                                        .orgUnit(targetUnit)
                                        .status(OkrStatus.ACTIVE)
                                        .build();
                            }
                            currentObjectives.add(objectiveRepository.save(objective));
                        }
                    }

                    if (currentObjectives.isEmpty()) {
                        errors.add("Dòng " + (i + 1) + ": Thiếu thông tin Mục tiêu trước khi thêm Kết quả then chốt");
                        continue;
                    }

                    // 2. Process Key Result for all current objectives
                    String krName = getCellValueAsString(row.getCell(krNameIdx));
                    String krDesc = getCellValueAsString(row.getCell(krDescIdx));
                    Double krTarget = getCellValueAsDouble(row.getCell(krTargetIdx));
                    String krUnit = getCellValueAsString(row.getCell(krUnitIdx));

                    for (Objective targetObj : currentObjectives) {
                        Optional<KeyResult> existingKr = keyResultRepository.findByObjectiveId(targetObj.getId()).stream()
                                .filter(kr -> krCode.equals(kr.getCode()))
                                .findFirst();

                        KeyResult kr;
                        if (existingKr.isPresent()) {
                            kr = existingKr.get();
                            kr.setName(krName);
                            if (krDesc != null) kr.setDescription(krDesc);
                            if (krTarget != null) kr.setTargetValue(krTarget);
                            if (krUnit != null) kr.setUnit(krUnit);
                        } else {
                            kr = KeyResult.builder()
                                    .objective(targetObj)
                                    .code(krCode)
                                    .name(krName)
                                    .description(krDesc)
                                    .targetValue(krTarget != null ? krTarget : 0.0)
                                    .currentValue(0.0)
                                    .unit(krUnit)
                                    .build();
                        }
                        keyResultRepository.save(kr);
                    }
                    successfulImports++;

                } catch (Exception e) {
                    errors.add("Dòng " + (i + 1) + ": " + e.getMessage());
                }
            }

        } catch (Exception e) {
            throw new BusinessException("Xử lý tập tin thất bại: " + e.getMessage());
        }

        return ImportOkrResponse.builder()
                .totalRows(totalRows)
                .successfulImports(successfulImports)
                .errors(errors)
                .build();
    }

    private String getCellValueAsString(Cell cell) {
        if (cell == null) return "";
        switch (cell.getCellType()) {
            case STRING: return cell.getStringCellValue().trim();
            case NUMERIC: 
                if (DateUtil.isCellDateFormatted(cell)) {
                    return cell.getLocalDateTimeCellValue().toLocalDate().toString();
                }
                return String.valueOf((long) cell.getNumericCellValue());
            case BOOLEAN: return String.valueOf(cell.getBooleanCellValue());
            case FORMULA: return cell.getCellFormula();
            default: return "";
        }
    }

    private LocalDate getCellValueAsLocalDate(Cell cell) {
        if (cell == null) return null;
        if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            return cell.getLocalDateTimeCellValue().toLocalDate();
        }
        try {
            String value = getCellValueAsString(cell);
            if (value.isBlank()) return null;
            return LocalDate.parse(value);
        } catch (Exception e) {
            return null;
        }
    }

    private Double getCellValueAsDouble(Cell cell) {
        if (cell == null) return null;
        if (cell.getCellType() == CellType.NUMERIC) return cell.getNumericCellValue();
        try {
            String value = getCellValueAsString(cell);
            if (value.isBlank()) return null;
            return Double.parseDouble(value);
        } catch (Exception e) {
            return null;
        }
    }

    private boolean isRowEmpty(Row row) {
        for (int c = row.getFirstCellNum(); c < row.getLastCellNum(); c++) {
            Cell cell = row.getCell(c);
            if (cell != null && cell.getCellType() != CellType.BLANK) return false;
        }
        return true;
    }

    private ObjectiveResponse mapToObjectiveResponse(Objective objective) {
        return ObjectiveResponse.builder()
                .id(objective.getId())
                .code(objective.getCode())
                .name(objective.getName())
                .description(objective.getDescription())
                .startDate(objective.getStartDate())
                .endDate(objective.getEndDate())
                .status(objective.getStatus())
                .orgUnitId(objective.getOrgUnit() != null ? objective.getOrgUnit().getId() : null)
                .orgUnitName(objective.getOrgUnit() != null ? objective.getOrgUnit().getName() : null)
                .keyResults(objective.getKeyResults().stream()
                        .map(this::mapToKeyResultResponse)
                        .collect(Collectors.toList()))
                .build();
    }

    private KeyResultResponse mapToKeyResultResponse(KeyResult keyResult) {
        // Calculate currentValue from approved KPI submissions
        double totalApprovedActual = 0.0;
        boolean hasLinkedKpis = keyResult.getKpis() != null && !keyResult.getKpis().isEmpty();
        
        if (hasLinkedKpis) {
            for (var kpi : keyResult.getKpis()) {
                totalApprovedActual += submissionRepository
                    .findByKpiCriteriaIdAndDeletedAtIsNull(kpi.getId()).stream()
                    .filter(s -> s.getStatus() == SubmissionStatus.APPROVED)
                    .mapToDouble(s -> s.getActualValue() != null ? s.getActualValue() : 0.0)
                    .sum();
            }
        } else {
            totalApprovedActual = keyResult.getCurrentValue() != null ? keyResult.getCurrentValue() : 0.0;
        }

        Double progress = 0.0;
        if (keyResult.getTargetValue() != null && keyResult.getTargetValue() != 0) {
            progress = Math.min(100.0, (totalApprovedActual / keyResult.getTargetValue()) * 100);
        }

        String periodName = null;
        if (hasLinkedKpis) {
            periodName = keyResult.getKpis().stream()
                    .filter(kpi -> kpi.getKpiPeriod() != null)
                    .map(kpi -> kpi.getKpiPeriod().getName())
                    .findFirst()
                    .orElse(null);
        }

        return KeyResultResponse.builder()
                .id(keyResult.getId())
                .code(keyResult.getCode())
                .name(keyResult.getName())
                .description(keyResult.getDescription())
                .targetValue(keyResult.getTargetValue())
                .currentValue(totalApprovedActual)
                .unit(keyResult.getUnit())
                .progress(progress)
                .periodName(periodName)
                .build();
    }
}
