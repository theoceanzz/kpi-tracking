package com.kpitracking.tool;

import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.RankRequest;
import com.kpitracking.tool.ToolSupport.UnitRef;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Xếp hạng theo chỉ số — gộp từ rank_members và rank_org_units.
 *
 * <p>Hai tool cũ cùng trả một bảng xếp hạng, chỉ khác đối tượng được xếp. Mô tả của chúng cộng lại
 * dài 2.369 ký tự, phần lớn là luật dặn model đừng gọi nhầm sang tool kia hoặc sang search — thứ
 * mất nghĩa ngay khi gộp. Phần giữ lại là NGỮ NGHĨA NGHIỆP VỤ mà model không thể tự suy ra:
 * average_performance là điểm đánh giá chứ không phải % mục tiêu, và người chưa có đánh giá bị
 * loại khỏi bảng chứ không phải bị tính 0 điểm.
 */
@Component
@RequiredArgsConstructor
public class RankTool {

    private final OrgUnitStatisticService orgUnitStatisticService;
    private final FollowupContextStore followupContextStore;
    private final ToolSupport support;

    @Tool(name = "rank", description = "Xếp hạng theo chỉ số. subject=members xếp hạng NGƯỜI "
            + "-> [rank, userId, fullName, email, orgUnitName, positionName, score]; subject=org_units "
            + "xếp hạng CÁC ĐƠN VỊ CON bên trong một đơn vị cha -> [rank, orgUnitName, score]. "
            + "Mặc định là đơn vị hiện tại của bạn, nên khi người dùng nêu tên đơn vị PHẢI truyền unitName. "
            + "Chỉ số: average_progress (% đạt mục tiêu), average_performance (ĐIỂM ĐÁNH GIÁ theo đợt, "
            + "KHÔNG phải % mục tiêu; startDate/endDate = các đợt phủ khoảng đó, bỏ trống = mọi đợt), "
            + "total_progress, late_submission_count, missing_submission_count, submission_count, "
            + "member_count (chỉ với org_units). Với chỉ số đánh giá, người/đơn vị CHƯA có đánh giá bị "
            + "LOẠI khỏi bảng — không phải 0 điểm, không phải 'thấp nhất'. "
            + "Riêng subject=members: một người giữ nhiều chức vụ sẽ có thêm mảng 'positions' — khi có "
            + "thì phải nêu ĐỦ, không chỉ nêu một. Lọc: managersOnly=true lấy trưởng/phó đơn vị cấp dưới; "
            + "positionName lọc theo chức vụ; unitTypeName lọc theo loại cấp đơn vị (vd 'Phòng'); "
            + "kpiId xếp hạng trong phạm vi một KPI.")
    public String rank(RankRequest request, ToolContext context) {
        try {
            String subject = normalizeSubject(request.subject());
            if (subject == null) {
                throw new IllegalArgumentException("Thiếu hoặc sai subject. Chỉ nhận: members, org_units.");
            }
            return "org_units".equals(subject)
                    ? rankOrgUnits(request, context)
                    : rankMembers(request, context);
        } catch (Exception e) {
            return support.toolError("rank", e);
        }
    }

    private static String normalizeSubject(String raw) {
        if (raw == null) return null;
        String s = raw.trim().toLowerCase().replace('-', '_');
        return switch (s) {
            case "member", "members", "user", "users", "people", "person" -> "members";
            case "org_unit", "org_units", "orgunit", "orgunits", "unit", "units", "department", "departments" -> "org_units";
            default -> null;
        };
    }

    // ── xếp hạng đơn vị ──────────────────────────────────────────────────────

    private String rankOrgUnits(RankRequest request, ToolContext context) throws Exception {
        // Tham số chỉ có nghĩa với subject=members. Lờ đi thì model tưởng đã lọc rồi báo cáo
        // một bảng xếp hạng KHÔNG hề được lọc — sai mà không ai phát hiện.
        rejectUnsupported(request);

        // Không có unitName/unitId thì xếp hạng trong đơn vị hiện tại — hỏi "các phòng trong
        // khối X" mà thiếu tham số này sẽ âm thầm xếp hạng nhầm subtree.
        UnitRef unit = support.resolveUnit(request.unitId(), request.unitName(), context);
        if (unit.clarification() != null) return support.respond(context, "rank", unit.clarification());

        List<Map<String, Object>> response = orgUnitStatisticService.rankOrgUnits(
                unit.id(), request.metric(), request.order(), request.limit(),
                request.startDate(), request.endDate());
        return support.respond(context, "rank", response);
    }

