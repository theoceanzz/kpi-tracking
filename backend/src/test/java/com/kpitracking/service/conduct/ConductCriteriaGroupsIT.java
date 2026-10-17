package com.kpitracking.service.conduct;

import com.kpitracking.dto.request.conduct.ConductCriteriaRequest;
import com.kpitracking.dto.request.conduct.ConductGroupRequest;
import com.kpitracking.dto.request.conduct.ConductScoreRequest;
import com.kpitracking.dto.request.conduct.ConductSetRequest;
import com.kpitracking.dto.response.conduct.ConductConfigResponse;
import com.kpitracking.dto.response.conduct.ConductItemResponse;
import com.kpitracking.dto.response.conduct.ConductSetResponse;
import com.kpitracking.dto.response.conduct.ConductSheetResponse;
import com.kpitracking.enums.conduct.ConductScope;
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

    /** Lưu lại bộ (kể cả không đổi gì) từng xoá mềm + chèn lại TẤT CẢ dòng — bảng phình, id đổi. */
    @Test
    void resavingWithIds_updatesInPlace_insteadOfInsertingNewRows() {
        ConductSetResponse set = createGrouped(uniq("Sửa tại chỗ"), List.of());
        List<UUID> groupIds = set.getGroups().stream().map(g -> g.getId()).toList();
        List<UUID> criteriaIds = set.getCriteria().stream().map(c -> c.getId()).toList();
        em.flush();
        Integer rowsBefore = jdbc.queryForObject(
                "SELECT count(*) FROM conduct_criteria WHERE conduct_criteria_set_id = ?", Integer.class, set.getId());

        // Gửi lại y nguyên những gì giao diện đang giữ (kèm id), chỉ đổi tên một tiêu chí.
        List<ConductGroupRequest> resend = set.getGroups().stream().map(g -> ConductGroupRequest.builder()
                .id(g.getId()).name(g.getName()).weight(g.getWeight())
                .criteria(g.getCriteria().stream().map(c -> ConductCriteriaRequest.builder()
                        .id(c.getId()).name(c.getName()).description(c.getDescription()).weight(c.getWeight()).build())
                        .toList())
                .build()).toList();
        resend.get(0).getCriteria().get(0).setName("Đã đổi tên");
        conductService.updateSet(DEMO1, set.getId(), ConductSetRequest.builder().name(set.getName()).groups(resend).build());
        ConductSetResponse saved = conductService.updateSet(DEMO1, set.getId(),
                        ConductSetRequest.builder().name(set.getName()).groups(resend).build())
                .getSets().stream().filter(s -> s.getId().equals(set.getId())).findFirst().orElseThrow();

        em.flush();

        assertThat(saved.getGroups()).extracting(g -> g.getId()).containsExactlyElementsOf(groupIds);
        assertThat(saved.getCriteria()).extracting(c -> c.getId()).containsExactlyElementsOf(criteriaIds);
        assertThat(saved.getCriteria().get(0).getName()).isEqualTo("Đã đổi tên");
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM conduct_criteria WHERE conduct_criteria_set_id = ?", Integer.class, set.getId()))
                .isEqualTo(rowsBefore);
    }

    @Test
    void resaving_dropsOnlyRemovedRows_andInsertsOnlyNewOnes() {
        ConductSetResponse set = createGrouped(uniq("Bỏ một thêm một"), List.of());
        em.flush();
        var g0 = set.getGroups().get(0);
        UUID removed = g0.getCriteria().get(4).getId();

        // Nhóm đầu: giữ 4 tiêu chí cũ (20% mỗi cái), bỏ cái thứ 5, thêm một tiêu chí mới 20%.
        List<ConductCriteriaRequest> first = new ArrayList<>(g0.getCriteria().subList(0, 4).stream()
                .map(c -> ConductCriteriaRequest.builder().id(c.getId()).name(c.getName()).weight(c.getWeight()).build())
                .toList());
        first.add(ConductCriteriaRequest.builder().name("Mới").weight(20.0).build());
        List<ConductGroupRequest> groups = new ArrayList<>(set.getGroups().stream().skip(1).map(g -> ConductGroupRequest.builder()
                .id(g.getId()).name(g.getName()).weight(g.getWeight())
                .criteria(g.getCriteria().stream().map(c -> ConductCriteriaRequest.builder()
                        .id(c.getId()).name(c.getName()).weight(c.getWeight()).build()).toList())
                .build()).toList());
        groups.add(0, ConductGroupRequest.builder().id(g0.getId()).name(g0.getName()).weight(g0.getWeight()).criteria(first).build());

        ConductSetResponse saved = conductService.updateSet(DEMO1, set.getId(),
                        ConductSetRequest.builder().name(set.getName()).groups(groups).build())
                .getSets().stream().filter(s -> s.getId().equals(set.getId())).findFirst().orElseThrow();
        em.flush();

        assertThat(saved.getCriteria()).hasSize(21).extracting(c -> c.getId()).doesNotContain(removed);
        assertThat(jdbc.queryForObject(
                "SELECT deleted_at IS NOT NULL FROM conduct_criteria WHERE id = ?", Boolean.class, removed)).isTrue();
        // 21 dòng ban đầu + đúng 1 dòng mới.
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM conduct_criteria WHERE conduct_criteria_set_id = ?", Integer.class, set.getId()))
                .isEqualTo(22);
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
