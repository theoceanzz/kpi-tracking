package com.kpitracking.dto.response.approvalprocess;

import lombok.*;

import java.util.List;
import java.util.Map;

/** Kết quả kiểm sơ đồ: lỗi chặn lưu, cảnh báo không chặn; kèm mã bước tính theo sơ đồ. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ProcessValidationResponse {
    private boolean valid;
    private List<Issue> errors;
    private List<Issue> warnings;
    private Map<String, String> stepCodes;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Issue {
        private String nodeId;
        private String edgeId;
        private String code;
        private String message;
    }
}
