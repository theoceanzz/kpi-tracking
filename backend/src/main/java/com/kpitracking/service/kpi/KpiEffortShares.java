package com.kpitracking.service.kpi;

import com.kpitracking.service.evaluation.EvaluationService;

import com.kpitracking.entity.kpi.KpiCriteria;
import com.kpitracking.entity.organization.OrgUnit;
import com.kpitracking.entity.user.User;
import com.kpitracking.entity.user.UserRoleOrgUnit;
import com.kpitracking.entity.user.UserUnitEffortShare;
import com.kpitracking.repository.user.UserRepository;
import com.kpitracking.repository.user.UserRoleOrgUnitRepository;
import com.kpitracking.repository.user.UserUnitEffortShareRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;

import com.kpitracking.service.PrimaryUnitResolver;
/**
 * "% công sức" của người kiêm nhiệm (V46) — MỘT luật cho điểm KPI đợt.
 *
 * <p>Mỗi đơn vị giao KPI vẫn phải đủ 100% của riêng nó (chốt theo đơn vị ở KpiCriteriaService).
 * Người thuộc HAI nhánh trở lên vì thế có 100% + 100%… Trước đây điểm hệ thống cộng hết rồi chia
 * cho tổng trọng số, nên mỗi nhánh ngầm chiếm phần bằng nhau và KPI thưởng của mọi nhánh cộng đủ.
 * Giờ: điểm = Σ (% công sức của nhánh × % hoàn thành KPI của nhánh), KPI thưởng nhân theo % công sức.
 *
 * <p>NHÁNH = đơn vị người đó thuộc (phân công thật, không tính vai trò uỷ quyền), bỏ những đơn vị là
 * tổ tiên của một đơn vị khác họ cũng thuộc — dòng "nhân viên" tự sinh ở đơn vị cha gộp vào nhánh con,
 * nên người chỉ ở một phòng (dù có dòng ở cả phòng lẫn công ty) luôn có MỘT nhánh và điểm y như cũ.
 * KPI thuộc nhánh chứa đơn vị của KPI (KPI giao từ đơn vị cha thuộc nhánh con bên dưới nó; mơ hồ thì
 * về nhánh của đơn vị chính).
 *
 * <p>Cách áp: trả hệ số nhân vào trọng số từng KPI ({@link #factors}); chỉ khác rỗng khi KPI của đợt
 * thực sự rơi vào từ hai nhánh trở lên. Nơi tính điểm nhân {@code weight × factor} rồi giữ nguyên công
 * thức — phiếu chấm ở frontend nhận đúng bảng hệ số này qua score-preview.
 */
@Component
@RequiredArgsConstructor
public class KpiEffortShares {

    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final UserRepository userRepository;
    private final UserUnitEffortShareRepository shareRepository;
    private final com.kpitracking.repository.user.UserPeriodEffortShareRepository periodShareRepository;

    /** Một nhánh của người này kèm % công sức hiệu lực và việc % đó có được đặt tay không. */
    public record Branch(OrgUnit unit, double sharePercent, boolean configured) {}

    /**
     * KPI của đợt đã chia theo nhánh. {@code active} = KPI rơi vào ≥ 2 nhánh (mới áp % công sức);
     * {@code frozen} = % lấy từ bản chụp của đợt (đã chấm), không phải cấu hình hiện tại.
     */
    public record Split(Map<UUID, UUID> branchOfKpi, Map<UUID, Branch> branches, boolean active, boolean frozen) {
        public Split(Map<UUID, UUID> branchOfKpi, Map<UUID, Branch> branches, boolean active) {
            this(branchOfKpi, branches, active, false);
        }
    }

    /** Các nhánh + % công sức hiệu lực, đơn vị chính đứng đầu. Một nhánh ⇒ danh sách một phần tử. */
    @Transactional(readOnly = true)
    public List<Branch> branchesOf(UUID userId) {
        return branchesOf(userRepository.findById(userId).orElse(null), userId,
                userRoleOrgUnitRepository.findByUserId(userId));
    }

