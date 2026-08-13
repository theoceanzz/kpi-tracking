package com.kpitracking.service.reward;

import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Tra cứu người dùng hiện tại và tổ chức của họ.
 *
 * <p>Gom vào một chỗ vì {@code users} KHÔNG có cột {@code organization_id} — tổ chức
 * phải suy ra qua chuỗi {@code UserRoleOrgUnit → OrgUnit → OrgHierarchyLevel → Organization}.
 * Sáu service của phần thưởng đều cần phép suy này; chép tay sáu lần là sáu chỗ có thể
 * lệch khi cấu trúc thay đổi.
 */
@Component
@RequiredArgsConstructor
public class RewardContext {

    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;

    public User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
    }

    public UUID getCurrentOrgId() {
        return getOrgIdOf(getCurrentUser().getId());
    }

    public UUID getOrgIdOf(UUID userId) {
        List<UserRoleOrgUnit> roles = userRoleOrgUnitRepository.findByUserId(userId);
        if (roles.isEmpty()) {
            throw new ResourceNotFoundException("Tổ chức", "userId", userId);
        }
        return roles.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
    }

    /**
     * Đơn vị "chính" của một người: đơn vị có {@code path} ngắn nhất trong số các đơn vị
     * họ được gán. Một người có thể thuộc nhiều đơn vị, nên cần một quy tắc xác định
     * thay vì lấy bừa phần tử đầu — nếu không, cùng một đề nghị thưởng có thể rơi vào
     * đơn vị khác nhau giữa hai lần chạy và người duyệt sẽ đổi theo.
     */
    public OrgUnit getPrimaryOrgUnit(UUID userId) {
        return userRoleOrgUnitRepository.findByUserId(userId).stream()
                .map(UserRoleOrgUnit::getOrgUnit)
                .filter(u -> u != null && u.getPath() != null)
                .min(Comparator.comparing(OrgUnit::getPath))
                .orElseThrow(() -> new ResourceNotFoundException("Đơn vị của người dùng", "userId", userId));
    }
}
