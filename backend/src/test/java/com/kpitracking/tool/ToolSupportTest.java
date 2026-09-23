package com.kpitracking.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.repository.ConversationMessageRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.OrgUnitStatisticService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import dev.langchain4j.invocation.InvocationParameters;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import com.kpitracking.service.ai.agent.AgentState;

/**
 * Test cho phần QUYẾT ĐỊNH của tầng tool AI: ai được xem dữ liệu của ai.
 *
 * <p>Đây là chỗ đáng test nhất trong toàn bộ tầng tool — sai một phép so đường dẫn là rò dữ liệu
 * giữa các đơn vị của cùng một công ty, mà lỗi đó không hề ồn ào: người dùng vẫn nhận được câu trả
 * lời trôi chảy, chỉ là chứa số liệu của đơn vị họ không được xem.
 *
 * <p>Dùng Mockito thuần, không dựng Spring context, nên chạy trong vài trăm mili giây và không cần
 * cơ sở dữ liệu.
 */
class ToolSupportTest {

    // Cây đơn vị dùng chung cho mọi test:
    //   /cty/          (gốc)
    //     /cty/it/     (Phòng IT — phạm vi của người đang đăng nhập)
    //       /cty/it/be/  (Team Backend — nằm TRONG phạm vi)
    //     /cty/mkt/    (Phòng Marketing — NGOÀI phạm vi)
    private static final String ROOT = "/cty/";
    private static final String IT = "/cty/it/";
    private static final String IT_BACKEND = "/cty/it/be/";
    private static final String MARKETING = "/cty/mkt/";

    private OrgUnitRepository orgUnitRepository;
    private UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private KpiCriteriaRepository kpiCriteriaRepository;
    private OrgUnitStatisticService orgUnitStatisticService;
    private FollowupContextStore followupContextStore;
    private ToolSupport support;

    @BeforeEach
    void setUp() {
        orgUnitRepository = mock(OrgUnitRepository.class);
        userRoleOrgUnitRepository = mock(UserRoleOrgUnitRepository.class);
        kpiCriteriaRepository = mock(KpiCriteriaRepository.class);
        orgUnitStatisticService = mock(OrgUnitStatisticService.class);
        followupContextStore = mock(FollowupContextStore.class);

        support = new ToolSupport(
                orgUnitRepository,
                userRoleOrgUnitRepository,
                mock(UserRepository.class),
                kpiCriteriaRepository,
                mock(ConversationMessageRepository.class),
                orgUnitStatisticService,
                followupContextStore,
                new ObjectMapper());
        support.initToolMapper();
    }

    /** Ngữ cảnh của một quản lý Phòng IT. */
    private InvocationParameters contextOfItManager() {
        return new InvocationParameters(Map.of(
                "orgUnitId", UUID.randomUUID().toString(),
                "organizationId", UUID.randomUUID().toString(),
                "orgUnitPath", IT,
                "userEmail", "head@demo.com"));
    }

    private UUID stubUnitAtPath(String path) {
        UUID id = UUID.randomUUID();
        when(orgUnitRepository.findById(id))
                .thenReturn(Optional.of(OrgUnit.builder().id(id).path(path).build()));
        return id;
    }

    private UUID stubUserInUnitAtPath(String path) {
        UUID userId = UUID.randomUUID();
        when(userRoleOrgUnitRepository.findByUserId(userId)).thenReturn(List.of(
                UserRoleOrgUnit.builder()
                        .orgUnit(OrgUnit.builder().id(UUID.randomUUID()).path(path).build())
                        .build()));
        return userId;
    }

    private UUID stubKpiInUnitAtPath(String path) {
        UUID kpiId = UUID.randomUUID();
        when(kpiCriteriaRepository.findById(kpiId)).thenReturn(Optional.of(
                KpiCriteria.builder()
                        .id(kpiId)
                        .orgUnit(OrgUnit.builder().id(UUID.randomUUID()).path(path).build())
                        .build()));
        return kpiId;
    }

    // ════════════════════════════════════════════════════════════════════════
    @Nested
    @DisplayName("Phạm vi đơn vị")
    class SubtreeAccess {

