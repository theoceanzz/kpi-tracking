package com.kpitracking.service;

import com.kpitracking.exception.BusinessException;
import com.kpitracking.dto.request.kpi.KpiCycleRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.kpi.KpiCycleResponse;
import com.kpitracking.entity.KpiCycle;
import com.kpitracking.entity.Organization;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.Terms;
import com.kpitracking.repository.KpiCycleRepository;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class KpiCycleService {

    private final KpiCycleRepository kpiCycleRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final com.kpitracking.service.kpi.CycleStatusGuard cycleStatusGuard;

    /**
     * Luật "kỳ cùng loại không chồng lấn" cho thao tác tạo/sửa MỚI. Tắt được để bật dần trên prod
     * sau khi đã chạy {@code backend/scripts/check_cycle_overlap.sql} và xử lý dữ liệu cũ.
     */
    @org.springframework.beans.factory.annotation.Value("${app.kpi.cycle-overlap-check:true}")
    private boolean overlapCheckEnabled = true;

    private com.kpitracking.entity.User getCurrentUser() {
        String email = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "email", email));
    }

    /** Chỉ cho sắp xếp theo cột đã biết; tên lạ (do client gửi) rơi về mặc định thay vì nổ 500. */
    private static final java.util.Set<String> SORTABLE = java.util.Set.of(
            "name", "startDate", "endDate", "createdAt", "updatedAt", "status");

    private static String safeSort(String sortBy) {
        return sortBy != null && SORTABLE.contains(sortBy) ? sortBy : "startDate";
    }

    private UUID getCurrentUserOrganizationId(com.kpitracking.entity.User user) {
        java.util.List<com.kpitracking.entity.UserRoleOrgUnit> roles = userRoleOrgUnitRepository.findByUserId(user.getId());
        if (roles.isEmpty()) return null;
        return roles.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
    }

    @Transactional(readOnly = true)
    public PageResponse<KpiCycleResponse> getKpiCycles(
            int page, int size, String sortBy, String direction, String keyword,
            com.kpitracking.enums.KpiFrequency cycleType,
            Instant startDate, Instant endDate, UUID organizationId) {

        com.kpitracking.entity.User currentUser = getCurrentUser();
        UUID userOrgId = getCurrentUserOrganizationId(currentUser);
        // organizationId do client gửi chỉ có nghĩa với platform admin (không thuộc tổ chức nào);
        // người dùng thường luôn bị khoá vào tổ chức của chính mình.
        UUID effectiveOrgId = userOrgId != null ? userOrgId : organizationId;

        Sort sort = "asc".equalsIgnoreCase(direction) ? Sort.by(safeSort(sortBy)).ascending() : Sort.by(safeSort(sortBy)).descending();
        Pageable pageable = PageRequest.of(page, size, sort);

        Specification<KpiCycle> spec = Specification.where(null);

        if (StringUtils.hasText(keyword)) {
            spec = spec.and((root, query, cb) ->
                cb.like(cb.lower(root.get("name")), "%" + keyword.toLowerCase() + "%"));
        }

        if (cycleType != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("cycleType"), cycleType));
        }

        if (effectiveOrgId != null) {
            final UUID orgId = effectiveOrgId;
            spec = spec.and((root, query, cb) -> cb.equal(root.get("organization").get("id"), orgId));
        }

        if (startDate != null) {
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("startDate"), startDate));
        }

        if (endDate != null) {
            spec = spec.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("endDate"), endDate));
        }

        Page<KpiCycle> pagedResult = kpiCycleRepository.findAll(spec, pageable);

        return PageResponse.<KpiCycleResponse>builder()
                .content(pagedResult.getContent().stream().map(this::toResponse).toList())
                .page(pagedResult.getNumber())
                .size(pagedResult.getSize())
                .totalElements(pagedResult.getTotalElements())
                .totalPages(pagedResult.getTotalPages())
                .last(pagedResult.isLast())
                .build();
    }

    @Transactional
    public KpiCycleResponse createKpiCycle(KpiCycleRequest request) {
        validateDates(request.getStartDate(), request.getEndDate());

        UUID organizationId = request.getOrganizationId();
        if (organizationId == null) {
            organizationId = getCurrentUserOrganizationId(getCurrentUser());
        }
        if (organizationId == null) {
            throw new BusinessException(ErrorCode.COULD_NOT_DETERMINE_ORGANIZATION_EVALUATION_CYCLE);
        }

        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.organization"), "id", request.getOrganizationId()));

        assertNoOverlap(organization.getId(), request.getCycleType(), null, request.getStartDate(), request.getEndDate());

        KpiCycle cycle = KpiCycle.builder()
                .name(request.getName())
                .cycleType(request.getCycleType())
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .description(request.getDescription())
                .evaluationMode(resolveEvaluationMode(organization, request.getEvaluationMode()))
                .organization(organization)
                .build();

        cycle = kpiCycleRepository.save(cycle);
        syncPeriods(cycle, request.getPeriodIds());
        return toResponse(cycle);
    }

    @Transactional
    public KpiCycleResponse updateKpiCycle(UUID id, KpiCycleRequest request) {
        validateDates(request.getStartDate(), request.getEndDate());

        KpiCycle cycle = kpiCycleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.evaluationCycle"), "id", id));
        // Kỳ đã khoá: không sửa thông tin/ngày, không gán thêm/gỡ đợt. Muốn sửa phải mở lại kỳ.
        cycleStatusGuard.assertWritable(cycle);

        // Chỉ kiểm tra chồng lấn khi ngày/loại thực sự đổi — kỳ cũ đang chồng lấn sẵn vẫn sửa tên được.
        boolean rangeChanged = !java.util.Objects.equals(cycle.getStartDate(), request.getStartDate())
                || !java.util.Objects.equals(cycle.getEndDate(), request.getEndDate())
                || cycle.getCycleType() != request.getCycleType();
        if (rangeChanged) {
            assertNoOverlap(cycle.getOrganization().getId(), request.getCycleType(), cycle.getId(),
                    request.getStartDate(), request.getEndDate());
        }

        cycle.setName(request.getName());
        cycle.setCycleType(request.getCycleType());
        cycle.setStartDate(request.getStartDate());
        cycle.setEndDate(request.getEndDate());
        cycle.setDescription(request.getDescription());
        if (request.getEvaluationMode() != null) {
            cycle.setEvaluationMode(resolveEvaluationMode(cycle.getOrganization(), request.getEvaluationMode()));
        }

        if (request.getOrganizationId() != null && !request.getOrganizationId().equals(cycle.getOrganization().getId())) {
            Organization organization = organizationRepository.findById(request.getOrganizationId())
                    .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.organization"), "id", request.getOrganizationId()));
            cycle.setOrganization(organization);
        }

        cycle = kpiCycleRepository.save(cycle);
        syncPeriods(cycle, request.getPeriodIds());
        return toResponse(cycle);
    }

    @Transactional
    public void deleteKpiCycle(UUID id) {
        KpiCycle cycle = kpiCycleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.evaluationCycle"), "id", id));
        cycleStatusGuard.assertWritable(cycle);
        // Gỡ liên kết các đợt trước khi xoá mềm để tránh tham chiếu treo.
        kpiPeriodRepository.detachFromCycle(id);
        cycle.setDeletedAt(Instant.now());
        kpiCycleRepository.save(cycle);
    }

    /**
     * Đồng bộ danh sách đợt thuộc kỳ: gỡ các đợt không còn được chọn, gán các đợt mới chọn.
     * Đợt đang thuộc kỳ khác sẽ được chuyển sang kỳ này.
     * periodIds == null ⇒ giữ nguyên liên kết hiện tại.
     */
    private void syncPeriods(KpiCycle cycle, java.util.List<UUID> periodIds) {
        if (periodIds == null) return;

        java.util.Set<UUID> wanted = new java.util.LinkedHashSet<>(periodIds);

        java.util.List<com.kpitracking.entity.KpiPeriod> current =
                kpiPeriodRepository.findByKpiCycleIdOrderByStartDateAsc(cycle.getId());
        for (com.kpitracking.entity.KpiPeriod period : current) {
            if (!wanted.contains(period.getId())) {
                period.setKpiCycle(null);
                kpiPeriodRepository.save(period);
            }
        }

        for (UUID periodId : wanted) {
            com.kpitracking.entity.KpiPeriod period = kpiPeriodRepository.findById(periodId)
                    .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.kpiPeriod"), "id", periodId));
            // Đợt đang thuộc một kỳ đã khoá thì không kéo sang kỳ khác được (chuyển đợt khi khoá
            // kỳ đi qua thủ tục khoá, không qua đây).
            if (period.getKpiCycle() != null && !period.getKpiCycle().getId().equals(cycle.getId())) {
                cycleStatusGuard.assertWritable(period.getKpiCycle());
            }

            // BusinessException chứ không IllegalArgumentException: đây là lỗi nghiệp vụ
            // người dùng sửa được, ném IllegalArgument thì rơi vào handler chung và họ chỉ
            // nhận được "Đã xảy ra lỗi không xác định" trong khi câu giải thích đã có sẵn.
            if (!period.getOrganization().getId().equals(cycle.getOrganization().getId())) {
                throw new BusinessException(ErrorCode.PERIOD_OUTSIDE_CYCLE_ORGANIZATION, period.getName());
            }

            Instant cycleStart = cycle.getStartDate();
            Instant cycleEnd = cycle.getEndDate();
            if (cycleStart != null && cycleEnd != null
                    && period.getStartDate() != null && period.getEndDate() != null
                    && (period.getStartDate().isBefore(cycleStart) || period.getEndDate().isAfter(cycleEnd))) {
                throw new BusinessException(ErrorCode.DATES_PERIOD_MUST_WITHIN_DATES_CYCLE, period.getName(), cycle.getName());
            }

            period.setKpiCycle(cycle);
            kpiPeriodRepository.save(period);
        }
    }

    /**
     * Tổ chức chưa bật KPI định tính ⇒ kỳ chỉ được đánh giá theo Định lượng.
     * Mặc định khi không truyền: BOTH nếu có định tính, ngược lại QUANTITATIVE.
     */
    private com.kpitracking.enums.CycleEvaluationMode resolveEvaluationMode(
            Organization organization, com.kpitracking.enums.CycleEvaluationMode requested) {
        boolean qualitativeEnabled = organization != null
                && Boolean.TRUE.equals(organization.getEnableQualitative());

        if (requested == null) {
            return qualitativeEnabled
                    ? com.kpitracking.enums.CycleEvaluationMode.BOTH
                    : com.kpitracking.enums.CycleEvaluationMode.QUANTITATIVE;
        }
        if (!qualitativeEnabled && requested != com.kpitracking.enums.CycleEvaluationMode.QUANTITATIVE) {
            throw new BusinessException(ErrorCode.ORGANIZATION_NOT_ENABLED_QUALITATIVE_KPIS_CYCLE_CAN);
        }
        return requested;
    }

    /** Kỳ cùng tổ chức + cùng loại không được có khoảng thời gian giao nhau. */
    private void assertNoOverlap(UUID orgId, com.kpitracking.enums.KpiFrequency type, UUID excludeId,
                                 Instant start, Instant end) {
        if (!overlapCheckEnabled || start == null || end == null || type == null) return;
        java.util.List<KpiCycle> overlaps = kpiCycleRepository.findOverlapping(
                orgId, type, excludeId != null ? excludeId : new UUID(0L, 0L), start, end);
        if (!overlaps.isEmpty()) {
            KpiCycle o = overlaps.get(0);
            java.time.format.DateTimeFormatter f = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy")
                    .withZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));
            throw new BusinessException(ErrorCode.CYCLE_DATES_OVERLAP_CYCLE_SAME_TYPE, o.getName(), String.valueOf(f.format(o.getStartDate())), String.valueOf(f.format(o.getEndDate())));
        }
    }

    private void validateDates(Instant start, Instant end) {
        if (start == null || end == null) return;
        if (!end.isAfter(start)) {
            throw new BusinessException(ErrorCode.END_TIME_MUST_AFTER_START_TIME);
        }
    }

    public KpiCycleResponse toResponse(KpiCycle cycle) {
        return KpiCycleResponse.builder()
                .id(cycle.getId())
                .name(cycle.getName())
                .cycleType(cycle.getCycleType())
                .startDate(cycle.getStartDate())
                .endDate(cycle.getEndDate())
                .description(cycle.getDescription())
                .evaluationMode(cycle.getEvaluationMode())
                .organizationId(cycle.getOrganization().getId())
                .periodCount(kpiCycleRepository.countPeriods(cycle.getId()))
                .status(cycle.getStatus())
                .lockedAt(cycle.getLockedAt())
                .lockedByName(cycle.getLockedBy() != null ? cycle.getLockedBy().getFullName() : null)
                .reopenedAt(cycle.getReopenedAt())
                .reopenedByName(cycle.getReopenedBy() != null ? cycle.getReopenedBy().getFullName() : null)
                .reopenReason(cycle.getReopenReason())
                .build();
    }
}
