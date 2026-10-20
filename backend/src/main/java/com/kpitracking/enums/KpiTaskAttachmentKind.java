package com.kpitracking.enums;

/**
 * Loại tệp của công việc (V47). {@code REFERENCE} = tệp đính kèm (người giao đưa để làm việc, như ô Attachment của
 * Lark); {@code RESULT} = kết quả người thực hiện nộp lại khi làm xong. Không phải minh chứng KPI — KPI vẫn nộp qua
 * báo cáo kết quả ({@code KpiSubmission}).
 */
public enum KpiTaskAttachmentKind {
    REFERENCE, RESULT
}