        @Test
        @DisplayName("cho phép chính đơn vị của mình")
        void allowsOwnUnit() {
            UUID unit = stubUnitAtPath(IT);
            assertThatCode(() -> support.validateSubtreeAccess(unit, contextOfItManager()))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("cho phép đơn vị con")
        void allowsDescendant() {
            UUID unit = stubUnitAtPath(IT_BACKEND);
            assertThatCode(() -> support.validateSubtreeAccess(unit, contextOfItManager()))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("CHẶN đơn vị anh em cùng công ty")
        void blocksSibling() {
            UUID unit = stubUnitAtPath(MARKETING);
            assertThatThrownBy(() -> support.validateSubtreeAccess(unit, contextOfItManager()))
                    .isInstanceOf(SecurityException.class)
                    .hasMessageContaining("Không có quyền truy cập đơn vị này");
        }

        @Test
        @DisplayName("CHẶN đơn vị cha — quyền chỉ đi xuống, không đi lên")
        void blocksAncestor() {
            UUID unit = stubUnitAtPath(ROOT);
            assertThatThrownBy(() -> support.validateSubtreeAccess(unit, contextOfItManager()))
                    .isInstanceOf(SecurityException.class);
        }

        @Test
        @DisplayName("không có orgUnitPath trong ngữ cảnh thì bỏ qua kiểm tra")
        void skipsWhenNoContextPath() {
            UUID unit = stubUnitAtPath(MARKETING);
            assertThatCode(() -> support.validateSubtreeAccess(unit, new InvocationParameters(Map.of())))
                    .doesNotThrowAnyException();
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    @Nested
    @DisplayName("Phạm vi người dùng")
    class UserAccess {

        @Test
        @DisplayName("cho phép người trong đơn vị con")
        void allowsUserInSubtree() {
            UUID user = stubUserInUnitAtPath(IT_BACKEND);
            assertThatCode(() -> support.validateUserAccess(user, contextOfItManager()))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("CHẶN người ở đơn vị khác")
        void blocksUserOutside() {
            UUID user = stubUserInUnitAtPath(MARKETING);
            assertThatThrownBy(() -> support.validateUserAccess(user, contextOfItManager()))
                    .isInstanceOf(SecurityException.class)
                    .hasMessageContaining("không thuộc phạm vi đơn vị của bạn");
        }

        @Test
        @DisplayName("CHẶN người chưa thuộc đơn vị nào")
        void blocksUserWithoutUnit() {
            UUID user = UUID.randomUUID();
            when(userRoleOrgUnitRepository.findByUserId(user)).thenReturn(List.of());
            assertThatThrownBy(() -> support.validateUserAccess(user, contextOfItManager()))
                    .isInstanceOf(SecurityException.class);
        }

        @Test
        @DisplayName("người giữ nhiều vai trò: chỉ cần MỘT đơn vị nằm trong phạm vi là đủ")
        void allowsWhenAnyAssignmentInScope() {
            UUID user = UUID.randomUUID();
            when(userRoleOrgUnitRepository.findByUserId(user)).thenReturn(List.of(
                    UserRoleOrgUnit.builder()
                            .orgUnit(OrgUnit.builder().id(UUID.randomUUID()).path(MARKETING).build()).build(),
                    UserRoleOrgUnit.builder()
                            .orgUnit(OrgUnit.builder().id(UUID.randomUUID()).path(IT_BACKEND).build()).build()));
            assertThatCode(() -> support.validateUserAccess(user, contextOfItManager()))
                    .doesNotThrowAnyException();
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    @Nested
    @DisplayName("Phạm vi KPI")
    class KpiAccess {

        @Test
        @DisplayName("cho phép KPI của đơn vị con")
        void allowsKpiInSubtree() {
            UUID kpi = stubKpiInUnitAtPath(IT_BACKEND);
            assertThatCode(() -> support.validateKpiAccess(kpi, contextOfItManager()))
                    .doesNotThrowAnyException();
            assertThat(support.hasKpiAccess(kpi, contextOfItManager())).isTrue();
        }

        @Test
        @DisplayName("CHẶN KPI của đơn vị khác")
        void blocksKpiOutside() {
            UUID kpi = stubKpiInUnitAtPath(MARKETING);
            assertThatThrownBy(() -> support.validateKpiAccess(kpi, contextOfItManager()))
                    .isInstanceOf(SecurityException.class);
        }

        @Test
        @DisplayName("hasKpiAccess trả false thay vì ném lỗi — dùng để LỌC khi gom nhiều KPI trùng tên")
        void hasKpiAccessFiltersSilently() {
            UUID kpi = stubKpiInUnitAtPath(MARKETING);
            assertThat(support.hasKpiAccess(kpi, contextOfItManager())).isFalse();
        }

        @Test
        @DisplayName("KPI không tồn tại thì hasKpiAccess trả false, không ném NullPointer")
        void hasKpiAccessHandlesMissingKpi() {
            UUID kpi = UUID.randomUUID();
            when(kpiCriteriaRepository.findById(kpi)).thenReturn(Optional.empty());
            assertThat(support.hasKpiAccess(kpi, contextOfItManager())).isFalse();
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    @Nested
    @DisplayName("Resolve đơn vị theo tên")
    class ResolveUnit {

        @Test
        @DisplayName("một tên khớp đúng một đơn vị -> trả id, không cần hỏi lại")
        void singleMatchResolves() {
            UUID unitId = stubUnitAtPath(IT_BACKEND);
            when(orgUnitStatisticService.searchOrgUnits(any(), anyString(), anyInt()))
                    .thenReturn(List.of(Map.of("id", unitId.toString(), "name", "Team Backend")));

            ToolSupport.UnitRef ref = support.resolveUnit(null, "Team Backend", contextOfItManager());

            assertThat(ref.clarification()).isNull();
            assertThat(ref.id()).isEqualTo(unitId);
        }

        @Test
        @DisplayName("tên khớp NHIỀU đơn vị -> yêu cầu hỏi lại, KHÔNG tự chọn giúp")
        void ambiguousNameAsksBack() {
            when(orgUnitStatisticService.searchOrgUnits(any(), anyString(), anyInt())).thenReturn(List.of(
                    Map.of("id", UUID.randomUUID().toString(), "name", "Team Backend"),
                    Map.of("id", UUID.randomUUID().toString(), "name", "Team Backend")));

            ToolSupport.UnitRef ref = support.resolveUnit(null, "Team Backend", contextOfItManager());

            assertThat(ref.id()).isNull();
            assertThat(ref.clarification()).containsEntry("needsClarification", true);
        }

        @Test
        @DisplayName("không tìm thấy tên -> cũng hỏi lại chứ không im lặng dùng đơn vị hiện tại")
        void notFoundAsksBack() {
            when(orgUnitStatisticService.searchOrgUnits(any(), anyString(), anyInt())).thenReturn(List.of());

            ToolSupport.UnitRef ref = support.resolveUnit(null, "Phòng không tồn tại", contextOfItManager());

            assertThat(ref.id()).isNull();
            assertThat(ref.clarification()).containsEntry("needsClarification", true);
        }

        @Test
        @DisplayName("\"công ty\" / \"toàn tổ chức\" / \"đơn vị của tôi\" không phải tên đơn vị -> lùi về đơn vị hiện tại, không hỏi lại")
        void wholeScopeAliasFallsBackToCurrentUnit() {
            when(orgUnitStatisticService.searchOrgUnits(any(), anyString(), anyInt())).thenReturn(List.of());
            InvocationParameters ctx = contextOfItManager();
            UUID current = UUID.fromString(String.valueOf(ctx.<Object>get("orgUnitId")));

            for (String alias : List.of("Công ty", "toàn công ty", "Toàn bộ tổ chức", "đơn vị của tôi",
                    "cả công ty này", "tổ chức hiện tại", "Doanh nghiệp")) {
                ToolSupport.UnitRef ref = support.resolveUnit(null, alias, ctx);
                assertThat(ref.clarification()).as(alias).isNull();
                assertThat(ref.id()).as(alias).isEqualTo(current);
            }
        }

        @Test
        @DisplayName("lùi về đơn vị hiện tại thì lời gọi tool kế tiếp mang scopeNote nêu tên đơn vị, và chỉ một lần")
        void fallbackAnnotatesNextToolPayload() throws Exception {
            when(orgUnitStatisticService.searchOrgUnits(any(), anyString(), anyInt())).thenReturn(List.of());
            UUID current = stubUnitAtPath(IT);
            com.kpitracking.service.ai.AiTurn turn = new com.kpitracking.service.ai.AiTurn("q", null, null);
            com.kpitracking.service.ai.agent.AgentState state = new com.kpitracking.service.ai.agent.AgentState(turn);
            InvocationParameters ctx = new InvocationParameters(Map.of(
                    "orgUnitId", current.toString(), "organizationId", UUID.randomUUID().toString(),
                    "orgUnitPath", IT, com.kpitracking.service.ai.agent.AgentState.CONTEXT_KEY, state));

            ToolSupport.UnitRef ref = support.resolveUnit(null, "toàn công ty", ctx);
            String first = support.respond(ctx, "get_kpi", Map.of("total", 3));
            String second = support.respond(ctx, "get_kpi", Map.of("total", 3));

            assertThat(ref.id()).isEqualTo(current);
            assertThat(first).contains("scopeNote").contains("toàn công ty").contains("\"total\":3");
            assertThat(second).doesNotContain("scopeNote");
        }

        @Test
        @DisplayName("scoped(): payload tổng hợp mang tên đơn vị lên đầu; không phải Map thì trả nguyên")
        void scopedPrependsUnitName() {
            UUID unitId = UUID.randomUUID();
            when(orgUnitRepository.findById(unitId))
                    .thenReturn(Optional.of(OrgUnit.builder().id(unitId).path(IT).name("Phòng IT").build()));

            Object out = support.scoped(new java.util.LinkedHashMap<>(Map.of("totalKpis", 80)), unitId);

            assertThat(out).isInstanceOf(Map.class);
            @SuppressWarnings("unchecked") Map<String, Object> m = (Map<String, Object>) out;
            assertThat(m.keySet().iterator().next()).isEqualTo("orgUnitName");
            assertThat(m).containsEntry("orgUnitName", "Phòng IT").containsEntry("totalKpis", 80);
            assertThat(support.scoped(List.of(1, 2), unitId)).isEqualTo(List.of(1, 2));
        }

        @Test
        @DisplayName("đơn vị THẬT tên \"Công ty ABC\" vẫn thắng cách gọi chung — chỉ lùi khi không tìm thấy gì")
        void realUnitNamedLikeAliasStillWins() {
            UUID unitId = stubUnitAtPath(IT_BACKEND);
            when(orgUnitStatisticService.searchOrgUnits(any(), anyString(), anyInt()))
                    .thenReturn(List.of(Map.of("id", unitId.toString(), "name", "Công ty")));

            ToolSupport.UnitRef ref = support.resolveUnit(null, "Công ty", contextOfItManager());

            assertThat(ref.id()).isEqualTo(unitId);
            assertThat(ToolSupport.isWholeScopeAlias("Phòng Marketing")).isFalse();
        }

        @Test
        @DisplayName("ưu tiên khớp CHÍNH XÁC tên để tránh mơ hồ giả")
        void prefersExactNameMatch() {
            UUID exactId = stubUnitAtPath(IT_BACKEND);
            when(orgUnitStatisticService.searchOrgUnits(any(), anyString(), anyInt())).thenReturn(List.of(
                    Map.of("id", exactId.toString(), "name", "Sales"),
                    Map.of("id", UUID.randomUUID().toString(), "name", "Sales Support")));

            ToolSupport.UnitRef ref = support.resolveUnit(null, "Sales", contextOfItManager());

            assertThat(ref.clarification()).isNull();
            assertThat(ref.id()).isEqualTo(exactId);
        }

        @Test
        @DisplayName("resolve theo unitName vẫn PHẢI kiểm phạm vi — không được lách qua đường tên")
        void nameResolutionStillChecksScope() {
            UUID outside = stubUnitAtPath(MARKETING);
            when(orgUnitStatisticService.searchOrgUnits(any(), anyString(), anyInt()))
                    .thenReturn(List.of(Map.of("id", outside.toString(), "name", "Phòng Marketing")));

            assertThatThrownBy(() -> support.resolveUnit(null, "Phòng Marketing", contextOfItManager()))
                    .isInstanceOf(SecurityException.class);
        }

        @Test
        @DisplayName("không truyền tên lẫn id -> mặc định là đơn vị hiện tại")
        void defaultsToCurrentUnit() {
            UUID current = UUID.randomUUID();
            InvocationParameters ctx = new InvocationParameters(Map.of("orgUnitId", current.toString(), "orgUnitPath", IT));

            ToolSupport.UnitRef ref = support.resolveUnit(null, null, ctx);

            assertThat(ref.clarification()).isNull();
            assertThat(ref.id()).isEqualTo(current);
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    @Nested
    @DisplayName("Chống trùng tên và ID hỏng")
    class GuardsAndIds {

        @Test
        @DisplayName("ID đã bị đánh dấu trùng tên thì từ chối, buộc hỏi người dùng chọn")
        void refusesArmedId() {
            UUID id = UUID.randomUUID();
            // Dùng trạng thái THẬT chứ không mock: chốt chặn nay nằm trong AgentState đi cùng
            // InvocationParameters, nên test đi đúng đường mà lúc chạy thật nó đi.
            AgentState st = AgentState.forToolsOnly();
            st.arm("user", java.util.Set.of(id));
            InvocationParameters ctx = new InvocationParameters(java.util.Map.of(AgentState.CONTEXT_KEY, st));

            assertThatThrownBy(() -> support.guardDisambiguation("user", id, "người dùng", ctx))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("trùng tên");
        }

        @Test
        @DisplayName("ID không phải UUID -> báo lỗi CHỈ RÕ tool cần gọi để lấy ID thật")
        void malformedIdTellsModelWhatToDo() {
            assertThatThrownBy(() -> support.parseId("IT-DEPT", "đơn vị (unitId)", "search (entityType=org_unit)"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("search (entityType=org_unit)");
        }

        @Test
        @DisplayName("gom nhóm tên trùng: chỉ trả về những mục THỰC SỰ đụng tên nhau")
        void findsOnlyCollidingNames() {
            List<Map<String, Object>> results = List.of(
                    Map.of("id", UUID.randomUUID().toString(), "fullName", "Nguyễn Văn A"),
                    Map.of("id", UUID.randomUUID().toString(), "fullName", "Nguyễn Văn A"),
                    Map.of("id", UUID.randomUUID().toString(), "fullName", "Trần Thị B"));

            assertThat(support.findDuplicateNameGroup(results, "fullName")).hasSize(2);
        }

        @Test
        @DisplayName("tên khác nhau thì không có nhóm trùng nào")
        void noCollisionWhenNamesUnique() {
            List<Map<String, Object>> results = List.of(
                    Map.of("id", UUID.randomUUID().toString(), "fullName", "Nguyễn Văn A"),
                    Map.of("id", UUID.randomUUID().toString(), "fullName", "Trần Thị B"));

            assertThat(support.findDuplicateNameGroup(results, "fullName")).isEmpty();
        }

        @Test
        @DisplayName("so tên bỏ qua hoa thường và khoảng trắng thừa")
        void nameComparisonIgnoresCaseAndSpace() {
            List<Map<String, Object>> results = List.of(
                    Map.of("id", UUID.randomUUID().toString(), "name", "Phòng IT"),
                    Map.of("id", UUID.randomUUID().toString(), "name", "  phòng it  "));

            assertThat(support.findDuplicateNameGroup(results, "name")).hasSize(2);
        }

        @Test
        @DisplayName("collectIds bỏ qua giá trị không phải UUID thay vì làm hỏng cả lượt")
        void collectIdsSkipsNonUuid() {
            UUID good = UUID.randomUUID();
            List<Map<String, Object>> items = List.of(
                    Map.of("id", good.toString()),
                    Map.of("id", "khong-phai-uuid"));

            assertThat(support.collectIds(items)).containsExactly(good);
        }
    }
}
