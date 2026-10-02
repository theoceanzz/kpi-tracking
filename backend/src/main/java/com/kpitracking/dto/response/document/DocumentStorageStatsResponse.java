package com.kpitracking.dto.response.document;

import com.kpitracking.enums.DocumentScope;

import java.util.List;
import java.util.UUID;

/**
 * Thống kê dung lượng thư viện tài liệu cho quản trị (docs/DOCUMENTS_DESIGN.md §16.5). Kho cá nhân chỉ có SỐ LƯỢNG
 * và DUNG LƯỢNG theo người — không tên, không nội dung tài liệu.
 */
public record DocumentStorageStatsResponse(
        List<ScopeRow> scopes,
        Usage trash,
        Usage versions,
        List<UnitRow> topUnits,
        List<OwnerRow> topOwners,
        long orgChunks,
        long orgChunkQuota,
        long unitQuota,
        long personalQuota,
        int trashRetentionDays) {

    public record Usage(long count, long bytes) {}

    /** {@code quota} chỉ có ở COMPANY (hạn mức chung); UNIT/PERSONAL là hạn mức MỖI đơn vị / MỖI người. */
    public record ScopeRow(DocumentScope scope, long count, long bytes, long chunks, Long quota) {}

    public record UnitRow(UUID unitId, String name, String path, long count, long bytes, long chunks) {}

    public record OwnerRow(UUID userId, String name, String email, boolean deactivated, long count, long bytes, long chunks) {}
}
