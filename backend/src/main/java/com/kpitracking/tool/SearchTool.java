package com.kpitracking.tool;

import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.SearchRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Tìm kiếm theo tên cho mọi loại thực thể — gộp từ 5 tool riêng (search_users, search_org_units,
 * search_kpis, search_positions, search_kpi_periods).
 *
 * <p>Gộp vì cả 5 có cùng một khuôn (từ khoá → danh sách kèm ID) và chỉ khác nhau ở loại thực thể.
 * Để rời rạc thì model phải chọn giữa 5 mô tả gần như giống hệt; gộp lại thì nó chọn 1 tool rồi
 * chọn 1 giá trị trong danh sách enum nhìn thấy ngay cạnh nhau — dễ hơn hẳn với model nhỏ.
 */
@Component
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class SearchTool {

    private final OrgUnitStatisticService orgUnitStatisticService;
    private final ToolSupport support;

    /**
     * Cấu hình riêng của từng loại thực thể.
     *
     * @param arrayKey  tên mảng trong JSON trả về
     * @param label     nhãn tiếng Việt dùng trong thông báo hỏi làm rõ
     * @param guardType khoá chống trùng tên trong {@code AgentState}; {@code null} = loại này không cần
     * @param nameKey   trường dùng để phát hiện trùng tên
     * @param labelKeys các trường phân biệt, để biết lượt trước đã hỏi người dùng chọn chưa
     */
    private record EntitySpec(String arrayKey, String label, String guardType,
                              String nameKey, String[] labelKeys, String aggregateHint) {}

    /**
     * Trùng tên KPI hầu như luôn là CÙNG một KPI lặp qua nhiều kỳ, không phải hai KPI khác nhau.
     * Không có gợi ý này thì model đọc "hãy yêu cầu người dùng chọn TRƯỚC KHI xem chi tiết" rồi
     * dừng lại hỏi, dù {@code get_submissions(kpiName=...)} và {@code get_kpi(view=list)} đã được
     * viết đúng để GỘP mọi bản trùng tên. Đo được: 3 câu hỏi hợp lệ bị chặn lại ở bước hỏi này.
     */
    private static final String KPI_HINT =
            "LƯU Ý: các KPI trùng tên bên dưới thường là CÙNG một KPI lặp qua nhiều kỳ. "
            + "Nếu câu hỏi cần số liệu TỔNG HỢP qua các kỳ (lịch sử nộp, diễn biến, ai được giao) "
            + "thì ĐỪNG hỏi lại — gọi thẳng get_submissions(view=history, kpiName=...) hoặc "
            + "get_kpi(view=list) để gộp mọi bản. Chỉ hỏi khi thật sự cần đúng MỘT kỳ cụ thể.";

    private static final Map<String, EntitySpec> SPECS = Map.of(
            "user", new EntitySpec("users", "người dùng", "user", "fullName",
                    new String[]{"email", "orgUnitName", "roleName"}, null),
            "org_unit", new EntitySpec("orgUnits", "đơn vị", "orgUnit", "name",
                    new String[]{"code", "parentName", "levelName"}, null),
            "kpi", new EntitySpec("kpis", "KPI", "kpi", "name",
                    new String[]{"orgUnitName", "periodName"}, KPI_HINT),
            // Chức vụ và kỳ KPI không chống trùng tên: trùng tên ở đây là bình thường và vô hại
            // (nhiều đơn vị cùng có "Trưởng phòng"), hỏi lại chỉ làm phiền người dùng.
            "position", new EntitySpec("positions", "chức vụ", null, null, new String[0], null),
            "period", new EntitySpec("periods", "kỳ KPI", null, null, new String[0], null)
    );

    @Tool(name = "search", description = "Tìm theo tên và trả về ID. entityType: "
            + "user (nhân sự — tìm theo tên, email, số điện thoại, chức vụ, đơn vị) | "
            + "org_unit (đơn vị) | kpi | position (chức vụ) | period (kỳ KPI). "
            + "Chỉ dùng khi cần UUID cho tool khác; phần lớn tool đã tự nhận tên qua unitName/positionName.")
    public String search(SearchRequest request, ToolContext context) {
        try {
            String entityType = normalizeEntityType(request.entityType());
            EntitySpec spec = SPECS.get(entityType);

            // Sai entityType phải báo LỖI RÕ chứ không được đoán bừa: model nhận thông báo này
            // và tự gọi lại đúng ngay trong cùng lượt.
            if (spec == null) {
                throw new IllegalArgumentException("entityType '" + request.entityType()
                        + "' không hợp lệ. Chỉ nhận: user, org_unit, kpi, position, period.");
            }
            if (!ToolSupport.notBlank(request.keyword())) {
                throw new IllegalArgumentException("Thiếu keyword — hãy truyền từ khoá cần tìm.");
            }

            // Tham số chỉ dành cho entityType=user. KHÔNG được lờ đi khi model truyền nhầm:
            // lờ đi thì model tưởng đã lọc rồi và trả về kết quả sai mà không ai biết.
            if (!"user".equals(entityType)
                    && (ToolSupport.notBlank(request.unitId()) || ToolSupport.notBlank(request.positionName()))) {
                throw new IllegalArgumentException("unitId/positionName chỉ dùng được với entityType=user, "
                        + "không dùng với entityType=" + entityType + ".");
            }

            UUID orgId = support.getOrgId(context);
            int maxResults = (request.limit() != null && request.limit() > 0) ? request.limit() : 10;

            if (ToolSupport.notBlank(request.unitId())) {
                support.validateSubtreeAccess(
                        support.parseId(request.unitId(), "đơn vị (unitId)", "search (entityType=org_unit)"),
                        context);
            }

            List<Map<String, Object>> results = fetch(entityType, orgId, request, maxResults);

            Map<String, Object> result = new LinkedHashMap<>();

            if (spec.guardType() != null) {
                // Xét TỪNG nhóm trùng tên riêng. Gộp mọi nhóm thành một khối phẳng là cách bản
                // trước làm, và nó khiến chốt chặn arm nhầm nhóm — xem ToolSupport.duplicateNameGroups.
                List<List<Map<String, Object>>> groups = support.focusGroups(
                        support.duplicateNameGroups(results, spec.nameKey()),
                        request.keyword(), spec.nameKey());

                log.debug("search(entityType={}, keyword='{}') -> {} nhóm trùng tên: {}",
                        entityType, request.keyword(), groups.size(),
                        groups.stream().map(g -> support.collisionName(g, spec.nameKey())).toList());

                List<Map<String, Object>> mustAsk = new ArrayList<>();
                List<String> hints = new ArrayList<>();

                for (List<Map<String, Object>> group : groups) {
                    List<Map<String, Object>> named = support.namedInPriorTurn(
                            support.getConversationId(context),
                            support.collisionName(group, spec.nameKey()), group, spec.labelKeys());

                    if (named.size() == 1) {
                        // Lượt trước chỉ nói tới MỘT bản → đó là bản đang được nhắc đến. Chặn các
                        // bản còn lại và nói thẳng bản nào đúng, thay vì hỏi lại một câu mà chính
                        // trợ lý vừa trả lời xong.
                        Map<String, Object> chosen = named.get(0);
                        support.armDisambiguation(spec.guardType(),
                                support.collectIds(group.stream().filter(c -> c != chosen).toList()),
                                context);
                        hints.add(contextHint(spec, chosen));
                    } else if (named.isEmpty()) {
                        // Không có căn cứ nào -> phải hỏi. (named >= 2 nghĩa là lượt trước đã bày ra
                        // lựa chọn và người dùng đã chọn — cứ chạy tiếp.)
                        mustAsk.addAll(group);
                    }
                }

                if (!mustAsk.isEmpty()) {
                    support.armDisambiguation(spec.guardType(), support.collectIds(mustAsk), context);
                    return support.returnAmbiguous("search", spec.label(), spec.arrayKey(), mustAsk,
                            spec.aggregateHint(), context);
                }
                if (!hints.isEmpty()) result.put("contextualChoice", String.join(" ", hints));
            }

            result.put("count", results.size());
            result.put(spec.arrayKey(), results);
            return support.respond(context, "search", result);
        } catch (Exception e) {
            return support.toolError("search", e);
        }
    }

    /**
     * Câu chỉ đường khi ngữ cảnh đã xác định được bản nào.
     *
     * <p>Nêu ĐÍCH DANH bản đúng chứ không chỉ nói "có nhiều bản": model đọc danh sách kết quả thấy
     * mấy dòng trùng tên thì vẫn có thể chọn nhầm, và các bản kia đang bị chặn nên nó sẽ ăn lỗi
     * rồi đi hỏi lại người dùng — an toàn, nhưng phiền vô ích khi câu trả lời đã nằm sẵn ở lượt
     * trước.
     */
    private static String contextHint(EntitySpec spec, Map<String, Object> chosen) {
        StringBuilder sb = new StringBuilder("Có nhiều ").append(spec.label())
                .append(" trùng tên, nhưng câu trả lời TRƯỚC của bạn đang nói về bản");
        for (String key : spec.labelKeys()) {
            Object v = chosen.get(key);
            if (v != null && !v.toString().isBlank()) sb.append(' ').append(v);
        }
        sb.append(". Dùng ĐÚNG bản đó (các bản còn lại đã bị chặn). ")
          .append("Người dùng thật sự muốn bản khác thì họ sẽ nói rõ.");
        return sb.toString();
    }

    /** Chấp nhận vài cách viết model hay dùng, để một lỗi chính tả nhỏ không thành lỗi cứng. */
    private static String normalizeEntityType(String raw) {
        if (raw == null) return null;
        String s = raw.trim().toLowerCase().replace('-', '_');
        return switch (s) {
            case "users", "employee", "employees", "person", "people" -> "user";
            case "org_units", "orgunit", "orgunits", "unit", "units", "department" -> "org_unit";
            case "kpis", "criteria" -> "kpi";
            case "positions", "role", "roles" -> "position";
            case "periods", "kpi_period", "kpi_periods" -> "period";
            default -> s;
        };
    }

    private List<Map<String, Object>> fetch(String entityType, UUID orgId,
                                            SearchRequest request, int maxResults) {
        return switch (entityType) {
            case "user" -> orgUnitStatisticService.searchUsers(
                    orgId, request.keyword(), request.unitId(), request.positionName(), maxResults);
            case "org_unit" -> orgUnitStatisticService.searchOrgUnits(orgId, request.keyword(), maxResults);
            case "kpi" -> orgUnitStatisticService.searchKpis(orgId, request.keyword(), maxResults);
            case "position" -> orgUnitStatisticService.searchPositions(orgId, request.keyword(), maxResults);
            case "period" -> orgUnitStatisticService.searchKpiPeriods(orgId, request.keyword(), maxResults);
            default -> throw new IllegalStateException("entityType chưa xử lý: " + entityType);
        };
    }
}
