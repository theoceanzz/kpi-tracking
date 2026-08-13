package com.kpitracking.dto.request.reward;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class CreateRewardGrantRequest {

    @NotEmpty(message = "Vui lòng chọn ít nhất một nhân viên để thưởng")
    @Valid
    private List<Recipient> recipients;

    @NotBlank(message = "Vui lòng nhập lý do thưởng")
    private String reason;

    /** Chỉ để giao diện điền nhanh; số điểm có thẩm quyền nằm ở từng người nhận. */
    private Integer pointsPerRecipient;

    @Data
    public static class Recipient {

        @NotNull(message = "Thiếu thông tin nhân viên")
        private UUID userId;

        @NotNull(message = "Vui lòng nhập số điểm thưởng")
        @Min(value = 1, message = "Số điểm thưởng phải lớn hơn 0")
        private Integer points;
    }
}
