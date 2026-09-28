package com.kpitracking.enums;

/** Kết quả một lần bấm duyệt. */
public enum ApprovalOutcome {
    /** Duyệt và chuyển lên bước kế tiếp. */
    FORWARDED,
    /** Duyệt cuối — đối tượng đã được chốt. */
    FINAL
}
