package com.kpitracking.dto.response.organization;

import com.kpitracking.enums.CodeType;
import lombok.*;

import java.util.List;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class OrgCodeRuleResponse {

    private CodeType codeType;
    /** Nhãn tiếng Việt của loại mã — giao diện khỏi phải giữ bảng dịch riêng. */
    private String label;
    private String pattern;
    private Boolean autoGenerate;
    private Boolean allowManualOverride;
    /** Token dùng được cho loại mã này (chưa gồm ô số {###}). */
    private List<String> supportedTokens;
    /** Mã sẽ sinh ra nếu tạo mới ngay lúc này. Null nếu mẫu đang không hợp lệ. */
    private String preview;
    /** Lý do không dựng được preview — hiện ngay dưới ô nhập mẫu. */
    private String previewError;
}
