package com.kpitracking.enums;

/**
 * Vòng đời một lần chạy chương trình thưởng tự động.
 *
 * <p>Tách PREVIEW khỏi ISSUED là cố ý: quản trị viên phải nhìn thấy chính xác ai
 * được bao nhiêu điểm trước khi điểm thật sự vào ví. Bản PREVIEW lưu kèm
 * {@code snapshot_hash}; lúc phát, hệ thống tính lại bảng xếp hạng và so hash để
 * bảo đảm phát đúng danh sách đã duyệt.
 */
public enum RewardRunStatus {
    /** Đã tính xếp hạng, chưa phát điểm. Xem trước lại sẽ thay thế bản này. */
    PREVIEW,
    /** Đã phát điểm. Chỉ số này bị chặn trùng bởi unique index một phần. */
    ISSUED,
    /** Đã thu hồi bằng các giao dịch ADJUST âm bù trừ. Có thể phát lại sau khi thu hồi. */
    REVERTED
}
