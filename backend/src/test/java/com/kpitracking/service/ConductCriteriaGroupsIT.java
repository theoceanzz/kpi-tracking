package com.kpitracking.service;

import com.kpitracking.dto.request.conduct.ConductCriteriaRequest;
import com.kpitracking.dto.request.conduct.ConductGroupRequest;
import com.kpitracking.dto.request.conduct.ConductScoreRequest;
import com.kpitracking.dto.request.conduct.ConductSetRequest;
import com.kpitracking.dto.response.conduct.ConductConfigResponse;
import com.kpitracking.dto.response.conduct.ConductItemResponse;
import com.kpitracking.dto.response.conduct.ConductSetResponse;
import com.kpitracking.dto.response.conduct.ConductSheetResponse;
import com.kpitracking.enums.ConductScope;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.service.kpi.CycleLockChecker;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Hạnh kiểm theo bộ → NHÓM → tiêu chí (V39) trên PostgreSQL thật: lưu/kiểm/chép cấu hình nhóm, và phiếu
 * chấm chụp đúng nhóm để tổng điểm ra a×30% + b×40% + c×30%.
 *
 * <p>Cần DB local (org demo DEMO1). Mỗi test rollback. Khoá kỳ được giả lập "không khoá" để test không phụ
 * thuộc trạng thái chốt kỳ của dữ liệu dev. Chạy tay: {@code ./mvnw test -Dtest=ConductCriteriaGroupsIT}.
 */
@SpringBootTest
@Transactional
class ConductCriteriaGroupsIT {

    private static final UUID DEMO1 = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @Autowired ConductService conductService;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManager em;
    @MockBean CycleLockChecker cycleLockChecker;

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    // ── phiếu giấy mẫu: 5 giá trị cốt lõi 30% / 10 đặc điểm 40% / 6 chữ vàng 30% ──────────────

    private static List<ConductCriteriaRequest> evenly(String prefix, int n) {
        List<ConductCriteriaRequest> out = new ArrayList<>();
        double each = Math.floor(100.0 / n * 100) / 100;
        for (int i = 0; i < n; i++) {
            double w = i == n - 1 ? Math.round((100 - each * (n - 1)) * 100) / 100.0 : each;
            out.add(ConductCriteriaRequest.builder().name(prefix + " " + (i + 1)).weight(w).build());
        }
        return out;
    }

    private static List<ConductGroupRequest> cultureGroups() {
        return List.of(
                ConductGroupRequest.builder().name("5 giá trị cốt lõi").weight(30.0).criteria(evenly("Giá trị", 5)).build(),
                ConductGroupRequest.builder().name("10 đặc điểm nhân sự").weight(40.0).criteria(evenly("Đặc điểm", 10)).build(),
                ConductGroupRequest.builder().name("6 chữ vàng").weight(30.0).criteria(evenly("Chữ", 6)).build());
    }

    private ConductSetResponse createGrouped(String name, List<UUID> cycleIds) {
        ConductConfigResponse cfg = conductService.createSet(DEMO1, ConductSetRequest.builder()
                .name(name).maxScore(5.0).kpiCycleIds(cycleIds).groups(cultureGroups()).build());
        return cfg.getSets().stream().filter(s -> s.getName().equals(name)).findFirst().orElseThrow();
    }

    private static String uniq(String p) {
        return p + " " + UUID.randomUUID().toString().substring(0, 6);
    }

    // ── cấu hình ─────────────────────────────────────────────────────────────

    @Test
    void groupedSet_isSavedWithGroupsAndInGroupWeights() {
        ConductSetResponse set = createGrouped(uniq("Văn hoá DN"), List.of());

        assertThat(set.getGroups()).extracting(g -> g.getName())
                .containsExactly("5 giá trị cốt lõi", "10 đặc điểm nhân sự", "6 chữ vàng");
        assertThat(set.getGroups()).extracting(g -> g.getWeight()).containsExactly(30.0, 40.0, 30.0);
        assertThat(set.getGroups()).allSatisfy(g -> assertThat(g.getTotalWeight()).isEqualTo(100.0));
        assertThat(set.getGroups().get(0).getCriteria()).hasSize(5)
                .allSatisfy(c -> assertThat(c.getWeight()).isEqualTo(20.0));
        assertThat(set.getTotalWeight()).isEqualTo(100.0);
        assertThat(set.getCriteria()).hasSize(21).allSatisfy(c -> assertThat(c.getGroupId()).isNotNull());
    }

