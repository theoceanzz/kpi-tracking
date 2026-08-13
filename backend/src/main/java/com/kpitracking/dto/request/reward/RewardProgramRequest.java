package com.kpitracking.dto.request.reward;

import com.kpitracking.enums.RewardProgramScope;
import com.kpitracking.enums.RewardRankWithin;
import com.kpitracking.enums.RewardRankingMetric;
import com.kpitracking.enums.RewardTiePolicy;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class RewardProgramRequest {

    @NotBlank(message = "Vui lòng nhập tên chương trình")
    private String name;

    private String description;

    @NotNull(message = "Vui lòng chọn phạm vi (theo đợt hay theo kỳ)")
    private RewardProgramScope scope;

    /** Gốc phạm vi xếp hạng. Để trống = toàn tổ chức. */
    private UUID orgUnitId;

    /**
     * Gắn cứng chương trình vào MỘT kỳ/đợt cụ thể. Để trống = dùng cho mọi kỳ/đợt,
     * mục tiêu chọn lúc bấm chạy.
     *
     * <p>Phải là id của kỳ khi {@link #scope} = CYCLE, id của đợt khi = PERIOD.
     */
    private UUID fixedTargetId;

    private RewardRankWithin rankWithin;

    @NotNull(message = "Vui lòng chọn chỉ số xếp hạng")
    private RewardRankingMetric metric;

    private RewardTiePolicy tiePolicy;

    /** Điểm sàn: dưới mức này thì không được thưởng dù xếp hạng cao. */
    private Double minMetricValue;

    /** Trần an toàn cho một lần phát. Để trống = không giới hạn. */
    @Min(value = 1, message = "Trần điểm mỗi lần phát phải lớn hơn 0")
    private Integer maxPointsPerRun;

    private Boolean includeUnitHeads;

    @NotEmpty(message = "Vui lòng thiết lập ít nhất một bậc thưởng")
    private List<Tier> tiers;

    private Boolean enabled;

    /**
     * Tự động phát khi kỳ/đợt đã qua ngày kết thúc.
     *
     * <p>Bám vào ngày kết thúc chứ không phải thao tác chốt đánh giá, vì chốt chỉ có ở
     * KỲ — bám vào đó thì chương trình theo ĐỢT vĩnh viễn không tự chạy được.
     */
    private Boolean autoTrigger;

    /**
     * Một bậc thưởng: từ hạng bao nhiêu tới hạng bao nhiêu thì được bao nhiêu điểm.
     * Ví dụ {@code fromRank=2, toRank=3, points=300} nghĩa là hạng nhì và hạng ba
     * mỗi người 300 điểm.
     */
    @Data
    public static class Tier {

        @NotNull(message = "Thiếu hạng bắt đầu")
        @Min(value = 1, message = "Hạng bắt đầu phải từ 1")
        private Integer fromRank;

        @NotNull(message = "Thiếu hạng kết thúc")
        @Min(value = 1, message = "Hạng kết thúc phải từ 1")
        private Integer toRank;

        @NotNull(message = "Thiếu số điểm thưởng")
        @Min(value = 1, message = "Số điểm thưởng phải lớn hơn 0")
        private Integer points;
    }
}
