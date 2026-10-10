package com.kpitracking.service;

import com.kpitracking.dto.request.orgunit.CreateOrgUnitRequest;
import com.kpitracking.dto.request.orgunit.UpdateOrgUnitRequest;
import com.kpitracking.dto.response.orgunit.OrgUnitExcelResponse;
import com.kpitracking.dto.response.orgunit.OrgUnitResponse;
import com.kpitracking.dto.response.orgunit.OrgUnitTreeResponse;
import com.kpitracking.enums.OrgUnitRelationType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cột {@code org_units.parent_relation} (V38) và cách OrgUnitService đọc/ghi nó. Quan hệ CHỈ để vẽ sơ
 * đồ — luật chuỗi duyệt / quyền xem đã có test riêng ở KpiApprovalChainServiceTest, KpiAccessPolicyTest.
 *
 * <p>Cần DB local (org demo DEMO1). Mỗi test rollback. Chạy tay: {@code ./mvnw test -Dtest=OrgUnitParentRelationIT}.
 */
@SpringBootTest
@Transactional
class OrgUnitParentRelationIT {

    private static final UUID DEMO1 = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @Autowired OrgUnitService orgUnitService;
    @Autowired JdbcTemplate jdbc;
    @Autowired jakarta.persistence.EntityManager em;

    private UUID branchId;
    private String childTypeName;

    @BeforeEach
    void pickParent() {
        Map<String, Object> branch = jdbc.queryForMap("""
                SELECT u.id, l.level_order FROM org_units u JOIN org_hierarchy_levels l ON l.id = u.org_hierarchy_id
                 WHERE l.organization_id = ? AND u.parent_id IS NULL AND u.deleted_at IS NULL LIMIT 1""", DEMO1);
        branchId = (UUID) branch.get("id");
        childTypeName = jdbc.queryForObject(
                "SELECT unit_type_name FROM org_hierarchy_levels WHERE organization_id = ? AND level_order = ?",
                String.class, DEMO1, ((Number) branch.get("level_order")).intValue() + 1);
    }

    @Test
    void migration_columnIsNotNullWithDirectDefault() {
        Map<String, Object> col = jdbc.queryForMap("""
                SELECT is_nullable, column_default FROM information_schema.columns
                 WHERE table_name = 'org_units' AND column_name = 'parent_relation'""");
        assertThat(col.get("is_nullable")).isEqualTo("NO");
        assertThat(String.valueOf(col.get("column_default"))).contains("DIRECT");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM org_units WHERE parent_relation IS NULL", Long.class)).isZero();
    }

    @Test
    void create_withoutRelation_isDirect() {
        OrgUnitResponse r = orgUnitService.createOrgUnit(DEMO1, request("IT-DIR", null));
        assertThat(r.getParentRelation()).isEqualTo(OrgUnitRelationType.DIRECT);
    }

    @Test
    void create_advisory_isStoredAndShownInTree() {
        OrgUnitResponse r = orgUnitService.createOrgUnit(DEMO1, request("IT-ADV", OrgUnitRelationType.ADVISORY));

        assertThat(r.getParentRelation()).isEqualTo(OrgUnitRelationType.ADVISORY);
        em.flush(); // đọc bằng SQL thẳng: phải đẩy INSERT xuống trước
        assertThat(jdbc.queryForObject("SELECT parent_relation FROM org_units WHERE id = ?", String.class, r.getId()))
                .isEqualTo("ADVISORY");
        // Cây đơn vị lọc theo người đang đăng nhập — đăng nhập bằng người đứng đầu đơn vị gốc (thấy cả cây).
        String email = jdbc.queryForObject("""
                SELECT u.email FROM users u JOIN user_role_org_units x ON x.user_id = u.id
                  JOIN roles r ON r.id = x.role_id
                 WHERE x.org_unit_id = ? AND r.rank = 0 AND u.deleted_at IS NULL LIMIT 1""", String.class, branchId);
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(email, null, List.of()));
        assertThat(flatten(orgUnitService.getOrgUnitTree(DEMO1))
                .filter(n -> n.getId().equals(r.getId())).findFirst().orElseThrow().getParentRelation())
                .isEqualTo(OrgUnitRelationType.ADVISORY);
    }

    @Test
    void update_changesRelation_andOmittedRelationKeepsIt() {
        UUID id = orgUnitService.createOrgUnit(DEMO1, request("IT-UPD", null)).getId();

        UpdateOrgUnitRequest toSupervisory = new UpdateOrgUnitRequest();
        toSupervisory.setParentRelation(OrgUnitRelationType.SUPERVISORY);
        assertThat(orgUnitService.updateOrgUnit(DEMO1, id, toSupervisory).getParentRelation())
                .isEqualTo(OrgUnitRelationType.SUPERVISORY);

        UpdateOrgUnitRequest renameOnly = new UpdateOrgUnitRequest();
        renameOnly.setName("IT-UPD đổi tên " + UUID.randomUUID());
        assertThat(orgUnitService.updateOrgUnit(DEMO1, id, renameOnly).getParentRelation())
                .isEqualTo(OrgUnitRelationType.SUPERVISORY);
    }

    @Test
    void rootUnit_isAlwaysDirect() {
        UpdateOrgUnitRequest req = new UpdateOrgUnitRequest();
        req.setParentRelation(OrgUnitRelationType.ADVISORY);
        assertThat(orgUnitService.updateOrgUnit(DEMO1, branchId, req).getParentRelation())
                .isEqualTo(OrgUnitRelationType.DIRECT);
    }

    @Test
    void export_hasParentRelationColumn() {
        UUID id = orgUnitService.createOrgUnit(DEMO1, request("IT-EXP", OrgUnitRelationType.SUPERVISORY)).getId();
        em.flush();
        String code = jdbc.queryForObject("SELECT code FROM org_units WHERE id = ?", String.class, id);

        List<OrgUnitExcelResponse> rows = orgUnitService.exportOrgUnits(DEMO1);

        assertThat(rows).filteredOn(r -> r.getCode().equals(code)).singleElement()
                .extracting(OrgUnitExcelResponse::getParentRelation).isEqualTo("SUPERVISORY");
        assertThat(rows).allSatisfy(r -> assertThat(r.getParentRelation()).isNotNull());
    }

    @org.junit.jupiter.api.AfterEach
    void clearAuth() {
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
    }

    private CreateOrgUnitRequest request(String prefix, OrgUnitRelationType relation) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        return CreateOrgUnitRequest.builder()
                .name(prefix + " " + suffix).code(prefix + "-" + suffix)
                .parentId(branchId).unitTypeName(childTypeName)
                .parentRelation(relation).build();
    }

    private static Stream<OrgUnitTreeResponse> flatten(List<OrgUnitTreeResponse> nodes) {
        return nodes.stream().flatMap(n -> Stream.concat(Stream.of(n), flatten(n.getChildren())));
    }
}
