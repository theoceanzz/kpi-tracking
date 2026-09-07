package com.kpitracking.service.notification;

import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Chọn NGƯỜI NHẬN theo phân cấp tổ chức.
 *
 * <p>Trước đây mọi sự kiện đều lấy hết những người có quyền ở MỌI cấp cha ông của đơn vị.
 * Nhân viên một tổ nộp báo cáo là tổ trưởng, trưởng phòng, giám đốc khối và tổng giám đốc
 * cùng nhận thư — ba người trên cùng chẳng có việc gì để làm với lá thư đó, và chính vì
 * luôn nhận thư không phải việc của mình nên họ ngừng đọc.
 *
 * <p>Lớp này thay bằng quy tắc "đúng một cấp":
 * <ul>
 *   <li>Nhân viên nộp ⇒ chỉ trưởng đơn vị của họ nhận.</li>
 *   <li>Trưởng đơn vị nộp ⇒ chính họ bị loại, thang leo tiếp lên cấp trên ⇒ sếp nhận.</li>
 *   <li>Trưởng đơn vị duyệt xong ⇒ mới báo lên cấp trên kế tiếp ({@link #nearestAbove}).</li>
 * </ul>
 *
 * <p>Đường dẫn đơn vị có dạng {@code /id-ông/id-cha/id-con/} (trigger {@code fn_set_org_path}
 * dựng), nên chuỗi cha ông suy ra được từ chính chuỗi ký tự, không phải truy vấn đệ quy.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationRoutingService {

    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;

    /**
     * Chuỗi đường dẫn từ chính đơn vị lên tới gốc: {@code /a/b/c/} ⇒
     * {@code [/a/b/c/, /a/b/, /a/]}. Sâu nhất đứng trước.
     */
    static List<String> ancestorPaths(String path) {
        List<String> result = new ArrayList<>();
        if (path == null || path.isBlank()) return result;
        String current = path.endsWith("/") ? path : path + "/";
        while (current.length() > 1) {
            result.add(current);
            int cut = current.lastIndexOf('/', current.length() - 2);
            if (cut < 0) break;
            current = current.substring(0, cut + 1);
        }
        return result;
    }

    /**
     * Người có quyền ở cấp GẦN NHẤT tính từ {@code unit} đi lên. Dừng ngay ở cấp đầu tiên
     * có người đủ điều kiện — không leo tiếp lên các cấp trên nữa.
     *
     * @param excludeUserIds người không được nhận (người vừa gây ra sự kiện, người đã báo rồi)
     */
    @Transactional(readOnly = true)
    public List<User> nearestWithPermission(OrgUnit unit, String permissionCode, Collection<UUID> excludeUserIds) {
        if (unit == null) return List.of();
        return nearestWithin(ancestorPaths(unit.getPath()), permissionCode, excludeUserIds);
    }

    /**
     * Như {@link #nearestWithPermission} nhưng bắt đầu từ cấp NGAY TRÊN cấp mà {@code actorId}
     * đang đứng — dùng khi trưởng đơn vị duyệt xong và cần báo lên sếp.
     *
     * <p>Không thể chỉ loại {@code actorId} rồi tìm cấp gần nhất: đơn vị có phó phòng cùng
     * quyền thì thư sẽ dừng lại ở phó phòng chứ không bao giờ lên tới sếp.
     *
     * <p>Người thao tác không giữ vai trò nào trong nhánh này (VD nhân sự duyệt hộ từ đơn vị
     * khác) thì không có "cấp của họ" để leo lên — khi đó quay về quy tắc cấp gần nhất.
     */
    @Transactional(readOnly = true)
    public List<User> nearestAbove(OrgUnit unit, UUID actorId, String permissionCode, Collection<UUID> excludeUserIds) {
        if (unit == null) return List.of();
        List<String> chain = ancestorPaths(unit.getPath());
        if (chain.isEmpty()) return List.of();

        List<String> actorPaths = userRoleOrgUnitRepository.findOrgUnitPathsOfUserWithin(actorId, chain);
        if (actorPaths.isEmpty()) {
            return nearestWithin(chain, permissionCode, excludeUserIds);
        }

        // Cấp SÂU NHẤT của người thao tác trong nhánh này = vị trí họ vừa hành động.
        String actorPath = actorPaths.stream().max(Comparator.comparingInt(String::length)).orElseThrow();
        List<String> above = chain.stream().filter(p -> p.length() < actorPath.length()).toList();
        if (above.isEmpty()) {
            // Người thao tác đã ở cấp cao nhất của nhánh — không còn ai để báo lên.
            return List.of();
        }
        return nearestWithin(above, permissionCode, excludeUserIds);
    }

    private List<User> nearestWithin(List<String> orderedPaths, String permissionCode, Collection<UUID> excludeUserIds) {
        if (orderedPaths.isEmpty()) return List.of();

        Set<UUID> excluded = excludeUserIds == null ? Set.of() : new HashSet<>(excludeUserIds);

        // Một truy vấn cho cả chuỗi rồi lọc trong bộ nhớ: hỏi từng cấp một sẽ tốn tới N vòng
        // đi lại DB cho một việc chỉ để chọn ra vài người nhận.
        Map<String, List<User>> byPath = new LinkedHashMap<>();
        for (Object[] row : userRoleOrgUnitRepository.findUsersWithPermissionAtOrgUnitPaths(orderedPaths, permissionCode)) {
            byPath.computeIfAbsent((String) row[0], k -> new ArrayList<>()).add((User) row[1]);
        }

        for (String path : orderedPaths) {
            List<User> candidates = byPath.get(path);
            if (candidates == null) continue;

            Set<UUID> seen = new HashSet<>();
            List<User> eligible = candidates.stream()
                    .filter(u -> u != null && !excluded.contains(u.getId()) && seen.add(u.getId()))
                    .toList();
            if (!eligible.isEmpty()) return eligible;
        }
        return List.of();
    }
}
