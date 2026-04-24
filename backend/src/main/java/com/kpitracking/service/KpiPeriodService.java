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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class KpiPeriodService {

    private final KpiPeriodRepository kpiPeriodRepository;
    private final OrganizationRepository organizationRepository;

    @Transactional(readOnly = true)
    public PageResponse<KpiPeriodResponse> getKpiPeriods(int page, int size, UUID organizationId) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("startDate").descending());

        Page<KpiPeriod> pagedResult;
        if (organizationId != null) {
            pagedResult = kpiPeriodRepository.findByOrganizationId(organizationId, pageable);
        } else {
            pagedResult = kpiPeriodRepository.findAll(pageable);
        }

        return PageResponse.<KpiPeriodResponse>builder()
                .content(pagedResult.getContent().stream().map(this::toResponse).toList())
                .page(pagedResult.getNumber())
                .size(pagedResult.getSize())
                .totalElements(pagedResult.getTotalElements())
                .totalPages(pagedResult.getTotalPages())
                .last(pagedResult.isLast())
                .build();
    }

    private KpiPeriodResponse toResponse(KpiPeriod period) {
        return KpiPeriodResponse.builder()
                .id(period.getId())
                .name(period.getName())
                .periodType(period.getPeriodType())
                .startDate(period.getStartDate())
                .endDate(period.getEndDate())
                .organizationId(period.getOrganization().getId())
                .build();
    }
}
