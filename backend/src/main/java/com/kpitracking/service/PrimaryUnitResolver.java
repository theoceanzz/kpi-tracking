package com.kpitracking.service;

import com.kpitracking.service.user.UserService;

import com.kpitracking.entity.organization.OrgUnit;
import com.kpitracking.entity.user.User;
import com.kpitracking.entity.user.UserRoleOrgUnit;
import com.kpitracking.repository.user.UserRepository;
import com.kpitracking.repository.user.UserRoleOrgUnitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Đơn vị CHÍNH của một người — MỘT luật cho cả hệ thống (V46).
 *
 * <p>Một người có thể giữ nhiều vai trò trong một đơn vị và thuộc nhiều đơn vị (kiêm nhiệm,
 * hoặc dòng "nhân viên" {@code UserService} tự sinh ở đơn vị cha). Quyền thì cộng dồn mọi
 * phân công (PermissionChecker), nhưng những thứ chỉ được tính MỘT lần cho mỗi người — ai chấm
 * đợt/kỳ/hạnh kiểm, nằm trong bell curve phòng nào, thẻ BSC nào, phòng nào chốt thì khoá điểm,
 * thưởng ghi về đâu, đếm cơ cấu nhân sự — đều đi qua đây. Đừng tự lấy {@code findByUserId(..).get(0)}.
 *
 * <p>Luật: đơn vị ghim ở {@code users.primary_org_unit_id} nếu người đó còn một phân công THẬT ở
 * đó; ngược lại vai trò cao nhất (rank nhỏ — trưởng phòng kiêm nhân viên một team vẫn "ở" phòng),
 * rồi đơn vị sâu nhất (dòng nhân viên tự sinh ở đơn vị cha không kéo người về cha), rồi path. Vai trò sinh từ uỷ
 * quyền ký thay (V45) không bao giờ thành đơn vị chính khi người đó còn phân công khác. Phân
 * công trả về là vai trò CAO NHẤT tại đơn vị chính (người vừa Trưởng vừa Nhân viên ⇒ Trưởng).
 */
@Component
@RequiredArgsConstructor
public class PrimaryUnitResolver {

    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final UserRepository userRepository;

    private static final Comparator<UserRoleOrgUnit> BY_RANK =
            Comparator.comparingInt(PrimaryUnitResolver::rankOf);

    private static final Comparator<UserRoleOrgUnit> FALLBACK =
            Comparator.comparingInt(PrimaryUnitResolver::rankOf)
                    .thenComparingInt((UserRoleOrgUnit a) -> -depth(a.getOrgUnit()))
                    .thenComparing(a -> a.getOrgUnit().getPath() == null ? "" : a.getOrgUnit().getPath());

    /**
     * Phân công đại diện trong {@code assignments} — phải là TOÀN BỘ phân công của một người
     * (truyền một phần, vd. chỉ các dòng trong một cây con, sẽ chọn sai). Null nếu không có.
     */
    public static UserRoleOrgUnit pick(Collection<UserRoleOrgUnit> assignments, UUID pinnedUnitId) {
        if (assignments == null || assignments.isEmpty()) return null;
        List<UserRoleOrgUnit> live = assignments.stream()
                .filter(a -> a.getOrgUnit() != null && a.getOrgUnit().getDeletedAt() == null)
                .toList();
        List<UserRoleOrgUnit> own = live.stream().filter(a -> a.getDelegationId() == null).toList();
        List<UserRoleOrgUnit> pool = own.isEmpty() ? live : own;
        if (pool.isEmpty()) return null;
        if (pinnedUnitId != null) {
            UserRoleOrgUnit pinned = pool.stream()
                    .filter(a -> pinnedUnitId.equals(a.getOrgUnit().getId()))
                    .min(BY_RANK).orElse(null);
            if (pinned != null) return pinned;
        }
        // FALLBACK xếp rank trước nên dòng thắng đã là vai trò cao nhất tại đơn vị của nó.
        return pool.stream().min(FALLBACK).orElse(null);
    }

