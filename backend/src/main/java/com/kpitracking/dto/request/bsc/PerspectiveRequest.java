package com.kpitracking.dto.request.bsc;

import com.kpitracking.enums.BscFixedPerspective;
import com.kpitracking.enums.BscPerspectiveStatus;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class PerspectiveRequest {
    @NotBlank(message = "Vui lòng nhập mã")
    @Size(max = 50, message = "Mã tối đa 50 ký tự")
    @Pattern(regexp = "^[A-Za-z0-9_]+$", message = "Mã chỉ gồm chữ, số và dấu gạch dưới")
    private String code;

    @NotBlank(message = "Vui lòng nhập tên viễn cảnh")
    private String name;

    private String description;

    @Pattern(regexp = "^#([0-9A-Fa-f]{6})$", message = "Màu không hợp lệ")
    private String color;

    private String icon;

    @Min(value = 0, message = "Thứ tự không được âm")
    private Integer displayOrder;

    private BscPerspectiveStatus status;

    @NotNull(message = "Vui lòng chọn viễn cảnh cho hạng mục")
    private BscFixedPerspective fixedPerspective;
}
