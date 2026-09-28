package com.kpitracking.service.feedback360;

import com.kpitracking.entity.F360Subject;
import com.kpitracking.entity.OrgUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Ngưỡng k ở CẤP ĐƠN VỊ (§6.1): trung bình của một phòng 2 người để lộ điểm của người còn lại, nên
 * đơn vị dưới ngưỡng phải được gộp lên cha — và nhóm vẫn dưới ngưỡng ở gốc thì bị bỏ.
 */
class F360AnalyticsServiceTest {

    private final F360AnalyticsService service = new F360AnalyticsService(null, null, null, null);

    private static OrgUnit unit(String name, String path, OrgUnit parent) {
        return OrgUnit.builder().id(UUID.randomUUID()).name(name).path(path).parent(parent).build();
    }

    private static List<F360Subject> people(OrgUnit u, int n) {
        List<F360Subject> out = new ArrayList<>();
        for (int i = 0; i < n; i++) out.add(F360Subject.builder().id(UUID.randomUUID()).orgUnit(u).build());
        return out;
    }

    @Test
    @DisplayName("phòng dưới ngưỡng được gộp lên đơn vị cha; phòng đủ ngưỡng giữ riêng")
    void rollsUpSmallUnits() {
        OrgUnit company = unit("Công ty", "/c/", null);
        OrgUnit big = unit("Phòng lớn", "/c/b/", company);
        OrgUnit small = unit("Phòng nhỏ", "/c/s/", company);
        List<F360Subject> all = new ArrayList<>(people(big, 4));
        all.addAll(people(small, 2));
        all.addAll(people(company, 1));

        List<F360AnalyticsService.UnitGroup> groups = service.groupByUnit(all, 3);

        assertThat(groups).extracting(g -> g.unit().getName()).containsExactlyInAnyOrder("Phòng lớn", "Công ty");
        F360AnalyticsService.UnitGroup rolled = groups.stream().filter(g -> g.unit() == company).findFirst().orElseThrow();
        assertThat(rolled.subjects()).hasSize(3);
        assertThat(rolled.rolledUp()).isTrue();
    }

    @Test
    @DisplayName("gộp tới gốc vẫn không đủ k ⇒ bỏ, không hiện dòng nào")
    void dropsBelowThresholdAtRoot() {
        OrgUnit company = unit("Công ty", "/c/", null);
        OrgUnit small = unit("Phòng nhỏ", "/c/s/", company);

        assertThat(service.groupByUnit(people(small, 2), 3)).isEmpty();
    }

    @Test
    @DisplayName("đơn vị lồng nhiều cấp gộp dần từ sâu lên")
    void multiLevel() {
        OrgUnit company = unit("Công ty", "/c/", null);
        OrgUnit dept = unit("Phòng", "/c/d/", company);
        OrgUnit team1 = unit("Nhóm 1", "/c/d/1/", dept);
        OrgUnit team2 = unit("Nhóm 2", "/c/d/2/", dept);
        List<F360Subject> all = new ArrayList<>(people(team1, 1));
        all.addAll(people(team2, 2));

        List<F360AnalyticsService.UnitGroup> groups = service.groupByUnit(all, 3);

        assertThat(groups).singleElement().satisfies(g -> {
            assertThat(g.unit()).isSameAs(dept);
            assertThat(g.subjects()).hasSize(3);
        });
    }
}