    /** Phân công đại diện của một người; null nếu họ chưa thuộc đơn vị nào. */
    @Transactional(readOnly = true)
    public UserRoleOrgUnit assignmentOf(User user) {
        if (user == null) return null;
        return pick(userRoleOrgUnitRepository.findByUserId(user.getId()), user.getPrimaryOrgUnitId());
    }

    @Transactional(readOnly = true)
    public UserRoleOrgUnit assignmentOf(UUID userId) {
        if (userId == null) return null;
        UUID pinned = userRepository.findById(userId).map(User::getPrimaryOrgUnitId).orElse(null);
        return pick(userRoleOrgUnitRepository.findByUserId(userId), pinned);
    }

    /** Đơn vị chính; null nếu chưa thuộc đơn vị nào. */
    @Transactional(readOnly = true)
    public OrgUnit unitOf(UUID userId) {
        UserRoleOrgUnit a = assignmentOf(userId);
        return a != null ? a.getOrgUnit() : null;
    }

    @Transactional(readOnly = true)
    public OrgUnit unitOf(User user) {
        UserRoleOrgUnit a = assignmentOf(user);
        return a != null ? a.getOrgUnit() : null;
    }

    /** Phân công đại diện của nhiều người, một truy vấn. Người chưa thuộc đơn vị nào không có trong map. */
    @Transactional(readOnly = true)
    public Map<UUID, UserRoleOrgUnit> assignmentsOf(Collection<UUID> userIds) {
        if (userIds == null || userIds.isEmpty()) return Map.of();
        return pickAll(userRoleOrgUnitRepository.findByUserIdInWithUnit(Set.copyOf(userIds)));
    }

    /**
     * Gom {@code rows} theo người rồi chọn. {@code rows} phải chứa MỌI phân công của từng người có
     * mặt (vd. mọi dòng của cả tổ chức); đơn vị ghim đọc từ {@code row.getUser()}.
     */
    public static Map<UUID, UserRoleOrgUnit> pickAll(Collection<UserRoleOrgUnit> rows) {
        Map<UUID, List<UserRoleOrgUnit>> byUser = new LinkedHashMap<>();
        Map<UUID, UUID> pinned = new HashMap<>();
        for (UserRoleOrgUnit r : rows) {
            if (r.getUser() == null) continue;
            byUser.computeIfAbsent(r.getUser().getId(), k -> new ArrayList<>()).add(r);
            pinned.putIfAbsent(r.getUser().getId(), r.getUser().getPrimaryOrgUnitId());
        }
        Map<UUID, UserRoleOrgUnit> out = new LinkedHashMap<>();
        byUser.forEach((uid, list) -> {
            UserRoleOrgUnit p = pick(list, pinned.get(uid));
            if (p != null) out.put(uid, p);
        });
        return out;
    }

    /**
     * Những người có ĐƠN VỊ CHÍNH nằm trong {@code unitIds} (thường là một cây con), kèm phân công
     * đại diện. Người chỉ kiêm nhiệm ở đây (đơn vị chính ở chỗ khác) bị loại — họ được đánh giá,
     * xếp loại ở đơn vị chính.
     */
    @Transactional(readOnly = true)
    public Map<UUID, UserRoleOrgUnit> primaryWithin(Collection<UUID> unitIds) {
        if (unitIds == null || unitIds.isEmpty()) return Map.of();
        Set<UUID> scope = Set.copyOf(unitIds);
        List<UUID> candidates = userRoleOrgUnitRepository.findByOrgUnitIdIn(scope).stream()
                .map(a -> a.getUser() != null ? a.getUser().getId() : null)
                .filter(Objects::nonNull).distinct().toList();
        Map<UUID, UserRoleOrgUnit> out = new LinkedHashMap<>();
        assignmentsOf(candidates).forEach((uid, a) -> {
            if (scope.contains(a.getOrgUnit().getId())) out.put(uid, a);
        });
        return out;
    }

