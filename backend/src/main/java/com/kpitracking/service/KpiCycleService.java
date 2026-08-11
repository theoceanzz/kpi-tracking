package com.kpitracking.service;

import com.kpitracking.dto.request.kpi.KpiCycleRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.kpi.KpiCycleResponse;
import com.kpitracking.entity.KpiCycle;
import com.kpitracking.entity.Organization;
import com.kpitracking.exception.ResourceNotFoundException;
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

    private com.kpitracking.entity.User getCurrentUser() {
        String email = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
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
        UUID effectiveOrgId = organizationId != null ? organizationId : userOrgId;

        Sort sort = direction.equalsIgnoreCase("asc") ? Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
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
            throw new IllegalArgumentException("Không xác định được tổ chức của kỳ đánh giá");
        }

        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", request.getOrganizationId()));

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
        return toResponse(cycle);
    }

    @Transactional
    public KpiCycleResponse updateKpiCycle(UUID id, KpiCycleRequest request) {
        validateDates(request.getStartDate(), request.getEndDate());

        KpiCycle cycle = kpiCycleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá", "id", id));

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
                    .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", request.getOrganizationId()));
            cycle.setOrganization(organization);
        }

        cycle = kpiCycleRepository.save(cycle);
        return toResponse(cycle);
    }

    @Transactional
    public void deleteKpiCycle(UUID id) {
        KpiCycle cycle = kpiCycleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá", "id", id));
        // Gỡ liên kết các đợt trước khi xoá mềm để tránh tham chiếu treo.
        kpiPeriodRepository.detachFromCycle(id);
        cycle.setDeletedAt(Instant.now());
        kpiCycleRepository.save(cycle);
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
            throw new IllegalArgumentException(
                    "Tổ chức chưa bật KPI định tính nên kỳ chỉ có thể đánh giá theo Định lượng");
        }
        return requested;
    }

    private void validateDates(Instant start, Instant end) {
        if (start == null || end == null) return;
        if (!end.isAfter(start)) {
            throw new IllegalArgumentException("Thời gian kết thúc phải sau thời gian bắt đầu");
        }
    }

    private KpiCycleResponse toResponse(KpiCycle cycle) {
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
                .build();
    }
}
