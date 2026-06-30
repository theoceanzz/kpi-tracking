package com.kpitracking.service;

import com.kpitracking.entity.*;
import com.kpitracking.enums.*;
import com.kpitracking.repository.*;
import com.kpitracking.service.analytics.KpiMetricsCalculator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.TypedQuery;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrgUnitStatisticService {

    private final OrgUnitRepository orgUnitRepository;
    private final EvaluationRepository evaluationRepository;
    private final KpiSubmissionRepository kpiSubmissionRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final UserRepository userRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final RoleRepository roleRepository;
    private final EntityManager entityManager;
    private final EvaluationService evaluationService;

    // Helper to parse dates from string
    public Instant parseDate(String dateStr, Instant defaultInstant) {
        if (dateStr == null || dateStr.isBlank()) return defaultInstant;
        try {
            if (dateStr.length() == 10) { // YYYY-MM-DD
                return java.time.LocalDate.parse(dateStr).atStartOfDay(ZoneId.systemDefault()).toInstant();
            }
            return Instant.parse(dateStr);
        } catch (Exception e) {
            log.warn("Could not parse date: {}. Using default.", dateStr);
            return defaultInstant;
        }
    }

    public String getPathPrefix(UUID id) {
        OrgUnit unit = orgUnitRepository.findById(id).orElseThrow(() -> new RuntimeException("OrgUnit not found: " + id));
        return unit.getPath();
    }

    /**
     * Reads a lazy {@code @ManyToOne} reference that may point at a soft-deleted entity.
     * Such targets carry {@code @SQLRestriction("deleted_at IS NULL")}, so initializing the
     * proxy finds no row and throws {@link EntityNotFoundException}. We swallow that and return
     * {@code null}, letting callers degrade gracefully instead of failing the whole tool call.
     */
    private static <T> T safeRef(java.util.function.Supplier<T> getter) {
        try {
            return getter.get();
        } catch (EntityNotFoundException e) {
            return null;
        }
    }

    /**
     * Returns the KPI's period, or {@code null} when the {@code kpiPeriod} points to a soft-deleted
     * (or otherwise missing) row. See {@link #safeRef}.
     */
    private KpiPeriod resolveKpiPeriod(KpiCriteria kpi) {
        KpiPeriod period = kpi.getKpiPeriod();
        if (period == null) return null;
        // Touch a field to force proxy init; if the period row is filtered out / missing, treat as absent.
        return safeRef(() -> {
            period.getStartDate();
            return period;
        });
    }

    // Standardized KPI Progress & Performance calculator aligned with SubordinateAnalyticsService
    public double[] calculateKpiMetrics(KpiCriteria kpi, Instant A, Instant B) {
        // KPI cha (decomposition): tiến độ/hiệu suất = bình quân có trọng số chuẩn hoá của các con.
        if (KpiMetricsCalculator.hasDecompositionChildren(kpi)) {
            double wSum = 0, compSum = 0, perfSum = 0;
            for (KpiCriteria child : KpiMetricsCalculator.decompositionChildren(kpi)) {
                double w = child.getWeight() != null && child.getWeight() > 0 ? child.getWeight() : 0.0;
                if (w <= 0) continue;
                double[] cm = calculateKpiMetrics(child, A, B);
                wSum += w;
                compSum += cm[0] * w;
                perfSum += cm[1] * w;
            }
            return wSum > 0 ? new double[]{compSum / wSum, perfSum / wSum} : new double[]{0.0, 0.0};
        }

        KpiPeriod period = resolveKpiPeriod(kpi);
        Instant kpiStart = period != null && period.getStartDate() != null ?
                           period.getStartDate() :
                           (kpi.getCreatedAt() != null ? kpi.getCreatedAt() : Instant.EPOCH);
        Instant kpiEnd = period != null && period.getEndDate() != null ?
                         period.getEndDate() :
                         (kpi.getCreatedAt() != null ? kpi.getCreatedAt().plus(365, java.time.temporal.ChronoUnit.DAYS) : Instant.now().plus(365, java.time.temporal.ChronoUnit.DAYS));

        Instant startCalc = A != null && A.isAfter(kpiStart) ? A : kpiStart;
        Instant endCalc = B != null && B.isBefore(kpiEnd) ? B : kpiEnd;

        if (startCalc.isAfter(endCalc)) {
            return new double[]{0.0, 0.0};
        }

        double totalKpiTime = Math.max(1.0, kpiEnd.toEpochMilli() - kpiStart.toEpochMilli());
        double validFilterTime = endCalc.toEpochMilli() - startCalc.toEpochMilli();
        double timeRatio = Math.min(1.0, validFilterTime / totalKpiTime);

        double targetValue = kpi.getTargetValue() != null ? kpi.getTargetValue() : 1.0;
        double expectedValueFilter = targetValue * timeRatio;

        // Actual cho Tiến độ: Tính LŨY KẾ từ lúc KPI bắt đầu cho đến ngày B
        List<KpiSubmission> complSubs = kpi.getSubmissions().stream()
                .filter(s -> s.getStatus() == SubmissionStatus.APPROVED)
                .filter(s -> {
                    Instant submissionTime = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
                    return !submissionTime.isBefore(kpiStart) && (B == null || !submissionTime.isAfter(B));
                })
                .collect(Collectors.toList());

        // Actual cho Hiệu suất: Chỉ tính nghiêm ngặt trong khoảng [A, B]
        List<KpiSubmission> perfSubs = kpi.getSubmissions().stream()
                .filter(s -> s.getStatus() == SubmissionStatus.APPROVED)
                .filter(s -> {
                    Instant submissionTime = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
                    return (A == null || !submissionTime.isBefore(A)) && (B == null || !submissionTime.isAfter(B));
                })
                .collect(Collectors.toList());

        double completion;
        double performance;
        if (kpi.getCompensatedAchievementPercent() != null) {
            completion = kpi.getCompensatedAchievementPercent();
            performance = kpi.getCompensatedAchievementPercent();
        } else {
            boolean reverse = Boolean.TRUE.equals(kpi.getIsReverseKpi());
            completion = reverse
                    ? KpiMetricsCalculator.reversePercent(complSubs, targetValue)
                    : (targetValue > 0 ? (KpiMetricsCalculator.sum(complSubs) / targetValue) * 100 : 0);
            performance = reverse
                    ? KpiMetricsCalculator.reversePercent(perfSubs, targetValue)
                    : (expectedValueFilter > 0 ? (KpiMetricsCalculator.sum(perfSubs) / expectedValueFilter) * 100 : 0);
        }

        return new double[]{completion, performance};
    }

    public double[] calculateAverages(List<KpiCriteria> kpis, Instant A, Instant B) {
        double sumWeightedCompletion = 0;
        double sumWeight = 0;
        // Hiệu suất nay tính theo ĐÁNH GIÁ của người trong đợt (gom người + đợt từ tập KPI).
        java.util.Set<UUID> users = new java.util.LinkedHashSet<>();
        java.util.Set<UUID> periods = new java.util.LinkedHashSet<>();

        for (KpiCriteria kpi : kpis) {
            // KPI thác nước (có parent) không tính tiến độ/hiệu suất cho người được giao;
            // kết quả của nó đã được tổng hợp lên KPI cha nên bỏ qua để tránh tính trùng.
            if (kpi.getParent() != null) continue;
            // KPI thưởng không phản ánh tiến độ/hiệu suất → không tính vào số trung bình.
            if (Boolean.TRUE.equals(kpi.getIsBonusKpi())) continue;
            // KPI đã dừng nhưng chưa có mức bù (dữ liệu cũ trước khi có cơ chế bù) - bỏ qua an toàn.
            if (kpi.getStatus() == KpiStatus.INACTIVE && kpi.getCompensatedAchievementPercent() == null) continue;
            double[] metrics = calculateKpiMetrics(kpi, A, B);
            double weight = kpi.getWeight() != null && kpi.getWeight() > 0 ? kpi.getWeight() : 1.0;

            sumWeightedCompletion += (metrics[0] * weight);
            sumWeight += weight;

            if (kpi.getAssignees() != null) kpi.getAssignees().forEach(u -> users.add(u.getId()));
            if (kpi.getKpiPeriod() != null) periods.add(kpi.getKpiPeriod().getId());
        }

        double avgProgress = sumWeight > 0 ? (sumWeightedCompletion / sumWeight) : 0.0;
        Double evalPerf = evaluationService.averagePerformance(users, periods);

        return new double[]{
            Math.round(avgProgress * 100.0) / 100.0,
            evalPerf != null ? Math.round(evalPerf * 100.0) / 100.0 : 0.0
        };
    }

    // Helper for pagination & sorting in JPQL
    private String applyPaginationAndSorting(String jpql, Integer page, Integer size, String sortBy, String sortDirection, String defaultSortBy, Set<String> allowedFields) {
        String field = defaultSortBy;
        if (sortBy != null && !sortBy.isBlank() && allowedFields.contains(sortBy.trim())) {
            field = sortBy.trim();
        }
        String direction = "DESC".equalsIgnoreCase(sortDirection) ? "DESC" : "ASC";
        return jpql + " ORDER BY " + field + " " + direction;
    }

    private <T> TypedQuery<T> setPageParams(TypedQuery<T> query, Integer page, Integer size) {
        int p = (page != null && page > 0) ? page - 1 : 0;
        int s = (size != null && size > 0) ? size : 20;
        // Trần cứng 50 (giảm từ 100) để một tool list không đổ quá nhiều dòng nặng vào
        // context của model trong vòng lặp gọi tool; totalCount vẫn báo còn dữ liệu để phân trang.
        if (s > 50) s = 50;
        return query.setFirstResult(p * s).setMaxResults(s);
    }

    // 1. get_org_hierarchy
    @Transactional(readOnly = true)
    public Map<String, Object> getOrgHierarchy(UUID orgUnitId) {
        OrgUnit root = orgUnitRepository.findById(orgUnitId).orElseThrow(() -> new RuntimeException("OrgUnit not found: " + orgUnitId));
        UUID orgId = root.getOrgHierarchyLevel().getOrganization().getId();
        String pathPrefix = root.getPath();
        List<OrgUnit> units = orgUnitRepository.findSubtree(pathPrefix, orgId);

        List<Map<String, Object>> flatList = new ArrayList<>();
        for (OrgUnit u : units) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("name", u.getName());
            entry.put("code", u.getCode());
            entry.put("childCount", u.getChildren().size());
            entry.put("memberCount", userRoleOrgUnitRepository.countUsersByOrganizationUnitId(u.getId()));
            entry.put("status", u.getStatus().toString());
            flatList.add(entry);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("units", flatList);
        return response;
    }

    // 2. get_org_unit_detail
    @Transactional(readOnly = true)
    public Map<String, Object> getOrgUnitDetail(UUID targetId) {
        OrgUnit u = orgUnitRepository.findById(targetId).orElseThrow(() -> new RuntimeException("OrgUnit not found: " + targetId));

        List<UserRoleOrgUnit> managers = userRoleOrgUnitRepository.findManagersByOrgUnitId(targetId);
        List<Map<String, String>> managersInfo = managers.stream().map(m -> {
            Map<String, String> entry = new LinkedHashMap<>();
            User mu = safeRef(m::getUser);
            entry.put("fullName", mu != null ? mu.getFullName() : null);
            entry.put("email", mu != null ? mu.getEmail() : null);
            return entry;
        }).collect(Collectors.toList());

        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("name", u.getName());
        detail.put("code", u.getCode());
        OrgUnit parentUnit = safeRef(u::getParent);
        detail.put("parentName", parentUnit != null ? parentUnit.getName() : null);
        detail.put("childCount", u.getChildren().size());
        detail.put("memberCount", userRoleOrgUnitRepository.countUsersByOrganizationUnitId(targetId));
        detail.put("managers", managersInfo);
        detail.put("email", u.getEmail());
        detail.put("phone", u.getPhone());
        detail.put("address", u.getAddress());
        detail.put("status", u.getStatus().toString());
        return detail;
    }

    // 3. get_child_org_units
    @Transactional(readOnly = true)
    public Map<String, Object> getChildOrgUnits(UUID targetParentId, Boolean recursive, Integer page, Integer size, String sortBy, String sortDirection) {
        boolean recurse = recursive != null && recursive;

        String countJpql;
        String selectJpql;

        if (recurse) {
            String pathPrefix = getPathPrefix(targetParentId);
            countJpql = "SELECT COUNT(o) FROM OrgUnit o WHERE o.path LIKE CONCAT(:pathPrefix, '%') AND o.id <> :parentId AND o.deletedAt IS NULL";
            selectJpql = "SELECT o FROM OrgUnit o WHERE o.path LIKE CONCAT(:pathPrefix, '%') AND o.id <> :parentId AND o.deletedAt IS NULL";
        } else {
            countJpql = "SELECT COUNT(o) FROM OrgUnit o WHERE o.parent.id = :parentId AND o.deletedAt IS NULL";
            selectJpql = "SELECT o FROM OrgUnit o WHERE o.parent.id = :parentId AND o.deletedAt IS NULL";
        }

        // Apply sorting
        Set<String> allowedSorts = Set.of("name", "code", "createdAt", "status");
        selectJpql = applyPaginationAndSorting(selectJpql, page, size, sortBy, sortDirection, "o.name", allowedSorts);

        TypedQuery<Long> countQuery = entityManager.createQuery(countJpql, Long.class).setParameter("parentId", targetParentId);
        TypedQuery<OrgUnit> selectQuery = entityManager.createQuery(selectJpql, OrgUnit.class).setParameter("parentId", targetParentId);

        if (recurse) {
            String pathPrefix = getPathPrefix(targetParentId);
            countQuery.setParameter("pathPrefix", pathPrefix);
            selectQuery.setParameter("pathPrefix", pathPrefix);
        }

        long totalCount = countQuery.getSingleResult();
        List<OrgUnit> childUnits = setPageParams(selectQuery, page, size).getResultList();

        List<Map<String, Object>> childList = new ArrayList<>();
        for (OrgUnit u : childUnits) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("name", u.getName());
            entry.put("code", u.getCode());
            entry.put("childCount", u.getChildren().size());
            entry.put("memberCount", userRoleOrgUnitRepository.countUsersByOrganizationUnitId(u.getId()));
            entry.put("status", u.getStatus().toString());
            childList.add(entry);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("recursive", recurse);
        response.put("totalCount", totalCount);
        response.put("units", childList);
        return response;
    }

    // 4. get_members
    @Transactional(readOnly = true)
    public Map<String, Object> getMembers(UUID targetUnitId, Boolean includeChildUnits, String positionId, Integer page, Integer size, String sortBy, String sortDirection) {
        boolean subtree = includeChildUnits != null && includeChildUnits;
        UUID targetPosId = (positionId != null && !positionId.isBlank()) ? UUID.fromString(positionId) : null;

        String pathPrefix = getPathPrefix(targetUnitId);

        StringBuilder selectBuilder = new StringBuilder("SELECT DISTINCT uro FROM UserRoleOrgUnit uro JOIN FETCH uro.user JOIN FETCH uro.role JOIN FETCH uro.orgUnit WHERE ");
        StringBuilder countBuilder = new StringBuilder("SELECT COUNT(DISTINCT uro.user.id) FROM UserRoleOrgUnit uro WHERE ");

        if (subtree) {
            selectBuilder.append("uro.orgUnit.path LIKE CONCAT(:pathPrefix, '%') ");
            countBuilder.append("uro.orgUnit.path LIKE CONCAT(:pathPrefix, '%') ");
        } else {
            selectBuilder.append("uro.orgUnit.id = :unitId ");
            countBuilder.append("uro.orgUnit.id = :unitId ");
        }

        if (targetPosId != null) {
            selectBuilder.append("AND uro.role.id = :posId ");
            countBuilder.append("AND uro.role.id = :posId ");
        }

        Set<String> allowedSorts = Set.of("uro.user.fullName", "uro.user.email", "uro.user.employeeCode", "uro.role.name", "uro.orgUnit.name");
        String sortedJpql = applyPaginationAndSorting(selectBuilder.toString(), page, size, sortBy, sortDirection, "uro.user.fullName", allowedSorts);

        TypedQuery<Long> countQuery = entityManager.createQuery(countBuilder.toString(), Long.class);
        TypedQuery<UserRoleOrgUnit> selectQuery = entityManager.createQuery(sortedJpql, UserRoleOrgUnit.class);

        if (subtree) {
            countQuery.setParameter("pathPrefix", pathPrefix);
            selectQuery.setParameter("pathPrefix", pathPrefix);
        } else {
            countQuery.setParameter("unitId", targetUnitId);
            selectQuery.setParameter("unitId", targetUnitId);
        }

        if (targetPosId != null) {
            countQuery.setParameter("posId", targetPosId);
            selectQuery.setParameter("posId", targetPosId);
        }

        long totalCount = countQuery.getSingleResult();
        List<UserRoleOrgUnit> assignments = setPageParams(selectQuery, page, size).getResultList();

        List<Map<String, Object>> memberList = new ArrayList<>();
        for (UserRoleOrgUnit uro : assignments) {
            Map<String, Object> entry = new LinkedHashMap<>();
            User mUser = safeRef(uro::getUser);
            OrgUnit mUnit = safeRef(uro::getOrgUnit);
            Role mRole = safeRef(uro::getRole);
            entry.put("fullName", mUser != null ? mUser.getFullName() : null);
            entry.put("email", mUser != null ? mUser.getEmail() : null);
            entry.put("employeeCode", mUser != null ? mUser.getEmployeeCode() : null);
            entry.put("orgUnitName", mUnit != null ? mUnit.getName() : null);
            entry.put("positionName", mRole != null ? mRole.getName() : null);
            entry.put("status", mUser != null && mUser.getStatus() != null ? mUser.getStatus().toString() : null);
            memberList.add(entry);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("includeChildUnits", subtree);
        response.put("totalCount", totalCount);
        response.put("members", memberList);
        return response;
    }

    // 5. get_member_statistics
    @Transactional(readOnly = true)
    public Map<String, Object> getMemberStatistics(UUID targetUnitId, Boolean includeChildUnits, String startDate, String endDate) {
        boolean subtree = includeChildUnits != null && includeChildUnits;
//        UUID targetPosId = (positionId != null && !positionId.isBlank()) ? UUID.fromString(positionId) : null;
        Instant start = parseDate(startDate, Instant.EPOCH);
        Instant end = parseDate(endDate, Instant.now());

        OrgUnit unit = orgUnitRepository.findById(targetUnitId).orElseThrow(() -> new RuntimeException("OrgUnit not found: " + targetUnitId));
        UUID orgId = unit.getOrgHierarchyLevel().getOrganization().getId();
        String pathPrefix = unit.getPath();

        StringBuilder usersJpql = new StringBuilder("SELECT DISTINCT uro.user.id FROM UserRoleOrgUnit uro WHERE ");
        if (subtree) {
            usersJpql.append("uro.orgUnit.path LIKE CONCAT(:pathPrefix, '%') ");
        } else {
            usersJpql.append("uro.orgUnit.id = :unitId ");
        }

//        if (targetPosId != null) {
//            usersJpql.append("AND uro.role.id = :posId ");
//        }

        TypedQuery<UUID> userQuery = entityManager.createQuery(usersJpql.toString(), UUID.class);
        if (subtree) {
            userQuery.setParameter("pathPrefix", pathPrefix);
        } else {
            userQuery.setParameter("unitId", targetUnitId);
        }
//        if (targetPosId != null) {
//            userQuery.setParameter("posId", targetPosId);
//        }

        List<UUID> userIds = userQuery.getResultList();

        Map<String, Object> stats = new LinkedHashMap<>();
        if (userIds.isEmpty()) {
            stats.put("message", "No members found under the specified scope");
            stats.put("averageProgress", 0.0);
            stats.put("averagePerformance", 0.0);
            stats.put("averageRating", 0.0);
            stats.put("totalKpis", 0L);
            stats.put("submissionCount", 0L);
            stats.put("lateSubmissionCount", 0L);
            return stats;
        }

        // Fetch kpis for the users
        List<KpiCriteria> kpis = entityManager.createQuery(
                "SELECT DISTINCT k FROM KpiCriteria k JOIN FETCH k.submissions LEFT JOIN k.assignees a WHERE a.id IN :userIds AND k.parent IS NULL AND k.createdAt >= :start AND k.createdAt <= :end", KpiCriteria.class)
                .setParameter("userIds", userIds)
                .setParameter("start", start)
                .setParameter("end", end)
                .getResultList();

        double[] averages = calculateAverages(kpis, start, end);

        Long submissionCount = entityManager.createQuery(
                "SELECT COUNT(s.id) FROM KpiSubmission s WHERE s.submittedBy.id IN :userIds AND s.createdAt >= :start AND s.createdAt <= :end", Long.class)
                .setParameter("userIds", userIds)
                .setParameter("start", start)
                .setParameter("end", end)
                .getSingleResult();

        Long lateSubmissionCount = entityManager.createQuery(
                "SELECT COUNT(s.id) FROM KpiSubmission s WHERE s.submittedBy.id IN :userIds AND s.periodEnd IS NOT NULL AND s.createdAt > s.periodEnd AND s.createdAt >= :start AND s.createdAt <= :end", Long.class)
                .setParameter("userIds", userIds)
                .setParameter("start", start)
                .setParameter("end", end)
                .getSingleResult();

        Double avgRating = entityManager.createQuery(
                "SELECT AVG(e.score) FROM Evaluation e WHERE e.user.id IN :userIds AND e.createdAt >= :start AND e.createdAt <= :end", Double.class)
                .setParameter("userIds", userIds)
                .setParameter("start", start)
                .setParameter("end", end)
                .getSingleResult();

        stats.put("averageProgress", averages[0]);
        stats.put("averagePerformance", averages[1]);
        stats.put("averageRating", avgRating != null ? Math.round(avgRating * 100.0) / 100.0 : 0.0);
        stats.put("totalKpis", (long) kpis.size());
        stats.put("submissionCount", submissionCount);
        stats.put("lateSubmissionCount", lateSubmissionCount);
        return stats;
    }

    // 6. get_user_summary
    @Transactional(readOnly = true)
    public Map<String, Object> getUserSummary(UUID targetUserId, String startDate, String endDate) {
        Instant start = parseDate(startDate, Instant.EPOCH);
        Instant end = parseDate(endDate, Instant.now());

        User targetUser = userRepository.findById(targetUserId).orElseThrow(() -> new RuntimeException("User not found: " + targetUserId));

        List<KpiCriteria> kpis = entityManager.createQuery(
                "SELECT DISTINCT k FROM KpiCriteria k JOIN FETCH k.submissions LEFT JOIN k.assignees a WHERE a.id = :userId AND k.parent IS NULL AND k.createdAt >= :start AND k.createdAt <= :end", KpiCriteria.class)
                .setParameter("userId", targetUserId)
                .setParameter("start", start)
                .setParameter("end", end)
                .getResultList();

        double[] averages = calculateAverages(kpis, start, end);

        Long submissionCount = entityManager.createQuery(
                "SELECT COUNT(s.id) FROM KpiSubmission s WHERE s.submittedBy.id = :userId AND s.createdAt >= :start AND s.createdAt <= :end", Long.class)
                .setParameter("userId", targetUserId)
                .setParameter("start", start)
                .setParameter("end", end)
                .getSingleResult();

        Long lateSubmissionCount = entityManager.createQuery(
                "SELECT COUNT(s.id) FROM KpiSubmission s WHERE s.submittedBy.id = :userId AND s.periodEnd IS NOT NULL AND s.createdAt > s.periodEnd AND s.createdAt >= :start AND s.createdAt <= :end", Long.class)
                .setParameter("userId", targetUserId)
                .setParameter("start", start)
                .setParameter("end", end)
                .getSingleResult();

        Double avgRating = evaluationRepository.avgScoreByUserId(targetUserId);

        List<Map<String, Object>> kpiDetailsList = new ArrayList<>();
        for (KpiCriteria k : kpis) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("kpiName", k.getName());
            entry.put("targetValue", k.getTargetValue());
            entry.put("unit", k.getUnit());
            entry.put("status", k.getStatus().toString());

            double[] kpiMetrics = calculateKpiMetrics(k, start, end);
            entry.put("progress", round1(kpiMetrics[0]));
            entry.put("performance", round1(kpiMetrics[1]));
            kpiDetailsList.add(entry);
        }

        Map<String, Object> userSummary = new LinkedHashMap<>();
        userSummary.put("fullName", targetUser.getFullName());
        userSummary.put("email", targetUser.getEmail());
        userSummary.put("employeeCode", targetUser.getEmployeeCode());
        userSummary.put("totalKpis", (long) kpis.size());
        userSummary.put("averageProgress", averages[0]);
        userSummary.put("averagePerformance", averages[1]);
        userSummary.put("averageRating", avgRating != null ? Math.round(avgRating * 100.0) / 100.0 : 0.0);
        userSummary.put("submissionCount", submissionCount);
        userSummary.put("lateSubmissionCount", lateSubmissionCount);
        userSummary.put("kpis", kpiDetailsList);
        return userSummary;
    }

    // 7. get_kpis
    @Transactional(readOnly = true)
    public Map<String, Object> getKpis(UUID orgUnitId, String ownerId, String assignedById, String assignedToId, String periodId, String status, Integer page, Integer size, String sortBy, String sortDirection, String startDate, String endDate) {
        String pathPrefix = getPathPrefix(orgUnitId);
        Instant start = parseDate(startDate, Instant.EPOCH);
        Instant end = parseDate(endDate, Instant.now());

        StringBuilder jpql = new StringBuilder("SELECT DISTINCT k FROM KpiCriteria k LEFT JOIN k.assignees a WHERE k.orgUnit.path LIKE CONCAT(:pathPrefix, '%') AND k.createdAt >= :start AND k.createdAt <= :end ");
        StringBuilder countJpql = new StringBuilder("SELECT COUNT(DISTINCT k.id) FROM KpiCriteria k LEFT JOIN k.assignees a WHERE k.orgUnit.path LIKE CONCAT(:pathPrefix, '%') AND k.createdAt >= :start AND k.createdAt <= :end ");

        if (ownerId != null && !ownerId.isBlank()) {
            jpql.append("AND k.createdBy.id = :ownerId ");
            countJpql.append("AND k.createdBy.id = :ownerId ");
        }
        if (assignedById != null && !assignedById.isBlank()) {
            jpql.append("AND k.createdBy.id = :assignerId ");
            countJpql.append("AND k.createdBy.id = :assignerId ");
        }
        if (assignedToId != null && !assignedToId.isBlank()) {
            jpql.append("AND a.id = :assigneeId ");
            countJpql.append("AND a.id = :assigneeId ");
        }
        if (periodId != null && !periodId.isBlank()) {
            jpql.append("AND k.kpiPeriod.id = :periodId ");
            countJpql.append("AND k.kpiPeriod.id = :periodId ");
        }
        if (status != null && !status.isBlank()) {
            jpql.append("AND k.status = :status ");
            countJpql.append("AND k.status = :status ");
        }

        Set<String> allowedSorts = Set.of("name", "weight", "targetValue", "createdAt", "status");
        String sortedJpql = applyPaginationAndSorting(jpql.toString(), page, size, sortBy, sortDirection, "k.createdAt", allowedSorts);

        TypedQuery<Long> countQuery = entityManager.createQuery(countJpql.toString(), Long.class)
                .setParameter("pathPrefix", pathPrefix)
                .setParameter("start", start)
                .setParameter("end", end);

        TypedQuery<KpiCriteria> selectQuery = entityManager.createQuery(sortedJpql, KpiCriteria.class)
                .setParameter("pathPrefix", pathPrefix)
                .setParameter("start", start)
                .setParameter("end", end);

        if (ownerId != null && !ownerId.isBlank()) {
            countQuery.setParameter("ownerId", UUID.fromString(ownerId));
            selectQuery.setParameter("ownerId", UUID.fromString(ownerId));
        }
        if (assignedById != null && !assignedById.isBlank()) {
            countQuery.setParameter("assignerId", UUID.fromString(assignedById));
            selectQuery.setParameter("assignerId", UUID.fromString(assignedById));
        }
        if (assignedToId != null && !assignedToId.isBlank()) {
            countQuery.setParameter("assigneeId", UUID.fromString(assignedToId));
            selectQuery.setParameter("assigneeId", UUID.fromString(assignedToId));
        }
        if (periodId != null && !periodId.isBlank()) {
            countQuery.setParameter("periodId", UUID.fromString(periodId));
            selectQuery.setParameter("periodId", UUID.fromString(periodId));
        }
        if (status != null && !status.isBlank()) {
            countQuery.setParameter("status", KpiStatus.valueOf(status.trim().toUpperCase()));
            selectQuery.setParameter("status", KpiStatus.valueOf(status.trim().toUpperCase()));
        }

        long totalCount = countQuery.getSingleResult();
        List<KpiCriteria> kpiList = setPageParams(selectQuery, page, size).getResultList();

        List<Map<String, Object>> recordsList = new ArrayList<>();
        for (KpiCriteria k : kpiList) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("name", k.getName());
            // description (free-text dài) bị loại khỏi payload để giảm token gửi lên model;
            // phân tích chỉ cần name/progress/performance. Lấy chi tiết qua get_kpi_detail nếu cần.
            entry.put("weight", k.getWeight());
            entry.put("targetValue", k.getTargetValue());
            boolean kReverse = Boolean.TRUE.equals(k.getIsReverseKpi());
            entry.put("isReverseKpi", kReverse);
            entry.put("targetComparator", kReverse ? "≤" : "≥");
            entry.put("unit", k.getUnit());
            entry.put("status", k.getStatus().toString());
            KpiPeriod kPeriod = resolveKpiPeriod(k);
            entry.put("periodName", kPeriod != null ? kPeriod.getName() : null);
            User kCreatedBy = safeRef(k::getCreatedBy);
            OrgUnit kOrgUnit = safeRef(k::getOrgUnit);
            entry.put("createdByFullName", kCreatedBy != null ? kCreatedBy.getFullName() : null);
            entry.put("orgUnitName", kOrgUnit != null ? kOrgUnit.getName() : null);
            entry.put("createdAt", k.getCreatedAt() != null ? k.getCreatedAt().toString() : null);
            double[] metrics = calculateKpiMetrics(k, start, end);
            entry.put("progress", round1(metrics[0]));
            entry.put("performance", round1(metrics[1]));
            recordsList.add(entry);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalCount", totalCount);
        result.put("kpis", recordsList);
        return result;
    }

    // 8. get_kpi_summary
    @Transactional(readOnly = true)
    public Map<String, Object> getKpiSummary(UUID orgUnitId, String ownerId, String assignedById, String assignedToId, String periodId, String status, String startDate, String endDate) {
        String pathPrefix = getPathPrefix(orgUnitId);
        Instant start = parseDate(startDate, Instant.EPOCH);
        Instant end = parseDate(endDate, Instant.now());

        // KPI thác nước (có parent) không được tính như một KPI độc lập trong thống kê.
        StringBuilder filter = new StringBuilder("FROM KpiCriteria k LEFT JOIN k.assignees a WHERE k.parent IS NULL AND k.orgUnit.path LIKE CONCAT(:pathPrefix, '%') AND k.createdAt >= :start AND k.createdAt <= :end ");

        if (ownerId != null && !ownerId.isBlank()) filter.append("AND k.createdBy.id = :ownerId ");
        if (assignedById != null && !assignedById.isBlank()) filter.append("AND k.createdBy.id = :assignerId ");
        if (assignedToId != null && !assignedToId.isBlank()) filter.append("AND a.id = :assigneeId ");
        if (periodId != null && !periodId.isBlank()) filter.append("AND k.kpiPeriod.id = :periodId ");
        if (status != null && !status.isBlank()) filter.append("AND k.status = :status ");

        TypedQuery<Long> totalQuery = entityManager.createQuery("SELECT COUNT(DISTINCT k.id) " + filter.toString(), Long.class)
                .setParameter("pathPrefix", pathPrefix)
                .setParameter("start", start)
                .setParameter("end", end);

        if (ownerId != null && !ownerId.isBlank()) totalQuery.setParameter("ownerId", UUID.fromString(ownerId));
        if (assignedById != null && !assignedById.isBlank()) totalQuery.setParameter("assignerId", UUID.fromString(assignedById));
        if (assignedToId != null && !assignedToId.isBlank()) totalQuery.setParameter("assigneeId", UUID.fromString(assignedToId));
        if (periodId != null && !periodId.isBlank()) totalQuery.setParameter("periodId", UUID.fromString(periodId));
        if (status != null && !status.isBlank()) totalQuery.setParameter("status", KpiStatus.valueOf(status.trim().toUpperCase()));

        Long totalKpis = totalQuery.getSingleResult();

        Map<String, Object> summary = new LinkedHashMap<>();
        if (totalKpis == 0) {
            summary.put("totalKpis", 0L);
            summary.put("averageProgress", 0.0);
            summary.put("averagePerformance", 0.0);
            summary.put("averageRating", 0.0);
            summary.put("completedCount", 0L);
            summary.put("inProgressCount", 0L);
            summary.put("overdueCount", 0L);
            return summary;
        }

        TypedQuery<KpiCriteria> criteriaQuery = entityManager.createQuery("SELECT DISTINCT k FROM KpiCriteria k JOIN FETCH k.submissions LEFT JOIN k.assignees a WHERE k.parent IS NULL AND k.orgUnit.path LIKE CONCAT(:pathPrefix, '%') AND k.createdAt >= :start AND k.createdAt <= :end ", KpiCriteria.class)
                .setParameter("pathPrefix", pathPrefix)
                .setParameter("start", start)
                .setParameter("end", end);

        List<KpiCriteria> kpis = criteriaQuery.getResultList();
        List<UUID> kpiIds = kpis.stream().map(KpiCriteria::getId).toList();

        double[] averages = calculateAverages(kpis, start, end);

        Double avgRating = entityManager.createQuery(
                "SELECT AVG(e.score) FROM Evaluation e WHERE e.kpiPeriod.id IN (SELECT DISTINCT k.kpiPeriod.id FROM KpiCriteria k WHERE k.id IN :kpiIds) AND e.deletedAt IS NULL", Double.class)
                .setParameter("kpiIds", kpiIds)
                .getSingleResult();

        long completed = 0L;
        for (KpiCriteria k : kpis) {
            // KPI thưởng không tính vào số KPI hoàn thành.
            if (Boolean.TRUE.equals(k.getIsBonusKpi())) continue;
            double[] kpiMetrics = calculateKpiMetrics(k, start, end);
            if (kpiMetrics[0] >= 100.0) {
                completed++;
            }
        }

        Long overdue = entityManager.createQuery(
                "SELECT COUNT(DISTINCT k.id) FROM KpiCriteria k JOIN k.kpiPeriod p WHERE k.id IN :kpiIds AND COALESCE(k.deadline, p.endDate) < CURRENT_TIMESTAMP", Long.class)
                .setParameter("kpiIds", kpiIds)
                .getSingleResult();

        summary.put("totalKpis", totalKpis);
        summary.put("averageProgress", averages[0]);
        summary.put("averagePerformance", averages[1]);
        summary.put("averageRating", avgRating != null ? Math.round(avgRating * 100.0) / 100.0 : 0.0);
        summary.put("completedCount", completed);
        summary.put("inProgressCount", totalKpis - completed - overdue > 0 ? totalKpis - completed - overdue : 0L);
        summary.put("overdueCount", overdue);
        return summary;
    }

    // 9. get_kpi_detail
    @Transactional(readOnly = true)
    public Map<String, Object> getKpiDetail(UUID id, String startDate, String endDate) {
        KpiCriteria k = kpiCriteriaRepository.findById(id).orElseThrow(() -> new RuntimeException("KPI not found: " + id));
        Instant start = parseDate(startDate, Instant.EPOCH);
        Instant end = parseDate(endDate, Instant.now());

        double[] metrics = calculateKpiMetrics(k, start, end);

        List<Map<String, String>> assigneesList = k.getAssignees().stream().map(a -> {
            Map<String, String> entry = new LinkedHashMap<>();
            entry.put("fullName", a.getFullName());
            entry.put("email", a.getEmail());
            return entry;
        }).collect(Collectors.toList());

        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("name", k.getName());
        detail.put("description", k.getDescription());
        detail.put("weight", k.getWeight());
        detail.put("targetValue", k.getTargetValue());
        boolean detailReverse = Boolean.TRUE.equals(k.getIsReverseKpi());
        detail.put("isReverseKpi", detailReverse);
        detail.put("targetComparator", detailReverse ? "≤" : "≥");
        detail.put("unit", k.getUnit());
        detail.put("progress", Math.round(metrics[0] * 100.0) / 100.0);
        detail.put("performance", Math.round(metrics[1] * 100.0) / 100.0);
        detail.put("deadline", k.getEffectiveDeadline() != null ? k.getEffectiveDeadline().toString() : null);
        KpiPeriod detailPeriod = resolveKpiPeriod(k);
        detail.put("periodName", detailPeriod != null ? detailPeriod.getName() : null);
        User detailCreatedBy = safeRef(k::getCreatedBy);
        detail.put("createdBy", detailCreatedBy != null ? detailCreatedBy.getFullName() : null);
        detail.put("assignees", assigneesList);
        detail.put("status", k.getStatus().toString());
        return detail;
    }

    // 10. get_kpi_assignees
    @Transactional(readOnly = true)
    public Map<String, Object> getKpiAssignees(UUID id) {
        KpiCriteria k = kpiCriteriaRepository.findById(id).orElseThrow(() -> new RuntimeException("KPI not found: " + id));
        List<User> assignees = k.getAssignees();

        List<Map<String, Object>> assigneeList = new ArrayList<>();
        for (User u : assignees) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("fullName", u.getFullName());
            entry.put("email", u.getEmail());
            entry.put("employeeCode", u.getEmployeeCode());

            List<UserRoleOrgUnit> units = userRoleOrgUnitRepository.findByUserId(u.getId());
            List<Map<String, String>> unitEntries = units.stream().map(uro -> {
                Map<String, String> ue = new LinkedHashMap<>();
                OrgUnit aUnit = safeRef(uro::getOrgUnit);
                Role aRole = safeRef(uro::getRole);
                ue.put("orgUnitName", aUnit != null ? aUnit.getName() : null);
                ue.put("position", aRole != null ? aRole.getName() : null);
                return ue;
            }).collect(Collectors.toList());

            entry.put("units", unitEntries);
            assigneeList.add(entry);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("kpiName", k.getName());
        response.put("assigneesCount", assignees.size());
        response.put("assignees", assigneeList);
        return response;
    }

    // 11. get_kpi_periods
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getKpiPeriods(UUID orgId, String startDate, String endDate) {
        List<KpiPeriod> periods = kpiPeriodRepository.findByOrganizationId(orgId, org.springframework.data.domain.Pageable.unpaged()).getContent();
        Instant start = parseDate(startDate, Instant.EPOCH);
        Instant end = parseDate(endDate, Instant.now());

        List<Map<String, Object>> periodDetails = new ArrayList<>();
        for (KpiPeriod p : periods) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("name", p.getName());
            entry.put("periodType", p.getPeriodType().toString());
            entry.put("startDate", p.getStartDate() != null ? p.getStartDate().toString() : null);
            entry.put("endDate", p.getEndDate() != null ? p.getEndDate().toString() : null);

            Long kpisCount = entityManager.createQuery(
                    "SELECT COUNT(k) FROM KpiCriteria k WHERE k.kpiPeriod.id = :periodId", Long.class)
                    .setParameter("periodId", p.getId())
                    .getSingleResult();

            Long participantsCount = entityManager.createQuery(
                    "SELECT COUNT(DISTINCT a.id) FROM KpiCriteria k JOIN k.assignees a WHERE k.kpiPeriod.id = :periodId", Long.class)
                    .setParameter("periodId", p.getId())
                    .getSingleResult();

            List<KpiCriteria> kpis = entityManager.createQuery(
                    "SELECT DISTINCT k FROM KpiCriteria k JOIN FETCH k.submissions WHERE k.kpiPeriod.id = :periodId", KpiCriteria.class)
                    .setParameter("periodId", p.getId())
                    .getResultList();

            double[] averages = calculateAverages(kpis, start, end);

            entry.put("kpisCount", kpisCount);
            entry.put("participantsCount", participantsCount);
            entry.put("averageProgress", averages[0]);
            entry.put("averagePerformance", averages[1]);
            periodDetails.add(entry);
        }
        return periodDetails;
    }

    // get_time_series — trend of a metric over time + anomaly points
    @Transactional(readOnly = true)
    public Map<String, Object> getTimeSeries(UUID unitId, String metric, String granularity, Integer lookback) {
        String pathPrefix = getPathPrefix(unitId);
        String datePattern = switch (granularity == null ? "MONTH" : granularity.toUpperCase()) {
            case "YEAR" -> "YYYY";
            case "QUARTER" -> "YYYY-\"Q\"Q";
            default -> "YYYY-MM";
        };
        String metricKey = "avg_performance".equalsIgnoreCase(metric) ? "avg_performance" : "completion";
        int keep = (lookback != null && lookback > 0) ? lookback : 6;

        // row: [period_label, total_actual, total_target, avg_performance, submission_count]
        List<Object[]> rows = kpiSubmissionRepository.trendStatsInSubtree(pathPrefix, datePattern);
        if (rows.size() > keep) {
            rows = rows.subList(rows.size() - keep, rows.size());
        }

        List<Map<String, Object>> series = new ArrayList<>();
        for (Object[] r : rows) {
            double value = "avg_performance".equals(metricKey)
                    ? toDouble(r[3])
                    : computeCompletion(toDouble(r[1]), toDouble(r[2]));
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("period", r[0] != null ? r[0].toString() : null);
            point.put("value", round1(value));
            series.add(point);
        }

        // anomalies: period-over-period change crossing SPIKE (+20%) / DROP (-15%) thresholds
        List<Map<String, Object>> anomalies = new ArrayList<>();
        for (int i = 1; i < series.size(); i++) {
            double prev = ((Number) series.get(i - 1).get("value")).doubleValue();
            double cur = ((Number) series.get(i).get("value")).doubleValue();
            if (prev <= 0) continue;
            double deltaPct = (cur - prev) / prev * 100.0;
            if (deltaPct > 20.0 || deltaPct < -15.0) {
                Map<String, Object> a = new LinkedHashMap<>();
                a.put("period", series.get(i).get("period"));
                a.put("value", series.get(i).get("value"));
                a.put("deltaPct", round1(deltaPct));
                a.put("type", deltaPct > 0 ? "SPIKE" : "DROP");
                anomalies.add(a);
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("metric", metricKey);
        result.put("granularity", granularity == null ? "MONTH" : granularity.toUpperCase());
        result.put("series", series);
        result.put("anomalyPoints", anomalies);
        return result;
    }

    private double toDouble(Object o) {
        return o instanceof Number ? ((Number) o).doubleValue() : 0.0;
    }

    private double computeCompletion(double actual, double target) {
        return target <= 0 ? 0.0 : actual / target * 100.0;
    }

    private double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    // 12. get_positions
    @Transactional(readOnly = true)
    public Map<String, Object> getPositions(UUID targetUnitId) {
        List<Object[]> data = entityManager.createQuery(
                "SELECT r.id, r.name, COUNT(DISTINCT uro.user.id) " +
                "FROM UserRoleOrgUnit uro JOIN uro.role r WHERE uro.orgUnit.id = :unitId " +
                "GROUP BY r.id, r.name", Object[].class)
                .setParameter("unitId", targetUnitId)
                .getResultList();

        List<Map<String, Object>> posList = new ArrayList<>();
        for (Object[] row : data) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("positionName", row[1]);
            entry.put("memberCount", row[2]);
            posList.add(entry);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("positionsCount", posList.size());
        result.put("positions", posList);
        return result;
    }

    // 13. rank_members
    @Transactional(readOnly = true)
    public List<Map<String, Object>> rankMembers(UUID orgId, String metric, String order, String scope, String unitId, String kpiId, Integer limit, String startDate, String endDate, UUID contextUnitId) {
        int effectiveLimit = (limit != null && limit > 0) ? limit : 5;
        boolean desc = !"asc".equalsIgnoreCase(order);
        Instant start = parseDate(startDate, Instant.EPOCH);
        Instant end = parseDate(endDate, Instant.now());

        List<User> users = new ArrayList<>();
        if ("kpi".equalsIgnoreCase(scope)) {
            if (kpiId == null || kpiId.isBlank()) throw new RuntimeException("kpiId is required for 'kpi' scope");
            KpiCriteria k = kpiCriteriaRepository.findById(UUID.fromString(kpiId)).orElseThrow(() -> new RuntimeException("KPI not found"));
            users = k.getAssignees();
        } else if ("unit".equalsIgnoreCase(scope)) {
            UUID scopeUnitId = (unitId != null && !unitId.isBlank()) ? UUID.fromString(unitId) : contextUnitId;
            String pathPrefix = getPathPrefix(scopeUnitId);
            users = userRoleOrgUnitRepository.findUsersByOrgUnitPath(pathPrefix + "%", orgId);
        } else {
            users = userRoleOrgUnitRepository.findUsersByOrganizationId(orgId);
        }

        List<Map<String, Object>> rankList = new ArrayList<>();
        for (User u : users) {
            double score = 0.0;

            if ("average_progress".equalsIgnoreCase(metric) || "average_performance".equalsIgnoreCase(metric)) {
                List<KpiCriteria> userKpis = entityManager.createQuery(
                        "SELECT DISTINCT k FROM KpiCriteria k JOIN FETCH k.submissions LEFT JOIN k.assignees a WHERE a.id = :userId AND k.createdAt >= :start AND k.createdAt <= :end", KpiCriteria.class)
                        .setParameter("userId", u.getId())
                        .setParameter("start", start)
                        .setParameter("end", end)
                        .getResultList();
                double[] averages = calculateAverages(userKpis, start, end);
                score = "average_progress".equalsIgnoreCase(metric) ? averages[0] : averages[1];
            } else if ("total_progress".equalsIgnoreCase(metric)) {
                Double sumTotalActual = entityManager.createQuery(
                        "SELECT SUM(s.actualValue) FROM KpiSubmission s WHERE s.submittedBy.id = :userId AND s.status = 'APPROVED' AND s.createdAt >= :start AND s.createdAt <= :end", Double.class)
                        .setParameter("userId", u.getId())
                        .setParameter("start", start)
                        .setParameter("end", end)
                        .getSingleResult();
                score = sumTotalActual != null ? sumTotalActual : 0.0;
            } else if ("average_rating".equalsIgnoreCase(metric)) {
                Double avgRate = evaluationRepository.avgScoreByUserId(u.getId());
                score = avgRate != null ? avgRate : 0.0;
            } else if ("late_submission_count".equalsIgnoreCase(metric)) {
                Long count = entityManager.createQuery(
                        "SELECT COUNT(s.id) FROM KpiSubmission s WHERE s.submittedBy.id = :userId AND s.periodEnd IS NOT NULL AND s.createdAt > s.periodEnd AND s.createdAt >= :start AND s.createdAt <= :end", Long.class)
                        .setParameter("userId", u.getId())
                        .setParameter("start", start)
                        .setParameter("end", end)
                        .getSingleResult();
                score = count;
            } else if ("missing_submission_count".equalsIgnoreCase(metric)) {
                Long count = entityManager.createQuery(
                        "SELECT COUNT(DISTINCT k.id) FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND k.id NOT IN (SELECT DISTINCT s.kpiCriteria.id FROM KpiSubmission s WHERE s.submittedBy.id = :userId AND s.createdAt >= :start AND s.createdAt <= :end)", Long.class)
                        .setParameter("userId", u.getId())
                        .setParameter("start", start)
                        .setParameter("end", end)
                        .getSingleResult();
                score = count;
            } else { // submission_count
                Long count = entityManager.createQuery(
                        "SELECT COUNT(s.id) FROM KpiSubmission s WHERE s.submittedBy.id = :userId AND s.createdAt >= :start AND s.createdAt <= :end", Long.class)
                        .setParameter("userId", u.getId())
                        .setParameter("start", start)
                        .setParameter("end", end)
                        .getSingleResult();
                score = count;
            }

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("fullName", u.getFullName());
            entry.put("email", u.getEmail());
            entry.put("score", Math.round(score * 100.0) / 100.0);
            rankList.add(entry);
        }

        rankList.sort((a, b) -> {
            double s1 = ((Number) a.get("score")).doubleValue();
            double s2 = ((Number) b.get("score")).doubleValue();
            return desc ? Double.compare(s2, s1) : Double.compare(s1, s2);
        });

        List<Map<String, Object>> sliced = rankList.stream().limit(effectiveLimit).collect(Collectors.toList());

        int rank = 1;
        for (Map<String, Object> entry : sliced) {
            entry.put("rank", rank++);
        }

        return sliced;
    }

    // 14. rank_org_units
    @Transactional(readOnly = true)
    public List<Map<String, Object>> rankOrgUnits(UUID orgUnitId, String metric, String order, Integer limit, String startDate, String endDate) {
        int effectiveLimit = (limit != null && limit > 0) ? limit : 5;
        boolean desc = !"asc".equalsIgnoreCase(order);
        Instant start = parseDate(startDate, Instant.EPOCH);
        Instant end = parseDate(endDate, Instant.now());

        OrgUnit root = orgUnitRepository.findById(orgUnitId).orElseThrow(() -> new RuntimeException("OrgUnit not found: " + orgUnitId));
        UUID orgIdFromUnit = root.getOrgHierarchyLevel().getOrganization().getId();
        String pathPrefix = root.getPath();
        List<OrgUnit> units = orgUnitRepository.findSubtree(pathPrefix, orgIdFromUnit);

        List<Map<String, Object>> rankList = new ArrayList<>();
        for (OrgUnit u : units) {
            double score = 0.0;

            if ("average_progress".equalsIgnoreCase(metric) || "average_performance".equalsIgnoreCase(metric)) {
                List<KpiCriteria> uKpis = entityManager.createQuery(
                        "SELECT DISTINCT k FROM KpiCriteria k JOIN FETCH k.submissions WHERE k.orgUnit.id = :unitId AND k.createdAt >= :start AND k.createdAt <= :end", KpiCriteria.class)
                        .setParameter("unitId", u.getId())
                        .setParameter("start", start)
                        .setParameter("end", end)
                        .getResultList();
                double[] averages = calculateAverages(uKpis, start, end);
                score = "average_progress".equalsIgnoreCase(metric) ? averages[0] : averages[1];
            } else if ("average_rating".equalsIgnoreCase(metric)) {
                Double avgRate = evaluationRepository.avgScoreByOrgUnitId(u.getId());
                score = avgRate != null ? avgRate : 0.0;
            } else { // member_count
                score = userRoleOrgUnitRepository.countUsersByOrganizationUnitId(u.getId());
            }

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("orgUnitName", u.getName());
            entry.put("score", Math.round(score * 100.0) / 100.0);
            rankList.add(entry);
        }

        rankList.sort((a, b) -> {
            double s1 = ((Number) a.get("score")).doubleValue();
            double s2 = ((Number) b.get("score")).doubleValue();
            return desc ? Double.compare(s2, s1) : Double.compare(s1, s2);
        });

        List<Map<String, Object>> sliced = rankList.stream().limit(effectiveLimit).collect(Collectors.toList());

        int rank = 1;
        for (Map<String, Object> entry : sliced) {
            entry.put("rank", rank++);
        }

        return sliced;
    }

    // 15. get_kpi_risk_analysis
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getKpiRiskAnalysis(UUID orgUnitId, String startDate, String endDate) {
        String pathPrefix = getPathPrefix(orgUnitId);
        Instant start = parseDate(startDate, Instant.EPOCH);
        Instant end = parseDate(endDate, Instant.now());

        List<KpiCriteria> kpis = entityManager.createQuery(
                "SELECT DISTINCT k FROM KpiCriteria k JOIN FETCH k.submissions WHERE k.orgUnit.path LIKE CONCAT(:pathPrefix, '%') AND k.createdAt >= :start AND k.createdAt <= :end AND k.status = 'APPROVED'", KpiCriteria.class)
                .setParameter("pathPrefix", pathPrefix)
                .setParameter("start", start)
                .setParameter("end", end)
                .getResultList();

        List<Map<String, Object>> riskList = new ArrayList<>();
        for (KpiCriteria k : kpis) {
            // KPI thác nước được tổng hợp lên KPI cha -> không đánh giá rủi ro riêng.
            if (k.getParent() != null) continue;
            double[] kpiMetrics = calculateKpiMetrics(k, start, end);
            double progress = kpiMetrics[0];
            Instant deadline = k.getEffectiveDeadline();

            boolean overdue = deadline != null && deadline.isBefore(Instant.now()) && progress < 100.0;
            boolean nearDeadline = deadline != null && deadline.isAfter(Instant.now()) && deadline.isBefore(Instant.now().plusSeconds(7 * 24 * 3600)) && progress < 50.0;
            boolean stagnant = k.getCreatedAt() != null && k.getCreatedAt().isBefore(Instant.now().minusSeconds(30L * 24 * 3600)) && progress < 30.0;

            if (overdue || nearDeadline || stagnant) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("kpiName", k.getName());
                entry.put("progress", Math.round(progress * 100.0) / 100.0);
                entry.put("deadline", deadline != null ? deadline.toString() : null);

                if (overdue) {
                    entry.put("riskLevel", "HIGH");
                    entry.put("riskScore", 95);
                    entry.put("cause", "KPI đã quá hạn deadline nhưng tiến độ chưa hoàn thành.");
                } else if (nearDeadline) {
                    entry.put("riskLevel", "HIGH");
                    entry.put("riskScore", 80);
                    entry.put("cause", "Sắp đến deadline trong vòng 7 ngày nhưng tiến độ hiện tại dưới 50%.");
                } else {
                    entry.put("riskLevel", "MEDIUM");
                    entry.put("riskScore", 55);
                    entry.put("cause", "KPI đã tạo hơn 30 ngày nhưng tiến độ dưới 30% (Trì trệ).");
                }
                entry.put("status", k.getStatus().toString());
                riskList.add(entry);
            }
        }
        return riskList;
    }

    // 16. get_dashboard_summary
    @Transactional(readOnly = true)
    public Map<String, Object> getDashboardSummary(UUID orgUnitId, UUID orgId, String startDate, String endDate) {
        String pathPrefix = getPathPrefix(orgUnitId);
        Instant start = parseDate(startDate, Instant.EPOCH);
        Instant end = parseDate(endDate, Instant.now());

        long totalEmployees = userRoleOrgUnitRepository.countUsersInSubtree(pathPrefix, orgId);
        long totalUnits = orgUnitRepository.countChildrenInSubtree(pathPrefix) + 1;

        long totalKpis = kpiCriteriaRepository.countInSubtree(pathPrefix, start, end);
        long totalPeriods = kpiPeriodRepository.findByOrganizationId(orgId, org.springframework.data.domain.Pageable.unpaged()).getTotalElements();

        List<KpiCriteria> kpis = entityManager.createQuery(
                "SELECT DISTINCT k FROM KpiCriteria k JOIN FETCH k.submissions WHERE k.orgUnit.path LIKE CONCAT(:pathPrefix, '%') AND k.createdAt >= :start AND k.createdAt <= :end", KpiCriteria.class)
                .setParameter("pathPrefix", pathPrefix)
                .setParameter("start", start)
                .setParameter("end", end)
                .getResultList();

        double[] averages = calculateAverages(kpis, start, end);

        Double avgRating = entityManager.createQuery(
                "SELECT AVG(e.score) FROM Evaluation e WHERE e.orgUnit.path LIKE CONCAT(:pathPrefix, '%') AND e.createdAt >= :start AND e.createdAt <= :end", Double.class)
                .setParameter("pathPrefix", pathPrefix)
                .setParameter("start", start)
                .setParameter("end", end)
                .getSingleResult();

        Long pendingKpiCount = entityManager.createQuery(
                "SELECT COUNT(k) FROM KpiCriteria k WHERE k.orgUnit.path LIKE CONCAT(:pathPrefix, '%') AND k.status = 'SUBMITTED'", Long.class)
                .setParameter("pathPrefix", pathPrefix)
                .getSingleResult();

        Long lateSubmissionCount = entityManager.createQuery(
                "SELECT COUNT(s.id) FROM KpiSubmission s WHERE s.orgUnit.path LIKE CONCAT(:pathPrefix, '%') AND s.periodEnd IS NOT NULL AND s.createdAt > s.periodEnd AND s.createdAt >= :start AND s.createdAt <= :end", Long.class)
                .setParameter("pathPrefix", pathPrefix)
                .setParameter("start", start)
                .setParameter("end", end)
                .getSingleResult();

        Long overdueKpiCount = entityManager.createQuery(
                "SELECT COUNT(DISTINCT k.id) FROM KpiCriteria k JOIN k.kpiPeriod p WHERE k.orgUnit.path LIKE CONCAT(:pathPrefix, '%') AND COALESCE(k.deadline, p.endDate) < CURRENT_TIMESTAMP AND k.status = 'APPROVED' AND k.createdAt >= :start AND k.createdAt <= :end", Long.class)
                .setParameter("pathPrefix", pathPrefix)
                .setParameter("start", start)
                .setParameter("end", end)
                .getSingleResult();

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalEmployees", totalEmployees);
        summary.put("totalUnits", totalUnits);
        summary.put("totalKpis", totalKpis);
        summary.put("totalPeriods", totalPeriods);
        summary.put("averageProgress", averages[0]);
        summary.put("averagePerformance", averages[1]);
        summary.put("averageRating", avgRating != null ? Math.round(avgRating * 100.0) / 100.0 : 0.0);
        summary.put("pendingKpisCount", pendingKpiCount);
        summary.put("lateSubmissionsCount", lateSubmissionCount);
        summary.put("overdueKpisCount", overdueKpiCount);
        return summary;
    }

    // get_my_info — current logged-in user's own profile
    @Transactional(readOnly = true)
    public Map<String, Object> getCurrentUserProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng hiện tại."));

        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(user.getId());

        List<Map<String, Object>> units = assignments.stream().map(a -> {
            Map<String, Object> m = new LinkedHashMap<>();
            OrgUnit aUnit = safeRef(a::getOrgUnit);
            Role aRole = safeRef(a::getRole);
            m.put("orgUnitName", aUnit != null ? aUnit.getName() : null);
            m.put("orgUnitCode", aUnit != null ? aUnit.getCode() : null);
            m.put("levelName", aUnit != null && aUnit.getOrgHierarchyLevel() != null
                    ? aUnit.getOrgHierarchyLevel().getUnitTypeName() : null);
            m.put("positionName", aRole != null ? aRole.getName() : null);
            m.put("isManager", aRole != null && aRole.getRank() != null && aRole.getRank() <= 1);
            return m;
        }).collect(Collectors.toList());

        String organizationName = assignments.stream()
                .map(a -> safeRef(a::getOrgUnit))
                .filter(Objects::nonNull)
                .findFirst()
                .map(ou -> ou.getOrgHierarchyLevel().getOrganization().getName())
                .orElse(null);

        String managedUnitName = assignments.stream()
                .map(a -> new AbstractMap.SimpleEntry<>(safeRef(a::getRole), safeRef(a::getOrgUnit)))
                .filter(e -> e.getKey() != null && e.getKey().getRank() != null && e.getKey().getRank() <= 1 && e.getValue() != null)
                .min(Comparator.comparingInt(e -> e.getKey().getRank()))
                .map(e -> e.getValue().getName())
                .orElse(null);

        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("fullName", user.getFullName());
        profile.put("email", user.getEmail());
        profile.put("employeeCode", user.getEmployeeCode());
        profile.put("phone", user.getPhone());
        profile.put("status", user.getStatus() != null ? user.getStatus().toString() : null);
        profile.put("organizationName", organizationName);
        profile.put("managedUnitName", managedUnitName);
        profile.put("units", units);
        return profile;
    }

    // ==========================================
    // Search helpers — return UUID + basic info
    // ==========================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> searchUsers(UUID orgId, String keyword, String orgUnitId, String positionName, int limit) {
        UUID unitId = (orgUnitId != null && !orgUnitId.isBlank()) ? UUID.fromString(orgUnitId) : null;
        String pos = (positionName != null && positionName.isBlank()) ? null : positionName;
        String kw = (keyword != null && keyword.isBlank()) ? null : keyword;
        List<User> users = userRepository.searchForTool(orgId, unitId, pos, kw,
                org.springframework.data.domain.PageRequest.of(0, limit));
        return users.stream().map(u -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", u.getId());
            m.put("fullName", u.getFullName());
            m.put("email", u.getEmail());
            m.put("phone", u.getPhone());
            List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(u.getId());
            if (!assignments.isEmpty()) {
                UserRoleOrgUnit first = assignments.get(0);
                OrgUnit firstUnit = safeRef(first::getOrgUnit);
                Role firstRole = safeRef(first::getRole);
                m.put("orgUnitId", firstUnit != null ? firstUnit.getId() : null);
                m.put("orgUnitName", firstUnit != null ? firstUnit.getName() : null);
                m.put("roleName", firstRole != null ? firstRole.getName() : null);
            }
            return m;
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> searchOrgUnits(UUID orgId, String keyword, int limit) {
        String kw = (keyword != null && keyword.isBlank()) ? null : keyword;
        List<OrgUnit> units = orgUnitRepository.searchByKeyword(orgId, kw,
                org.springframework.data.domain.PageRequest.of(0, limit));
        return units.stream().map(o -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", o.getId());
            m.put("name", o.getName());
            m.put("code", o.getCode());
            m.put("levelName", o.getOrgHierarchyLevel() != null ? o.getOrgHierarchyLevel().getUnitTypeName() : null);
            OrgUnit oParent = safeRef(o::getParent);
            m.put("parentId", oParent != null ? oParent.getId() : null);
            m.put("parentName", oParent != null ? oParent.getName() : null);
            return m;
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> searchKpis(UUID orgId, String keyword, int limit) {
        String kw = (keyword != null && keyword.isBlank()) ? null : keyword;
        List<KpiCriteria> kpis = kpiCriteriaRepository.searchByKeyword(orgId, kw,
                org.springframework.data.domain.PageRequest.of(0, limit));
        return kpis.stream().map(k -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", k.getId());
            m.put("name", k.getName());
            m.put("status", k.getStatus());
            OrgUnit kUnit = safeRef(k::getOrgUnit);
            m.put("orgUnitId", kUnit != null ? kUnit.getId() : null);
            m.put("orgUnitName", kUnit != null ? kUnit.getName() : null);
            KpiPeriod mPeriod = resolveKpiPeriod(k);
            m.put("periodId", mPeriod != null ? mPeriod.getId() : null);
            m.put("periodName", mPeriod != null ? mPeriod.getName() : null);
            return m;
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> searchPositions(UUID orgId, String keyword, int limit) {
        String kw = (keyword != null && keyword.isBlank()) ? null : keyword;
        List<com.kpitracking.entity.Role> roles = roleRepository.searchByKeyword(orgId, kw,
                org.springframework.data.domain.PageRequest.of(0, limit));
        return roles.stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.getId());
            m.put("name", r.getName());
            m.put("level", r.getLevel());
            m.put("rank", r.getRank());
            return m;
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> searchKpiPeriods(UUID orgId, String keyword, int limit) {
        String kw = (keyword != null && keyword.isBlank()) ? null : keyword;
        List<KpiPeriod> periods = kpiPeriodRepository.searchByKeyword(orgId, kw,
                org.springframework.data.domain.PageRequest.of(0, limit));
        return periods.stream().map(p -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", p.getId());
            m.put("name", p.getName());
            m.put("periodType", p.getPeriodType());
            m.put("startDate", p.getStartDate());
            m.put("endDate", p.getEndDate());
            return m;
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getSubmissionHistory(
            UUID kpiId, String userId, String status,
            String startDate, String endDate, int limit) {
        Instant from = parseDate(startDate, Instant.EPOCH);
        Instant to = parseDate(endDate, Instant.now());

        List<KpiSubmission> submissions = kpiSubmissionRepository
                .findByKpiCriteriaIdAndDeletedAtIsNull(kpiId);

        java.util.stream.Stream<KpiSubmission> filtered = submissions.stream();
        if (userId != null && !userId.isBlank()) {
            UUID uid = UUID.fromString(userId);
            filtered = filtered.filter(s -> s.getSubmittedBy().getId().equals(uid));
        }
        if (status != null && !status.isBlank()) {
            filtered = filtered.filter(s -> s.getStatus().toString().equalsIgnoreCase(status));
        }
        filtered = filtered.filter(s -> s.getCreatedAt().isAfter(from) && s.getCreatedAt().isBefore(to));

        List<Map<String, Object>> items = filtered
                .limit(limit > 0 ? limit : 20)
                .map(s -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    KpiCriteria sKpi = safeRef(s::getKpiCriteria);
                    User submittedBy = safeRef(s::getSubmittedBy);
                    User reviewedBy = safeRef(s::getReviewedBy);
                    m.put("kpiName", sKpi != null ? sKpi.getName() : null);
                    m.put("submittedBy", submittedBy != null ? submittedBy.getFullName() : null);
                    m.put("actualValue", s.getActualValue());
                    m.put("status", s.getStatus());
                    m.put("periodStart", s.getPeriodStart());
                    m.put("periodEnd", s.getPeriodEnd());
                    m.put("createdAt", s.getCreatedAt());
                    m.put("reviewedBy", reviewedBy != null ? reviewedBy.getFullName() : null);
                    m.put("reviewedAt", s.getReviewedAt());
                    m.put("reviewNote", s.getReviewNote());
                    return m;
                }).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", items.size());
        result.put("submissions", items);
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getKpiPeriodBreakdown(
            UUID kpiId, String userId, String granularity,
            String startDate, String endDate) {
        String datePattern = switch (granularity != null ? granularity : "MONTH") {
            case "QUARTER" -> "YYYY-\"Q\"Q";
            case "YEAR" -> "YYYY";
            default -> "YYYY-MM";
        };

        java.util.List<Object[]> rows = (userId != null && !userId.isBlank())
                ? kpiSubmissionRepository.kpiTrendByPeriodAndUser(kpiId, UUID.fromString(userId), datePattern)
                : kpiSubmissionRepository.kpiTrendByPeriod(kpiId, datePattern);

        List<Map<String, Object>> series = rows.stream().map(row -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("period", row[0]);
            m.put("totalActual", toDouble(row[1]));
            m.put("target", toDouble(row[2]));
            m.put("completionPct", toDouble(row[3]));
            m.put("submissionCount", ((Number) row[4]).longValue());
            return m;
        }).collect(Collectors.toList());

        String trend = "stable";
        if (series.size() >= 2) {
            double first = ((Number) series.get(0).get("completionPct")).doubleValue();
            double last = ((Number) series.get(series.size() - 1).get("completionPct")).doubleValue();
            double delta = last - first;
            if (delta > 5) trend = "improving";
            else if (delta < -5) trend = "declining";
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("granularity", datePattern);
        result.put("trend", trend);
        result.put("series", series);
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getNonSubmitters(
            UUID orgUnitId, String periodId, String startDate, String endDate, int limit) {
        String pathPrefix = getPathPrefix(orgUnitId);
        java.util.List<Object[]> rows = kpiCriteriaRepository.findTopNonSubmittersInSubtree(
                pathPrefix, parseDate(startDate, Instant.EPOCH), parseDate(endDate, Instant.now()), limit > 0 ? limit : 20);

        List<Map<String, Object>> users = rows.stream().map(row -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("fullName", row[1]);
            m.put("email", row[2]);
            m.put("missingKpiCount", ((Number) row[3]).longValue());
            return m;
        }).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", users.size());
        result.put("nonSubmitters", users);
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> compareOrgUnits(
            java.util.List<UUID> unitIds, String startDate, String endDate) {
        List<Map<String, Object>> units = unitIds.stream().map(uid -> {
            try {
                Map<String, Object> detail = getOrgUnitDetail(uid);
                Map<String, Object> stats = getMemberStatistics(uid, false, startDate, endDate);

                Map<String, Object> m = new LinkedHashMap<>();
                m.put("unitName", detail.get("name"));
                m.put("unitCode", detail.get("code"));
                m.putAll(stats);
                return m;
            } catch (Exception e) {
                log.warn("Error comparing org unit {}: {}", uid, e.getMessage());
                return null;
            }
        }).filter(java.util.Objects::nonNull).collect(Collectors.toList());

        String winnerUnitName = units.stream()
                .max(java.util.Comparator.comparingDouble(m -> toDouble(m.get("avgPerformance"))))
                .map(m -> m.get("unitName") != null ? m.get("unitName").toString() : null)
                .orElse(null);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("compareCount", units.size());
        result.put("units", units);
        result.put("bestPerformerUnitName", winnerUnitName);
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getMembersByPerformanceThreshold(
            UUID orgUnitId, double threshold, String direction,
            String metric, String startDate, String endDate, int limit) {
        UUID orgId = orgUnitRepository.findById(orgUnitId)
                .map(ou -> ou.getOrgHierarchyLevel().getOrganization().getId())
                .orElseThrow(() -> new RuntimeException("Org unit not found: " + orgUnitId));

        String dir = ("above".equalsIgnoreCase(direction)) ? "DESC" : "ASC";
        String met = (metric != null && !metric.isBlank()) ? metric : "average_performance";

        java.util.List<Map<String, Object>> ranked = rankMembers(
                orgId, met, dir, "unit", orgUnitId.toString(), null,
                200, startDate, endDate, orgUnitId);

        List<Map<String, Object>> filtered = ranked.stream()
                .filter(m -> {
                    double score = toDouble(m.get("score"));
                    return ("below".equalsIgnoreCase(direction)) ? score <= threshold : score >= threshold;
                })
                .limit(limit > 0 ? limit : 20)
                .collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("threshold", threshold);
        result.put("direction", direction != null ? direction : "below");
        result.put("metric", met);
        result.put("count", filtered.size());
        result.put("members", filtered);
        return result;
    }
}
