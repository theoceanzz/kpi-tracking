package com.kpitracking.enums;

/** Trạng thái nạp tài liệu vào kho tri thức của K.AI. */
public enum DocumentAiStatus {
    /** Người dùng tắt "Dùng cho AI" — không có vector nào. */
    NONE,
    /** Chờ nạp (vừa tải lên, vừa bật lại, hoặc cần nạp lại vì sửa). */
    PENDING,
    /** Đang nạp. Kẹt quá lâu ở đây nghĩa là job chết giữa chừng — job khôi phục chạy lại. */
    INDEXING,
    READY,
    FAILED,
    /** Đọc được tệp nhưng không có chữ để nạp (PDF scan). Không tự thử lại. */
    UNSUPPORTED;

    public boolean isInFlight() {
        return this == PENDING || this == INDEXING;
    }
}
