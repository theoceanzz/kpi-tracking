package com.kpitracking.analytics;

import com.kpitracking.dto.response.stats.advanced.DistributionResponses.HeadcountPyramidResponse;
import com.kpitracking.dto.response.stats.advanced.DistributionResponses.ScoreHistogramResponse;
import com.kpitracking.dto.response.stats.advanced.DistributionResponses.UnitBoxplotResponse;
import com.kpitracking.dto.response.stats.advanced.FlowResponses.SankeyResponse;
import com.kpitracking.entity.OrgHierarchyLevel;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.repository.EvaluationLevelRepository;
import com.kpitracking.repository.EvaluationRepository;
import com.kpitracking.repository.KeyResultUnitWeightRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.analytics.DistributionAnalyticsService;
import com.kpitracking.service.analytics.FlowAnalyticsService;
import com.kpitracking.service.analytics.StatsTierResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Ba luật mà mọi biểu đồ chuyên sâu phải giữ, bất kể nó vẽ hình gì:
 *
 * <ol>
 *   <li>Cấp SELF không bao giờ nhìn thấy dữ liệu định danh của người khác — việc ẩn danh làm ở
 *       SERVICE, không phải ở giao diện, vì dữ liệu đã rời server thì coi như đã lộ.</li>
 *   <li>Biểu đồ so sánh giữa các ĐƠN VỊ phải trả rỗng ở cấp SELF: thu hẹp phạm vi vẫn để lộ mặt
 *       bằng điểm của đơn vị khác.</li>
 *   <li>Phạm vi rỗng phải ra kết quả rỗng hợp lệ, không ném lỗi — người dùng mới, chưa có dữ liệu,
 *       vẫn phải mở được trang.</li>
 * </ol>
 */
class AdvancedAnalyticsScopeTest {

    private EvaluationRepository evaluationRepository;
    private EvaluationLevelRepository evaluationLevelRepository;
    private OrganizationRepository organizationRepository;
    private UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private KpiCriteriaRepository kpiCriteriaRepository;
    private KeyResultUnitWeightRepository keyResultUnitWeightRepository;
    private PermissionChecker permissionChecker;
    private UserRepository userRepository;

    private DistributionAnalyticsService distribution;
    private FlowAnalyticsService flow;

    private final UUID orgId = UUID.randomUUID();
    private final UUID periodId = UUID.randomUUID();
    private final UUID directorId = UUID.randomUUID();
    private final UUID staffId = UUID.randomUUID();

    private OrgUnit unit;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        OrgUnitRepository orgUnitRepository = mock(OrgUnitRepository.class);
        KpiPeriodRepository kpiPeriodRepository = mock(KpiPeriodRepository.class);
        evaluationRepository = mock(EvaluationRepository.class);
        evaluationLevelRepository = mock(EvaluationLevelRepository.class);
        organizationRepository = mock(OrganizationRepository.class);
        userRoleOrgUnitRepository = mock(UserRoleOrgUnitRepository.class);
        kpiCriteriaRepository = mock(KpiCriteriaRepository.class);
        keyResultUnitWeightRepository = mock(KeyResultUnitWeightRepository.class);
        permissionChecker = mock(PermissionChecker.class);

        StatsTierResolver resolver = new StatsTierResolver(
                userRepository, orgUnitRepository, userRoleOrgUnitRepository,
                permissionChecker, kpiPeriodRepository);

        distribution = new DistributionAnalyticsService(
                resolver, evaluationRepository, evaluationLevelRepository,
                organizationRepository, userRoleOrgUnitRepository);
        flow = new FlowAnalyticsService(resolver, kpiCriteriaRepository, keyResultUnitWeightRepository);

        Organization org = Organization.builder().id(orgId).evaluationMaxScore(100.0).build();
        OrgHierarchyLevel level = OrgHierarchyLevel.builder()
                .organization(org).levelOrder(0).unitTypeName("Phòng ban").build();
        unit = OrgUnit.builder().id(UUID.randomUUID()).path("/root/").orgHierarchyLevel(level).build();

