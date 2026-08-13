package com.kpitracking.service.reward;

import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.RewardProgram;
import com.kpitracking.enums.RewardProgramScope;
import com.kpitracking.enums.RewardRankingMetric;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.repository.RewardRankingRepository;
import com.kpitracking.service.EvaluationService;
import lombok.Builder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Xếp hạng nhân viên để trao thưởng tự động.
 *
 * <h2>Chỉ ĐỌC từ phía đánh giá</h2>
 * Không có gì trong package thưởng được ghi vào {@code evaluations} hay
 * {@code cycle_user_evaluations}. Điểm thưởng là một loại "tiền tệ" riêng, KPI chỉ là
 * nguồn sinh ra nó.
 *
 * <h2>Vì sao thứ tự phải xác định tuyệt đối</h2>
 * Cùng một đầu vào phải luôn cho ra cùng một bảng xếp hạng, kể cả thứ tự các dòng.
 * Nếu không, {@code snapshotHash} lưu ở bản xem trước sẽ khác hash tính lại lúc phát,
 * và hệ thống sẽ từ chối phát thưởng dù dữ liệu chẳng thay đổi gì.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RewardRankingService {

    private final RewardRankingRepository rankingRepository;
    private final EvaluationService evaluationService;

    /** Một người trong bảng xếp hạng, kèm các giá trị dùng để phá hoà. */
    @Builder
    public record RankedUser(
            UUID userId,
            String fullName,
            String employeeCode,
            UUID orgUnitId,
            String orgUnitName,
            Double metricValue,
            Integer matrixRating,
            Instant evaluatedAt
    ) {}

    /** Người bị loại khỏi bảng xếp hạng, kèm lý do để hiện cho quản trị viên. */
    public record SkippedUser(UUID userId, String fullName, String reason) {}

    public record RankingResult(List<RankedUser> ranked, List<SkippedUser> skipped) {}

    /**
     * So sánh phá hoà — thứ tự này là HỢP ĐỒNG, đổi nó sẽ làm mọi bản xem trước đang
     * chờ phát trở nên không hợp lệ.
     *
     * <p>Điểm cao trước → xếp loại ma trận cao trước → được chấm sớm hơn trước →
     * mã nhân viên → id. Hai tiêu chí cuối không mang ý nghĩa nghiệp vụ, chúng chỉ để
     * bảo đảm không bao giờ còn thế hoà thật sự.
     */
    private static final Comparator<RankedUser> ORDER = Comparator
            .comparing(RankedUser::metricValue, Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(RankedUser::matrixRating, Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(RankedUser::evaluatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(RankedUser::employeeCode, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(RankedUser::userId);

    /**
     * Bảng xếp hạng cho một lần chạy chương trình.
     *
     * @param targetId id của kỳ hoặc đợt, tuỳ {@code program.scope}
     */
    @Transactional(readOnly = true)
    public RankingResult rank(RewardProgram program, UUID targetId, UUID orgId) {
        String pathPrefix = Optional.ofNullable(program.getOrgUnit())
                .map(OrgUnit::getPath)
                .orElse(null);

        RankingResult raw = program.getScope() == RewardProgramScope.CYCLE
                ? rankByCycle(program, targetId, orgId, pathPrefix)
                : rankByPeriod(program, targetId, orgId, pathPrefix);

        List<RankedUser> candidates = new ArrayList<>(raw.ranked());
        List<SkippedUser> skipped = new ArrayList<>(raw.skipped());

        // Loại trưởng/phó đơn vị nếu chương trình không tính họ — thường dùng khi muốn
        // thưởng riêng cho nhân viên, tránh việc quản lý luôn đứng đầu bảng.
        if (!Boolean.TRUE.equals(program.getIncludeUnitHeads())) {
            Set<UUID> heads = new HashSet<>(rankingRepository.findUnitHeadUserIds(orgId, pathPrefix));
            candidates.removeIf(u -> {
                if (heads.contains(u.userId())) {
                    skipped.add(new SkippedUser(u.userId(), u.fullName(),
                            "Là trưởng/phó đơn vị, chương trình này không tính"));
                    return true;
                }
                return false;
            });
        }

        // Sàn điểm: tránh trao "hạng nhất" cho người dẫn đầu một nhóm toàn điểm thấp.
        if (program.getMinMetricValue() != null) {
            double floor = program.getMinMetricValue();
            candidates.removeIf(u -> {
                if (u.metricValue() == null || u.metricValue() < floor) {
                    skipped.add(new SkippedUser(u.userId(), u.fullName(),
                            "Điểm " + fmtScore(u.metricValue()) + " thấp hơn mức sàn " + fmtScore(floor)));
                    return true;
                }
                return false;
            });
        }

        candidates.sort(ORDER);
        return new RankingResult(candidates, skipped);
    }

    /**
     * Theo KỲ: đọc thẳng {@code cycle_user_evaluations} — điểm đã chốt kỳ, mỗi người
     * đúng một dòng, không phải chọn lựa gì.
     */
    private RankingResult rankByCycle(RewardProgram program, UUID cycleId, UUID orgId, String pathPrefix) {
        if (program.getMetric() == RewardRankingMetric.PERFORMANCE) {
            throw new BusinessException("Chỉ số \"Điểm hiệu suất đợt\" chỉ dùng được với chương trình "
                    + "theo ĐỢT. Với chương trình theo KỲ, hãy chọn \"Điểm chốt kỳ\" hoặc \"Xếp loại\".");
        }
        String metric = program.getMetric() == RewardRankingMetric.MATRIX_RATING
                ? "MATRIX_RATING" : "FINAL_SCORE";

        List<RankedUser> ranked = rankingRepository
                .rankByCycleRaw(cycleId, orgId, pathPrefix, metric).stream()
                .map(r -> RankedUser.builder()
                        .userId((UUID) r[0])
                        .fullName((String) r[1])
                        .employeeCode((String) r[2])
                        .metricValue(toDouble(r[3]))
                        .orgUnitId((UUID) r[4])
                        .orgUnitName((String) r[5])
                        .matrixRating(toInteger(r[6]))
                        .evaluatedAt(toInstant(r[7]))
                        .build())
                .collect(Collectors.toList());

        // Người chưa có điểm chốt kỳ đã bị truy vấn loại sẵn. Không xếp họ là 0 điểm —
        // "chưa được chấm" khác hẳn "bị chấm 0", xếp nhầm sẽ tạo ra hạng bét giả.
        return new RankingResult(ranked, new ArrayList<>());
    }

    /**
     * Theo ĐỢT: lấy tập ứng viên bằng SQL rồi hỏi điểm từng người qua
     * {@code EvaluationService}.
     *
     * <p>Cố ý KHÔNG viết lại phép chọn "bản đánh giá đại diện" bằng SQL. Phép đó phụ
     * thuộc cấu hình thác nước của tổ chức và thứ bậc người đánh giá, logic nằm trong
     * {@code EvaluationService.getEffectiveEvaluation}. Chép sang SQL sẽ tạo ra một bản
     * sao lệch pha ngay lần đầu ai đó sửa quy tắc, và tiền thưởng sẽ trao sai.
     *
     * <p>Đổi lại là N truy vấn cho N ứng viên. Chấp nhận được: chỉ chạy khi quản trị
     * viên bấm xem trước hoặc phát thưởng, trong phạm vi một đơn vị.
     */
    private RankingResult rankByPeriod(RewardProgram program, UUID periodId, UUID orgId, String pathPrefix) {
        if (program.getMetric() == RewardRankingMetric.FINAL_SCORE) {
            throw new BusinessException("Chỉ số \"Điểm chốt kỳ\" chỉ dùng được với chương trình "
                    + "theo KỲ. Với chương trình theo ĐỢT, hãy chọn \"Điểm hiệu suất đợt\".");
        }

        List<RankedUser> ranked = new ArrayList<>();
        List<SkippedUser> skipped = new ArrayList<>();

        for (Object[] r : rankingRepository.candidatesByPeriodRaw(periodId, orgId, pathPrefix)) {
            UUID userId = (UUID) r[0];
            String fullName = (String) r[1];

            Double score = evaluationService.getEffectivePerformanceScore(userId, periodId);
            if (score == null) {
                skipped.add(new SkippedUser(userId, fullName,
                        "Chưa có bản đánh giá hợp lệ trong đợt này"));
                continue;
            }

            ranked.add(RankedUser.builder()
                    .userId(userId)
                    .fullName(fullName)
                    .employeeCode((String) r[2])
                    .orgUnitId((UUID) r[3])
                    .orgUnitName((String) r[4])
                    .metricValue(score)
                    .build());
        }
        return new RankingResult(ranked, skipped);
    }

    private static String fmtScore(Double d) {
        if (d == null) return "—";
        return d == Math.floor(d) ? String.valueOf(d.intValue()) : String.valueOf(d);
    }

    private static Double toDouble(Object o) {
        return o == null ? null : ((Number) o).doubleValue();
    }

    private static Integer toInteger(Object o) {
        return o == null ? null : ((Number) o).intValue();
    }

    private static Instant toInstant(Object o) {
        if (o == null) return null;
        if (o instanceof Instant i) return i;
        if (o instanceof Timestamp t) return t.toInstant();
        return null;
    }
}
