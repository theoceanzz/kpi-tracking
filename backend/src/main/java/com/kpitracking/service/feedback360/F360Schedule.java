package com.kpitracking.service.feedback360;

import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * Khung thời gian của chiến dịch 360 bám theo kỳ KPI.
 *
 * <ul>
 *   <li><b>Vào xếp loại</b>: 360 chạy ở CUỐI kỳ — người chấm cần nhìn lại cả kỳ, và kết quả phải có
 *       trước hiệu chỉnh/chốt. Được mở từ đầu kỳ, hạn trễ nhất {@link #SCORING_TAIL} sau ngày cuối kỳ
 *       (thứ tự: KPI kết thúc → 360 → hiệu chỉnh → chốt; {@link F360CycleGuard} chặn chốt khi 360 chưa đóng).</li>
 *   <li><b>Chỉ để phát triển</b> có gắn kỳ: nằm trọn trong kỳ (thường giữa kỳ).</li>
 *   <li>Không gắn kỳ: chỉ cần mở trước hạn.</li>
 * </ul>
 *
 * Khoảng GỢI Ý (mở/hạn tự điền khi chọn kỳ) do frontend tính theo cùng các mốc này —
 * {@code frontend/src/features/feedback360/utils/f360Schedule.ts}; backend chỉ kiểm tra biên.
 */
public final class F360Schedule {

    /** Chiến dịch vào xếp loại được kéo dài tối đa chừng này sau ngày cuối kỳ. */
    public static final Duration SCORING_TAIL = Duration.ofDays(21);

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy")
            .withZone(ZoneId.of("Asia/Ho_Chi_Minh"));

    private F360Schedule() {
    }

    /**
     * Ném {@link BusinessException} nếu khung [startAt, dueAt] không hợp lệ với kỳ. Giá trị null được bỏ
     * qua (chiến dịch cũ chưa có ngày mở; nháp chưa đặt hạn — {@code launch} tự đòi hạn).
     */
    public static void validate(boolean scoring, Instant cycleStart, Instant cycleEnd, Instant startAt, Instant dueAt) {
        if (startAt != null && dueAt != null && !startAt.isBefore(dueAt)) {
            throw new BusinessException(ErrorCode.START_DATE_MUST_BEFORE_EVALUATION_DEADLINE);
        }
        if (cycleStart == null || cycleEnd == null) return;
        Instant latest = scoring ? cycleEnd.plus(SCORING_TAIL) : cycleEnd;
        if (startAt != null && startAt.isBefore(cycleStart)) {
            throw new BusinessException(ErrorCode.START_DATE_MUST_WITHIN_CYCLE, String.valueOf(DATE.format(cycleStart)));
        }
        if (dueAt != null && dueAt.isAfter(latest)) {
            throw (scoring ? new BusinessException(ErrorCode.CAMPAIGN_COUNTS_TOWARD_RATING_MUST_END_BEFORE, String.valueOf(DATE.format(latest))) : new BusinessException(ErrorCode.DEVELOPMENT_ONLY_CAMPAIGN_MUST_END_WITHIN_CYCLE, String.valueOf(DATE.format(cycleEnd))));
        }
    }
}
