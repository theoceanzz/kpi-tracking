package com.kpitracking.service;

import com.kpitracking.entity.BscScorecard;
import com.kpitracking.enums.BscEmptyPerspectivePolicy;
import com.kpitracking.repository.BscScorecardRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static com.kpitracking.enums.BscEmptyPerspectivePolicy.RENORMALIZE;
import static com.kpitracking.enums.BscEmptyPerspectivePolicy.ZERO_FILL;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Luật "hạng mục chưa có KPI" là của cả cây BSC: thẻ con theo thẻ cha. */
class BscEmptyPolicySyncTest {

    final BscScorecardRepository repo = mock(BscScorecardRepository.class);
    final BscEmptyPolicySync sync = new BscEmptyPolicySync(repo);

    static BscScorecard card(BscScorecard parent, BscEmptyPerspectivePolicy policy) {
        BscScorecard sc = new BscScorecard();
        sc.setId(UUID.randomUUID());
        sc.setParentScorecard(parent);
        sc.setEmptyPerspectivePolicy(policy);
        return sc;
    }

    @Test
    @DisplayName("Thẻ cha đổi ⇒ áp xuống con và cháu")
    void propagatesToWholeSubtree() {
        BscScorecard company = card(null, ZERO_FILL);
        BscScorecard dept = card(company, RENORMALIZE);
        BscScorecard team = card(dept, RENORMALIZE);
        when(repo.findByParentScorecardId(company.getId())).thenReturn(List.of(dept));
        when(repo.findByParentScorecardId(dept.getId())).thenReturn(List.of(team));

        sync.propagateDown(company);

        assertThat(dept.getEmptyPerspectivePolicy()).isEqualTo(ZERO_FILL);
        assertThat(team.getEmptyPerspectivePolicy()).isEqualTo(ZERO_FILL);
    }

    @Test
    @DisplayName("Nhận nuôi / gắn vào cây ⇒ thẻ và cây con của nó đổi về theo thẻ cha")
    void inheritsOnAttach() {
        BscScorecard company = card(null, ZERO_FILL);
        BscScorecard dept = card(company, RENORMALIZE);
        BscScorecard team = card(dept, RENORMALIZE);
        when(repo.findByParentScorecardId(dept.getId())).thenReturn(List.of(team));

        sync.inheritFromParent(dept);

        assertThat(dept.getEmptyPerspectivePolicy()).isEqualTo(ZERO_FILL);
        assertThat(team.getEmptyPerspectivePolicy()).isEqualTo(ZERO_FILL);
        assertThat(BscEmptyPolicySync.followsParent(dept)).isTrue();
        assertThat(BscEmptyPolicySync.followsParent(company)).isFalse();
    }

    @Test
    @DisplayName("Dữ liệu lỗi vòng không làm treo")
    void stopsOnCycle() {
        BscScorecard a = card(null, ZERO_FILL);
        BscScorecard b = card(a, RENORMALIZE);
        when(repo.findByParentScorecardId(a.getId())).thenReturn(List.of(b));
        when(repo.findByParentScorecardId(b.getId())).thenReturn(List.of(a));

        sync.propagateDown(a);

        assertThat(b.getEmptyPerspectivePolicy()).isEqualTo(ZERO_FILL);
    }
}