    /** Như trên với phân công đã nạp sẵn (danh sách người dùng) — chỉ truy vấn thêm khi ≥ 2 nhánh. */
    @Transactional(readOnly = true)
    public List<Branch> branchesOf(User user, UUID userId, List<UserRoleOrgUnit> rows) {
        List<OrgUnit> units = branchUnits(rows);
        if (units.isEmpty()) return List.of();
        UserRoleOrgUnit primary = PrimaryUnitResolver.pick(rows, user != null ? user.getPrimaryOrgUnitId() : null);
        OrgUnit home = primary != null ? branchContaining(units, primary.getOrgUnit()) : null;
        if (home != null) {
            units.remove(home);
            units.add(0, home);
        }
        Map<UUID, Double> configured = new HashMap<>();
        if (units.size() > 1) {
            for (UserUnitEffortShare s : shareRepository.findByUserId(userId)) configured.put(s.getOrgUnitId(), s.getSharePercent());
        }
        return withShares(units, configured);
    }

    /** Chia KPI theo nhánh của {@code userId}. */
    @Transactional(readOnly = true)
    public Split split(UUID userId, Collection<KpiCriteria> kpis) {
        List<Branch> branches = branchesOf(userId);
        Map<UUID, Branch> byId = new LinkedHashMap<>();
        branches.forEach(b -> byId.put(b.unit().getId(), b));
        Map<UUID, UUID> branchOfKpi = new HashMap<>();
        if (branches.isEmpty()) return new Split(branchOfKpi, byId, false);
        List<OrgUnit> units = branches.stream().map(Branch::unit).toList();
        Set<UUID> used = new LinkedHashSet<>();
        for (KpiCriteria kpi : kpis) {
            if (kpi.getId() == null) continue;
            UUID b = branchOfUnit(units, kpi.getOrgUnit());
            branchOfKpi.put(kpi.getId(), b);
            used.add(b);
        }
        return new Split(branchOfKpi, byId, used.size() > 1);
    }

    /**
     * Như {@link #split(UUID, Collection)} cho KPI của MỘT đợt: đợt đã chấm (có bản chụp V46) thì %
     * công sức lấy từ bản chụp — sửa % về sau không làm đổi điểm của đợt đã chấm. Nhánh không có
     * trong bản chụp (gán thêm sau khi chấm) giữ % hiện tại rồi chuẩn hoá như thường.
     */
    @Transactional(readOnly = true)
    public Split split(UUID userId, UUID kpiPeriodId, Collection<KpiCriteria> kpis) {
        Split base = split(userId, kpis);
        if (kpiPeriodId == null || !base.active()) return base;
        List<com.kpitracking.entity.user.UserPeriodEffortShare> frozen = periodShareRepository.findByUserIdAndKpiPeriodId(userId, kpiPeriodId);
        if (frozen.isEmpty()) return base;
        Map<UUID, Double> pct = new HashMap<>();
        frozen.forEach(f -> pct.put(f.getOrgUnitId(), f.getSharePercent()));
        Map<UUID, Branch> branches = new LinkedHashMap<>();
        base.branches().forEach((id, b) -> branches.put(id,
                pct.containsKey(id) ? new Branch(b.unit(), pct.get(id), true) : b));
        return new Split(base.branchOfKpi(), branches, true, true);
    }

    /**
     * Chụp % công sức đang áp dụng cho đợt này (lần chấm đợt đầu tiên của quản lý). Đã có bản chụp
     * hoặc người này không kiêm nhiệm trong đợt ⇒ không làm gì. Gọi trong transaction ghi đã qua
     * CycleStatusGuard (EvaluationService.createEvaluation).
     */
    @Transactional
    public void freezeForPeriod(UUID userId, UUID kpiPeriodId, Collection<KpiCriteria> kpis) {
        if (userId == null || kpiPeriodId == null || periodShareRepository.existsByUserIdAndKpiPeriodId(userId, kpiPeriodId)) return;
        Split split = split(userId, kpis);
        if (!split.active()) return;
        java.time.Instant now = java.time.Instant.now();
        split.branches().values().forEach(b -> periodShareRepository.save(com.kpitracking.entity.user.UserPeriodEffortShare.builder()
                .userId(userId).kpiPeriodId(kpiPeriodId).orgUnitId(b.unit().getId())
                .sharePercent(b.sharePercent()).createdAt(now).build()));
    }

