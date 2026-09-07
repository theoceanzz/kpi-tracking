package com.kpitracking.workflow;

import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static com.kpitracking.workflow.WorkflowStage.*;

/**
 * Danh mục các bước của luồng KPI — NGUỒN SỰ THẬT DUY NHẤT.
 *
 * <p>Trước đây cùng một danh sách này tồn tại ba nơi và phải đồng bộ bằng tay:
 * {@code navItems} trong {@code Sidebar.tsx}, {@code menuItems} trong {@code SystemSettingsPage.tsx},
 * và các chuỗi {@code if} rải trong service. Registry gom lại một chỗ và phục vụ cho frontend
 * qua {@code GET /api/v1/kpi-workflow/stages}, nên hai bên không thể lệch nhau nữa.
 *
 * <p>Quyền ở đây tách làm hai trục có chủ đích:
 * {@code navPermission} giữ NGUYÊN quyền mà Sidebar đang dùng (để không ai bỗng dưng mất/được thấy
 * menu sau refactor), còn {@code actionPermission} là quyền thật sự cần để chạy hành động.
 * Hai trục này vốn khác nhau ở {@code /evaluations}: menu mở theo {@code EVALUATION:VIEW_MY}
 * nhưng chấm điểm người khác đòi {@code EVALUATION:CREATE}.
 */
@Component
public class StageRegistry {

    private static final Map<WorkflowStage, StageDescriptor> DESCRIPTORS = new EnumMap<>(WorkflowStage.class);

    static {
        register(new StageDescriptor(CYCLE_SETUP, "/kpi-cycles", List.of(),
                "KPI_CYCLE:CREATE", "KPI_CYCLE:CREATE",
                Set.of(), false, 1, "Quản lý kỳ"));

        register(new StageDescriptor(PERIOD_SETUP, "/kpi-periods", List.of(),
                "KPI_PERIOD:CREATE", "KPI_PERIOD:CREATE",
                Set.of(), true, 2, "Quản lý đợt"));

        register(new StageDescriptor(CRITERIA_DRAFT, "/kpi-criteria", List.of(),
                "KPI:VIEW", "KPI:CREATE",
                Set.of(PERIOD_SETUP), true, 3, "Quản lý chỉ tiêu"));

        register(new StageDescriptor(CRITERIA_APPROVAL, "/kpi-criteria/pending", List.of(),
                "KPI:APPROVE_CRITERIA", "KPI:APPROVE_CRITERIA",
                Set.of(CRITERIA_DRAFT), false, 4, "Duyệt chỉ tiêu"));

        register(new StageDescriptor(CRITERIA_ADJUSTMENT, "/kpi-adjustments/pending", List.of("/my-adjustments"),
                "KPI:APPROVE_ADJUSTMENT", "KPI:APPROVE_ADJUSTMENT",
                Set.of(CRITERIA_APPROVAL), false, 5, "Duyệt điều chỉnh"));

        register(new StageDescriptor(SUBMISSION, "/my-kpi", List.of("/submissions", "/submissions/new"),
                "KPI:VIEW_MY", "SUBMISSION:CREATE",
                Set.of(CRITERIA_DRAFT), true, 6, "KPI của tôi"));

        register(new StageDescriptor(SUBMISSION_REVIEW, "/submissions/org-unit", List.of(),
                "SUBMISSION:REVIEW", "SUBMISSION:REVIEW",
                Set.of(SUBMISSION), false, 7, "Phê duyệt & đánh giá"));

        register(new StageDescriptor(SELF_EVALUATION, "/evaluations?action=self-eval", List.of(),
                "EVALUATION:VIEW_MY", "EVALUATION:VIEW_MY",
                Set.of(SUBMISSION), false, 8, "Tự đánh giá"));

        register(new StageDescriptor(MANAGER_EVALUATION, "/evaluations", List.of(),
                "EVALUATION:VIEW_MY", "EVALUATION:CREATE",
                Set.of(SUBMISSION), false, 9, "Kết quả đánh giá"));

        register(new StageDescriptor(CYCLE_EVALUATION, "/kpi-cycles/evaluation", List.of(),
                "CYCLE_EVAL:VIEW", "CYCLE_EVAL:FINALIZE",
                Set.of(MANAGER_EVALUATION, CYCLE_SETUP), false, 10, "Đánh giá kỳ"));
    }

