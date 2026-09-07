package com.kpitracking.service.analytics;

import com.kpitracking.dto.response.stats.advanced.FlowResponses.SankeyLink;
import com.kpitracking.dto.response.stats.advanced.FlowResponses.SankeyNode;
import com.kpitracking.dto.response.stats.advanced.FlowResponses.SankeyResponse;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.repository.KeyResultUnitWeightRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Nhóm biểu đồ LUỒNG: ba câu chuyện mà biểu đồ cột không kể được, vì chúng nói về sự DI CHUYỂN
 * của KPI qua các đơn vị và các trạng thái chứ không phải về mức độ của một đại lượng.
 */
@Service
@RequiredArgsConstructor
public class FlowAnalyticsService {

    private static final String[] DEPTH_COLORS = {"#6366f1", "#0ea5e9", "#10b981", "#f59e0b"};

    private final StatsTierResolver tierResolver;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final KeyResultUnitWeightRepository keyResultUnitWeightRepository;

    // ============================================================
    // F1 - Phân rã / uỷ quyền KPI theo cây đơn vị
    // ============================================================

    /**
     * Mỗi dải là dòng KPI chảy từ một đơn vị xuống đơn vị khác, dày theo tổng trọng số.
     *
     * <p>Cây tổ chức cho biết ai trực thuộc ai; biểu đồ này cho biết công việc THỰC SỰ chảy đi
     * đâu — hai thứ đó không phải lúc nào cũng trùng nhau.
     */
    @Transactional(readOnly = true)
    public SankeyResponse getKpiCascade(UUID orgUnitId, Collection<UUID> periodIds) {
        StatsTierResolver.TierScope scope = tierResolver.resolve(orgUnitId, periodIds);
        if (scope.unitIds().isEmpty() || scope.anonymize()) {
            return empty("Tổng trọng số");
        }

        SankeyBuilder b = new SankeyBuilder();
        for (Object[] r : kpiCriteriaRepository.kpiCascadeEdges(scope.unitIds())) {
            String parent = (String) r[0];
            String child = (String) r[1];
            // Tự trỏ vào chính mình (KPI cha con cùng đơn vị) không tạo ra luồng nào để nhìn.
            if (parent == null || child == null || parent.equals(child)) continue;
            double weight = r[3] == null ? 0 : ((Number) r[3]).doubleValue();
            if (weight <= 0) continue;
            long count = r[4] == null ? 0 : ((Number) r[4]).longValue();
            String rel = r[2] == null ? "" : String.valueOf(r[2]);
            String relLabel = "DELEGATION".equals(rel) ? "Uỷ quyền" : "Phân rã";
            b.link(parent, 0, child, 1, weight, relLabel + " · " + count + " KPI");
        }
        return b.build("Tổng trọng số");
    }

    // ============================================================
    // F2 - Vòng đời KPI
    // ============================================================

    /**
     * KPI đi từ nháp đến chỗ nào rồi dừng lại: được duyệt, bị từ chối, phải sửa, hay bị thay thế.
     *
     * <p>Bảng đếm theo trạng thái nói được số lượng ở mỗi ô nhưng không nói được ô nào là ngõ cụt.
     */
    @Transactional(readOnly = true)
    public SankeyResponse getKpiLifecycle(UUID orgUnitId, Collection<UUID> periodIds) {
        StatsTierResolver.TierScope scope = tierResolver.resolve(orgUnitId, periodIds);
        if (scope.unitIds().isEmpty()) {
            return empty("Số KPI");
        }

        Map<KpiStatus, Long> counts = new LinkedHashMap<>();
        for (Object[] r : kpiCriteriaRepository.countByStatusInUnits(scope.unitIds())) {
            if (r[0] == null) continue;
            counts.put((KpiStatus) r[0], r[1] == null ? 0L : ((Number) r[1]).longValue());
        }
        if (counts.isEmpty()) return empty("Số KPI");

        long draft = get(counts, KpiStatus.DRAFT);
        long pending = get(counts, KpiStatus.PENDING_APPROVAL);
        long approved = get(counts, KpiStatus.APPROVED);
        long rejected = get(counts, KpiStatus.REJECTED);
        long edit = get(counts, KpiStatus.EDIT) + get(counts, KpiStatus.EDITED);
        long inactive = get(counts, KpiStatus.INACTIVE);
        long replaced = get(counts, KpiStatus.REPLACED);

        // Mọi KPI đều bắt đầu từ "Khởi tạo"; các trạng thái hiện tại là nơi chúng đang dừng lại.
        // Đây là ảnh chụp tại một thời điểm, không phải nhật ký chuyển trạng thái — hệ thống
        // không lưu lịch sử chuyển trạng thái của KPI nên không dựng được luồng thật sự.
        long total = draft + pending + approved + rejected + edit + inactive + replaced;
        if (total == 0) return empty("Số KPI");

        SankeyBuilder b = new SankeyBuilder();
        String root = "Tổng KPI";
        if (draft > 0) b.link(root, 0, "Nháp", 1, draft, "Chưa gửi duyệt");
        long submitted = pending + approved + rejected + edit + inactive + replaced;
        if (submitted > 0) {
            b.link(root, 0, "Đã gửi duyệt", 1, submitted, null);
            if (pending > 0) b.link("Đã gửi duyệt", 1, "Chờ duyệt", 2, pending, "Đang tồn đọng");
            if (rejected > 0) b.link("Đã gửi duyệt", 1, "Bị từ chối", 2, rejected, null);
            if (edit > 0) b.link("Đã gửi duyệt", 1, "Đang/đã chỉnh sửa", 2, edit, null);
            long settled = approved + inactive + replaced;
            if (settled > 0) {
                b.link("Đã gửi duyệt", 1, "Đã duyệt", 2, settled, null);
                if (approved > 0) b.link("Đã duyệt", 2, "Đang hiệu lực", 3, approved, null);
                if (replaced > 0) b.link("Đã duyệt", 2, "Bị thay thế", 3, replaced, "Có bản KPI mới thay");
                if (inactive > 0) b.link("Đã duyệt", 2, "Ngừng theo dõi", 3, inactive, null);
            }
        }
        return b.build("Số KPI");
    }

