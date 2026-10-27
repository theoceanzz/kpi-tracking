package com.kpitracking.dto.response.reward;

import com.kpitracking.enums.reward.RedemptionStatus;
import com.kpitracking.enums.reward.RewardCelebrationSource;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

/**
 * Một lượt chưa được ăn mừng của người đang đăng nhập (hiệu ứng + âm thanh ở frontend).
 *
 * <p>Trả dữ liệu THÔ (tên chương trình, hạng, tên quà, trạng thái) chứ không dựng câu: câu chúc mừng do
 * frontend dịch theo ngôn ngữ người xem. Ba nguồn chung một hình dạng; trường nào không thuộc nguồn thì null.
 */
@Data
@Builder
public class RewardCelebrationResponse {

    private RewardCelebrationSource source;

    /** Id đề nghị thưởng / lần chạy chương trình / đơn đổi quà — gửi lại nguyên văn khi ack. */
    private UUID refId;

    /** Điểm người xem nhận được (đổi quà: điểm đã tiêu). */
    private Integer points;

    private Instant occurredAt;

    // ── GRANT ──
    private String grantorName;
    private String reason;
    /** Lượt thưởng kèm giấy khen. */
    private boolean certificate;
    /**
     * Có giấy khen thì kèm chính đề nghị thưởng (chỉ dòng của người xem, như {@code /reward-grants/my-awards})
     * để frontend vẽ giấy khen mà không phải gọi thêm.
     */
    private RewardGrantResponse grant;

    // ── PROGRAM_RUN ──
    private String programName;
    private Integer rank;

    // ── REDEMPTION ──
    private String giftName;
    private String giftImageUrl;
    private RedemptionStatus redemptionStatus;
    private Integer quantity;
}
