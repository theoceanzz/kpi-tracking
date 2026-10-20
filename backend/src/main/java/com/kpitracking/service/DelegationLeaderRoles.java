package com.kpitracking.service;

import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.OrgUnitDelegation;
import com.kpitracking.entity.Role;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.repository.OrgUnitDelegationRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.audit.SecurityAuditEvent;
import com.kpitracking.security.audit.SecurityAuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Uỷ quyền "ký thay trưởng đơn vị" ⇒ một vai trò trưởng THẬT ở đơn vị đích trong thời hạn uỷ quyền.
 *
 * <p>Vì sao không dạy từng luật về bảng uỷ quyền: "ai là trưởng" được hỏi ở hàng chục chỗ bằng
 * vai trò rank ≤ 1 trong cây (luật xem KPI viết ở ba nơi, chuỗi duyệt, công việc, BSC, 360°…). Sót
 * một chỗ là người được uỷ quyền chấm được mà không xem được KPI. Gán hẳn vai trò thì mọi luật tự
 * đúng. Đơn vị đã có trưởng ⇒ thành đồng trưởng (chuỗi duyệt đã hỗ trợ nhiều trưởng một đơn vị).
 *
 * <p>Vai trò được gán là chính vai trò quản lý cao nhất người đó đang giữ — uỷ quyền vẫn không phát
 * quyền mới. Gán đúng MỘT lần ({@code leader_role_granted_at}): quản trị gỡ tay ở màn thành viên
 * thì không bị gán lại. Phần lớn luật không đọc {@code expires_at} của vai trò, nên hết hạn / thu
 * hồi phải XOÁ dòng — việc của {@link #sync()} và {@link #release(UUID)}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DelegationLeaderRoles {

    private final OrgUnitDelegationRepository delegationRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final SecurityAuditService securityAudit;

    /** Gán vai trò trưởng cho một uỷ quyền nếu nó đang hiệu lực và chưa từng gán. Luỹ đẳng. */
    @Transactional
    public void grantIfDue(OrgUnitDelegation d, Instant now) {
        if (!Boolean.TRUE.equals(d.getCanActAsLeader()) || d.getLeaderRoleGrantedAt() != null || !d.isActiveAt(now)) {
            return;
        }
        User delegate = d.getDelegateUser();
        OrgUnit target = d.getOrgUnit();
        Optional<Role> role = leaderRoleOf(delegate.getId());
        if (role.isEmpty()) {
            // Người này không còn vai trò quản lý nào: uỷ quyền chỉ còn nới phạm vi như cũ.
            log.warn("Delegation {}: delegate {} has no manager role left, leader role not granted", d.getId(), delegate.getId());
            d.setLeaderRoleGrantedAt(now);
            delegationRepository.save(d);
            return;
        }

        if (!userRoleOrgUnitRepository.existsByUserIdAndRoleIdAndOrgUnitId(delegate.getId(), role.get().getId(), target.getId())) {
            userRoleOrgUnitRepository.save(UserRoleOrgUnit.builder()
                    .user(delegate)
                    .role(role.get())
                    .orgUnit(target)
                    .assignedBy(d.getCreatedBy())
                    .assignedAt(now)
                    .expiresAt(d.getExpiresAt())
                    .delegationId(d.getId())
                    .build());
            securityAudit.record(SecurityAuditEvent.ROLE_ASSIGNED, SecurityAuditService.OK,
                    "USER", delegate.getId().toString(),
                    "Uỷ quyền " + d.getId() + ": gán vai trò " + role.get().getName() + " tại đơn vị " + target.getName());
        }
        d.setLeaderRoleGrantedAt(now);
        delegationRepository.save(d);
    }

    /** Gỡ vai trò trưởng sinh từ một uỷ quyền (thu hồi). */
    @Transactional
    public void release(UUID delegationId) {
        List<UserRoleOrgUnit> rows = userRoleOrgUnitRepository.findByDelegationId(delegationId);
        // delete từng entity (không bulk) để AuthorityCacheInvalidator xoá cache quyền của người đó.
        rows.forEach(this::remove);
    }

    /**
     * Đối chiếu mỗi phút: gỡ vai trò của uỷ quyền đã hết hạn / bị thu hồi, gán vai trò cho uỷ quyền
     * vừa tới ngày bắt đầu. Hai nửa đều luỹ đẳng nên chạy trùng giữa hai máy chủ cũng vô hại.
     */
    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    @Transactional
    public void sync() {
        Instant now = Instant.now();
        List<OrgUnitDelegation> active = delegationRepository.findAllActive();
        Set<UUID> activeIds = active.stream().map(OrgUnitDelegation::getId).collect(Collectors.toSet());

        for (UserRoleOrgUnit row : userRoleOrgUnitRepository.findDelegationGenerated()) {
            if (!activeIds.contains(row.getDelegationId())) remove(row);
        }
        for (OrgUnitDelegation d : active) {
            grantIfDue(d, now);
        }
    }

    private void remove(UserRoleOrgUnit row) {
        userRoleOrgUnitRepository.delete(row);
        securityAudit.record(SecurityAuditEvent.ROLE_ASSIGNED, SecurityAuditService.OK,
                "USER", row.getUser().getId().toString(),
                "Uỷ quyền " + row.getDelegationId() + " kết thúc: gỡ vai trò " + row.getRole().getName()
                        + " tại đơn vị " + row.getOrgUnit().getName());
    }

    /**
     * Vai trò quản lý cao nhất người này đang giữ ở cây gốc của họ (trưởng trước phó, rồi cấp vai
     * trò nhỏ hơn). Bỏ qua vai trò cũng sinh từ uỷ quyền — không để uỷ quyền nối đuôi nhau.
     */
    private Optional<Role> leaderRoleOf(UUID userId) {
        return userRoleOrgUnitRepository.findByUserId(userId).stream()
                .filter(a -> a.getDelegationId() == null)
                .map(UserRoleOrgUnit::getRole)
                .filter(r -> r != null && r.getDeletedAt() == null && r.getRank() != null && r.getRank() <= 1)
                .min(Comparator.comparingInt((Role r) -> r.getRank())
                        .thenComparingInt(r -> r.getLevel() != null ? r.getLevel() : Integer.MAX_VALUE));
    }
}
