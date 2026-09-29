package com.kpitracking.service.feedback360;

import com.kpitracking.entity.User;
import com.kpitracking.enums.F360Relationship;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Luật "ai là cấp trên / đồng nghiệp / cấp dưới của ai" (§5.2). Cây dựng tay:
 *
 * <pre>
 * Công ty (giám đốc G)
 * ├── Phòng A: trưởng TA, phó PA, nhân viên A1..A4
 * │   └── Nhóm A-x: trưởng nhóm TX
 * └── Phòng B: trưởng TB (không có phó, không có nhân viên khác)
 * </pre>
 */
class F360RaterSuggestionServiceTest {

    private final F360RaterSuggestionService service = new F360RaterSuggestionService(null, null, null);
    private final F360Settings.RaterRules rules = new F360Settings.RaterRules(5, 6, 10, 12, 5);

    private F360RaterSuggestionService.OrgSnapshot org;
    private final UUID company = UUID.randomUUID();
    private final UUID deptA = UUID.randomUUID();
    private final UUID deptB = UUID.randomUUID();
    private final UUID teamX = UUID.randomUUID();
    private User g, ta, pa, tb, tx;
    private final List<User> staffA = new ArrayList<>();

    @BeforeEach
    void setUp() {
        org = new F360RaterSuggestionService.OrgSnapshot();
        link(deptA, company);
        link(deptB, company);
        link(teamX, deptA);
        g = member(company, "Giám đốc", 0);
        ta = member(deptA, "Trưởng A", 0);
        pa = member(deptA, "Phó A", 1);
        for (int i = 1; i <= 4; i++) staffA.add(member(deptA, "Nhân viên A" + i, 2));
        tb = member(deptB, "Trưởng B", 0);
        tx = member(teamX, "Trưởng nhóm X", 0);
    }

    private void link(UUID child, UUID parent) {
        org.parentOf.put(child, parent);
        org.childrenOf.computeIfAbsent(parent, x -> new ArrayList<>()).add(child);
    }

    private User member(UUID unit, String name, int rank) {
        User u = User.builder().id(UUID.randomUUID()).fullName(name).build();
        org.membersOf.computeIfAbsent(unit, x -> new ArrayList<>()).add(new F360RaterSuggestionService.Member(u, rank));
        org.users.put(u.getId(), u);
        org.primaryUnitOf.put(u.getId(), unit);
        org.primaryRankOf.put(u.getId(), rank);
        return u;
    }

    private Map<User, F360Relationship> suggest(User subject, Map<UUID, Integer> load) {
        F360RaterSuggestionService.Suggestion s = service.suggest(org, subject, true, 3, rules, load, new Random(1));
        Map<User, F360Relationship> out = new LinkedHashMap<>();
        s.raters().forEach(e -> out.put(e.getKey(), e.getValue()));
        return out;
    }

    @Test
    @DisplayName("nhân viên: cấp trên là trưởng đơn vị, đồng nghiệp là nhân viên cùng đơn vị")
    void staff() {
        Map<User, F360Relationship> r = suggest(staffA.get(0), new HashMap<>());

        assertThat(r.get(staffA.get(0))).isEqualTo(F360Relationship.SELF);
        assertThat(r.get(ta)).isEqualTo(F360Relationship.MANAGER);
        assertThat(r).doesNotContainKey(pa);
        assertThat(r.entrySet().stream().filter(e -> e.getValue() == F360Relationship.PEER).map(Map.Entry::getKey))
                .containsExactlyInAnyOrder(staffA.get(1), staffA.get(2), staffA.get(3));
    }

    @Test
    @DisplayName("phó: cấp trên là trưởng CÙNG đơn vị, cấp dưới là nhân viên (không gồm trưởng)")
    void deputy() {
        Map<User, F360Relationship> r = suggest(pa, new HashMap<>());

        assertThat(r.get(ta)).isEqualTo(F360Relationship.MANAGER);
        assertThat(r.entrySet().stream().filter(e -> e.getValue() == F360Relationship.DIRECT_REPORT).map(Map.Entry::getKey))
                .containsExactlyInAnyOrderElementsOf(staffA);
    }

    @Test
    @DisplayName("trưởng: cấp trên là trưởng đơn vị cha; cấp dưới luôn có đủ các phó; đồng nghiệp là trưởng đơn vị anh em")
    void head() {
        Map<User, F360Relationship> r = suggest(ta, new HashMap<>());

        assertThat(r.get(g)).isEqualTo(F360Relationship.MANAGER);
        assertThat(r.get(pa)).isEqualTo(F360Relationship.DIRECT_REPORT);
        assertThat(r.get(tx)).isEqualTo(F360Relationship.DIRECT_REPORT);
        assertThat(r.get(tb)).isEqualTo(F360Relationship.PEER);
    }

    @Test
    @DisplayName("giám đốc cao nhất không có cấp trên — có cảnh báo, không bịa người")
    void topHasNoManager() {
        F360RaterSuggestionService.Suggestion s = service.suggest(org, g, true, 3, rules, new HashMap<>(), new Random(1));

        assertThat(s.raters()).noneMatch(e -> e.getValue() == F360Relationship.MANAGER);
        assertThat(s.warnings()).anyMatch(w -> w.contains("cấp trên"));
    }

    @Test
    @DisplayName("người đã chạm trần phiếu không được giao thêm phiếu đồng nghiệp")
    void respectsCap() {
        Map<UUID, Integer> load = new HashMap<>();
        load.put(staffA.get(1).getId(), 10);

        Map<User, F360Relationship> r = suggest(staffA.get(0), load);

        assertThat(r).doesNotContainKey(staffA.get(1));
        assertThat(load.get(staffA.get(2).getId())).isEqualTo(1);
    }

    @Test
    @DisplayName("trần phiếu không áp cho cấp trên — trưởng phòng vẫn là cấp trên của mọi nhân viên")
    void capDoesNotBlockManager() {
        Map<UUID, Integer> load = new HashMap<>();
        load.put(ta.getId(), 50);

        assertThat(suggest(staffA.get(0), load).get(ta)).isEqualTo(F360Relationship.MANAGER);
    }

    @Test
    @DisplayName("đơn vị không có trưởng: nhân viên nhận phó làm cấp trên")
    void staffFallsBackToDeputy() {
        org.membersOf.get(deptA).removeIf(m -> m.user() == ta);

        assertThat(suggest(staffA.get(0), new HashMap<>()).get(pa)).isEqualTo(F360Relationship.MANAGER);
    }
}
