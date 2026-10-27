package com.kpitracking.service.bsc;

import com.kpitracking.entity.bsc.BscScorecard;
import com.kpitracking.entity.bsc.BscScorecardPerspective;
import com.kpitracking.enums.bsc.BscItemOrigin;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Hạng mục thuộc bộ tiêu chí nào: bộ đầu tiên tự thêm là chủ, bộ khác chỉ dùng lại. */
class BscPerspectiveOwnershipTest {

    static BscScorecard card(String name) {
        BscScorecard sc = new BscScorecard();
        sc.setId(UUID.randomUUID());
        sc.setName(name);
        return sc;
    }

    static BscScorecardPerspective self(BscScorecard sc, String at) {
        return BscScorecardPerspective.builder().scorecard(sc).origin(BscItemOrigin.SELF)
                .createdAt(Instant.parse(at)).build();
    }

    static BscScorecardPerspective assigned(BscScorecard sc, BscScorecardPerspective parent) {
        return BscScorecardPerspective.builder().scorecard(sc).origin(BscItemOrigin.ASSIGNED).locked(true)
                .parentItem(parent).createdAt(Instant.parse("2026-01-01T00:00:00Z")).build();
    }

    final BscScorecard company = card("BSC công ty");
    final BscScorecard dept = card("BSC phòng");

    @Test
    @DisplayName("Chưa bộ nào dùng: sửa được từ mọi bộ (cả bộ chưa lưu), xoá được")
    void unusedIsFree() {
        assertThat(BscPerspectiveOwnership.ownerOf(List.of())).isNull();
        assertThat(BscPerspectiveOwnership.canEditFrom(List.of(), null)).isTrue();
        assertThat(BscPerspectiveOwnership.canEditFrom(List.of(), dept.getId())).isTrue();
        assertThat(BscPerspectiveOwnership.canDelete(List.of())).isTrue();
    }

    @Test
    @DisplayName("Bộ công ty phân rã xuống phòng: công ty vẫn sửa được, phòng thì không, không ai xoá được")
    void cascadedRowDoesNotOwn() {
        BscScorecardPerspective companyRow = self(company, "2026-02-01T00:00:00Z");
        List<BscScorecardPerspective> rows = List.of(companyRow, assigned(dept, companyRow));
        assertThat(BscPerspectiveOwnership.ownerOf(rows)).isSameAs(company);
        assertThat(BscPerspectiveOwnership.canEditFrom(rows, company.getId())).isTrue();
        assertThat(BscPerspectiveOwnership.canEditFrom(rows, dept.getId())).isFalse();
        assertThat(BscPerspectiveOwnership.canDelete(rows)).isFalse();
    }

    @Test
    @DisplayName("Phòng tự thêm lại hạng mục công ty đã dùng (không phân rã): chủ vẫn là bộ thêm trước")
    void earliestSelfRowOwns() {
        List<BscScorecardPerspective> rows = List.of(
                self(dept, "2026-03-01T00:00:00Z"), self(company, "2026-02-01T00:00:00Z"));
        assertThat(BscPerspectiveOwnership.ownerOf(rows)).isSameAs(company);
        assertThat(BscPerspectiveOwnership.canEditFrom(rows, dept.getId())).isFalse();
        assertThat(BscPerspectiveOwnership.canEditFrom(rows, null)).isFalse();
    }

    @Test
    @DisplayName("Dòng giao cả bộ / gắn cây cũng là dòng nhận, không làm chủ")
    void wholeAndTreeRowsAreDerived() {
        BscScorecardPerspective whole = BscScorecardPerspective.builder().scorecard(dept)
                .origin(BscItemOrigin.SELF).wholeSharePercent(20.0).build();
        BscScorecardPerspective linked = BscScorecardPerspective.builder().scorecard(dept)
                .origin(BscItemOrigin.SELF).parentItem(self(company, "2026-02-01T00:00:00Z")).build();
        assertThat(BscPerspectiveOwnership.derived(whole)).isTrue();
        assertThat(BscPerspectiveOwnership.derived(linked)).isTrue();
        assertThat(BscPerspectiveOwnership.ownerOf(List.of(whole, linked))).isNull();
    }
}
