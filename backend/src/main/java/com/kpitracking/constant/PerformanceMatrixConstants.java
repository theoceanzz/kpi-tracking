package com.kpitracking.constant;

/**
 * Default "Ma trận xếp loại hiệu quả làm việc" (Performance rating matrix).
 * Maps (% KPI achievement × behavior score) → performance rating (1..5).
 * Stored as a JSON string on Organization; fully customizable per organization.
 * Reference: rows 2-7 of the Performance Matrix sheet.
 *   rows  = behavior score bands (row headers)
 *   cols  = KPI achievement % bands (column headers)
 *   cells = rating value per (row, col), sized rows.length × cols.length
 */
public class PerformanceMatrixConstants {

    private PerformanceMatrixConstants() {}

    public static final String DEFAULT_MATRIX_JSON = "{"
        + "\"rowHeader\":\"Điểm hành vi\","
        + "\"colHeader\":\"% Hoàn thành KPI\","
        + "\"rows\":[\"<2\",\"≥2 và <3\",\"≥3 và <3.5\",\"≥3.5 và <4.5\",\"≥4.5 và ≤5\"],"
        + "\"cols\":[\"< 70%\",\"≥70 và <90%\",\"≥90 và <110%\",\"≥110 và <120%\",\"≥120%\"],"
        + "\"cells\":["
        + "[1,1,1,2,2],"
        + "[1,2,2,3,3],"
        + "[2,2,3,4,4],"
        + "[2,3,3,4,5],"
        + "[2,3,4,4,5]"
        + "]"
        + "}";
}
