package com.kpitracking.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Nguồn chân lý DUY NHẤT cho "Ma trận xếp loại hiệu quả": ánh xạ
 * (điểm hành vi → hàng) × (% hoàn thành KPI → cột) → xếp loại 1..5.
 *
 * Cấu hình lưu ở {@code Organization.performance_matrix} (JSON): {@code rowHeader, colHeader,
 * rows[] (dải hành vi), cols[] (dải %HT), cells[][] (rating theo (hàng, cột))}.
 *
 * Dùng chung bởi EvaluationService (chấm điểm) và MatrixAnalyticsService (thống kê/heatmap)
 * để cả hai nhất quán — tránh parse dải trùng lặp.
 */
public final class PerformanceMatrixResolver {

    private PerformanceMatrixResolver() {}

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Pattern NUM = Pattern.compile("[0-9]+(?:\\.[0-9]+)?");

    /** Ma trận đã parse. {@code cells[row][col]} = rating. */
    public record Matrix(String rowHeader, String colHeader, List<String> rows, List<String> cols, int[][] cells) {}

    /** Parse JSON cấu hình; trả {@code null} nếu thiếu/hỏng. */
    public static Matrix parse(String matrixJson) {
        if (matrixJson == null || matrixJson.isBlank()) return null;
        try {
            JsonNode root = MAPPER.readTree(matrixJson);
            JsonNode rows = root.get("rows");
            JsonNode cols = root.get("cols");
            JsonNode cells = root.get("cells");
            if (rows == null || cols == null || cells == null || !rows.isArray() || !cols.isArray() || !cells.isArray()) {
                return null;
            }
            List<String> rowLabels = new ArrayList<>();
            rows.forEach(n -> rowLabels.add(n.asText()));
            List<String> colLabels = new ArrayList<>();
            cols.forEach(n -> colLabels.add(n.asText()));
            int[][] grid = new int[cells.size()][];
            for (int r = 0; r < cells.size(); r++) {
                JsonNode rowCells = cells.get(r);
                grid[r] = new int[rowCells.size()];
                for (int c = 0; c < rowCells.size(); c++) grid[r][c] = rowCells.get(c).asInt();
            }
            String rowHeader = root.hasNonNull("rowHeader") ? root.get("rowHeader").asText() : "Điểm hành vi";
            String colHeader = root.hasNonNull("colHeader") ? root.get("colHeader").asText() : "% Hoàn thành KPI";
            return new Matrix(rowHeader, colHeader, rowLabels, colLabels, grid);
        } catch (Exception e) {
            return null;
        }
    }

    /** Chỉ số ô {@code [rowIdx, colIdx]} cho (hành vi, %HT); {@code null} nếu không xác định được. */
    public static int[] cellIndex(Matrix m, Double behaviorScore, Double completionPercent) {
        if (m == null || behaviorScore == null || completionPercent == null) return null;
        int rowIdx = bandIndex(behaviorScore, m.rows());
        int colIdx = bandIndex(completionPercent, m.cols());
        if (rowIdx < 0 || colIdx < 0 || rowIdx >= m.cells().length) return null;
        if (colIdx >= m.cells()[rowIdx].length) return null;
        return new int[]{rowIdx, colIdx};
    }

    /** Xếp loại (rating) cho (hành vi, %HT) theo cấu hình JSON; {@code null} nếu không tra được. */
    public static Integer rating(String matrixJson, Double behaviorScore, Double completionPercent) {
        Matrix m = parse(matrixJson);
        int[] idx = cellIndex(m, behaviorScore, completionPercent);
        return idx == null ? null : m.cells()[idx[0]][idx[1]];
    }

    /**
     * Chỉ số dải cho một giá trị theo nhãn dải tăng dần (vd "&lt;2", "≥2 và &lt;3", "≥120%").
     * Lấy số LỚN nhất trong nhãn làm cận trên; dải cuối là +∞.
     */
    public static int bandIndex(double value, List<String> bands) {
        for (int i = 0; i < bands.size(); i++) {
            if (i == bands.size() - 1) return i; // dải cuối "hứng" phần còn lại
            Matcher mt = NUM.matcher(bands.get(i));
            double upper = Double.NEGATIVE_INFINITY;
            while (mt.find()) upper = Math.max(upper, Double.parseDouble(mt.group()));
            if (upper == Double.NEGATIVE_INFINITY) continue;
            if (value < upper) return i;
        }
        return bands.isEmpty() ? -1 : bands.size() - 1;
    }
}
