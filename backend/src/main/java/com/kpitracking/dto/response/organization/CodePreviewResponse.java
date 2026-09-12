package com.kpitracking.dto.response.organization;

import com.kpitracking.enums.CodeType;
import lombok.*;

/**
 * Mã kế tiếp dựng theo một mẫu, dùng cho ô xem trước ở trang thiết lập.
 *
 * Bọc trong DTO thay vì trả thẳng chuỗi: {@code ApiResponse.success(String)} khớp với nạp
 * chồng {@code success(String message)} nên chuỗi sẽ chui vào ô `message` và `data` thành
 * null — một cái bẫy im lặng.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CodePreviewResponse {

    private CodeType codeType;
    /** Mẫu đã dùng để dựng — chính là mẫu client gửi lên, hoặc mẫu đang lưu nếu bỏ trống. */
    private String pattern;
    private String code;
}
