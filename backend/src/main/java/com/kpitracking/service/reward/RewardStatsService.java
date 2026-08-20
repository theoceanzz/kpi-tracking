package com.kpitracking.service.reward;

import com.kpitracking.dto.response.reward.RewardLeaderboardEntryResponse;
import com.kpitracking.dto.response.reward.RewardMonthlySummaryResponse;
import com.kpitracking.repository.RewardTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Số liệu tổng hợp điểm thưởng cho dashboard.
 *
 * <p>Tách khỏi {@link RewardActivityService}: bảng tin ở đó là "vài chục việc gần nhất"
 * (giới hạn cứng 50 bản ghi), còn ở đây là tổng hợp toàn kỳ — cộng dồn từ bảng tin sẽ
 * ra số sai ngay khi tổ chức thưởng nhiều hơn giới hạn đó.
 */
@Service
@RequiredArgsConstructor
public class RewardStatsService {

    /** Giờ Việt Nam — mốc chia tháng phải theo múi giờ tổ chức, không theo UTC. */
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int MAX_LEADERBOARD = 50;
    private static final int MAX_MONTHS = 24;

    private final RewardTransactionRepository transactionRepository;
    private final RewardContext context;

    /**
     * Những người được thưởng nhiều điểm nhất trong khoảng thời gian.
     *
     * @param from mốc bắt đầu, null nghĩa là tính từ đầu
     * @param to   mốc kết thúc (không bao gồm), null nghĩa là tới hiện tại
     */
    @Transactional(readOnly = true)
    public List<RewardLeaderboardEntryResponse> leaderboard(Instant from, Instant to, Integer limit) {
        UUID orgId = context.getCurrentOrgId();
        int size = clamp(limit, 10, MAX_LEADERBOARD);

        return transactionRepository.sumEarnedByUser(orgId, from, to, PageRequest.of(0, size)).stream()
                .map(row -> RewardLeaderboardEntryResponse.builder()
                        .userId((UUID) row[0])
                        .userName((String) row[1])
                        .userAvatarUrl((String) row[2])
                        .totalPoints(row[3] == null ? 0L : ((Number) row[3]).longValue())
                        .build())
                .toList();
    }

    /**
     * Điểm phát ra / tiêu đi của N tháng gần nhất, tính cả tháng đang chạy.
     *
     * <p>Tháng không có giao dịch vẫn xuất hiện với số 0 — biểu đồ đứt quãng khiến người
     * đọc tưởng mất dữ liệu, trong khi sự thật là tháng đó không ai thưởng.
     */
    @Transactional(readOnly = true)
    public List<RewardMonthlySummaryResponse> monthlySummary(Integer months) {
        UUID orgId = context.getCurrentOrgId();
        int span = clamp(months, 6, MAX_MONTHS);

        YearMonth current = YearMonth.now(ZONE);
        YearMonth first = current.minusMonths(span - 1L);
        Instant from = first.atDay(1).atStartOfDay(ZONE).toInstant();

        Map<String, long[]> byMonth = new HashMap<>();
        for (Object[] row : transactionRepository.sumByMonth(orgId, from)) {
            int year = ((Number) row[0]).intValue();
            int month = ((Number) row[1]).intValue();
            long earned = row[2] == null ? 0L : ((Number) row[2]).longValue();
            long spent = row[3] == null ? 0L : ((Number) row[3]).longValue();
            byMonth.put(YearMonth.of(year, month).toString(), new long[]{earned, spent});
        }

        List<RewardMonthlySummaryResponse> out = new ArrayList<>(span);
        for (int i = 0; i < span; i++) {
            String key = first.plusMonths(i).toString();
            long[] v = byMonth.getOrDefault(key, new long[]{0L, 0L});
            out.add(RewardMonthlySummaryResponse.builder()
                    .month(key)
                    // SPEND lưu số âm trong sổ cái; đổi dấu để biểu đồ đọc thẳng là "đã tiêu"
                    .earned(v[0])
                    .spent(Math.abs(v[1]))
                    .build());
        }
        return out;
    }

    private int clamp(Integer value, int fallback, int max) {
        if (value == null) return fallback;
        return Math.min(Math.max(value, 1), max);
    }
}