    private static void register(StageDescriptor d) {
        DESCRIPTORS.put(d.stage(), d);
    }

    public StageDescriptor get(WorkflowStage stage) {
        StageDescriptor d = DESCRIPTORS.get(stage);
        if (d == null) {
            // Không thể xảy ra trừ khi thêm hằng số enum mà quên đăng ký — hỏng ngay lúc khởi động
            // vẫn hơn là âm thầm coi bước đó như không tồn tại.
            throw new IllegalStateException("Bước " + stage + " chưa được đăng ký trong StageRegistry");
        }
        return d;
    }

    /** Toàn bộ danh mục, theo thứ tự hiển thị mặc định. */
    public List<StageDescriptor> all() {
        return DESCRIPTORS.values().stream()
                .sorted(Comparator.comparingInt(StageDescriptor::defaultOrder))
                .toList();
    }

    public Collection<WorkflowStage> stages() {
        return DESCRIPTORS.keySet();
    }

    /** Các bước lõi — {@code WorkflowConfigValidator} từ chối mọi cấu hình tắt chúng. */
    public Set<WorkflowStage> requiredStages() {
        return DESCRIPTORS.values().stream()
                .filter(StageDescriptor::required)
                .map(StageDescriptor::stage)
                .collect(java.util.stream.Collectors.toCollection(() -> java.util.EnumSet.noneOf(WorkflowStage.class)));
    }

    /**
     * Suy bước từ một đường dẫn frontend. Khớp dài nhất thắng, nên {@code /kpi-criteria/pending}
     * ra {@code CRITERIA_APPROVAL} chứ không phải {@code CRITERIA_DRAFT}.
     */
    public Optional<StageDescriptor> byRoute(String path) {
        if (path == null || path.isBlank()) return Optional.empty();
        String clean = stripQuery(path);
        return DESCRIPTORS.values().stream()
                .filter(d -> matches(d, clean))
                .max(Comparator.comparingInt(d -> longestMatch(d, clean)));
    }

    /** Bỏ phần query. Route của bước Tự đánh giá là {@code /evaluations?action=self-eval}. */
    private static String stripQuery(String route) {
        int q = route.indexOf('?');
        return q < 0 ? route : route.substring(0, q);
    }

    private static boolean matches(StageDescriptor d, String path) {
        return longestMatch(d, path) > 0;
    }

    /**
     * Điểm khớp của một bước với đường dẫn. Số lớn hơn thắng.
     *
     * <p>Nhân đôi độ dài rồi cộng 1 cho route KHÔNG kèm query, để phá hoà đúng hướng: Tự đánh giá
     * và Kết quả đánh giá cùng nằm ở {@code /evaluations}, nhưng Tự đánh giá là một HÀNH ĐỘNG mở
     * bằng {@code ?action=self-eval} chứ không phải trang. Không có luật này thì tắt bước tự đánh
     * giá sẽ làm biến mất cả mục menu của trang kết quả đánh giá.
     */
    private static int longestMatch(StageDescriptor d, String path) {
        int best = 0;
        for (String r : candidateRoutes(d)) {
            String base = stripQuery(r);
            if (path.equals(base) || path.startsWith(base + "/")) {
                best = Math.max(best, base.length() * 2 + (r.contains("?") ? 0 : 1));
            }
        }
        return best;
    }

    private static List<String> candidateRoutes(StageDescriptor d) {
        return java.util.stream.Stream.concat(
                java.util.stream.Stream.of(d.route()), d.extraRoutes().stream()).toList();
    }
}
