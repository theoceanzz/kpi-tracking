package com.kpitracking.service.ai.review;

import com.kpitracking.entity.AiCriteriaSet;
import com.kpitracking.entity.AiReviewUnitSetting;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.repository.AiCriteriaSetItemRepository;
import com.kpitracking.repository.AiCriteriaSetRepository;
import com.kpitracking.repository.AiReviewUnitSettingRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Luật bật/tắt nhiều cấp: công ty tắt thì mọi cấp tắt; công ty bật thì đơn vị GẦN NHẤT có cấu hình quyết.
 * Bộ tiêu chí chọn cùng luật, không có bộ của đơn vị thì dùng bộ cả tổ chức.
 */
class AiReviewSettingsResolverTest {

    private AiReviewUnitSettingRepository unitSettings;
    private AiCriteriaSetRepository sets;
    private AiReviewSettingsResolver resolver;

    private final Organization org = new Organization();
    private final OrgUnit root = unit("/r/");
    private final OrgUnit dept = unit("/r/d/");
    private final OrgUnit team = unit("/r/d/t/");
    private final UUID staffId = UUID.randomUUID();

    private static OrgUnit unit(String path) {
        OrgUnit u = new OrgUnit();
        u.setId(UUID.randomUUID());
        u.setPath(path);
        return u;
    }

    private AiReviewUnitSetting setting(OrgUnit u, boolean enabled, int t, int q, int o) {
        return AiReviewUnitSetting.builder().orgUnitId(u.getId()).organizationId(org.getId())
                .enabled(enabled).weightTarget(t).weightQuality(q).weightOnTime(o).build();
    }

    @BeforeEach
    void setUp() {
        unitSettings = mock(AiReviewUnitSettingRepository.class);
        sets = mock(AiCriteriaSetRepository.class);
        UserRoleOrgUnitRepository assignments = mock(UserRoleOrgUnitRepository.class);
        OrgUnitRepository units = mock(OrgUnitRepository.class);
        resolver = new AiReviewSettingsResolver(unitSettings, sets, mock(AiCriteriaSetItemRepository.class),
                assignments, units);

        org.setId(UUID.randomUUID());
        org.setEnableAi(true);
        org.setEnableAiReview(true);
        org.setAiReviewWeightTarget(60);
        org.setAiReviewWeightQuality(30);
        org.setAiReviewWeightOnTime(10);
        UserRoleOrgUnit a = new UserRoleOrgUnit();
        a.setOrgUnit(team);
        when(assignments.findByUserId(staffId)).thenReturn(List.of(a));
        when(units.findSubtree("/", org.getId())).thenReturn(List.of(root, dept, team));
    }

    @Test
    @DisplayName("không đơn vị nào cấu hình riêng -> theo công ty")
    void companyDefault() {
        when(unitSettings.findByOrganizationId(org.getId())).thenReturn(List.of());

        AiReviewSettingsResolver.Effective e = resolver.resolve(org, staffId);

        assertThat(e.enabled()).isTrue();
        assertThat(e.weights()).isEqualTo(new ReviewContext.Weights(60, 30, 10));
        assertThat(e.fromUnitId()).isNull();
    }

    @Test
    @DisplayName("gốc bật 50/40/10, phòng tắt -> nhân viên tổ dưới phòng: TẮT (đơn vị gần nhất thắng)")
    void nearestUnitWins() {
        when(unitSettings.findByOrganizationId(org.getId())).thenReturn(List.of(
                setting(root, true, 50, 40, 10), setting(dept, false, 60, 30, 10)));

        AiReviewSettingsResolver.Effective e = resolver.resolve(org, staffId);

        assertThat(e.enabled()).isFalse();
        assertThat(e.fromUnitId()).isEqualTo(dept.getId());
    }

    @Test
    @DisplayName("công ty tắt -> tắt, dù đơn vị có bật")
    void companyOffOverridesUnits() {
        org.setEnableAiReview(false);
        when(unitSettings.findByOrganizationId(org.getId())).thenReturn(List.of(setting(team, true, 50, 40, 10)));

        assertThat(resolver.resolve(org, staffId).enabled()).isFalse();
    }

    @Test
    @DisplayName("bộ tiêu chí: bộ của phòng thắng bộ cả tổ chức; không có bộ nào -> null")
    void criteriaSetNearestThenOrgWide() {
        AiCriteriaSet orgWide = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId())
                .title("Chung").version(3).status(AiCriteriaSet.CONFIRMED).build();
        AiCriteriaSet deptSet = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId())
                .orgUnitId(dept.getId()).title("Phòng").version(1).status(AiCriteriaSet.CONFIRMED).build();

        when(sets.findByOrganizationIdAndStatus(org.getId(), AiCriteriaSet.CONFIRMED)).thenReturn(List.of(orgWide, deptSet));
        assertThat(resolver.criteriaSetFor(org.getId(), staffId).title()).isEqualTo("Phòng");

        when(sets.findByOrganizationIdAndStatus(org.getId(), AiCriteriaSet.CONFIRMED)).thenReturn(List.of(orgWide));
        assertThat(resolver.criteriaSetFor(org.getId(), staffId).version()).isEqualTo(3);

        when(sets.findByOrganizationIdAndStatus(org.getId(), AiCriteriaSet.CONFIRMED)).thenReturn(List.of());
        assertThat(resolver.criteriaSetFor(org.getId(), staffId)).isNull();
    }

    @Test
    @DisplayName("trích quy chế: bỏ tài liệu kho của bộ đang áp cho đơn vị khác, giữ của bộ đã chọn (kể cả khi dùng chung)")
    void regulationDocsOfOtherUnitsExcluded() {
        UUID mine = UUID.randomUUID();
        UUID other = UUID.randomUUID();
        AiCriteriaSet chosen = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId())
                .orgUnitId(dept.getId()).status(AiCriteriaSet.CONFIRMED).ragDocumentId(mine).build();
        AiCriteriaSet sharedClone = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId())
                .orgUnitId(UUID.randomUUID()).status(AiCriteriaSet.CONFIRMED).ragDocumentId(mine).build();
        AiCriteriaSet otherUnit = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId())
                .orgUnitId(UUID.randomUUID()).status(AiCriteriaSet.CONFIRMED).ragDocumentId(other).build();
        when(sets.findByOrganizationIdAndStatus(org.getId(), AiCriteriaSet.CONFIRMED))
                .thenReturn(List.of(chosen, sharedClone, otherUnit));

        assertThat(resolver.regulationDocsNotFor(org.getId(), chosen.getId())).containsExactly(other.toString());
        // Người chưa có bộ nào áp: mọi quy chế gắn bộ tiêu chí đều bị loại (chỉ còn tài liệu nạp tay).
        assertThat(resolver.regulationDocsNotFor(org.getId(), null))
                .containsExactlyInAnyOrder(mine.toString(), other.toString());
    }
}
