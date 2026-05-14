package com.kpitracking.service;

import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.kpi.KpiPeriodResponse;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.Organization;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.OrganizationRepository;
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
public class KpiPeriodService {

    private final KpiPeriodRepository kpiPeriodRepository;
    private final OrganizationRepository organizationRepository;

    @Transactional(readOnly = true)
    public PageResponse<KpiPeriodResponse> getKpiPeriods(
            int page, int size, String sortBy, String direction, String keyword, 
            com.kpitracking.enums.KpiFrequency periodType, 
            java.time.Instant startDate, java.time.Instant endDate, UUID organizationId) {
        
        Sort sort = direction.equalsIgnoreCase("asc") ? Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);

        Specification<KpiPeriod> spec = Specification.where(null);

        if (StringUtils.hasText(keyword)) {
            spec = spec.and((root, query, cb) -> 
                cb.like(cb.lower(root.get("name")), "%" + keyword.toLowerCase() + "%"));
        }

        if (periodType != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("periodType"), periodType));
        }

        if (organizationId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("organization").get("id"), organizationId));
        }

        if (startDate != null) {
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("startDate"), startDate));
        }

        if (endDate != null) {
            spec = spec.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("endDate"), endDate));
        }

        Page<KpiPeriod> pagedResult = kpiPeriodRepository.findAll(spec, pageable);

        return PageResponse.<KpiPeriodResponse>builder()
                .content(pagedResult.getContent().stream().map(this::toResponse).toList())
                .page(pagedResult.getNumber())
                .size(pagedResult.getSize())
                .totalElements(pagedResult.getTotalElements())
                .totalPages(pagedResult.getTotalPages())
                .last(pagedResult.isLast())
                .build();
    }

    @Transactional
    public KpiPeriodResponse createKpiPeriod(com.kpitracking.dto.request.kpi.KpiPeriodRequest request) {
        validateDates(request.getStartDate(), request.getEndDate(), request.getNotificationDate());
        
        Organization organization = organizationRepository.findById(request.getOrganizationId())
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", request.getOrganizationId()));

        Instant notificationDate = request.getNotificationDate();
        if (notificationDate == null && request.getStartDate() != null && request.getEndDate() != null) {
            long mid = (request.getEndDate().toEpochMilli() + request.getStartDate().toEpochMilli()) / 2;
            notificationDate = java.time.Instant.ofEpochMilli(mid);
        }

        KpiPeriod period = KpiPeriod.builder()
                .name(request.getName())
                .periodType(request.getPeriodType())
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .notificationDate(notificationDate)
                .organization(organization)
                .build();

        period = kpiPeriodRepository.save(period);
        return toResponse(period);
    }

    @Transactional
    public KpiPeriodResponse updateKpiPeriod(UUID id, com.kpitracking.dto.request.kpi.KpiPeriodRequest request) {
        validateDates(request.getStartDate(), request.getEndDate(), request.getNotificationDate());

        KpiPeriod period = kpiPeriodRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Đợt KPI", "id", id));

        period.setName(request.getName());
        period.setPeriodType(request.getPeriodType());
        period.setStartDate(request.getStartDate());
        period.setEndDate(request.getEndDate());

        Instant notificationDate = request.getNotificationDate();
        if (notificationDate == null && request.getStartDate() != null && request.getEndDate() != null) {
            long mid = (request.getEndDate().toEpochMilli() + request.getStartDate().toEpochMilli()) / 2;
            notificationDate = java.time.Instant.ofEpochMilli(mid);
        }
        period.setNotificationDate(notificationDate);

        if (request.getOrganizationId() != null && !request.getOrganizationId().equals(period.getOrganization().getId())) {
            Organization organization = organizationRepository.findById(request.getOrganizationId())
                    .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", request.getOrganizationId()));
            period.setOrganization(organization);
        }

        period = kpiPeriodRepository.save(period);
        return toResponse(period);
    }

    private void validateDates(Instant start, Instant end, Instant notification) {
        if (start == null || end == null) return;
        
        if (!end.isAfter(start)) {
            throw new IllegalArgumentException("Thời gian kết thúc phải sau thời gian bắt đầu");
        }
        
        if (notification != null) {
            if (!notification.isAfter(start) || !notification.isBefore(end)) {
                throw new IllegalArgumentException("Thời gian thông báo phải nằm trong khoảng thời gian bắt đầu và kết thúc");
            }
        }
    }

    @Transactional
    public void deleteKpiPeriod(UUID id) {
        KpiPeriod period = kpiPeriodRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Đợt KPI", "id", id));
        period.setDeletedAt(java.time.Instant.now());
        kpiPeriodRepository.save(period);
    }

    private KpiPeriodResponse toResponse(KpiPeriod period) {
        return KpiPeriodResponse.builder()
                .id(period.getId())
                .name(period.getName())
                .periodType(period.getPeriodType())
                .startDate(period.getStartDate())
                .endDate(period.getEndDate())
                .notificationDate(period.getNotificationDate())
                .organizationId(period.getOrganization().getId())
                .build();
    }
}
