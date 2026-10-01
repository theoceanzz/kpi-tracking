package com.kpitracking.dto.response.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Một bộ tiêu chí chấm (bản nháp đang đối chiếu, hoặc phiên bản đã xác nhận). {@code sourceText} chỉ trả ở
 * màn chi tiết — màn đối chiếu cần nó để hiện cột "văn bản gốc".
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiCriteriaSetResponse {
    private UUID id;
    private String title;
    private UUID orgUnitId;
    private String orgUnitName;
    private Integer version;
    private String status;
    private String sourceFileName;
    private String sourceText;
    private Instant createdAt;
    private Instant confirmedAt;
    private List<Item> items;
    /** Mục tài liệu không có gì dùng để đánh giá. */
    private List<String> skippedSections;
    /** Mục AI bóc lỗi — nên xem tay hoặc tải lại. */
    private List<String> failedSections;
    /** Đã nạp toàn văn vào kho tri thức (khi xác nhận). */
    private Boolean inKnowledgeBase;
    /** Loại tài liệu đã nhận ra ({@code DocumentKind}) và tên hiển thị. */
    private String profile;
    private String profileLabel;
    /** Các vai trò loại tài liệu này dùng (nhãn, giải thích, dùng để chấm không) — frontend vẽ nhóm theo đây. */
    private java.util.List<com.kpitracking.ai.document.profile.CriteriaScheme.Role> roles;

    /** Người xem sửa / ngừng / xoá được bộ này không (trong phạm vi và không bị cấp trên khoá). */
    private Boolean canManage;
    /** Tài liệu đang áp cho đơn vị người xem quản lý nhưng do cấp trên áp — người xem không tự thay được. */
    private Boolean locked;
    private String lockReason;
    /** Người áp (bộ đang áp dụng) và chức vụ tại đơn vị đó. */
    private String appliedByName;
    private String appliedByRole;
    /** Đề nghị áp bộ này đang chờ duyệt, nếu có. */
    private PendingRequest pendingRequest;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PendingRequest {
        private UUID id;
        private UUID orgUnitId;
        private String orgUnitName;
        private String approverName;
        /** Người xem là người gửi (hiện "Rút đề nghị"). */
        private Boolean mine;
        private Instant createdAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Item {
        private UUID id;
        private String name;
        private String description;
        private BigDecimal weight;
        /** Mỗi dòng "Mức: mô tả". */
        private String scaleLevels;
        private String scope;
        private String sourceExcerpt;
        /** Đoạn gốc có thật trong tài liệu không — sai thì màn đối chiếu cảnh báo. */
        private Boolean excerptVerified;
        /** Người duyệt đã xác nhận dòng đúng (khi máy không thấy nguyên văn). */
        private Boolean reviewerConfirmed;
        private String kind;
        private String section;
        private String topic;
    }
}
