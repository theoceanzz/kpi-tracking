package com.kpitracking.service;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Role;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.KpiType;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Predicate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/** "% công sức" của người kiêm nhiệm ({@link KpiEffortShares}) — phần thuần, không cần DB. */
class KpiEffortSharesTest {

    private final OrgUnit root = unit("/r/");
    private final OrgUnit dept = unit("/r/d/");
    private final OrgUnit team = unit("/r/d/t/");
    private final OrgUnit other = unit("/r/o/");
    private final KpiEffortShares shares = new KpiEffortShares(null, null, null, null);

    private static final Predicate<KpiCriteria> QUANT = k -> k.getKpiType() != KpiType.QUALITATIVE;
    private static final Predicate<KpiCriteria> QUAL = k -> k.getKpiType() == KpiType.QUALITATIVE;

    @Test
    void autoParentRows_collapseIntoOneBranch() {
        // Nhân viên team có dòng tự sinh ở phòng + công ty: vẫn MỘT nhánh ⇒ điểm y như cũ.
        assertThat(KpiEffortShares.branchUnits(List.of(row(team), row(dept), row(root)))).containsExactly(team);
        assertThat(KpiEffortShares.branchUnits(List.of(row(team), row(dept), row(other)))).containsExactly(team, other);
    }

    @Test
    void delegationRow_isNotABranch() {
        UserRoleOrgUnit delegated = row(other);
        delegated.setDelegationId(UUID.randomUUID());
        assertThat(KpiEffortShares.branchUnits(List.of(row(team), delegated))).containsExactly(team);
    }

    @Test
    void unconfiguredBranches_splitTheRemainderEqually() {
        Map<UUID, Double> cfg = new HashMap<>();
        assertThat(KpiEffortShares.withShares(List.of(team, other), cfg))
                .extracting(KpiEffortShares.Branch::sharePercent).containsExactly(50.0, 50.0);
        cfg.put(team.getId(), 70.0);
        assertThat(KpiEffortShares.withShares(List.of(team, other), cfg))
                .extracting(KpiEffortShares.Branch::sharePercent).containsExactly(70.0, 30.0);
        OrgUnit third = unit("/r/x/");
        cfg.put(team.getId(), 40.0);
        assertThat(KpiEffortShares.withShares(List.of(team, other, third), cfg))
                .extracting(KpiEffortShares.Branch::sharePercent).containsExactly(40.0, 30.0, 30.0);
    }

    @Test
    void kpiFromParentUnit_belongsToTheBranchBelowIt() {
        List<OrgUnit> branches = List.of(team, other);
        assertThat(KpiEffortShares.branchOfUnit(branches, dept)).isEqualTo(team.getId());
        assertThat(KpiEffortShares.branchOfUnit(branches, other)).isEqualTo(other.getId());
        // Đơn vị chung tổ tiên ⇒ nhánh đứng đầu (đơn vị chính).
        assertThat(KpiEffortShares.branchOfUnit(branches, root)).isEqualTo(team.getId());
    }

    @Test
    void factors_weightEachBranchByItsShare() {
        KpiCriteria a1 = kpi(team, 60), a2 = kpi(team, 40), b1 = kpi(other, 100);
        KpiCriteria bonus = kpi(other, 10);
        bonus.setIsBonusKpi(true);
        List<KpiCriteria> kpis = List.of(a1, a2, b1, bonus);

        Map<UUID, Double> f = shares.factors(split(kpis, 70, 30), kpis, QUANT, QUAL);

        // Σ trọng số hiệu lực của KPI thường = 100: nhánh team 70, nhánh kia 30.
        assertThat(60 * f.get(a1.getId()) + 40 * f.get(a2.getId())).isCloseTo(70.0, within(1e-9));
        assertThat(100 * f.get(b1.getId())).isCloseTo(30.0, within(1e-9));
        // Thưởng của nhánh 30% chỉ tính 30%.
        assertThat(f.get(bonus.getId())).isCloseTo(0.3, within(1e-9));
        // Team đạt 100%, nhánh kia 50% ⇒ 0.7×100 + 0.3×50 = 85.
        double score = (60 * f.get(a1.getId()) + 40 * f.get(a2.getId())) * 1.0 + 100 * f.get(b1.getId()) * 0.5;
        assertThat(score).isCloseTo(85.0, within(1e-9));
    }

