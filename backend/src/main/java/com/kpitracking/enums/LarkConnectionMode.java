package com.kpitracking.enums;

/**
 * Nguồn lấy credential Lark của một tổ chức.
 */
public enum LarkConnectionMode {

    /** Tổ chức tự tạo Custom App trong Lark của họ và nhập App ID/Secret vào KeyGo. */
    CUSTOM_APP,

    /**
     * Dùng app KeyGo đã publish lên Lark App Directory — credential lấy từ cấu hình toàn cục,
     * tổ chức không phải nhập gì. Chỉ khả dụng sau khi KeyGo đăng ký ISV và được Lark duyệt.
     */
    STORE
}
