package com.kpitracking.tool;

import com.kpitracking.dto.response.okr.ObjectiveResponse;
import com.kpitracking.service.OkrService;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.OkrRequest;
import com.kpitracking.tool.ToolSupport.UnitRef;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Mục tiêu và kết quả then chốt (OKR) của một đơn vị.
 *
 * <p><b>Chốt chặn phạm vi, và vì sao nó bắt buộc.</b> {@code OkrService} có hai hàm đọc và CẢ HAI
 * đều truy vấn thẳng repository, không kiểm quyền:
 * <ul>
 *   <li>{@code getObjectivesByOrgUnit(orgUnitId)} — theo đơn vị</li>
 *   <li>{@code getObjectivesByOrganization(orgId)} — CẢ TỔ CHỨC</li>
 * </ul>
 * Đây đúng hình dạng lỗ rò dữ liệu mà tool {@code rank} từng mắc (nhánh cuối của service trả cả
 * công ty, không đi qua phép kiểm nào). Nên tool này TUYỆT ĐỐI không dùng hàm theo tổ chức, và giải
 * đơn vị qua {@code resolveUnit} — hàm đã gọi {@code validateSubtreeAccess}.
 *
 * <p>Điểm tiện: {@code ObjectiveResponse} đã mang sẵn {@code perspectiveName}, tức OKR vốn gắn với
 * viễn cảnh BSC — nên lọc "mục tiêu thuộc viễn cảnh Tài chính" trả lời được ngay tại đây.
 */
@Component
@RequiredArgsConstructor
public class OkrTool {

    private final OkrService okrService;
    private final ToolSupport support;

    @Tool(name = "get_okr", description = "Mục tiêu (Objective) và kết quả then chốt (Key Result) của một đơn vị. "
            + "view=objectives: danh sách mục tiêu kèm các kết quả then chốt và tiến độ từng cái. "
            + "view=progress: tổng hợp — đếm mục tiêu theo trạng thái và tiến độ trung bình "
            + "(dùng cho 'bao nhiêu mục tiêu đang chạy', 'OKR đơn vị tôi tới đâu rồi'). "
            + "Lọc thêm: perspectiveName = tên viễn cảnh BSC, status = ACTIVE | COMPLETED | CANCELLED. "
            + "Mặc định là đơn vị hiện tại của bạn, nên khi người dùng nêu tên đơn vị PHẢI truyền unitName. "
            + "Đây là OKR (mục tiêu), KHÁC chỉ tiêu KPI — hỏi về chỉ tiêu thì dùng get_kpi.")
    public String getOkr(OkrRequest request, ToolContext context) {
        try {
            String view = normalizeView(request.view());
            if (view == null) {
                throw new IllegalArgumentException("Thiếu hoặc sai view. Chỉ nhận: objectives, progress.");
            }
            String status = normalizeStatus(request.status());

            UnitRef u = support.resolveUnit(request.unitId(), request.unitName(), context);
            if (u.clarification() != null) return support.respond(context, "get_okr", u.clarification());

            List<ObjectiveResponse> all = okrService.getObjectivesByOrgUnit(u.id());
            List<ObjectiveResponse> objectives = all.stream()
                    .filter(o -> status == null
                            || (o.getStatus() != null && status.equals(o.getStatus().name())))
                    .filter(o -> !ToolSupport.notBlank(request.perspectiveName())
                            || matchesPerspective(o, request.perspectiveName()))
                    .toList();

            Object response = "progress".equals(view)
                    ? progress(objectives)
                    : listing(objectives);
            return support.respond(context, "get_okr", response);
        } catch (Exception e) {
            return support.toolError("get_okr", e);
        }
    }

    private static boolean matchesPerspective(ObjectiveResponse o, String wanted) {
        if (o.getPerspectiveName() == null) return false;
        return o.getPerspectiveName().toLowerCase().contains(wanted.trim().toLowerCase());
    }

    private static Map<String, Object> listing(List<ObjectiveResponse> objectives) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", objectives.size());
        out.put("objectives", objectives);
        if (objectives.isEmpty()) {
            out.put("message", "Đơn vị này chưa có mục tiêu nào khớp điều kiện.");
        }
        return out;
    }

    /**
     * Tổng hợp ngay trong tool từ chính danh sách vừa lấy — không cần thêm service.
     *
     * <p>Tiến độ trung bình tính trên các kết quả then chốt CÓ tiến độ; mục tiêu chưa có kết quả
     * then chốt nào thì không kéo trung bình xuống 0, vì "chưa nhập" khác "đạt 0%".
     */
    private static Map<String, Object> progress(List<ObjectiveResponse> objectives) {
        Map<String, Integer> byStatus = new TreeMap<>();
        double sum = 0;
        int counted = 0;
        int withoutKeyResults = 0;

        for (ObjectiveResponse o : objectives) {
            String st = o.getStatus() == null ? "KHÔNG RÕ" : o.getStatus().name();
            byStatus.merge(st, 1, Integer::sum);

            if (o.getKeyResults() == null || o.getKeyResults().isEmpty()) {
                withoutKeyResults++;
                continue;
            }
            for (var kr : o.getKeyResults()) {
                if (kr.getProgress() == null) continue;
                sum += kr.getProgress();
                counted++;
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalObjectives", objectives.size());
        out.put("countByStatus", byStatus);
        out.put("keyResultsCounted", counted);
        out.put("averageProgress", counted == 0 ? null : Math.round(sum / counted * 10.0) / 10.0);
        out.put("objectivesWithoutKeyResults", withoutKeyResults);
        if (counted == 0) {
            out.put("message", "Chưa có kết quả then chốt nào ghi nhận tiến độ, nên không tính được "
                    + "tiến độ trung bình. Đừng suy ra con số nào.");
        }
        return out;
    }

    private static String normalizeView(String raw) {
        if (raw == null) return null;
        String s = raw.trim().toLowerCase().replace('-', '_');
        return switch (s) {
            case "objectives", "objective", "list", "goals" -> "objectives";
            case "progress", "summary", "overview" -> "progress";
            default -> null;
        };
    }

    /** Nhận cả hằng số lẫn cách gọi tiếng Việt thường gặp. */
    private static String normalizeStatus(String raw) {
        if (!ToolSupport.notBlank(raw)) return null;
        String s = raw.trim().toUpperCase().replace(' ', '_');
        return switch (s) {
            case "ACTIVE", "ĐANG_CHẠY", "DANG_CHAY", "ĐANG_HOẠT_ĐỘNG" -> "ACTIVE";
            case "COMPLETED", "HOÀN_THÀNH", "HOAN_THANH", "DONE" -> "COMPLETED";
            case "CANCELLED", "CANCELED", "ĐÃ_HUỶ", "DA_HUY", "HUỶ" -> "CANCELLED";
            default -> throw new IllegalArgumentException("status '" + raw
                    + "' không hợp lệ. Chỉ nhận: ACTIVE, COMPLETED, CANCELLED.");
        };
    }
}