        for (UUID uid : List.of(directorId, staffId)) {
            User u = User.builder().id(uid).email(uid + "@test.local").build();
            when(userRoleOrgUnitRepository.findByUserId(uid)).thenReturn(List.of(
                    UserRoleOrgUnit.builder().user(u).orgUnit(unit).build()));
            when(userRepository.findByEmail(uid + "@test.local")).thenReturn(java.util.Optional.of(u));
        }
        when(kpiPeriodRepository.findIdsByOrganizationId(orgId)).thenReturn(List.of(periodId));
        when(organizationRepository.findById(orgId)).thenReturn(java.util.Optional.of(org));
        when(orgUnitRepository.findByOrgHierarchyLevel_Organization_IdAndDeletedAtIsNull(orgId))
                .thenReturn(List.of(unit));
        when(orgUnitRepository.findAllInSubtrees(any(), any())).thenReturn(List.of(unit));
        when(permissionChecker.hasPermission(any(), any())).thenReturn(false);
        when(permissionChecker.getOrgUnitsWithPermission(any(), any())).thenReturn(List.of(unit.getId()));
        when(evaluationLevelRepository.findByOrganizationIdOrderByThresholdDesc(orgId)).thenReturn(List.of());
    }

    private void asDirector() {
        when(permissionChecker.hasPermission(directorId, StatsTierResolver.PERM_ORG)).thenReturn(true);
    }

    private void asStaff() {
        when(permissionChecker.hasPermission(staffId, StatsTierResolver.PERM_MY)).thenReturn(true);
    }

    // ============================================================

    @Test
    @DisplayName("Histogram: cấp SELF vẫn thấy phân phối nhưng kèm điểm của chính mình để định vị")
    void histogramMarksOwnScoreForSelfTier() {
        asStaff();
        when(evaluationRepository.scoresInScope(any(), any()))
                .thenReturn(List.of(40.0, 55.0, 72.0, 88.0));
        when(evaluationRepository.avgScoreByUser(any(), any()))
                .thenReturn(List.<Object[]>of(new Object[]{staffId, "Tôi", "Phòng A", 72.0}));

        ScoreHistogramResponse res = histogramFor(staffId);

        assertThat(res.getAnonymized()).isTrue();
        assertThat(res.getTotalCount()).isEqualTo(4);
        assertThat(res.getMyScore()).isEqualTo(72.0);
        // Phân phối không mang danh tính ai nên vẫn hiện được đầy đủ.
        assertThat(res.getBins()).hasSize(10);
        assertThat(res.getBins().stream().mapToInt(b -> b.getCount()).sum()).isEqualTo(4);
    }

    @Test
    @DisplayName("Histogram: điểm bằng đúng trần thang rơi vào khoảng cuối, không tràn mảng")
    void histogramPutsMaxScoreInLastBin() {
        asDirector();
        when(evaluationRepository.scoresInScope(any(), any())).thenReturn(List.of(100.0));

        ScoreHistogramResponse res = histogramFor(directorId);

        assertThat(res.getBins().get(9).getCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("Boxplot so sánh giữa đơn vị → cấp SELF phải trả rỗng, không thu hẹp")
    void boxplotIsEmptyForSelfTier() {
        asStaff();
        UnitBoxplotResponse res = boxplotFor(staffId);
        assertThat(res.getBoxes()).isEmpty();
        // Trục vẫn phải có để frontend dựng khung trống mà không vỡ.
        assertThat(res.getAxisMax()).isEqualTo(100.0);
    }

    @Test
    @DisplayName("Tháp nhân sự: rank 0-1 về bên trái, rank 2 về bên phải, gộp theo cấp")
    void pyramidSplitsByRank() {
        asDirector();
        when(userRoleOrgUnitRepository.headcountByLevelAndRank(any())).thenReturn(List.of(
                new Object[]{0, "Phòng ban", 0, 2L},
                new Object[]{0, "Phòng ban", 1, 3L},
                new Object[]{0, "Phòng ban", 2, 12L}));

        HeadcountPyramidResponse res = pyramidFor(directorId);

        assertThat(res.getRows()).hasSize(1);
        assertThat(res.getRows().get(0).getLeft()).isEqualTo(5);
        assertThat(res.getRows().get(0).getRight()).isEqualTo(12);
        assertThat(res.getTotalHeadcount()).isEqualTo(17);
    }

    @Test
    @DisplayName("Sankey: dải trùng cặp nút được cộng dồn thay vì tạo hai dải chồng nhau")
    void sankeyMergesDuplicateEdges() {
        asDirector();
        when(kpiCriteriaRepository.kpiCascadeEdges(any())).thenReturn(List.of(
                new Object[]{"Phòng A", "Tổ 1", "DELEGATION", 10.0, 2L},
                new Object[]{"Phòng A", "Tổ 1", "DECOMPOSITION", 5.0, 1L}));

        SankeyResponse res = withUser(directorId, () -> flow.getKpiCascade(null, List.of(periodId)));

        assertThat(res.getEmpty()).isFalse();
        assertThat(res.getNodes()).hasSize(2);
        assertThat(res.getLinks()).hasSize(1);
        assertThat(res.getLinks().get(0).getValue()).isEqualTo(15.0);
    }

    @Test
    @DisplayName("Sankey: cạnh tự trỏ vào chính đơn vị mình bị loại, vì không tạo ra luồng nào")
    void sankeyDropsSelfLoops() {
        asDirector();
        when(kpiCriteriaRepository.kpiCascadeEdges(any())).thenReturn(List.<Object[]>of(
                new Object[]{"Phòng A", "Phòng A", "DECOMPOSITION", 8.0, 1L}));

        assertThat(withUser(directorId, () -> flow.getKpiCascade(null, List.of(periodId))).getEmpty()).isTrue();
    }

    @Test
    @DisplayName("Sankey OKR: cấp SELF không thấy phân bổ trọng số của đơn vị")
    void okrFlowIsEmptyForSelfTier() {
        asStaff();
        assertThat(withUser(staffId, () -> flow.getOkrFlow(null, List.of(periodId))).getEmpty()).isTrue();
    }

    // ============================================================
    // Gọi service với người dùng chỉ định (bỏ qua SecurityContext)
    // ============================================================

    private ScoreHistogramResponse histogramFor(UUID userId) {
        return withUser(userId, () -> distribution.getScoreHistogram(null, List.of(periodId)));
    }

    private UnitBoxplotResponse boxplotFor(UUID userId) {
        return withUser(userId, () -> distribution.getUnitBoxplot(null, List.of(periodId)));
    }

    private HeadcountPyramidResponse pyramidFor(UUID userId) {
        return withUser(userId, () -> distribution.getHeadcountPyramid(null, List.of(periodId)));
    }

    /**
     * Service gọi {@code tierResolver.resolve(...)} vốn đọc SecurityContext, nên nạp sẵn một
     * authentication trỏ tới email của người cần đóng vai.
     */
    private <T> T withUser(UUID userId, java.util.function.Supplier<T> action) {
        String email = userId + "@test.local";
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                        email, null, java.util.List.of()));
        try {
            return action.get();
        } finally {
            org.springframework.security.core.context.SecurityContextHolder.clearContext();
        }
    }
}