    @Test
    void factors_renormaliseOverBranchesThatHaveKpis() {
        // Nhánh thứ ba không có KPI trong đợt ⇒ phần của nó chia lại cho hai nhánh còn lại theo tỉ lệ.
        KpiCriteria a = kpi(team, 100), b = kpi(other, 100);
        OrgUnit third = unit("/r/x/");
        Map<UUID, KpiEffortShares.Branch> branches = new LinkedHashMap<>();
        branches.put(team.getId(), new KpiEffortShares.Branch(team, 40, true));
        branches.put(other.getId(), new KpiEffortShares.Branch(other, 40, true));
        branches.put(third.getId(), new KpiEffortShares.Branch(third, 20, true));
        KpiEffortShares.Split split = new KpiEffortShares.Split(
                Map.of(a.getId(), team.getId(), b.getId(), other.getId()), branches, true);

        Map<UUID, Double> f = shares.factors(split, List.of(a, b), QUANT, QUAL);

        assertThat(100 * f.get(a.getId())).isCloseTo(50.0, within(1e-9));
        assertThat(100 * f.get(b.getId())).isCloseTo(50.0, within(1e-9));
    }

    @Test
    void singleBranchOrInactiveSplit_returnsNoFactors() {
        KpiCriteria a = kpi(team, 100);
        KpiEffortShares.Split inactive = new KpiEffortShares.Split(Map.of(a.getId(), team.getId()),
                Map.of(team.getId(), new KpiEffortShares.Branch(team, 100, false)), false);
        assertThat(shares.factors(inactive, List.of(a), QUANT, QUAL)).isEmpty();
    }

    @Test
    void qualitative_isAveragedPerBranchThenByShare() {
        KpiCriteria qa = kpi(team, 20), qb = kpi(other, 80);
        qa.setKpiType(KpiType.QUALITATIVE);
        qb.setKpiType(KpiType.QUALITATIVE);
        List<KpiCriteria> kpis = List.of(qa, qb);
        Map<UUID, Double> f = shares.factors(split(kpis, 50, 50), kpis, QUANT, QUAL);
        // Mức 5 ở team, 1 ở nhánh kia, chia 50/50 ⇒ 3 (không phải 1.8 như khi cộng thô theo trọng số).
        double wa = 20 * f.get(qa.getId()), wb = 80 * f.get(qb.getId());
        assertThat((5 * wa + 1 * wb) / (wa + wb)).isCloseTo(3.0, within(1e-9));
    }

    private KpiEffortShares.Split split(List<KpiCriteria> kpis, double teamShare, double otherShare) {
        Map<UUID, UUID> of = new HashMap<>();
        for (KpiCriteria k : kpis) of.put(k.getId(), k.getOrgUnit() == team ? team.getId() : other.getId());
        Map<UUID, KpiEffortShares.Branch> branches = new LinkedHashMap<>();
        branches.put(team.getId(), new KpiEffortShares.Branch(team, teamShare, true));
        branches.put(other.getId(), new KpiEffortShares.Branch(other, otherShare, true));
        return new KpiEffortShares.Split(of, branches, true);
    }

    private static KpiCriteria kpi(OrgUnit unit, double weight) {
        return KpiCriteria.builder().id(UUID.randomUUID()).orgUnit(unit).weight(weight)
                .kpiType(KpiType.QUANTITATIVE).isBonusKpi(false).build();
    }

    private static UserRoleOrgUnit row(OrgUnit unit) {
        return UserRoleOrgUnit.builder().orgUnit(unit).role(Role.builder().id(UUID.randomUUID()).rank(2).build()).build();
    }

    private static OrgUnit unit(String path) {
        return OrgUnit.builder().id(UUID.randomUUID()).name(path).path(path).build();
    }
}
