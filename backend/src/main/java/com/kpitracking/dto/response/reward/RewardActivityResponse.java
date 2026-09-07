package com.kpitracking.dto.response.reward;

import com.kpitracking.enums.RewardActivityType;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

/**
 * Một dòng trên bảng tin điểm thưởng.
 *
 * <p>Ba nguồn rất khác nhau (sổ cái, hạn mức, yêu cầu đổi quà) được ép về CHUNG một
 * hình dạng ở backend thay vì trả ba danh sách rồi để giao diện tự trộn — thứ tự thời
 * gian của dải tin phải giống nhau ở mọi màn hình, mà logic trộn nằm ở frontend thì
 * mỗi chỗ dùng lại là một cơ hội lệch.
 */
@Data
@Builder
public class RewardActivityResponse {

    /** Id của bản ghi nguồn. Chỉ duy nhất TRONG một loại, nên khoá React phải ghép với type. */
    private UUID id;

    private RewardActivityType type;

    /** Nhân vật chính của dòng tin: người nhận điểm / được cấp hạn mức / đổi quà. */
    private UUID userId;
    private String userName;
    private String userAvatarUrl;

    /**
     * Người trao. Null khi không có ai đứng sau: chương trình tự động phát thưởng, và
     * đổi quà (người đổi đã là {@link #userId} rồi).
     */
    private UUID actorUserId;
    private String actorName;

    /** Số điểm, luôn dương: được thưởng, được cấp hạn mức, hoặc đã tiêu để đổi quà. */
    private Integer points;

    /** Chỉ có ở {@link RewardActivityType#GIFT_REDEEMED}, lấy từ bản chụp lúc đổi. */
    private String giftName;
    private String giftImageUrl;

    /** Lý do thưởng — thứ khiến dòng tin có ý nghĩa thay vì chỉ là một con số. */
    private String note;

    private Instant occurredAt;
}
