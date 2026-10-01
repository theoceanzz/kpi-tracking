package com.kpitracking.dto.response.document;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * Người đang đăng nhập làm được gì với thư viện tài liệu — để frontend ẩn/hiện tab và nút tải lên mà không
 * tự suy quyền. Cùng nguồn {@code DocumentAccess} với backend.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DocumentCapabilitiesResponse {
    private boolean member;
    private boolean canUploadPersonal;
    private boolean canManageCompany;
    /** Đơn vị mình tải tài liệu lên được (có DOCUMENT:MANAGE_UNIT). */
    private List<UnitOption> manageableUnits;
    /** Đơn vị mình đọc được tài liệu (để lọc ở tab Đơn vị). */
    private List<UnitOption> visibleUnits;
    private List<String> allowedExtensions;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UnitOption {
        private UUID id;
        private String name;
        private String path;
    }
}
