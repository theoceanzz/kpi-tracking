package com.kpitracking.tool;

import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.CompareOrgUnitsRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * So sánh nhiều đơn vị cạnh nhau.
 *
 * <p>Không gộp vào {@link RankTool} vì đầu ra khác hẳn: xếp hạng trả một bảng thứ tự của mọi đơn vị
 * con, còn so sánh trả các chỉ số đặt cạnh nhau cho 2–5 đơn vị do người dùng chỉ đích danh, kèm
 * đánh dấu đơn vị tốt nhất. Gộp chúng sẽ tạo ra một tool có hai kiểu kết quả khác nhau — đúng thứ
 * làm model lẫn.
 */
@Component
@RequiredArgsConstructor
public class CompareTool {

    private final OrgUnitStatisticService orgUnitStatisticService;
    private final FollowupContextStore followupContextStore;
    private final ToolSupport support;

    @Tool(name = "compare_org_units", description = "So sánh 2–5 đơn vị cạnh nhau trên các chỉ số KPI "
            + "(avgPerformance, avgProgress, memberCount, completionRate) — dùng cho câu hỏi kiểu "
            + "'so sánh đơn vị A với B'. NÊN truyền unitNames: tool tự tra tên trong MỘT lần gọi; unitIds "
            + "(UUID) cũng nhận. Nếu một tên khớp nhiều đơn vị, tool trả needsClarification liệt kê lựa chọn "
            + "cho TẤT CẢ các tên mơ hồ cùng lúc — hãy hỏi người dùng chọn hết trong MỘT câu hỏi rồi gọi lại. "
            + "Kết quả có đánh dấu đơn vị tốt nhất.")
    public String compareOrgUnits(CompareOrgUnitsRequest request, ToolContext context) {
        try {
            UUID orgId = support.getOrgId(context);
            List<UUID> unitIds = new ArrayList<>();

            // 1. UUID truyền thẳng (giữ tương thích).
            if (request.unitIds() != null) {
                for (String id : request.unitIds()) {
                    if (ToolSupport.notBlank(id)) {
                        unitIds.add(support.parseId(id, "đơn vị (unitIds)", "search (entityType=org_unit)"));
                    }
                }
            }

            // 2. Resolve theo TÊN ngay trong tool (bỏ bước search riêng). Gom MỌI tên mơ hồ/không thấy
            //    để hỏi người dùng một lần, thay vì search tuần tự từng đơn vị (mỗi cái một lượt hỏi).
            List<Map<String, Object>> clarify = new ArrayList<>();
            if (request.unitNames() != null) {
                for (String name : request.unitNames()) {
                    if (!ToolSupport.notBlank(name)) continue;
                    String q = name.trim();
                    List<Map<String, Object>> pool = support.unitMatchPool(q, orgId);
                    if (pool.size() == 1) {
                        unitIds.add(UUID.fromString(String.valueOf(pool.get(0).get("id"))));
                    } else {
                        Map<String, Object> group = new LinkedHashMap<>();
                        group.put("query", q);
                        group.put("reason", pool.isEmpty() ? "not_found" : "ambiguous");
                        group.put("options", pool);
                        clarify.add(group);
                    }
                }
            }

            // 3. Có tên chưa xác định duy nhất -> trả yêu cầu làm rõ GỘP (hỏi 1 lần cho tất cả).
            if (!clarify.isEmpty()) {
                String convId = support.getConversationId(context);
                if (convId != null) followupContextStore.markDisambiguating(convId);
                Map<String, Object> out = new LinkedHashMap<>();
                out.put("needsClarification", true);
                out.put("ambiguous", clarify);
                out.put("message", "Một số tên đơn vị khớp NHIỀU đơn vị (hoặc không tìm thấy). Hãy hỏi người dùng "
                        + "chọn RÕ từng đơn vị (liệt kê đủ lựa chọn kèm đơn vị cha/cấp để phân biệt) trong MỘT câu hỏi, "
                        + "rồi gọi lại compare_org_units với tên cụ thể đã chọn.");
                return support.respond(context, "compare_org_units", out);
            }

            // 4. Khử trùng, kiểm tra số lượng + phân quyền, rồi so sánh.
            List<UUID> distinct = unitIds.stream().distinct().collect(Collectors.toList());
            if (distinct.size() < 2) {
                throw new IllegalArgumentException("Cần ít nhất 2 đơn vị KHÁC NHAU để so sánh. "
                        + "Hãy cung cấp unitNames (tên) hoặc unitIds.");
            }
            if (distinct.size() > 5) distinct = distinct.subList(0, 5);
            for (UUID uid : distinct) support.validateSubtreeAccess(uid, context);

            Map<String, Object> response = orgUnitStatisticService.compareOrgUnits(
                    distinct, request.startDate(), request.endDate());
            return support.respond(context, "compare_org_units", response);
        } catch (Exception e) {
            return support.toolError("compare_org_units", e);
        }
    }
}
