package com.kpitracking.tool;

import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.SearchRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

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

            if (spec.guardType() != null) {
                List<Map<String, Object>> dup = support.findDuplicateNameGroup(results, spec.nameKey());
                if (!dup.isEmpty() && !support.alreadyAskedPriorTurn(
                        support.getConversationId(context),
                        support.collisionName(dup, spec.nameKey()), dup, spec.labelKeys())) {
                    support.armDisambiguation(spec.guardType(), support.collectIds(dup), context);
                    return support.returnAmbiguous("search", spec.label(), spec.arrayKey(), results,
                            spec.aggregateHint(), context);
                }
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("count", results.size());
            result.put(spec.arrayKey(), results);
            return support.respond(context, "search", result);
        } catch (Exception e) {
            return support.toolError("search", e);
        }
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
