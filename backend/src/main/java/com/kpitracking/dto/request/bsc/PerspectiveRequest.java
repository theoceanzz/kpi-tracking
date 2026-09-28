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
    /**
     * Bỏ trống nếu tổ chức bật sinh mã tự động — backend cấp mã theo mẫu của tổ chức.
     * Vì vậy regex dùng {@code *} chứ không phải {@code +}: chuỗi rỗng phải qua được validate.
     */
    @Size(max = 50, message = "{validation.codeCanMost50Characters}")
    @Pattern(regexp = "^[A-Za-z0-9_]*$", message = "{validation.codeMayOnlyContainLettersDigitsUnderscores}")
    private String code;

    @NotBlank(message = "{validation.enterAreaName}")
    private String name;

    private String description;

    /** Mục tiêu mong muốn — mức cần đạt của hạng mục. Bỏ trống nếu chưa đặt con số. */
    private Double targetValue;

    /** Kết quả tối thiểu — ngưỡng sàn chấp nhận được, không được lớn hơn mục tiêu mong muốn. */
    private Double minimumValue;

    /** Đơn vị tính của mục tiêu/tối thiểu. */
    @Size(max = 50, message = "{validation.unitMeasureCanMost50Characters}")
    private String unit;

    @Pattern(regexp = "^#([0-9A-Fa-f]{6})$", message = "{validation.invalidColorHex}")
    private String color;

    private String icon;

    @Min(value = 0, message = "{validation.orderCannotNegative}")
    private Integer displayOrder;

    private BscPerspectiveStatus status;

    @NotNull(message = "{validation.chooseAreaItem}")
    private BscFixedPerspective fixedPerspective;
}
