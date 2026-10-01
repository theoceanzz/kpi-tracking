package com.kpitracking.enums;

/** Vòng đời một lượt AI đọc bài nộp: bấm -> chờ chạy nền -> đang chạy -> xong / lỗi. */
public enum AiReviewStatus {
    QUEUED, RUNNING, DONE, FAILED
}
