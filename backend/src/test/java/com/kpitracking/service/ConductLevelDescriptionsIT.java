package com.kpitracking.service;

import com.kpitracking.dto.request.conduct.ConductCriteriaRequest;
import com.kpitracking.dto.request.conduct.ConductScoreRequest;
import com.kpitracking.dto.request.conduct.ConductSetRequest;
import com.kpitracking.dto.response.conduct.ConductCriteriaResponse;
import com.kpitracking.dto.response.conduct.ConductSetResponse;
import com.kpitracking.dto.response.conduct.ConductSheetResponse;
import com.kpitracking.enums.ConductScope;
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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Định nghĩa theo mức điểm của tiêu chí hạnh kiểm (V48) trên PostgreSQL thật: chuẩn hoá khi lưu, chép theo bộ, và phiếu
 * chấm mang theo (bản chụp). Cần DB local (org demo DEMO1). Mỗi test rollback.
 * Chạy tay: {@code ./mvnw test -Dtest=ConductLevelDescriptionsIT}.
 */
@SpringBootTest
@Transactional
class ConductLevelDescriptionsIT {

    private static final UUID DEMO1 = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @Autowired ConductService conductService;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManager em;
    @MockBean CycleLockChecker cycleLockChecker;

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    private static String uniq(String p) {
        return p + " " + UUID.randomUUID().toString().substring(0, 6);
    }

    private static Map<String, String> rubric() {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("5", "  Luôn chủ động, làm gương  ");
        m.put("3", "   ");               // trống ⇒ bỏ
        m.put("1", "Thường xuyên vi phạm");
        m.put("7", "Ngoài thang");       // thang 1–5 ⇒ bỏ
        m.put("x", "Không phải mức");    // ⇒ bỏ
        return m;
    }

    private ConductSetResponse create(String name, List<UUID> cycleIds) {
        List<ConductCriteriaRequest> criteria = List.of(
                ConductCriteriaRequest.builder().name("Nhiệt tâm").description("Trung thực").levelDescriptions(rubric()).weight(50.0).build(),
                ConductCriteriaRequest.builder().name("Sáng tạo").weight(50.0).build());
        return conductService.createSet(DEMO1, ConductSetRequest.builder()
                        .name(name).maxScore(5.0).kpiCycleIds(cycleIds).criteria(criteria).build())
                .getSets().stream().filter(s -> s.getName().equals(name)).findFirst().orElseThrow();
    }

    @Test
    void levels_areNormalizedOnSave_andCopiedWithTheSet() {
        ConductSetResponse set = create(uniq("Theo mức"), List.of());
        ConductCriteriaResponse first = set.getCriteria().get(0);
        assertThat(first.getLevelDescriptions()).containsExactly(
                Map.entry("1", "Thường xuyên vi phạm"), Map.entry("5", "Luôn chủ động, làm gương"));
        assertThat(set.getCriteria().get(1).getLevelDescriptions()).isNull();

        String name = uniq("Bản sao theo mức");
        ConductSetResponse copy = conductService.createSet(DEMO1, ConductSetRequest.builder()
                        .name(name).copyFromSetId(set.getId()).build())
                .getSets().stream().filter(s -> s.getName().equals(name)).findFirst().orElseThrow();
        assertThat(copy.getCriteria().get(0).getLevelDescriptions()).isEqualTo(first.getLevelDescriptions());
    }

    @Test
    void sheet_carriesLevels_beforeAndAfterSaving() {
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
        create(uniq("Phiếu theo mức"), List.of((UUID) pick.get("cycle_id")));
        em.flush();

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(pick.get("email"), null, List.of()));
        ConductSheetResponse blank = conductService.getSheet(null, ConductScope.PERIOD, periodId, null);
        assertThat(blank.getItems().get(0).getLevelDescriptions()).containsKeys("1", "5");

        List<ConductScoreRequest.ConductScoreItemRequest> scores = blank.getItems().stream()
                .map(i -> ConductScoreRequest.ConductScoreItemRequest.builder().criteriaId(i.getCriteriaId())
                        .position(i.getPosition()).score(5.0).build())
                .toList();
        ConductSheetResponse saved = conductService.saveSelfScores(ConductScoreRequest.builder()
                .scope(ConductScope.PERIOD).kpiPeriodId(periodId).items(scores).build());
        em.flush();
        assertThat(saved.getItems().get(0).getLevelDescriptions()).containsEntry("5", "Luôn chủ động, làm gương");
        assertThat(saved.getItems().get(1).getLevelDescriptions()).isNull();
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM conduct_evaluation_items i JOIN conduct_evaluations e ON e.id = i.conduct_evaluation_id
                 WHERE e.user_id = ? AND e.kpi_period_id = ? AND i.criteria_level_descriptions ->> '1' = 'Thường xuyên vi phạm'""",
                Integer.class, pick.get("user_id"), periodId)).as("phiếu chụp định nghĩa theo mức").isEqualTo(1);
    }
}