    /** Nhánh chứa đơn vị {@code unitId} của người này (để cộng trọng số "cùng nhánh"); null nếu không có. */
    @Transactional(readOnly = true)
    public UUID branchOf(UUID userId, OrgUnit unit) {
        List<OrgUnit> units = branchesOf(userId).stream().map(Branch::unit).toList();
        return units.isEmpty() ? null : branchOfUnit(units, unit);
    }

    /**
     * Hệ số nhân vào trọng số từng KPI (khoá = id KPI). Rỗng khi không chia (một nhánh) ⇒ nơi gọi dùng
     * hệ số 1, tức công thức cũ. Khi chia:
     * <ul>
     *   <li>KPI định lượng thường: Σ trọng số × hệ số của nhánh = % công sức × 100 / Σ% của các nhánh có
     *       KPI định lượng ⇒ cả người cộng đúng 100;</li>
     *   <li>KPI thưởng: hệ số = % công sức (chuẩn hoá trên các nhánh có KPI) — thưởng của nhánh 30% chỉ
     *       tính 30%;</li>
     *   <li>KPI định tính: chuẩn hoá trong nhánh rồi nhân % công sức (trung bình có trọng số không đổi tỉ lệ).</li>
     * </ul>
     */
    public Map<UUID, Double> factors(Split split, Collection<KpiCriteria> kpis,
                                     Predicate<KpiCriteria> quantitative, Predicate<KpiCriteria> qualitative) {
        if (!split.active()) return Map.of();
        Map<UUID, Double> quantW = new HashMap<>(), qualW = new HashMap<>();
        Set<UUID> present = new LinkedHashSet<>();
        for (KpiCriteria k : kpis) {
            UUID b = split.branchOfKpi().get(k.getId());
            if (b == null) continue;
            double w = k.getWeight() != null ? k.getWeight() : 0.0;
            if (quantitative.test(k)) {
                present.add(b);
                if (!Boolean.TRUE.equals(k.getIsBonusKpi())) quantW.merge(b, w, Double::sum);
            } else if (qualitative.test(k)) {
                present.add(b);
                qualW.merge(b, w, Double::sum);
            }
        }
        double sharePresent = sum(split, present);
        double shareQuant = sum(split, positive(quantW));
        double shareQual = sum(split, positive(qualW));
        Map<UUID, Double> out = new HashMap<>();
        for (KpiCriteria k : kpis) {
            UUID b = split.branchOfKpi().get(k.getId());
            if (b == null) continue;
            double s = share(split, b);
            if (quantitative.test(k)) {
                if (Boolean.TRUE.equals(k.getIsBonusKpi())) {
                    out.put(k.getId(), sharePresent > 0 ? s / sharePresent : 0.0);
                } else {
                    double wb = quantW.getOrDefault(b, 0.0);
                    out.put(k.getId(), wb > 0 && shareQuant > 0 ? (s / shareQuant) * 100.0 / wb : 0.0);
                }
            } else if (qualitative.test(k)) {
                double wb = qualW.getOrDefault(b, 0.0);
                out.put(k.getId(), wb > 0 && shareQual > 0 ? (s / shareQual) / wb : 0.0);
            }
        }
        return out;
    }

