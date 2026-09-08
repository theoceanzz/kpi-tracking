package com.kpitracking.service.analytics;

import com.kpitracking.dto.response.stats.advanced.DistributionResponses.*;
import com.kpitracking.entity.Organization;
import com.kpitracking.repository.EvaluationLevelRepository;
import com.kpitracking.repository.EvaluationRepository;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
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
 * Nhóm biểu đồ PHÂN PHỐI của tab thống kê.
 *
 * <p>Ba biểu đồ ở đây trả lời câu mà giá trị trung bình không trả lời được: điểm dồn ở đâu
 * (histogram), đơn vị nào đều tay và đơn vị nào phân hoá (hộp), tổ chức nặng đầu hay nặng đáy
 * (tháp). Phạm vi do {@link StatsTierResolver} quyết định, phân giải một lần đầu mỗi phương thức.
 */
@Service
@RequiredArgsConstructor
public class DistributionAnalyticsService {

    /** Số khoảng của histogram — đủ để thấy hình dạng mà không vụn thành răng cưa. */
    private static final int BIN_COUNT = 10;

    private final StatsTierResolver tierResolver;
    private final EvaluationRepository evaluationRepository;
    private final EvaluationLevelRepository evaluationLevelRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;

    // ============================================================
    // D1 - Histogram điểm đánh giá
    // ============================================================

    @Transactional(readOnly = true)
    public ScoreHistogramResponse getScoreHistogram(UUID orgUnitId, Collection<UUID> periodIds) {
        StatsTierResolver.TierScope scope = tierResolver.resolve(orgUnitId, periodIds);

        double axisMax = resolveMaxScore(scope.orgId());
        List<LevelMarker> levels = loadLevels(scope.orgId());

        if (scope.isEmpty()) {
            return ScoreHistogramResponse.builder()
                    .bins(buildBins(List.of(), axisMax)).levels(levels)
                    .totalCount(0).maxScore(axisMax).anonymized(scope.anonymize())
                    .build();
        }

        List<Double> scores = evaluationRepository.scoresInScope(scope.unitIds(), scope.periodIds());
        double avg = scores.isEmpty() ? 0
                : scores.stream().mapToDouble(Double::doubleValue).average().orElse(0);

        // Cấp SELF: phân phối vẫn hiện (bản thân nó không mang danh tính ai) nhưng thêm điểm của
        // chính người xem để họ định vị được mình - đó là toàn bộ giá trị của biểu đồ với họ.
        Double myScore = null;
        if (scope.anonymize()) {
            myScore = evaluationRepository.avgScoreByUser(scope.unitIds(), scope.periodIds()).stream()
                    .filter(r -> scope.userId().equals(r[0]))
                    .map(r -> dbl(r[3]))
                    .findFirst().orElse(null);
        }

        return ScoreHistogramResponse.builder()
                .bins(buildBins(scores, axisMax))
                .levels(levels)
                .totalCount(scores.size())
                .averageScore(round1(avg))
                .maxScore(axisMax)
                .myScore(round1(myScore))
                .anonymized(scope.anonymize())
                .build();
    }

    private List<HistogramBin> buildBins(List<Double> scores, double axisMax) {
        double width = axisMax / BIN_COUNT;
        int[] counts = new int[BIN_COUNT];
        for (Double s : scores) {
            if (s == null) continue;
            // Điểm bằng đúng trần rơi vào khoảng cuối chứ không tràn ra ngoài mảng.
            int idx = (int) Math.floor(s / width);
            if (idx >= BIN_COUNT) idx = BIN_COUNT - 1;
            if (idx < 0) idx = 0;
            counts[idx]++;
        }
        List<HistogramBin> bins = new ArrayList<>();
        for (int i = 0; i < BIN_COUNT; i++) {
            double from = round1(i * width);
            double to = round1((i + 1) * width);
            bins.add(HistogramBin.builder()
                    .from(from).to(to)
                    .label(trimNum(from) + " - " + trimNum(to))
                    .count(counts[i])
                    .build());
        }
        return bins;
    }

    private List<LevelMarker> loadLevels(UUID orgId) {
        if (orgId == null) return List.of();
        return evaluationLevelRepository.findByOrganizationIdOrderByThresholdDesc(orgId).stream()
                .map(l -> LevelMarker.builder()
                        .name(l.getName()).threshold(l.getThreshold()).color(l.getColor()).build())
                .toList();
    }

