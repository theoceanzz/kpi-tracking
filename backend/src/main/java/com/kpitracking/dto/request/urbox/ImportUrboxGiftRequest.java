package com.kpitracking.dto.request.urbox;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** Nhập một món quà UrBox vào danh mục quà của tổ chức. */
@Data
public class ImportUrboxGiftRequest {

    @NotBlank(message = "Thiếu mã quà UrBox")
    private String urboxGiftId;

    /**
     * Số điểm nhân viên phải trả. Bỏ trống thì lấy giá gợi ý = mệnh giá chia tỉ giá quy
     * đổi của tổ chức, làm tròn lên.
     */
    @Min(value = 1, message = "Số điểm đổi quà phải lớn hơn 0")
    private Integer pointCost;

    /**
     * Giới hạn số lượt đổi món này. Bỏ trống = không giới hạn, để tồn kho thật do UrBox
     * quyết — đó cũng là mặc định hợp lý vì kho của họ không nằm trong tầm kiểm soát
     * của tổ chức.
     */
    @Min(value = 0, message = "Tồn kho không được âm")
    private Integer stockQuantity;

    /** Tên hiển thị riêng. Bỏ trống thì dùng nguyên tên UrBox. */
    private String name;

    private Integer displayOrder;
}