    /**
     * Thay toàn bộ "% công sức" của một người. Rỗng = xoá cấu hình, về chia đều. Nơi gọi đã kiểm
     * quyền và kiểm đủ nhánh + tổng 100.
     */
    @Transactional
    public void replace(UUID userId, Map<UUID, Double> shares, UUID updatedBy) {
        shareRepository.deleteAllByUserId(userId);
        shareRepository.flush();
        if (shares.isEmpty()) return;
        java.time.Instant now = java.time.Instant.now();
        shares.forEach((unitId, pct) -> shareRepository.save(UserUnitEffortShare.builder()
                .userId(userId).orgUnitId(unitId).sharePercent(pct).updatedBy(updatedBy).updatedAt(now).build()));
    }

    /** Hiệu lực: nhánh có dòng cấu hình lấy đúng số đó; nhánh còn lại chia đều phần còn trống. */
    static List<Branch> withShares(List<OrgUnit> units, Map<UUID, Double> configured) {
        if (units.size() == 1) return List.of(new Branch(units.get(0), 100.0, false));
        double fixed = 0;
        int free = 0;
        for (OrgUnit u : units) {
            Double c = configured.get(u.getId());
            if (c != null) fixed += c; else free++;
        }
        double each = free > 0 ? Math.max(0.0, 100.0 - fixed) / free : 0.0;
        List<Branch> out = new ArrayList<>();
        for (OrgUnit u : units) {
            Double c = configured.get(u.getId());
            out.add(new Branch(u, c != null ? c : each, c != null));
        }
        return out;
    }

    /** Đơn vị phân công thật, bỏ đơn vị là tổ tiên của một đơn vị khác cũng trong danh sách. */
    static List<OrgUnit> branchUnits(List<UserRoleOrgUnit> rows) {
        Map<UUID, OrgUnit> units = new LinkedHashMap<>();
        for (UserRoleOrgUnit a : rows) {
            OrgUnit u = a.getOrgUnit();
            if (a.getDelegationId() != null || u == null || u.getDeletedAt() != null || u.getPath() == null) continue;
            units.putIfAbsent(u.getId(), u);
        }
        List<OrgUnit> out = new ArrayList<>();
        for (OrgUnit u : units.values()) {
            boolean ancestorOfAnother = units.values().stream()
                    .anyMatch(o -> o != u && o.getPath().startsWith(u.getPath()) && !o.getPath().equals(u.getPath()));
            if (!ancestorOfAnother) out.add(u);
        }
        out.sort(Comparator.comparing(OrgUnit::getPath));
        return out;
    }

    /**
     * Nhánh của một KPI: nhánh nằm trong (hoặc chính là) đơn vị của KPI — KPI giao từ cấp trên xuống;
     * không có thì nhánh chứa đơn vị của KPI. Nhiều nhánh khớp (KPI của đơn vị chung tổ tiên) ⇒ nhánh
     * đầu danh sách, tức nhánh của đơn vị chính khi nó khớp.
     */
    public static UUID branchOfUnit(List<OrgUnit> branches, OrgUnit kpiUnit) {
        if (kpiUnit != null && kpiUnit.getPath() != null) {
            for (OrgUnit b : branches) if (b.getPath().startsWith(kpiUnit.getPath())) return b.getId();
            for (OrgUnit b : branches) if (kpiUnit.getPath().startsWith(b.getPath())) return b.getId();
        }
        return branches.get(0).getId();
    }

    private static OrgUnit branchContaining(List<OrgUnit> branches, OrgUnit unit) {
        UUID id = branchOfUnit(branches, unit);
        return branches.stream().filter(b -> b.getId().equals(id)).findFirst().orElse(null);
    }

    private static Set<UUID> positive(Map<UUID, Double> weights) {
        Set<UUID> out = new LinkedHashSet<>();
        weights.forEach((b, w) -> { if (w > 0) out.add(b); });
        return out;
    }

    private static double share(Split split, UUID branch) {
        Branch b = split.branches().get(branch);
        return b != null ? b.sharePercent() : 0.0;
    }

    private static double sum(Split split, Set<UUID> branches) {
        return branches.stream().mapToDouble(b -> share(split, b)).sum();
    }
}