    // ============================================================
    // D2 - Hộp phân tán điểm theo đơn vị
    // ============================================================

    @Transactional(readOnly = true)
    public UnitBoxplotResponse getUnitBoxplot(UUID orgUnitId, Collection<UUID> periodIds) {
        StatsTierResolver.TierScope scope = tierResolver.resolve(orgUnitId, periodIds);
        double axisMax = resolveMaxScore(scope.orgId());

        // Biểu đồ hộp so sánh các ĐƠN VỊ với nhau - ở cấp SELF điều đó vừa vô nghĩa vừa để lộ mặt
        // bằng điểm của đơn vị khác, nên trả rỗng thay vì thu hẹp phạm vi.
        if (scope.isEmpty() || scope.anonymize()) {
            return UnitBoxplotResponse.builder().boxes(List.of()).axisMax(axisMax).build();
        }

        List<BoxplotBox> boxes = new ArrayList<>();
        for (Object[] r : evaluationRepository.unitScoreQuartiles(scope.unitIds(), scope.periodIds())) {
            boxes.add(BoxplotBox.builder()
                    .orgUnitId((UUID) r[0])
                    .name((String) r[1])
                    .min(round1(dbl(r[2])))
                    .q1(round1(dbl(r[3])))
                    .median(round1(dbl(r[4])))
                    .q3(round1(dbl(r[5])))
                    .max(round1(dbl(r[6])))
                    .count(r[7] == null ? 0 : ((Number) r[7]).intValue())
                    .build());
        }
        return UnitBoxplotResponse.builder().boxes(boxes).axisMax(axisMax).build();
    }

    // ============================================================
    // D3 - Tháp cơ cấu nhân sự
    // ============================================================

    @Transactional(readOnly = true)
    public HeadcountPyramidResponse getHeadcountPyramid(UUID orgUnitId, Collection<UUID> periodIds) {
        StatsTierResolver.TierScope scope = tierResolver.resolve(orgUnitId, periodIds);

        if (scope.unitIds().isEmpty() || scope.anonymize()) {
            return HeadcountPyramidResponse.builder()
                    .rows(List.of()).leftLabel("Trưởng & Phó").rightLabel("Nhân viên")
                    .totalHeadcount(0).build();
        }

        // Gộp theo cấp: mỗi cấp một hàng, rank 0-1 về bên trái, còn lại bên phải.
        Map<Integer, PyramidRow> byLevel = new LinkedHashMap<>();
        int total = 0;
        for (Object[] r : userRoleOrgUnitRepository.headcountByLevelAndRank(scope.unitIds())) {
            int levelOrder = r[0] == null ? 0 : ((Number) r[0]).intValue();
            String name = r[1] != null ? (String) r[1] : ("Cấp " + (levelOrder + 1));
            int rank = r[2] == null ? 2 : ((Number) r[2]).intValue();
            int count = r[3] == null ? 0 : ((Number) r[3]).intValue();

            PyramidRow row = byLevel.computeIfAbsent(levelOrder, k -> PyramidRow.builder()
                    .levelOrder(k).name(name).left(0).right(0).build());
            if (rank <= 1) row.setLeft(row.getLeft() + count);
            else row.setRight(row.getRight() + count);
            total += count;
        }

        return HeadcountPyramidResponse.builder()
                .rows(new ArrayList<>(byLevel.values()))
                .leftLabel("Trưởng & Phó")
                .rightLabel("Nhân viên")
                .totalHeadcount(total)
                .build();
    }

    // ============================================================
    // Helpers
    // ============================================================

    /** Trần thang điểm của tổ chức; mặc định 100 khi chưa cấu hình. */
    private double resolveMaxScore(UUID orgId) {
        if (orgId == null) return 100.0;
        Organization org = organizationRepository.findById(orgId).orElse(null);
        Double max = org != null ? org.getEvaluationMaxScore() : null;
        return max != null && max > 0 ? max : 100.0;
    }

    private static String trimNum(double v) {
        return v == Math.rint(v) ? String.valueOf((long) v) : String.valueOf(v);
    }

    private static Double dbl(Object o) {
        return o == null ? null : ((Number) o).doubleValue();
    }

    private static Double round1(Double v) {
        return v == null ? null : Math.round(v * 10.0) / 10.0;
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
