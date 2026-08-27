package com.kpitracking.tool;

import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.PeopleRequest;
import com.kpitracking.tool.ToolSupport.UnitRef;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/**
 * Nhân sự — gộp từ get_members, get_user_summary, get_my_info, get_org_unit_statistics và
 * get_members_by_performance_threshold.
 *
 * <p>Năm tool cũ đều trả về người hoặc số liệu về một nhóm người, và mô tả của chúng phải tự phân
 * biệt với nhau lẫn với rank/search — đúng chỗ model 20B hay lẫn nhất.
 */
@Component
@RequiredArgsConstructor
public class PeopleTool {

    private final OrgUnitStatisticService orgUnitStatisticService;
    private final ToolSupport support;

    @Tool(name = "get_people", description = "Nhân sự và số liệu về nhân sự. "
            + "view=list: danh sách và số lượng người trong đơn vị, MẶC ĐỊNH tính cả các đơn vị con "
            + "(truyền includeChildUnits=false nếu chỉ muốn người gắn trực tiếp vào đơn vị đó); "
            + "lọc chức vụ bằng positionName (vd 'trưởng phòng'). "
            + "view=statistics: số liệu KPI tổng hợp của nhóm người trong đơn vị (tiến độ, hiệu suất, xếp loại); "
            + "positionName giới hạn nhóm theo chức vụ. "
            + "view=by_performance: lọc người theo ngưỡng hiệu suất (vd 'dưới 80%', 'trên 90%') — dùng cho câu hỏi "
            + "cần hành động; truyền threshold và direction. "
            + "view=user_summary: số liệu KPI và danh sách KPI của MỘT người, cần userId. "
            + "view=me: hồ sơ của chính người đang đăng nhập — dùng cho câu hỏi tự quy chiếu "
            + "('tôi là ai', 'đơn vị của tôi', 'chức vụ của tôi'). "
            + "Các view theo đơn vị mặc định là đơn vị hiện tại, nên khi người dùng nêu tên đơn vị PHẢI truyền unitName.")
    public String getPeople(PeopleRequest request, ToolContext context) {
        try {
            String view = normalizeView(request.view());
            if (view == null) {
                throw new IllegalArgumentException(
                        "Thiếu hoặc sai view. Chỉ nhận: list, statistics, by_performance, user_summary, me.");
            }
            return switch (view) {
                case "me" -> me(request, context);
                case "user_summary" -> userSummary(request, context);
                default -> byUnit(view, request, context);
            };
        } catch (Exception e) {
            return support.toolError("get_people", e);
        }
    }

    private static String normalizeView(String raw) {
        if (raw == null) return null;
        String s = raw.trim().toLowerCase().replace('-', '_');
        return switch (s) {
            case "list", "members", "people" -> "list";
            case "statistics", "stats", "summary" -> "statistics";
            case "by_performance", "threshold", "performance" -> "by_performance";
            case "user_summary", "user", "person" -> "user_summary";
            case "me", "myself", "my_info" -> "me";
            default -> null;
        };
    }

    private String me(PeopleRequest request, ToolContext context) throws Exception {
        if (ToolSupport.notBlank(request.userId()) || ToolSupport.notBlank(request.unitName())
                || ToolSupport.notBlank(request.unitId())) {
            throw new IllegalArgumentException("view=me không nhận userId/unitName/unitId — nó luôn trả hồ sơ "
                    + "của chính người đang đăng nhập. Muốn xem người khác thì dùng view=user_summary.");
        }
        String email = support.getUserEmail(context);
        if (!ToolSupport.notBlank(email)) {
            throw new IllegalStateException("Không xác định được người dùng hiện tại.");
        }
        return support.respond(context, "get_people", orgUnitStatisticService.getCurrentUserProfile(email));
    }

    private String userSummary(PeopleRequest request, ToolContext context) throws Exception {
        if (!ToolSupport.notBlank(request.userId())) {
            throw new IllegalArgumentException("view=user_summary cần userId. Dùng search (entityType=user) "
                    + "để lấy UUID trước.");
        }
        UUID targetUserId = support.parseId(request.userId(), "người dùng (userId)", "search (entityType=user)");
        support.guardDisambiguation("user", targetUserId, "người dùng", context);
        support.validateUserAccess(targetUserId, context);
        Map<String, Object> response = orgUnitStatisticService.getUserSummary(
                targetUserId, request.startDate(), request.endDate());
        return support.respond(context, "get_people", response);
    }

    private String byUnit(String view, PeopleRequest request, ToolContext context) throws Exception {
        // userId chỉ có nghĩa với view=user_summary. Lờ đi thì model tưởng đã lọc theo người.
        if (ToolSupport.notBlank(request.userId())) {
            throw new IllegalArgumentException("userId chỉ dùng với view=user_summary, không dùng với view="
                    + view + ".");
        }
        UnitRef u = support.resolveUnit(request.unitId(), request.unitName(), context);
        if (u.clarification() != null) return support.respond(context, "get_people", u.clarification());

        if (ToolSupport.notBlank(request.positionId())) {
            support.parseId(request.positionId(), "vị trí (positionId)", "search (entityType=position)");
        }

        // Hỏi "phòng X có bao nhiêu người" thì gần như luôn có nghĩa là CẢ phòng, kể cả các nhóm
        // bên trong. Mặc định cũ là chỉ đếm người gắn TRỰC TIẾP vào đơn vị, nên "Phòng IT có bao
        // nhiêu người" trả về 2 (trưởng + phó) thay vì 8 — sai theo trực giác mà không báo lỗi gì,
        // chỉ là một con số nhỏ hơn nhìn vẫn hợp lý. Đo được: model có truyền cờ này hay không là
        // hên xui, gpt-oss-20b có truyền còn 120b thì không, nên không thể phụ thuộc vào model.
        // Muốn chỉ lấy người gắn trực tiếp thì truyền includeChildUnits=false một cách tường minh.
        boolean includeChildren = request.includeChildUnits() == null || request.includeChildUnits();

        Map<String, Object> response = switch (view) {
            case "list" -> orgUnitStatisticService.getMembers(
                    u.id(), includeChildren, request.positionId(), request.positionName(),
                    request.page(), request.size(), request.sortBy(), request.sortDirection());
            case "statistics" -> orgUnitStatisticService.getMemberStatistics(
                    u.id(), includeChildren, request.positionName(),
                    request.startDate(), request.endDate());
            case "by_performance" -> orgUnitStatisticService.getMembersByPerformanceThreshold(
                    u.id(), request.threshold() != null ? request.threshold() : 80.0,
                    request.direction(), request.metric(),
                    request.startDate(), request.endDate(),
                    request.limit() != null ? request.limit() : 20);
            default -> throw new IllegalStateException("view chưa xử lý: " + view);
        };
        return support.respond(context, "get_people", response);
    }
}
