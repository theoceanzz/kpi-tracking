package com.kpitracking.service;

import com.kpitracking.dto.request.bsc.PerspectiveRequest;
import com.kpitracking.dto.response.bsc.ImportBscResponse;
import com.kpitracking.dto.response.bsc.PerspectiveResponse;
import com.kpitracking.entity.BscPerspective;
import com.kpitracking.entity.Organization;
import com.kpitracking.enums.BscPerspectiveStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.DuplicateResourceException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.BscPerspectiveRepository;
import com.kpitracking.repository.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BscService {

    private final BscPerspectiveRepository perspectiveRepository;
    private final OrganizationRepository organizationRepository;

    // ============================================================
    // Perspectives (viễn cảnh) — danh mục cấu hình theo org
    // ============================================================

    @Transactional(readOnly = true)
    public List<PerspectiveResponse> getPerspectives(UUID organizationId) {
        return perspectiveRepository.findByOrganizationIdOrderByDisplayOrderAsc(organizationId).stream()
                .map(this::mapToPerspectiveResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public PerspectiveResponse createPerspective(UUID organizationId, PerspectiveRequest request) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization not found"));

        if (perspectiveRepository.existsByOrganizationIdAndCode(organizationId, request.getCode())) {
            throw new DuplicateResourceException("Viễn cảnh", "mã", request.getCode());
        }

        int displayOrder = request.getDisplayOrder() != null ? request.getDisplayOrder() : 0;
        if (perspectiveRepository.existsByOrganizationIdAndDisplayOrder(organizationId, displayOrder)) {
            throw new DuplicateResourceException("Viễn cảnh", "thứ tự hiển thị", displayOrder);
        }

        BscPerspective perspective = BscPerspective.builder()
                .organization(organization)
                .code(request.getCode())
                .name(request.getName())
                .description(request.getDescription())
                .color(request.getColor())
                .icon(request.getIcon())
                .displayOrder(displayOrder)
                .status(request.getStatus() != null ? request.getStatus() : BscPerspectiveStatus.ACTIVE)
                .build();

        return mapToPerspectiveResponse(perspectiveRepository.save(perspective));
    }

    @Transactional
    public PerspectiveResponse updatePerspective(UUID perspectiveId, PerspectiveRequest request) {
        BscPerspective perspective = perspectiveRepository.findById(perspectiveId)
                .orElseThrow(() -> new ResourceNotFoundException("Perspective not found"));

        if (perspectiveRepository.existsByOrganizationIdAndCodeAndIdNot(
                perspective.getOrganization().getId(), request.getCode(), perspectiveId)) {
            throw new DuplicateResourceException("Viễn cảnh", "mã", request.getCode());
        }

        if (request.getDisplayOrder() != null
                && perspectiveRepository.existsByOrganizationIdAndDisplayOrderAndIdNot(
                        perspective.getOrganization().getId(), request.getDisplayOrder(), perspectiveId)) {
            throw new DuplicateResourceException("Viễn cảnh", "thứ tự hiển thị", request.getDisplayOrder());
        }

        perspective.setCode(request.getCode());
        perspective.setName(request.getName());
        perspective.setDescription(request.getDescription());
        perspective.setColor(request.getColor());
        perspective.setIcon(request.getIcon());
        if (request.getDisplayOrder() != null) {
            perspective.setDisplayOrder(request.getDisplayOrder());
        }
        if (request.getStatus() != null) {
            perspective.setStatus(request.getStatus());
        }

        return mapToPerspectiveResponse(perspectiveRepository.save(perspective));
    }

    /**
     * Tạo 4 viễn cảnh BSC kinh điển cho một tổ chức nếu tổ chức đó chưa có viễn cảnh nào.
     * Gọi khi org bật enable_bsc (áp dụng cho mọi org: demo, org sẵn có, hay công ty tạo mới).
     */
    @Transactional
    public void seedDefaultPerspectives(Organization organization) {
        if (perspectiveRepository.countByOrganizationId(organization.getId()) > 0) {
            return;
        }
        List<BscPerspective> defaults = List.of(
                buildDefault(organization, "FINANCIAL",        "Tài chính",            "Các chỉ tiêu về hiệu quả tài chính, doanh thu, chi phí, lợi nhuận",  "#2563eb", 1),
                buildDefault(organization, "CUSTOMER",         "Khách hàng",           "Các chỉ tiêu về sự hài lòng, giữ chân và mở rộng khách hàng",        "#f59e0b", 2),
                buildDefault(organization, "INTERNAL_PROCESS", "Quy trình nội bộ",     "Các chỉ tiêu về hiệu quả vận hành, chất lượng quy trình nội bộ",     "#10b981", 3),
                buildDefault(organization, "LEARNING_GROWTH",  "Học hỏi & phát triển", "Các chỉ tiêu về năng lực, đào tạo, đổi mới và phát triển con người", "#8b5cf6", 4)
        );
        perspectiveRepository.saveAll(defaults);
    }

    private BscPerspective buildDefault(Organization org, String code, String name, String description, String color, int order) {
        return BscPerspective.builder()
                .organization(org)
                .code(code)
                .name(name)
                .description(description)
                .color(color)
                .displayOrder(order)
                .status(BscPerspectiveStatus.ACTIVE)
                .build();
    }

    @Transactional
    public void deletePerspective(UUID perspectiveId) {
        BscPerspective perspective = perspectiveRepository.findById(perspectiveId)
                .orElseThrow(() -> new ResourceNotFoundException("Perspective not found"));
        // Soft-delete: KPI đã gán viễn cảnh này sẽ được DB set NULL (ON DELETE SET NULL không chạy khi soft-delete),
        // nên chỉ đánh dấu xoá mềm để giữ lịch sử điểm.
        perspective.setDeletedAt(Instant.now());
        perspectiveRepository.save(perspective);
    }

    // ============================================================
    // Import Excel (.xlsx) — upsert viễn cảnh theo mã
    // Cột: Code (bắt buộc), Name (bắt buộc), Description, Color, DisplayOrder, Status
    // ============================================================

    @Transactional
    public ImportBscResponse importPerspectives(UUID organizationId, MultipartFile file) {
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

            int codeIdx = -1, nameIdx = -1, descIdx = -1, colorIdx = -1, orderIdx = -1, statusIdx = -1;
            for (int i = 0; i < headerRow.getLastCellNum(); i++) {
                String header = getCellString(headerRow.getCell(i));
                if (header.equalsIgnoreCase("Code")) codeIdx = i;
                else if (header.equalsIgnoreCase("Name")) nameIdx = i;
                else if (header.equalsIgnoreCase("Description")) descIdx = i;
                else if (header.equalsIgnoreCase("Color")) colorIdx = i;
                else if (header.equalsIgnoreCase("DisplayOrder")) orderIdx = i;
                else if (header.equalsIgnoreCase("Status")) statusIdx = i;
            }
            if (codeIdx == -1 || nameIdx == -1) {
                throw new BusinessException("Thiếu các cột bắt buộc: Code, Name");
            }

            int nextOrder = (int) perspectiveRepository.countByOrganizationId(organizationId) + 1;

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                String code = getCellString(row.getCell(codeIdx));
                String name = nameIdx != -1 ? getCellString(row.getCell(nameIdx)) : "";
                if (code.isBlank() && name.isBlank()) continue; // dòng trống
                totalRows++;
                try {
                    if (code.isBlank()) throw new BusinessException("Mã viễn cảnh là bắt buộc");
                    if (name.isBlank()) throw new BusinessException("Tên viễn cảnh là bắt buộc");
                    if (!code.matches("^[A-Za-z0-9_]+$")) throw new BusinessException("Mã '" + code + "' chỉ gồm chữ, số và dấu gạch dưới");

                    String desc = descIdx != -1 ? getCellString(row.getCell(descIdx)) : null;
                    String color = colorIdx != -1 ? getCellString(row.getCell(colorIdx)) : null;
                    if (color != null && !color.isBlank() && !color.matches("^#([0-9A-Fa-f]{6})$")) {
                        throw new BusinessException("Màu '" + color + "' không hợp lệ (định dạng #RRGGBB)");
                    }
                    String statusStr = statusIdx != -1 ? getCellString(row.getCell(statusIdx)) : null;
                    BscPerspectiveStatus status = BscPerspectiveStatus.ACTIVE;
                    if (statusStr != null && !statusStr.isBlank()) {
                        try { status = BscPerspectiveStatus.valueOf(statusStr.trim().toUpperCase()); }
                        catch (Exception e) { throw new BusinessException("Trạng thái '" + statusStr + "' không hợp lệ (ACTIVE/INACTIVE)"); }
                    }
                    Integer displayOrder = null;
                    if (orderIdx != -1) {
                        String orderStr = getCellString(row.getCell(orderIdx));
                        if (!orderStr.isBlank()) {
                            try { displayOrder = (int) Double.parseDouble(orderStr); }
                            catch (Exception e) { throw new BusinessException("Thứ tự '" + orderStr + "' phải là số"); }
                        }
                    }

                    // Upsert theo mã (chỉ bản ghi chưa xoá mềm)
                    BscPerspective existing = perspectiveRepository
                            .findFirstByOrganizationIdAndCodeIgnoreCase(organizationId, code).orElse(null);

                    int order = displayOrder != null ? displayOrder : (existing != null ? existing.getDisplayOrder() : nextOrder++);

                    if (existing != null) {
                        existing.setName(name);
                        existing.setDescription(desc);
                        if (color != null && !color.isBlank()) existing.setColor(color);
                        existing.setDisplayOrder(order);
                        existing.setStatus(status);
                        perspectiveRepository.save(existing);
                    } else {
                        perspectiveRepository.save(BscPerspective.builder()
                                .organization(organization)
                                .code(code)
                                .name(name)
                                .description(desc)
                                .color(color != null && !color.isBlank() ? color : "#8b5cf6")
                                .displayOrder(order)
                                .status(status)
                                .build());
                    }
                    successfulImports++;
                } catch (Exception e) {
                    errors.add("Dòng " + (i + 1) + ": " + e.getMessage());
                }
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("Lỗi đọc tập tin Excel: " + e.getMessage());
        }

        return ImportBscResponse.builder()
                .totalRows(totalRows)
                .successfulImports(successfulImports)
                .errors(errors)
                .build();
    }

    private String getCellString(Cell cell) {
        if (cell == null) return "";
        switch (cell.getCellType()) {
            case STRING: return cell.getStringCellValue().trim();
            case NUMERIC: return String.valueOf((long) cell.getNumericCellValue());
            case BOOLEAN: return String.valueOf(cell.getBooleanCellValue());
            case FORMULA: return cell.getCellFormula();
            default: return "";
        }
    }

    // ============================================================
    // Mapping
    // ============================================================

    private PerspectiveResponse mapToPerspectiveResponse(BscPerspective p) {
        return PerspectiveResponse.builder()
                .id(p.getId())
                .code(p.getCode())
                .name(p.getName())
                .description(p.getDescription())
                .color(p.getColor())
                .icon(p.getIcon())
                .displayOrder(p.getDisplayOrder())
                .status(p.getStatus())
                .build();
    }
}
