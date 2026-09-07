package com.kpitracking.dto.request.wallet;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class ConvertToPointsRequest {

    @NotNull(message = "Vui lòng nhập số điểm muốn đổi")
    @Positive(message = "Số điểm muốn đổi phải lớn hơn 0")
    private Integer points;

    /**
     * Mã chống ghi trùng do client sinh. Phải sinh MỚI mỗi khi số điểm thay đổi,
     * và giữ nguyên khi chỉ bấm gửi lại cùng một giá trị: sinh lại mỗi lần bấm thì
     * lớp bảo vệ vô nghĩa, còn giữ cố định suốt vòng đời form thì đổi số điểm rồi
     * bấm sẽ nhận về kết quả của lần đổi trước.
     */
    @NotBlank(message = "Thiếu mã yêu cầu")
    private String requestId;
}
