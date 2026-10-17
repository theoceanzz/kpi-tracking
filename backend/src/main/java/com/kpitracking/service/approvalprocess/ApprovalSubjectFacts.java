package com.kpitracking.service.approvalprocess;


import com.kpitracking.enums.approvalprocess.ApprovalObjectType;

import java.util.*;

import com.kpitracking.entity.kpi.KpiAdjustmentRequest;
import com.kpitracking.entity.kpi.KpiCriteria;
import com.kpitracking.entity.organization.OrgUnit;
import com.kpitracking.entity.user.User;
/**
 * Những gì điều kiện duyệt được phép nhìn vào, chụp từ KPI / yêu cầu điều chỉnh / người gửi ngay
 * lúc gửi duyệt. Tách ra record để bộ đánh giá điều kiện là thuần logic.
 *
 * @param orgUnitAncestry đơn vị của KPI và mọi cấp cha (cho toán tử "kể cả đơn vị con")
 * @param requesterRoleIds vai trò người gửi đang giữ (còn hạn) ở bất kỳ đơn vị nào
 * @param targetChangePercent |chỉ tiêu xin − chỉ tiêu hiện tại| / |hiện tại| × 100; null khi không tính được
 * @param score con số chính của đề xuất: điểm quản lý đề xuất (đánh giá đợt), số điểm thưởng (khen
 *              thưởng, đổi quà); null với đối tượng khác
 * @param form giá trị widget của đơn từ mà điều kiện đọc được, theo id widget: số ({@link Double}) hoặc
 *             id các phương án đã chọn ({@code List<String>}); rỗng với đối tượng khác
 */
public record ApprovalSubjectFacts(
        ApprovalObjectType objectType,
        String subObject,
        UUID orgUnitId,
        Set<UUID> orgUnitAncestry,
        UUID orgLevelId,
        UUID requesterId,
        Set<UUID> requesterRoleIds,
        String kpiType,
        String frequency,
        UUID periodId,
        Double weight,
        boolean bonus,
        String requestKind,
        Double targetChangePercent,
        Double score,
        Map<String, Object> form) {

    public static final String KIND_CHANGE_TARGET = "CHANGE_TARGET";
    public static final String KIND_DEACTIVATE = "DEACTIVATE";

    /**
     * @param requesterRoleIds đã lọc phân công hết hạn ở phía gọi
     */
    public static ApprovalSubjectFacts of(KpiCriteria kpi, KpiAdjustmentRequest adjustment, User requester,
                                          Set<UUID> requesterRoleIds) {
        OrgUnit unit = kpi.getOrgUnit();
        Set<UUID> ancestry = new LinkedHashSet<>();
        Set<UUID> guard = new HashSet<>();
        for (OrgUnit u = unit; u != null && guard.add(u.getId()); u = u.getParent()) {
            ancestry.add(u.getId());
        }

        String kpiType = kpi.getKpiType() == null ? null : kpi.getKpiType().name();
        ApprovalObjectType objectType = adjustment == null ? ApprovalObjectType.KPI_CRITERIA : ApprovalObjectType.KPI_ADJUSTMENT;
        String requestKind = null;
        Double changePercent = null;
        if (adjustment != null) {
            requestKind = adjustment.isDeactivationRequest() ? KIND_DEACTIVATE : KIND_CHANGE_TARGET;
            Double current = kpi.getTargetValue();
            Double requested = adjustment.getRequestedTargetValue();
            if (!adjustment.isDeactivationRequest() && current != null && requested != null && current != 0d) {
                changePercent = Math.abs(requested - current) / Math.abs(current) * 100d;
            }
        }

        return new ApprovalSubjectFacts(
                objectType,
                adjustment == null ? kpiType : requestKind,
                unit == null ? null : unit.getId(),
                ancestry,
                unit == null || unit.getOrgHierarchyLevel() == null ? null : unit.getOrgHierarchyLevel().getId(),
                requester == null ? null : requester.getId(),
                requesterRoleIds == null ? Set.of() : requesterRoleIds,
                kpiType,
                kpi.getFrequency() == null ? null : kpi.getFrequency().name(),
                kpi.getKpiPeriod() == null ? null : kpi.getKpiPeriod().getId(),
                kpi.getWeight(),
                Boolean.TRUE.equals(kpi.getIsBonusKpi()),
                requestKind,
                changePercent,
                null,
                Map.of());
    }

    /**
     * Đối tượng không gắn một chỉ tiêu (đánh giá đợt, chốt kỳ): chỉ có trường chung (đơn vị, người
     * gửi, chức vụ) cộng đợt và điểm nếu có.
     */
    public static ApprovalSubjectFacts generic(ApprovalObjectType type, String subObject, OrgUnit unit, User requester,
                                               Set<UUID> requesterRoleIds, UUID periodId, Double score) {
        Set<UUID> ancestry = new LinkedHashSet<>();
        Set<UUID> guard = new HashSet<>();
        for (OrgUnit u = unit; u != null && guard.add(u.getId()); u = u.getParent()) {
            ancestry.add(u.getId());
        }
        return new ApprovalSubjectFacts(type, subObject,
                unit == null ? null : unit.getId(), ancestry,
                unit == null || unit.getOrgHierarchyLevel() == null ? null : unit.getOrgHierarchyLevel().getId(),
                requester == null ? null : requester.getId(),
                requesterRoleIds == null ? Set.of() : requesterRoleIds,
                null, null, periodId, null, false, null, null, score, Map.of());
    }

    /** Cùng dữ kiện, khác đối tượng — vd. bài nộp kết quả đọc lại trường của KPI mà nó báo cáo. */
    public ApprovalSubjectFacts forObject(ApprovalObjectType type) {
        return new ApprovalSubjectFacts(type, subObject, orgUnitId, orgUnitAncestry, orgLevelId, requesterId,
                requesterRoleIds, kpiType, frequency, periodId, weight, bonus, requestKind, targetChangePercent, score, form);
    }

    /** Đơn từ: trường chung (đơn vị, người gửi, chức vụ) cộng giá trị widget đã được backend chuẩn hoá. */
    public static ApprovalSubjectFacts forForm(OrgUnit unit, User requester, Set<UUID> requesterRoleIds,
                                               Map<String, Object> form) {
        ApprovalSubjectFacts base = generic(ApprovalObjectType.FORM_REQUEST, null, unit, requester, requesterRoleIds, null, null);
        return new ApprovalSubjectFacts(base.objectType, null, base.orgUnitId, base.orgUnitAncestry, base.orgLevelId,
                base.requesterId, base.requesterRoleIds, null, null, null, null, false, null, null, null,
                form == null ? Map.of() : form);
    }

    /** Cùng dữ kiện, đối tượng con khác — vd. id đơn từ để chọn quy trình theo đơn. */
    public ApprovalSubjectFacts withSubObject(String sub) {
        return new ApprovalSubjectFacts(objectType, sub, orgUnitId, orgUnitAncestry, orgLevelId, requesterId,
                requesterRoleIds, kpiType, frequency, periodId, weight, bonus, requestKind, targetChangePercent, score, form);
    }

    public Map<String, Object> formOrEmpty() {
        return form == null ? Map.of() : form;
    }
}
