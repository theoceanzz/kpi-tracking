package com.kpitracking.service;

import com.kpitracking.dto.request.admin.UpdateOrgFeaturesRequest;
import com.kpitracking.dto.request.admin.UpdateOrgStatusRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.admin.OrganizationAdminResponse;
import com.kpitracking.dto.response.admin.PlatformAdminStatsResponse;
import com.kpitracking.entity.Organization;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.OrganizationRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PlatformAdminService {

    private final OrganizationRepository organizationRepository;

    @PersistenceContext
    private EntityManager em;

    public PlatformAdminStatsResponse getStats() {
        // Orgs by status
        List<Object[]> statusRows = em.createQuery(
                "SELECT o.status, COUNT(o) FROM Organization o GROUP BY o.status", Object[].class
        ).getResultList();
        Map<String, Long> orgsByStatus = new LinkedHashMap<>();
        for (Object[] row : statusRows) {
            orgsByStatus.put(row[0].toString(), (Long) row[1]);
        }
        long totalOrgs = orgsByStatus.values().stream().mapToLong(Long::longValue).sum();

        long orgsWithAiEnabled = ((Number) em.createQuery(
                "SELECT COUNT(o) FROM Organization o WHERE o.enableAi = true"
        ).getSingleResult()).longValue();

        long totalUsers = ((Number) em.createQuery(
                "SELECT COUNT(u) FROM User u WHERE u.deletedAt IS NULL"
        ).getSingleResult()).longValue();

        Instant monthStart = YearMonth.now(ZoneId.of("Asia/Ho_Chi_Minh"))
                .atDay(1).atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant();

        long newUsersThisMonth = ((Number) em.createQuery(
                "SELECT COUNT(u) FROM User u WHERE u.createdAt >= :from AND u.deletedAt IS NULL"
        ).setParameter("from", monthStart).getSingleResult()).longValue();

        long totalKpiCriteria = ((Number) em.createQuery(
                "SELECT COUNT(k) FROM KpiCriteria k"
        ).getSingleResult()).longValue();

        long totalSubmissionsThisMonth = ((Number) em.createQuery(
                "SELECT COUNT(s) FROM KpiSubmission s WHERE s.createdAt >= :from"
        ).setParameter("from", monthStart).getSingleResult()).longValue();

        long totalAiConversations = ((Number) em.createQuery(
                "SELECT COUNT(c) FROM Conversation c WHERE c.deletedAt IS NULL"
        ).getSingleResult()).longValue();

        long totalAiMessages = ((Number) em.createQuery(
                "SELECT COUNT(m) FROM ConversationMessage m"
        ).getSingleResult()).longValue();

        return PlatformAdminStatsResponse.builder()
                .totalOrgs(totalOrgs)
                .orgsByStatus(orgsByStatus)
                .totalUsers(totalUsers)
                .newUsersThisMonth(newUsersThisMonth)
                .totalKpiCriteria(totalKpiCriteria)
                .totalSubmissionsThisMonth(totalSubmissionsThisMonth)
                .orgsWithAiEnabled(orgsWithAiEnabled)
                .totalAiConversations(totalAiConversations)
                .totalAiMessages(totalAiMessages)
                .build();
    }

    public PageResponse<OrganizationAdminResponse> getOrganizations(int page, int size) {
        Page<Organization> orgs = organizationRepository.findAll(
                PageRequest.of(page, size, Sort.by("createdAt").descending()));
        List<OrganizationAdminResponse> content = orgs.getContent().stream()
                .map(this::toAdminResponse)
                .toList();
        return PageResponse.<OrganizationAdminResponse>builder()
                .content(content)
                .page(orgs.getNumber())
                .size(orgs.getSize())
                .totalElements(orgs.getTotalElements())
                .totalPages(orgs.getTotalPages())
                .last(orgs.isLast())
                .build();
    }

    @Transactional
    public OrganizationAdminResponse updateFeatures(UUID orgId, UpdateOrgFeaturesRequest req) {
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization", "id", orgId));
        if (req.getEnableAi() != null) org.setEnableAi(req.getEnableAi());
        if (req.getEnableOkr() != null) org.setEnableOkr(req.getEnableOkr());
        if (req.getEnableWaterfall() != null) org.setEnableWaterfall(req.getEnableWaterfall());
        return toAdminResponse(organizationRepository.save(org));
    }

    @Transactional
    public OrganizationAdminResponse updateStatus(UUID orgId, UpdateOrgStatusRequest req) {
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization", "id", orgId));
        org.setStatus(req.getStatus());
        return toAdminResponse(organizationRepository.save(org));
    }

    private OrganizationAdminResponse toAdminResponse(Organization org) {
        long userCount = ((Number) em.createQuery(
                "SELECT COUNT(DISTINCT u) FROM User u " +
                "JOIN UserRoleOrgUnit uro ON uro.user.id = u.id " +
                "WHERE uro.orgUnit.orgHierarchyLevel.organization.id = :orgId " +
                "AND u.deletedAt IS NULL"
        ).setParameter("orgId", org.getId()).getSingleResult()).longValue();

        return OrganizationAdminResponse.builder()
                .id(org.getId())
                .name(org.getName())
                .code(org.getCode())
                .status(org.getStatus().name())
                .enableAi(org.getEnableAi())
                .enableOkr(org.getEnableOkr())
                .enableWaterfall(org.getEnableWaterfall())
                .userCount(userCount)
                .createdAt(org.getCreatedAt())
                .updatedAt(org.getUpdatedAt())
                .build();
    }
}