    // ============================================================
    // F5 - Luồng OKR: Mục tiêu -> Key Result -> Đơn vị
    // ============================================================

    @Transactional(readOnly = true)
    public SankeyResponse getOkrFlow(UUID orgUnitId, Collection<UUID> periodIds) {
        StatsTierResolver.TierScope scope = tierResolver.resolve(orgUnitId, periodIds);
        if (scope.unitIds().isEmpty() || scope.anonymize()) {
            return empty("Trọng số phân bổ");
        }

        SankeyBuilder b = new SankeyBuilder();
        for (Object[] r : keyResultUnitWeightRepository.okrFlowEdges(scope.unitIds())) {
            String obj = (String) r[0];
            String kr = (String) r[1];
            String unit = (String) r[2];
            double w = r[3] == null ? 0 : ((Number) r[3]).doubleValue();
            if (obj == null || kr == null || unit == null || w <= 0) continue;
            // Tên KR có thể trùng giữa hai mục tiêu khác nhau nên gắn tiền tố mục tiêu vào khoá.
            String krKey = obj + " ▸ " + kr;
            b.link(obj, 0, krKey, 1, w, null);
            b.link(krKey, 1, unit, 2, w, null);
        }
        return b.build("Trọng số phân bổ");
    }

    // ============================================================
    // Helpers
    // ============================================================

    private static long get(Map<KpiStatus, Long> m, KpiStatus k) {
        return m.getOrDefault(k, 0L);
    }

    private SankeyResponse empty(String valueLabel) {
        return SankeyResponse.builder()
                .nodes(List.of()).links(List.of()).valueLabel(valueLabel).empty(true).build();
    }

    /**
     * Gom nút theo tên và cộng dồn dải trùng nhau.
     *
     * <p>Recharts Sankey trỏ nút bằng CHỈ SỐ mảng, nên phải giữ bản đồ tên đến chỉ số ở một chỗ;
     * để mỗi nơi tự đánh số là cách chắc chắn nhất để có một biểu đồ nối sai nút.
     */
    private static final class SankeyBuilder {
        private final Map<String, Integer> index = new LinkedHashMap<>();
        private final List<SankeyNode> nodes = new ArrayList<>();
        private final Map<String, SankeyLink> links = new LinkedHashMap<>();

        int node(String name, int depth) {
            Integer existing = index.get(name);
            if (existing != null) return existing;
            int i = nodes.size();
            index.put(name, i);
            nodes.add(SankeyNode.builder()
                    .name(name).depth(depth)
                    .color(DEPTH_COLORS[Math.min(depth, DEPTH_COLORS.length - 1)])
                    .build());
            return i;
        }

        void link(String from, int fromDepth, String to, int toDepth, double value, String note) {
            int s = node(from, fromDepth);
            int t = node(to, toDepth);
            String key = s + "->" + t;
            SankeyLink existing = links.get(key);
            if (existing != null) {
                existing.setValue(round1(existing.getValue() + value));
            } else {
                links.put(key, SankeyLink.builder()
                        .source(s).target(t).value(round1(value)).note(note).build());
            }
        }

        SankeyResponse build(String valueLabel) {
            boolean isEmpty = links.isEmpty();
            return SankeyResponse.builder()
                    .nodes(nodes).links(new ArrayList<>(links.values()))
                    .valueLabel(valueLabel).empty(isEmpty)
                    .build();
        }
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