    /**
     * MỌI người thuộc {@code unitIds} (kể cả kiêm nhiệm), mỗi người MỘT dòng: phân công đại diện nếu
     * đơn vị chính nằm trong phạm vi, không thì vai trò cao nhất của họ trong phạm vi. Dùng cho
     * thống kê đếm / liệt kê nhân sự (cơ cấu, xếp hạng, xuất báo cáo) — không đếm trùng người có
     * nhiều vai trò, và vai trò được chọn không phụ thuộc thứ tự dòng trả về. Chấm điểm / xếp loại
     * dùng {@link #primaryWithin} thay vì hàm này.
     */
    @Transactional(readOnly = true)
    public Map<UUID, UserRoleOrgUnit> membersWithin(Collection<UUID> unitIds) {
        if (unitIds == null || unitIds.isEmpty()) return Map.of();
        Set<UUID> scope = Set.copyOf(unitIds);
        Map<UUID, List<UserRoleOrgUnit>> inScope = new LinkedHashMap<>();
        for (UserRoleOrgUnit a : userRoleOrgUnitRepository.findByOrgUnitIdIn(scope)) {
            if (a.getUser() != null) inScope.computeIfAbsent(a.getUser().getId(), k -> new ArrayList<>()).add(a);
        }
        Map<UUID, UserRoleOrgUnit> primary = assignmentsOf(inScope.keySet());
        Map<UUID, UserRoleOrgUnit> out = new LinkedHashMap<>();
        inScope.forEach((uid, rows) -> {
            UserRoleOrgUnit p = primary.get(uid);
            UserRoleOrgUnit chosen = p != null && scope.contains(p.getOrgUnit().getId()) ? p : pick(rows, null);
            if (chosen != null) out.put(uid, chosen);
        });
        return out;
    }

    /**
     * Ghim đơn vị chính đang hiệu lực vào cột nếu cột trống hoặc trỏ vào đơn vị người đó đã rời.
     * Gọi TRƯỚC khi gán thêm đơn vị (để đơn vị mới, dù sâu hơn, không âm thầm thành "nhà") và SAU
     * khi gỡ phân công (để cột không trỏ vào chỗ cũ).
     */
    @Transactional
    public void ensurePinned(User user) {
        if (user == null) return;
        List<UserRoleOrgUnit> rows = userRoleOrgUnitRepository.findByUserId(user.getId());
        UUID current = user.getPrimaryOrgUnitId();
        boolean valid = current != null && rows.stream().anyMatch(a -> a.getDelegationId() == null
                && a.getOrgUnit() != null && a.getOrgUnit().getDeletedAt() == null
                && current.equals(a.getOrgUnit().getId()));
        if (valid) return;
        UserRoleOrgUnit p = pick(rows, null);
        UUID next = p != null && p.getDelegationId() == null ? p.getOrgUnit().getId() : null;
        if (!Objects.equals(current, next)) {
            user.setPrimaryOrgUnitId(next);
            userRepository.save(user);
        }
    }

    @Transactional
    public void ensurePinned(Collection<UUID> userIds) {
        if (userIds == null || userIds.isEmpty()) return;
        userRepository.findAllById(Set.copyOf(userIds)).forEach(this::ensurePinned);
    }

    /** Ghim một đơn vị người đó ĐANG thuộc (phân công thật) làm đơn vị chính. */
    @Transactional
    public boolean pin(User user, UUID orgUnitId) {
        boolean member = userRoleOrgUnitRepository.findByUserIdAndOrgUnitId(user.getId(), orgUnitId).stream()
                .anyMatch(a -> a.getDelegationId() == null);
        if (!member) return false;
        if (!orgUnitId.equals(user.getPrimaryOrgUnitId())) {
            user.setPrimaryOrgUnitId(orgUnitId);
            userRepository.save(user);
        }
        return true;
    }

    private static int rankOf(UserRoleOrgUnit a) {
        Integer r = a.getRole() != null ? a.getRole().getRank() : null;
        return r != null ? r : 99;
    }

    /** Độ sâu theo path vật chất hoá ("/root/" = 1, "/root/{id}/" = 2). */
    static int depth(OrgUnit unit) {
        if (unit == null || unit.getPath() == null) return 0;
        int n = 0;
        for (String seg : unit.getPath().split("/")) if (!seg.isEmpty()) n++;
        return n;
    }
}
