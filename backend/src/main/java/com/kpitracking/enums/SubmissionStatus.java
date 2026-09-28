package com.kpitracking.enums;

public enum SubmissionStatus {
    DRAFT,
    PENDING,
    APPROVED,
    REJECTED,
    /**
     * Người chấm đợt đã TRẢ LẠI (hoàn duyệt) bài này để nhân viên làm lại bằng một bài nộp mới.
     * Giữ làm lịch sử: không tính điểm, không tính vào số lần nộp. Các chỗ tính điểm/đếm bài nộp
     * đều liệt kê trạng thái được tính (APPROVED/PENDING/REJECTED), nên RETURNED tự bị loại.
     */
    RETURNED
}
