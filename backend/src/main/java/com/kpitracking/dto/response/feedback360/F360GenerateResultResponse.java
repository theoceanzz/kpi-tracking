package com.kpitracking.dto.response.feedback360;

import lombok.*;

import java.util.List;

/** Kết quả sinh người chấm tự động: số phiếu tạo ra và các cảnh báo cần HR xem trước khi khởi động. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360GenerateResultResponse {
    private Integer subjectsProcessed;
    private Integer assignmentsCreated;
    private List<String> warnings;
}
