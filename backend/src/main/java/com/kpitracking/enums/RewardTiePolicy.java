package com.kpitracking.enums;

/** Xử lý đồng hạng khi trao thưởng theo thứ hạng. */
public enum RewardTiePolicy {
    /**
     * Mọi người cùng hạng đều nhận điểm của hạng đó ⇒ "Top 3" có thể trả cho 4 người.
     * Màn hình xem trước luôn hiện tổng điểm thực tế nên con số không bao giờ bất ngờ.
     */
    SHARE_ALL,
    /** Bám thứ tự tuyệt đối sau khi phá hoà, trả đúng N người. */
    STRICT
}