    private void rejectUnsupported(RankRequest r) {
        StringBuilder bad = new StringBuilder();
        if (ToolSupport.notBlank(r.kpiId())) bad.append("kpiId ");
        if (ToolSupport.notBlank(r.positionFilter()) || ToolSupport.notBlank(r.positionName())) bad.append("positionName ");
        if (Boolean.TRUE.equals(r.managersOnly())) bad.append("managersOnly ");
        if (ToolSupport.notBlank(r.unitTypeName())) bad.append("unitTypeName ");
        if (bad.length() > 0) {
            // Thông báo phải nói RÕ việc cần làm tiếp. Bản đầu chỉ nói "không dùng được" và
            // model bỏ cuộc, quay ra hỏi lại người dùng thay vì tự gọi lại cho đúng.
            throw new IllegalArgumentException(bad.toString().trim().replace(' ', ',')
                    + " không dùng được với subject=org_units. "
                    + "subject=org_units đã xếp hạng sẵn các đơn vị con của đơn vị cha rồi, "
                    + "nên hãy BỎ các tham số này và gọi lại ngay với cùng unitName. "
                    + "Nếu thật sự muốn xếp hạng NGƯỜI theo chức vụ thì đổi sang subject=members.");
        }
    }

    // ── xếp hạng người ───────────────────────────────────────────────────────

    private String rankMembers(RankRequest request, ToolContext context) throws Exception {
        if ("kpi".equals(request.scope()) && ToolSupport.notBlank(request.kpiId())) {
            support.validateKpiAccess(
                    support.parseId(request.kpiId(), "KPI (kpiId)", "search (entityType=kpi)"), context);
        }
        UUID orgId = support.getOrgId(context);
        UUID contextUnitId = support.getOrgUnitId(context);

        // Model thường nêu tên đơn vị nhưng QUÊN đặt scope="unit". Nếu đòi đúng scope mới xử lý
        // thì unitName bị lờ đi và tool lặng lẽ xếp hạng CẢ TỔ CHỨC -> trả sai người. Nêu tên/ID
        // đơn vị tức là muốn xếp hạng TRONG đơn vị đó, nên suy scope ra từ chính tham số.
        boolean hasUnitTarget = ToolSupport.notBlank(request.unitId()) || ToolSupport.notBlank(request.unitName());
        String scope = request.scope();
        if (hasUnitTarget && !"kpi".equalsIgnoreCase(scope)) {
            scope = "unit";
        }

        // RÒ DỮ LIỆU nếu bỏ dòng này: mọi scope khác "unit"/"kpi" rơi vào nhánh cuối của
        // OrgUnitStatisticService.rankMembers, và nhánh đó gọi findUsersByOrganizationId(orgId)
        // — tức TOÀN BỘ công ty, không hề dùng contextUnitId. Không có unitName thì tool cũng
        // không đi qua validateSubtreeAccess lần nào, nên một trưởng phòng hỏi "xếp hạng toàn bộ
        // nhân viên công ty" sẽ nhận được cả người của đơn vị khác.
        // Kẹp về đúng điều mô tả tool đã hứa: không nêu đơn vị = đơn vị hiện tại của người hỏi.
        if (!hasUnitTarget && !"kpi".equalsIgnoreCase(scope)) {
            scope = "unit";
        }

        String targetUnitId = request.unitId();
        if (hasUnitTarget && "unit".equalsIgnoreCase(scope)) {
            UnitRef unit = ToolSupport.notBlank(targetUnitId)
                    ? support.resolveUnit(targetUnitId, null, context)
                    : support.resolveUnit(null, request.unitName(), context);
            if (unit.clarification() != null) return support.respond(context, "rank", unit.clarification());
            targetUnitId = unit.id().toString();
        }

        // Model hay gọi lại y hệt tool này nhiều lần trong MỘT lượt. Xếp hạng theo điểm đánh giá
        // chạy một truy vấn đánh giá cho MỖI người nên khá nặng — trả lại kết quả đã tính của
        // đúng lời gọi đó trong lượt hiện tại (startTurn xoá cache nên không bao giờ trả dữ liệu cũ).
        String conversationId = support.getConversationId(context);
        String cacheKey = "rank_members|" + support.toolMapper().writeValueAsString(request);
        String cached = followupContextStore.getCachedCall(conversationId, cacheKey);
        if (cached != null) return cached;

        // Các tool anh em nhận "positionName" nên model hay truyền tên đó vào đây; chấp nhận
        // cả hai để tham số không bị bỏ qua âm thầm (dẫn tới không lọc chức vụ).
        String positionFilter = ToolSupport.notBlank(request.positionFilter())
                ? request.positionFilter() : request.positionName();

        List<Map<String, Object>> response = orgUnitStatisticService.rankMembers(
                orgId, request.metric(), request.order(), scope,
                targetUnitId, request.kpiId(), request.limit(),
                request.startDate(), request.endDate(), contextUnitId,
                positionFilter, request.managersOnly(), request.unitTypeName());
        String json = support.respond(context, "rank", response);
        followupContextStore.cacheCall(conversationId, cacheKey, json);
        return json;
    }
}
