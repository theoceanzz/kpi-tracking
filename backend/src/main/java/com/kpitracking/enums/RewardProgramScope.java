package com.kpitracking.enums;

/** Chương trình thưởng tự động xếp hạng theo đợt hay theo kỳ. */
public enum RewardProgramScope {
    /** Theo đợt ({@code kpi_periods}) — điểm lấy qua bản đánh giá đại diện của đợt. */
    PERIOD,
    /** Theo kỳ ({@code kpi_cycles}) — điểm lấy từ {@code cycle_user_evaluations}, đã chốt. */
    CYCLE
}
