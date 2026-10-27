package com.kpitracking.ai.submission.review;

import com.kpitracking.entity.ai.AiCriteriaSet;
import com.kpitracking.entity.ai.AiReviewUnitSetting;
import com.kpitracking.entity.organization.OrgUnit;
import com.kpitracking.entity.organization.Organization;
import com.kpitracking.entity.user.UserRoleOrgUnit;
import com.kpitracking.repository.ai.AiCriteriaSetItemRepository;
import com.kpitracking.entity.ai.RagDocument;
import com.kpitracking.repository.ai.AiCriteriaSetRepository;
import com.kpitracking.repository.ai.RagDocumentRepository;
import com.kpitracking.repository.ai.AiReviewUnitSettingRepository;
import com.kpitracking.repository.organization.OrgUnitRepository;
import com.kpitracking.repository.user.UserRoleOrgUnitRepository;
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
    private RagDocumentRepository ragDocs;
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

    private AiReviewUnitSetting setting(OrgUnit u, boolean enabled) {
        return AiReviewUnitSetting.builder().orgUnitId(u.getId()).organizationId(org.getId())
                .enabled(enabled).build();
    }

    @BeforeEach
    void setUp() {
        unitSettings = mock(AiReviewUnitSettingRepository.class);
        sets = mock(AiCriteriaSetRepository.class);
        UserRoleOrgUnitRepository assignments = mock(UserRoleOrgUnitRepository.class);
        OrgUnitRepository units = mock(OrgUnitRepository.class);
        ragDocs = mock(RagDocumentRepository.class);
        resolver = new AiReviewSettingsResolver(unitSettings, sets, mock(AiCriteriaSetItemRepository.class),
                assignments, new com.kpitracking.service.PrimaryUnitResolver(assignments,
                        mock(com.kpitracking.repository.user.UserRepository.class)), units, ragDocs,
                mock(com.kpitracking.repository.ai.AiReviewLevelRepository.class));

        org.setId(UUID.randomUUID());
        org.setEnableAi(true);
        org.setEnableAiReview(true);
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
        assertThat(e.fromUnitId()).isNull();
    }

    @Test
    @DisplayName("gốc bật, phòng tắt -> nhân viên tổ dưới phòng: TẮT (đơn vị gần nhất thắng)")
    void nearestUnitWins() {
        when(unitSettings.findByOrganizationId(org.getId())).thenReturn(List.of(
                setting(root, true), setting(dept, false)));

        AiReviewSettingsResolver.Effective e = resolver.resolve(org, staffId);

        assertThat(e.enabled()).isFalse();
        assertThat(e.fromUnitId()).isEqualTo(dept.getId());
    }

    @Test
    @DisplayName("công ty tắt -> tắt, dù đơn vị có bật")
    void companyOffOverridesUnits() {
        org.setEnableAiReview(false);
        when(unitSettings.findByOrganizationId(org.getId())).thenReturn(List.of(setting(team, true)));

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

    private RagDocument doc(UUID id, String title) {
        return RagDocument.builder().id(id).organizationId(org.getId()).source(RagDocument.Source.REGULATION)
                .title(title).status(RagDocument.Status.READY).build();
    }

    @Test
    @DisplayName("trích quy chế: CHỈ tài liệu của bộ đã chọn (kể cả bộ nhân bản dùng chung) + tài liệu nạp tay")
    void regulationDocsAllowList() {
        UUID mine = UUID.randomUUID();
        UUID other = UUID.randomUUID();
        UUID manual = UUID.randomUUID();
        AiCriteriaSet chosen = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId())
                .orgUnitId(dept.getId()).status(AiCriteriaSet.CONFIRMED).ragDocumentId(mine).build();
        AiCriteriaSet sharedClone = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId())
                .orgUnitId(UUID.randomUUID()).status(AiCriteriaSet.CONFIRMED).ragDocumentId(mine).build();
        AiCriteriaSet otherUnit = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId())
                .orgUnitId(UUID.randomUUID()).status(AiCriteriaSet.CONFIRMED).ragDocumentId(other).build();
        when(sets.findByOrganizationIdOrderByCreatedAtDesc(org.getId())).thenReturn(List.of(chosen, sharedClone, otherUnit));
        RagDocument pending = doc(UUID.randomUUID(), "Đang nạp");
        pending.setStatus(RagDocument.Status.PENDING);
        when(ragDocs.findByOrganizationIdOrderByCreatedAtDesc(org.getId())).thenReturn(List.of(
                doc(mine, "Quy chế phòng"), doc(other, "Quy chế đơn vị khác"), doc(manual, "Sổ tay nạp tay"), pending));

        assertThat(resolver.regulationDocsFor(org.getId(), chosen.getId()))
                .containsExactlyInAnyOrder(mine.toString(), manual.toString());
        // Người chưa có bộ nào áp: chỉ còn tài liệu nạp tay dùng chung.
        assertThat(resolver.regulationDocsFor(org.getId(), null)).containsExactly(manual.toString());
    }

    @Test
    @DisplayName("đoạn mồ côi trong kho vector (không còn trong rag_documents) không bao giờ vào danh sách cho phép")
    void orphanChunksNeverAllowed() {
        // Ca 29/09: DB dựng lại, kho vector còn giữ đoạn của "Quy_dinh_van_hanh_IT-OPS-2026" cũ. Danh sách cho phép
        // lấy từ rag_documents nên tài liệu đó (không có dòng nào) tự nhiên bị loại — không cần biết id của nó.
        AiCriteriaSet chosen = AiCriteriaSet.builder().id(UUID.randomUUID()).organizationId(org.getId())
                .status(AiCriteriaSet.CONFIRMED).build();   // bộ chưa có tài liệu kho
        when(sets.findByOrganizationIdOrderByCreatedAtDesc(org.getId())).thenReturn(List.of(chosen));
        when(ragDocs.findByOrganizationIdOrderByCreatedAtDesc(org.getId())).thenReturn(List.of());

        assertThat(resolver.regulationDocsFor(org.getId(), chosen.getId())).isEmpty();
    }

    @Test
    @DisplayName("thang điểm AI: xếp theo điểm tăng dần, tối đa = điểm mức cao nhất, % = điểm / tối đa; thang toàn 0 -> trống")
    void aiScaleFromLevels() {
        var rows = List.of(
                com.kpitracking.entity.ai.AiReviewLevel.builder().name("Tốt").position(1).points(java.math.BigDecimal.valueOf(8)).description("Đủ số liệu").build(),
                com.kpitracking.entity.ai.AiReviewLevel.builder().name("Kém").position(2).points(java.math.BigDecimal.ZERO).build(),
                com.kpitracking.entity.ai.AiReviewLevel.builder().name("Khá").position(3).points(java.math.BigDecimal.valueOf(6)).build());

        AiReviewSettingsResolver.AiScale s = AiReviewSettingsResolver.scaleOf(rows);

        assertThat(s.max()).isEqualByComparingTo("8");
        assertThat(s.levels()).extracting(ReviewContext.QualityLevel::name).containsExactly("Kém", "Khá", "Tốt");
        assertThat(s.levels()).extracting(ReviewContext.QualityLevel::scorePercent).containsExactly(0.0, 75.0, 100.0);
        assertThat(s.levels().get(2).description()).isEqualTo("Đủ số liệu");
        assertThat(AiReviewSettingsResolver.scaleOf(List.of(rows.get(1)))).isEqualTo(AiReviewSettingsResolver.AiScale.EMPTY);
    }
}
