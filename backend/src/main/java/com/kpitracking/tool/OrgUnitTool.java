package com.kpitracking.tool;

import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.OrgUnitRequest;
import com.kpitracking.tool.ToolSupport.UnitRef;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Cơ cấu tổ chức — gộp từ get_org_hierarchy, get_org_unit_detail, get_child_org_units và
 * get_positions.
 *
 * <p>Bốn tool cũ đều trả thông tin về MỘT đơn vị, chỉ khác góc nhìn, nên mô tả của chúng phải tự
 * phân biệt với nhau. Gộp lại thì view làm việc đó và model chỉ còn một quyết định.
 */
@Component
@RequiredArgsConstructor
public class OrgUnitTool {

    private final OrgUnitStatisticService orgUnitStatisticService;
    private final ToolSupport support;

    @Tool(name = "get_org_unit", description = "Thông tin một đơn vị. "
            + "view=detail: chi tiết đơn vị kèm người phụ trách (dùng để trả lời 'ai chịu trách nhiệm đơn vị X'). "
            + "view=hierarchy: cây cơ cấu đầy đủ kèm số đơn vị con và số nhân sự. "
            + "view=children: danh sách và số lượng đơn vị con, recursive=true để lấy cả cây con. "
            + "view=positions: các chức vụ trong đơn vị kèm số người giữ mỗi chức vụ. "
            // Đo được: model đọc memberCount (chỉ người gắn trực tiếp) để trả lời "đơn vị X có bao
            // nhiêu người" và ra số nhỏ hơn thực tế. Nói rõ khoá nào là gì, vì hai khoá nghe giống
            // nhau thì model chọn hú hoạ.
            + "SỐ NGƯỜI: `memberCount` chỉ đếm người gắn TRỰC TIẾP vào đơn vị, KHÔNG gồm các đơn vị "
            + "con. `totalMemberCount` (chỉ có ở view=detail) mới là tổng gồm cả đơn vị con. "
            + "Câu hỏi 'đơn vị X có bao nhiêu người' PHẢI dùng totalMemberCount hoặc "
            + "get_people(view=list) — dùng memberCount là trả thiếu. "
            + "Mặc định là đơn vị hiện tại của bạn, nên khi người dùng nêu tên đơn vị PHẢI truyền unitName.")
    public String getOrgUnit(OrgUnitRequest request, ToolContext context) {
        try {
            String view = normalizeView(request.view());
            if (view == null) {
                throw new IllegalArgumentException(
                        "Thiếu hoặc sai view. Chỉ nhận: detail, hierarchy, children, positions.");
            }
            // Phân trang/sắp xếp chỉ có nghĩa với danh sách đơn vị con.
            if (!"children".equals(view)
                    && (request.recursive() != null || request.page() != null || request.size() != null
                        || ToolSupport.notBlank(request.sortBy()) || ToolSupport.notBlank(request.sortDirection()))) {
                throw new IllegalArgumentException(
                        "recursive/page/size/sortBy/sortDirection chỉ dùng với view=children, không dùng với view="
                        + view + ".");
            }

            UnitRef u = support.resolveUnit(request.unitId(), request.unitName(), context);
            if (u.clarification() != null) return support.respond(context, "get_org_unit", u.clarification());

            Map<String, Object> response = switch (view) {
                case "hierarchy" -> orgUnitStatisticService.getOrgHierarchy(u.id());
                case "detail" -> orgUnitStatisticService.getOrgUnitDetail(u.id());
                case "children" -> orgUnitStatisticService.getChildOrgUnits(
                        u.id(), request.recursive(), request.page(), request.size(),
                        request.sortBy(), request.sortDirection());
                case "positions" -> orgUnitStatisticService.getPositions(u.id());
                default -> throw new IllegalStateException("view chưa xử lý: " + view);
            };
            return support.respond(context, "get_org_unit", response);
        } catch (Exception e) {
            return support.toolError("get_org_unit", e);
        }
    }

    private static String normalizeView(String raw) {
        if (raw == null) return null;
        String s = raw.trim().toLowerCase().replace('-', '_');
        return switch (s) {
            case "detail", "info", "details" -> "detail";
            case "hierarchy", "tree", "structure" -> "hierarchy";
            case "children", "child", "child_units", "sub_units", "subunits" -> "children";
            case "positions", "position", "roles" -> "positions";
            default -> null;
        };
    }
}
