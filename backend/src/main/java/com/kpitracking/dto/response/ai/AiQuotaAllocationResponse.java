package com.kpitracking.dto.response.ai;

import lombok.*;

import java.util.UUID;

/** Một dòng trong bảng phân bổ hạn mức. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AiQuotaAllocationResponse {

    private UUID userId;
    private String fullName;
    private String email;

    /** Vai trò cao nhất của người này (rank nhỏ nhất) — hiện ở cột Vai trò. */
    private String roleName;

    /** Đơn vị tương ứng với vai trò đó, giúp phân biệt người trùng tên. */
    private String orgUnitName;

    private Long monthlyLimit;
    private Long usedThisMonth;

    /**
     * Người đang đăng nhập có sửa được hạn mức này không: phần do mình cấp, phần chưa ai cấp,
     * hoặc phần do một người dưới quyền mình cấp.
     */
    private Boolean editable;

    /** Tên người đã cấp hạn mức này; {@code null} nghĩa là cấp thẳng từ ngân sách công ty. */
    private String allocatedByName;

    /**
     * Sửa dòng này là giành quyền cấp từ người khác: hạn mức cũ trả về túi người cấp cũ, hạn mức
     * mới trừ trọn vẹn vào túi của người đang đăng nhập. Giao diện cần biết để tính đúng số token
     * bị trừ và để hỏi xác nhận trước khi lưu.
     */
    private Boolean takeover;
}
