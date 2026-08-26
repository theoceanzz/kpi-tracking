package com.kpitracking.dto.request.bsc;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;

/** Sửa hiển thị của 1 lĩnh vực BSC cố định (theo org). Mã (code) cố định, không sửa được. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class FixedPerspectiveUpdateRequest {

    @NotBlank(message = "Tên lĩnh vực là bắt buộc")
    @Size(max = 100, message = "Tên lĩnh vực tối đa 100 ký tự")
    private String name;

    @Pattern(regexp = "^#([0-9A-Fa-f]{6})$", message = "Màu không hợp lệ (định dạng #RRGGBB)")
    private String color;

    private Integer displayOrder;
}