    @Test
    void groupWithInGroupTotalNot100_isRejected() {
        List<ConductGroupRequest> groups = new ArrayList<>(cultureGroups());
        groups.set(0, ConductGroupRequest.builder().name("Lệch").weight(30.0)
                .criteria(List.of(ConductCriteriaRequest.builder().name("A").weight(90.0).build())).build());

        assertThatThrownBy(() -> conductService.createSet(DEMO1, ConductSetRequest.builder()
                .name(uniq("Sai")).groups(groups).build()))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.CONDUCT_GROUP_WEIGHT_MUST_100_PERCENT);
    }

    @Test
    void groupWeightsNotTotal100_isRejected() {
        List<ConductGroupRequest> groups = cultureGroups().subList(0, 2); // 30 + 40 = 70

        assertThatThrownBy(() -> conductService.createSet(DEMO1, ConductSetRequest.builder()
                .name(uniq("Sai")).groups(groups).build()))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.TOTAL_WEIGHT_SET_MUST_100_PERCENT);
    }

    @Test
    void emptyGroup_isRejected() {
        List<ConductGroupRequest> groups = new ArrayList<>(cultureGroups());
        groups.set(2, ConductGroupRequest.builder().name("Rỗng").weight(30.0).criteria(List.of()).build());

        assertThatThrownBy(() -> conductService.createSet(DEMO1, ConductSetRequest.builder()
                .name(uniq("Sai")).groups(groups).build()))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.CONDUCT_GROUP_NEEDS_CRITERION);
    }

    @Test
    void copyingAGroupedSet_copiesTheGroups() {
        ConductSetResponse source = createGrouped(uniq("Nguồn"), List.of());
        String name = uniq("Bản sao");

        ConductSetResponse copy = conductService.createSet(DEMO1, ConductSetRequest.builder()
                        .name(name).copyFromSetId(source.getId()).build())
                .getSets().stream().filter(s -> s.getName().equals(name)).findFirst().orElseThrow();

        assertThat(copy.getGroups()).extracting(g -> g.getName())
                .containsExactly("5 giá trị cốt lõi", "10 đặc điểm nhân sự", "6 chữ vàng");
        assertThat(copy.getCriteria()).hasSize(21);
    }

    @Test
    void savingFlatCriteriaWithEmptyGroups_removesTheGroups() {
        ConductSetResponse set = createGrouped(uniq("Về phẳng"), List.of());

        ConductSetResponse flat = conductService.updateSet(DEMO1, set.getId(), ConductSetRequest.builder()
                        .name(set.getName()).groups(List.of())
                        .criteria(evenly("Phẳng", 4)).build())
                .getSets().stream().filter(s -> s.getId().equals(set.getId())).findFirst().orElseThrow();

        assertThat(flat.getGroups()).isEmpty();
        assertThat(flat.getCriteria()).hasSize(4).allSatisfy(c -> assertThat(c.getGroupId()).isNull());
    }

    // ── phiếu chấm ──────────────────────────────────────────────────────────

    @Test
    void sheet_snapshotsGroups_andTotalIsWeightedByGroup() {
        // Một đợt có kỳ của DEMO1 và một người CHƯA có phiếu đợt đó (phiếu có rồi thì giữ bản chụp cũ).
        Map<String, Object> pick = jdbc.queryForMap("""
                SELECT p.id AS period_id, p.kpi_cycle_id AS cycle_id, u.id AS user_id, u.email
                  FROM kpi_periods p
                  JOIN user_role_org_units x ON TRUE
                  JOIN users u ON u.id = x.user_id AND u.deleted_at IS NULL
                  JOIN org_units ou ON ou.id = x.org_unit_id
                  JOIN org_hierarchy_levels l ON l.id = ou.org_hierarchy_id AND l.organization_id = p.organization_id
                 WHERE p.organization_id = ? AND p.deleted_at IS NULL AND p.kpi_cycle_id IS NOT NULL
                   AND NOT EXISTS (SELECT 1 FROM conduct_evaluations e
                                    WHERE e.user_id = u.id AND e.kpi_period_id = p.id AND e.deleted_at IS NULL)
                 LIMIT 1""", DEMO1);
        UUID periodId = (UUID) pick.get("period_id");
        UUID cycleId = (UUID) pick.get("cycle_id");
        createGrouped(uniq("Văn hoá phiếu"), List.of(cycleId));
        em.flush();

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(pick.get("email"), null, List.of()));
        ConductSheetResponse blank = conductService.getSheet(null, ConductScope.PERIOD, periodId, null);
        assertThat(blank.getItems()).hasSize(21);

        // Chấm: nhóm a toàn 5, nhóm b toàn 4, nhóm c toàn 3 ⇒ tổng = 5×30% + 4×40% + 3×30% = 4.0
        List<ConductScoreRequest.ConductScoreItemRequest> scores = blank.getItems().stream()
                .map(i -> {
                    double s = switch (i.getGroupPosition()) { case 1 -> 5.0; case 2 -> 4.0; default -> 3.0; };
                    return ConductScoreRequest.ConductScoreItemRequest.builder().criteriaId(i.getCriteriaId())
                            .position(i.getPosition()).score(s).build();
                })
                .toList();
        ConductSheetResponse saved = conductService.saveSelfScores(ConductScoreRequest.builder()
                .scope(ConductScope.PERIOD).kpiPeriodId(periodId).items(scores).build());

        ConductItemResponse first = saved.getItems().get(0);
        assertThat(first.getGroupName()).isEqualTo("5 giá trị cốt lõi");
        assertThat(first.getGroupWeight()).isEqualTo(30.0);
        assertThat(first.getWeightInGroup()).isEqualTo(20.0);
        assertThat(first.getWeight()).as("% trên tổng = 20% × 30%").isEqualTo(6.0);
        assertThat(saved.getItems()).extracting(ConductItemResponse::getWeight)
                .satisfies(ws -> assertThat(ws.stream().mapToDouble(Double::doubleValue).sum()).isCloseTo(100.0,
                        org.assertj.core.data.Offset.offset(0.05)));
        assertThat(saved.getSelfScore()).isCloseTo(4.0, org.assertj.core.data.Offset.offset(0.01));
        assertThat(IntStream.of(1, 2, 3).allMatch(gp -> saved.getItems().stream()
                .anyMatch(i -> i.getGroupPosition() == gp))).isTrue();
    }
}
