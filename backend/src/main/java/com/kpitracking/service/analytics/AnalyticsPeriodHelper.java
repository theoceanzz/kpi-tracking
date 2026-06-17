package com.kpitracking.service.analytics;

import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Helper dùng chung cho các service thống kê khi người dùng lọc theo một "đợt" (KpiPeriod).
 *
 * <p>Khi {@code periodId != null}: nạp đợt (scope theo tổ chức của người dùng hiện tại), rồi
 * <b>clamp</b> cửa sổ thời gian [from, to] vào trong biên [startDate, endDate] của đợt. Khi
 * {@code periodId == null} thì giữ nguyên from/to (hành vi cũ).
 */
@Component
@RequiredArgsConstructor
public class AnalyticsPeriodHelper {

    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final KpiPeriodRepository kpiPeriodRepository;

    /** Cửa sổ thời gian đã được clamp theo đợt (nếu có). */
    public record Window(Instant from, Instant to) {}

    /**
     * Trả về cửa sổ thời gian áp dụng cho truy vấn thống kê.
     * Nếu có {@code periodId}: giao [from, to] với biên của đợt; nếu from/to null thì lấy thẳng biên đợt.
     */
    public Window window(Instant from, Instant to, UUID periodId) {
        if (periodId == null) return new Window(from, to);

        KpiPeriod p = resolveOrgScoped(periodId);
        Instant pStart = p.getStartDate();
        Instant pEnd = p.getEndDate();

        Instant effFrom = pStart;
        if (from != null && (pStart == null || from.isAfter(pStart))) effFrom = from;

        Instant effTo = pEnd;
        if (to != null && (pEnd == null || to.isBefore(pEnd))) effTo = to;

        return new Window(effFrom, effTo);
    }

    /**
     * Nạp đợt theo id và xác thực đợt thuộc tổ chức của người dùng hiện tại.
     * Ném {@link IllegalArgumentException} nếu không tồn tại hoặc khác tổ chức.
     */
    public KpiPeriod resolveOrgScoped(UUID periodId) {
        KpiPeriod period = kpiPeriodRepository.findById(periodId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đợt KPI"));
        UUID orgId = currentUserOrgId();
        if (orgId != null && period.getOrganization() != null
                && !orgId.equals(period.getOrganization().getId())) {
            throw new IllegalArgumentException("Đợt KPI không thuộc tổ chức của bạn");
        }
        return period;
    }

    private UUID currentUserOrgId() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) return null;
        List<UserRoleOrgUnit> roles = userRoleOrgUnitRepository.findByUserId(user.getId());
        if (roles.isEmpty()) return null;
        return roles.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
    }
}
