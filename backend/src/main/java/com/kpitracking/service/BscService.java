package com.kpitracking.service;

import com.kpitracking.dto.request.bsc.PerspectiveRequest;
import com.kpitracking.dto.request.bsc.ScorecardPerspectiveWeightRequest;
import com.kpitracking.dto.request.bsc.ScorecardRequest;
import com.kpitracking.dto.response.bsc.ImportBscResponse;
import com.kpitracking.dto.response.bsc.PerspectiveResponse;
import com.kpitracking.dto.response.bsc.ScorecardPerspectiveResponse;
import com.kpitracking.dto.response.bsc.ScorecardResponse;
import com.kpitracking.entity.BscPerspective;
import com.kpitracking.entity.BscScorecard;
import com.kpitracking.entity.BscScorecardPerspective;
import com.kpitracking.entity.BscWeightHistory;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.User;
import com.kpitracking.enums.BscPerspectiveStatus;
import com.kpitracking.enums.BscScorecardStatus;
import com.kpitracking.enums.BscScoringMode;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.DuplicateResourceException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.BscPerspectiveRepository;
import com.kpitracking.repository.BscScorecardPerspectiveRepository;
import com.kpitracking.repository.BscScorecardRepository;
import com.kpitracking.repository.BscWeightHistoryRepository;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.security.core.context.SecurityContextHolder;
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
    private final BscScorecardRepository scorecardRepository;
    private final BscScorecardPerspectiveRepository scorecardPerspectiveRepository;
    private final BscWeightHistoryRepository weightHistoryRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final UserRepository userRepository;

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
    // Scorecards (thẻ điểm) — mỗi org + kỳ một bản, kèm trọng số viễn cảnh
    // ============================================================

    @Transactional(readOnly = true)
    public List<ScorecardResponse> getScorecards(UUID organizationId) {
        return scorecardRepository.findByOrganizationIdOrderByCreatedAtDesc(organizationId).stream()
                .map(this::mapToScorecardResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ScorecardResponse getScorecardById(UUID scorecardId) {
        return mapToScorecardResponse(scorecardRepository.findById(scorecardId)
                .orElseThrow(() -> new ResourceNotFoundException("Scorecard not found")));
    }

    @Transactional
    public ScorecardResponse createScorecard(UUID organizationId, ScorecardRequest request) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization not found"));
        KpiPeriod period = kpiPeriodRepository.findById(request.getKpiPeriodId())
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ KPI", "id", request.getKpiPeriodId()));
        if (period.getOrganization() == null || !period.getOrganization().getId().equals(organizationId)) {
            throw new BusinessException("Kỳ KPI không thuộc tổ chức này");
        }
        if (scorecardRepository.existsByOrganizationIdAndKpiPeriodId(organizationId, request.getKpiPeriodId())) {
            throw new DuplicateResourceException("Đã tồn tại thẻ điểm cho kỳ này");
        }
        validateWeights(request.getPerspectives());

        BscScorecard scorecard = BscScorecard.builder()
                .organization(organization)
                .kpiPeriod(period)
                .name(request.getName())
                .vision(request.getVision())
                .status(request.getStatus() != null ? request.getStatus() : BscScorecardStatus.DRAFT)
                .scoringMode(request.getScoringMode() != null ? request.getScoringMode() : BscScoringMode.SHADOW)
                .emptyPerspectivePolicy(request.getEmptyPerspectivePolicy() != null
                        ? request.getEmptyPerspectivePolicy()
                        : com.kpitracking.enums.BscEmptyPerspectivePolicy.RENORMALIZE)
                .build();
        scorecard = scorecardRepository.save(scorecard);

        User currentUser = getCurrentUserOrNull();
        if (request.getPerspectives() != null) {
            for (ScorecardPerspectiveWeightRequest item : request.getPerspectives()) {
                BscPerspective perspective = perspectiveRepository.findById(item.getPerspectiveId())
                        .orElseThrow(() -> new ResourceNotFoundException("Viễn cảnh", "id", item.getPerspectiveId()));
                BscScorecardPerspective sp = BscScorecardPerspective.builder()
                        .scorecard(scorecard)
                        .perspective(perspective)
                        .weightPercentage(item.getWeightPercentage() != null ? item.getWeightPercentage() : 0.0)
                        .displayOrder(item.getDisplayOrder() != null ? item.getDisplayOrder() : perspective.getDisplayOrder())
                        .build();
                scorecardPerspectiveRepository.save(sp);
                logWeightChange(scorecard, perspective, null, sp.getWeightPercentage(), currentUser, item.getReason());
            }
        }
        return mapToScorecardResponse(scorecardRepository.findById(scorecard.getId()).orElseThrow());
    }

    @Transactional
    public ScorecardResponse updateScorecard(UUID scorecardId, ScorecardRequest request) {
        BscScorecard scorecard = scorecardRepository.findById(scorecardId)
                .orElseThrow(() -> new ResourceNotFoundException("Scorecard not found"));
        validateWeights(request.getPerspectives());

        scorecard.setName(request.getName());
        scorecard.setVision(request.getVision());
        if (request.getStatus() != null) scorecard.setStatus(request.getStatus());
        if (request.getScoringMode() != null) scorecard.setScoringMode(request.getScoringMode());
        if (request.getEmptyPerspectivePolicy() != null) scorecard.setEmptyPerspectivePolicy(request.getEmptyPerspectivePolicy());

        User currentUser = getCurrentUserOrNull();
        if (request.getPerspectives() != null) {
            List<BscScorecardPerspective> existing = scorecardPerspectiveRepository.findByScorecardIdOrderByDisplayOrderAsc(scorecardId);
            java.util.Map<UUID, BscScorecardPerspective> byPerspective = new java.util.HashMap<>();
            for (BscScorecardPerspective sp : existing) byPerspective.put(sp.getPerspective().getId(), sp);
            java.util.Set<UUID> keepIds = new java.util.HashSet<>();

            for (ScorecardPerspectiveWeightRequest item : request.getPerspectives()) {
                keepIds.add(item.getPerspectiveId());
                double newWeight = item.getWeightPercentage() != null ? item.getWeightPercentage() : 0.0;
                BscScorecardPerspective sp = byPerspective.get(item.getPerspectiveId());
                if (sp != null) {
                    double oldWeight = sp.getWeightPercentage() != null ? sp.getWeightPercentage() : 0.0;
                    if (Math.abs(oldWeight - newWeight) > 0.0001) {
                        logWeightChange(scorecard, sp.getPerspective(), oldWeight, newWeight, currentUser, item.getReason());
                    }
                    sp.setWeightPercentage(newWeight);
                    if (item.getDisplayOrder() != null) sp.setDisplayOrder(item.getDisplayOrder());
                    scorecardPerspectiveRepository.save(sp);
                } else {
                    BscPerspective perspective = perspectiveRepository.findById(item.getPerspectiveId())
                            .orElseThrow(() -> new ResourceNotFoundException("Viễn cảnh", "id", item.getPerspectiveId()));
                    BscScorecardPerspective created = BscScorecardPerspective.builder()
                            .scorecard(scorecard)
                            .perspective(perspective)
                            .weightPercentage(newWeight)
                            .displayOrder(item.getDisplayOrder() != null ? item.getDisplayOrder() : perspective.getDisplayOrder())
                            .build();
                    scorecardPerspectiveRepository.save(created);
                    logWeightChange(scorecard, perspective, null, newWeight, currentUser, item.getReason());
                }
            }
            // Xoá các viễn cảnh không còn trong danh sách
            for (BscScorecardPerspective sp : existing) {
                if (!keepIds.contains(sp.getPerspective().getId())) {
                    scorecardPerspectiveRepository.delete(sp);
                }
            }
        }
        scorecardRepository.save(scorecard);
        return mapToScorecardResponse(scorecardRepository.findById(scorecardId).orElseThrow());
    }

    @Transactional
    public void deleteScorecard(UUID scorecardId) {
        BscScorecard scorecard = scorecardRepository.findById(scorecardId)
                .orElseThrow(() -> new ResourceNotFoundException("Scorecard not found"));
        scorecard.setDeletedAt(Instant.now());
        scorecardRepository.save(scorecard);
    }

    /** Chuyển chế độ chấm điểm (SHADOW/OFFICIAL) — gác bằng permission BSC:PUBLISH_SCORE ở controller. */
    @Transactional
    public ScorecardResponse updateScoringMode(UUID scorecardId, BscScoringMode mode) {
        BscScorecard scorecard = scorecardRepository.findById(scorecardId)
                .orElseThrow(() -> new ResourceNotFoundException("Scorecard not found"));
        scorecard.setScoringMode(mode);
        scorecardRepository.save(scorecard);
        return mapToScorecardResponse(scorecard);
    }

    private void validateWeights(List<ScorecardPerspectiveWeightRequest> items) {
        if (items == null || items.isEmpty()) return;
        double total = items.stream().mapToDouble(i -> i.getWeightPercentage() != null ? i.getWeightPercentage() : 0.0).sum();
        if (Math.abs(total - 100.0) > 0.01) {
            throw new BusinessException("Tổng trọng số các viễn cảnh phải bằng 100% (hiện tại: " + total + "%)");
        }
    }

    private void logWeightChange(BscScorecard scorecard, BscPerspective perspective, Double oldW, Double newW, User user, String reason) {
        weightHistoryRepository.save(BscWeightHistory.builder()
                .scorecard(scorecard)
                .perspective(perspective)
                .oldWeight(oldW)
                .newWeight(newW)
                .changedBy(user)
                .reason(reason)
                .build());
    }

    private User getCurrentUserOrNull() {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            return userRepository.findByEmail(email).orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    private ScorecardResponse mapToScorecardResponse(BscScorecard s) {
        List<ScorecardPerspectiveResponse> perspectives = s.getScorecardPerspectives() == null ? List.of()
                : s.getScorecardPerspectives().stream()
                    .map(sp -> ScorecardPerspectiveResponse.builder()
                            .id(sp.getId())
                            .perspectiveId(sp.getPerspective().getId())
                            .code(sp.getPerspective().getCode())
                            .name(sp.getPerspective().getName())
                            .color(sp.getPerspective().getColor())
                            .weightPercentage(sp.getWeightPercentage())
                            .displayOrder(sp.getDisplayOrder())
                            .build())
                    .collect(Collectors.toList());
        double totalWeight = perspectives.stream().mapToDouble(p -> p.getWeightPercentage() != null ? p.getWeightPercentage() : 0.0).sum();
        return ScorecardResponse.builder()
                .id(s.getId())
                .name(s.getName())
                .vision(s.getVision())
                .kpiPeriodId(s.getKpiPeriod() != null ? s.getKpiPeriod().getId() : null)
                .kpiPeriodName(s.getKpiPeriod() != null ? s.getKpiPeriod().getName() : null)
                .status(s.getStatus())
                .scoringMode(s.getScoringMode())
                .emptyPerspectivePolicy(s.getEmptyPerspectivePolicy())
                .perspectives(perspectives)
                .totalWeight(totalWeight)
                .createdAt(s.getCreatedAt())
                .updatedAt(s.getUpdatedAt())
                .build();
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
            java.util.Set<Integer> seenOrders = new java.util.HashSet<>();

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
                            if (!seenOrders.add(displayOrder)) {
                                throw new BusinessException("Thứ tự hiển thị '" + displayOrder + "' bị trùng trong tệp");
                            }
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

    /** Đọc ô dạng số nhưng GIỮ phần thập phân (dùng cho trọng số). */
    private String getCellDecimalString(Cell cell) {
        if (cell == null) return "";
        if (cell.getCellType() == CellType.NUMERIC) {
            double v = cell.getNumericCellValue();
            return v == Math.floor(v) ? String.valueOf((long) v) : String.valueOf(v);
        }
        return getCellString(cell);
    }

    // ============================================================
    // Import Excel thẻ điểm (.xlsx) — mỗi dòng = 1 trọng số viễn cảnh trong 1 kỳ
    // Cột: Period (bắt buộc), ScorecardName (bắt buộc), Vision, PerspectiveCode (bắt buộc),
    //      Weight (bắt buộc), Status, ScoringMode, EmptyPolicy. Gom nhóm theo Period → upsert scorecard.
    // ============================================================

    @Transactional
    public ImportBscResponse importScorecards(UUID organizationId, MultipartFile file) {
        String filename = file.getOriginalFilename();
        if (filename == null || !filename.endsWith(".xlsx")) {
            throw new BusinessException("Chỉ hỗ trợ tập tin định dạng .xlsx");
        }
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization not found"));

        List<String> errors = new ArrayList<>();
        int totalRows = 0;
        int successfulImports = 0;

        // period key (normalized) -> gom dữ liệu
        java.util.LinkedHashMap<String, ScorecardImportGroup> groups = new java.util.LinkedHashMap<>();

        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            Row headerRow = sheet.getRow(0);
            if (headerRow == null) throw new BusinessException("Tập tin Excel trống");

            int periodIdx = -1, nameIdx = -1, visionIdx = -1, pCodeIdx = -1, weightIdx = -1, statusIdx = -1, modeIdx = -1, policyIdx = -1;
            for (int i = 0; i < headerRow.getLastCellNum(); i++) {
                String h = getCellString(headerRow.getCell(i));
                if (h.equalsIgnoreCase("Period")) periodIdx = i;
                else if (h.equalsIgnoreCase("ScorecardName")) nameIdx = i;
                else if (h.equalsIgnoreCase("Vision")) visionIdx = i;
                else if (h.equalsIgnoreCase("PerspectiveCode")) pCodeIdx = i;
                else if (h.equalsIgnoreCase("Weight")) weightIdx = i;
                else if (h.equalsIgnoreCase("Status")) statusIdx = i;
                else if (h.equalsIgnoreCase("ScoringMode")) modeIdx = i;
                else if (h.equalsIgnoreCase("EmptyPolicy")) policyIdx = i;
            }
            if (periodIdx == -1 || nameIdx == -1 || pCodeIdx == -1 || weightIdx == -1) {
                throw new BusinessException("Thiếu các cột bắt buộc: Period, ScorecardName, PerspectiveCode, Weight");
            }

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                String period = getCellString(row.getCell(periodIdx));
                String pCode = getCellString(row.getCell(pCodeIdx));
                if (period.isBlank() && pCode.isBlank()) continue;
                totalRows++;
                try {
                    if (period.isBlank()) throw new BusinessException("Thiếu Period");
                    if (pCode.isBlank()) throw new BusinessException("Thiếu PerspectiveCode");
                    String weightStr = getCellDecimalString(row.getCell(weightIdx));
                    if (weightStr.isBlank()) throw new BusinessException("Thiếu Weight");
                    double weight;
                    try { weight = Double.parseDouble(weightStr); }
                    catch (Exception e) { throw new BusinessException("Weight '" + weightStr + "' phải là số"); }

                    String key = period.trim().replaceAll("\\s+", " ").toLowerCase();
                    ScorecardImportGroup g = groups.computeIfAbsent(key, k -> new ScorecardImportGroup());
                    g.periodName = period.trim();
                    if (g.name == null && nameIdx != -1) { String n = getCellString(row.getCell(nameIdx)); if (!n.isBlank()) g.name = n; }
                    if (g.vision == null && visionIdx != -1) { String v = getCellString(row.getCell(visionIdx)); if (!v.isBlank()) g.vision = v; }
                    if (g.statusStr == null && statusIdx != -1) g.statusStr = getCellString(row.getCell(statusIdx));
                    if (g.modeStr == null && modeIdx != -1) g.modeStr = getCellString(row.getCell(modeIdx));
                    if (g.policyStr == null && policyIdx != -1) g.policyStr = getCellString(row.getCell(policyIdx));
                    String codeKey = pCode.trim();
                    boolean dup = g.weights.keySet().stream().anyMatch(k -> k.equalsIgnoreCase(codeKey));
                    if (dup) throw new BusinessException("Mã viễn cảnh '" + codeKey + "' bị trùng trong kỳ '" + period.trim() + "'");
                    g.weights.put(codeKey, weight);
                } catch (Exception e) {
                    errors.add("Dòng " + (i + 1) + ": " + e.getMessage());
                }
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("Lỗi đọc tập tin Excel: " + e.getMessage());
        }

        User currentUser = getCurrentUserOrNull();
        for (ScorecardImportGroup g : groups.values()) {
            try {
                if (g.name == null || g.name.isBlank()) throw new BusinessException("Thiếu ScorecardName");
                double sum = g.weights.values().stream().mapToDouble(Double::doubleValue).sum();
                if (Math.abs(sum - 100.0) > 0.01) {
                    throw new BusinessException("Tổng trọng số phải = 100% (hiện tại: " + sum + "%)");
                }
                String clean = g.periodName.replaceAll("\\s+", " ");
                KpiPeriod period = kpiPeriodRepository.findByNameSmart(clean, organizationId)
                        .or(() -> kpiPeriodRepository.findByNameIgnoreCase(clean))
                        .orElseThrow(() -> new BusinessException("Không tìm thấy kỳ '" + g.periodName + "'"));

                BscScorecard scorecard = scorecardRepository
                        .findByOrganizationIdAndKpiPeriodId(organizationId, period.getId())
                        .orElse(null);
                boolean isNew = scorecard == null;
                if (isNew) {
                    scorecard = BscScorecard.builder().organization(organization).kpiPeriod(period).name(g.name).build();
                }
                scorecard.setName(g.name);
                if (g.vision != null) scorecard.setVision(g.vision);
                if (g.statusStr != null && !g.statusStr.isBlank()) {
                    try { scorecard.setStatus(BscScorecardStatus.valueOf(g.statusStr.trim().toUpperCase())); } catch (Exception ignored) {}
                }
                if (g.modeStr != null && !g.modeStr.isBlank()) {
                    try { scorecard.setScoringMode(BscScoringMode.valueOf(g.modeStr.trim().toUpperCase())); } catch (Exception ignored) {}
                }
                if (g.policyStr != null && !g.policyStr.isBlank()) {
                    try { scorecard.setEmptyPerspectivePolicy(com.kpitracking.enums.BscEmptyPerspectivePolicy.valueOf(g.policyStr.trim().toUpperCase())); } catch (Exception ignored) {}
                }
                scorecard = scorecardRepository.save(scorecard);

                // Xoá trọng số cũ, ghi lại theo file
                if (!isNew) {
                    for (BscScorecardPerspective sp : scorecardPerspectiveRepository.findByScorecardIdOrderByDisplayOrderAsc(scorecard.getId())) {
                        scorecardPerspectiveRepository.delete(sp);
                    }
                }
                int order = 0;
                for (java.util.Map.Entry<String, Double> w : g.weights.entrySet()) {
                    BscPerspective perspective = perspectiveRepository
                            .findFirstByOrganizationIdAndCodeIgnoreCase(organizationId, w.getKey())
                            .orElseThrow(() -> new BusinessException("Không tìm thấy viễn cảnh mã '" + w.getKey() + "'"));
                    BscScorecardPerspective sp = BscScorecardPerspective.builder()
                            .scorecard(scorecard).perspective(perspective)
                            .weightPercentage(w.getValue()).displayOrder(order++).build();
                    scorecardPerspectiveRepository.save(sp);
                    logWeightChange(scorecard, perspective, null, w.getValue(), currentUser, "Import Excel");
                }
                successfulImports++;
            } catch (Exception e) {
                errors.add("Thẻ điểm kỳ '" + g.periodName + "': " + e.getMessage());
            }
        }

        return ImportBscResponse.builder()
                .totalRows(totalRows)
                .successfulImports(successfulImports)
                .errors(errors)
                .build();
    }

    private static class ScorecardImportGroup {
        String periodName;
        String name;
        String vision;
        String statusStr;
        String modeStr;
        String policyStr;
        final java.util.LinkedHashMap<String, Double> weights = new java.util.LinkedHashMap<>();
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
