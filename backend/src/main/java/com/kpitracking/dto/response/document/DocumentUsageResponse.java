package com.kpitracking.dto.response.document;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Dung lượng đã dùng / hạn mức (byte), và số đoạn kho tri thức của tổ chức. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DocumentUsageResponse {
    private long personalUsed;
    private long personalQuota;
    private long companyUsed;
    private long companyQuota;
    private long unitQuota;
    private long orgChunks;
    private long orgChunkQuota;
    private long maxFileBytes;
    /** Tài liệu trong thùng rác khôi phục được trong bấy nhiêu ngày, sau đó bị xoá hẳn. */
    private int trashRetentionDays;
}
