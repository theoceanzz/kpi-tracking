package com.kpitracking.ai.document.parse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.ai.document.model.Block;
import com.kpitracking.ai.document.model.FileRef;
import com.kpitracking.ai.document.model.ParsedDocument;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/**
 * Bảng tính soạn trực tuyến ({@code .kgsheet}): snapshot JSON của trình bảng tính Univer
 * ({@code {sheetOrder, sheets: {id: {name, cellData: {hàng: {cột: {v, f}}}}}}}). Đọc ra ĐÚNG khuôn của
 * {@link SpreadsheetParser} — mỗi trang tính một tiêu đề {@link SpreadsheetParser#SHEET_PREFIX}, rồi các dòng bảng, cùng
 * trần dòng / cột / trang tính, định dạng báo là {@code xlsx} — để hồ sơ "Bảng tiêu chí / KPI" và cách cắt theo trang tính
 * áp dụng y như tệp Excel tải lên.
 */
@Component
public class UniverSheetParser implements DocumentParser {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Override
    public Set<String> formats() {
        return Set.of("kgsheet");
    }

    @Override
    public boolean accepts(FileRef file) {
        return formats().contains(file.extension());
    }

    @Override
    public ParsedDocument parse(FileRef file) throws Exception {
        JsonNode root = JSON.readTree(file.bytes());
        if (root == null || !root.isObject()) throw new Unparseable("không phải bảng tính soạn trực tuyến");
        JsonNode sheets = root.path("sheets");
        List<String> order = new ArrayList<>();
        root.path("sheetOrder").forEach(n -> order.add(n.asText()));
        if (order.isEmpty()) sheets.fieldNames().forEachRemaining(order::add);

        List<Block> blocks = new ArrayList<>();
        boolean truncated = order.size() > SpreadsheetParser.MAX_SHEETS;
        for (String id : order.subList(0, Math.min(order.size(), SpreadsheetParser.MAX_SHEETS))) {
            JsonNode sheet = sheets.path(id);
            List<List<String>> rows = rows(sheet.path("cellData"));
            if (rows.isEmpty()) continue;
            blocks.add(new Block.Heading(1, SpreadsheetParser.SHEET_PREFIX + sheet.path("name").asText(id)));
            int head = SpreadsheetParser.HEAD_ROWS;
            if (rows.size() <= head + 1) {
                rows.forEach(r -> blocks.add(new Block.TableRow(r)));
            } else {
                truncated = true;
                rows.subList(0, head).forEach(r -> blocks.add(new Block.TableRow(r)));
                blocks.add(new Block.Paragraph("… (bỏ " + (rows.size() - head - 1) + " dòng) …"));
                blocks.add(new Block.TableRow(rows.get(rows.size() - 1)));
                blocks.add(new Block.Paragraph("↑ dòng cuối của trang tính"));
            }
        }
        ParsedDocument parsed = new ParsedDocument(file.name(), "xlsx", blocks, ParsedDocument.TextSource.TEXT, truncated, null);
        if (parsed.isEmpty()) throw new Unparseable("bảng tính trống");
        return parsed;
    }

    /** Các dòng có chữ, theo thứ tự hàng; mỗi dòng đủ cột từ 0 tới ô cuối có chữ (tối đa {@code MAX_COLS}). */
    private static List<List<String>> rows(JsonNode cellData) {
        Map<Integer, Map<Integer, String>> grid = new TreeMap<>();
        for (Iterator<Map.Entry<String, JsonNode>> rs = cellData.fields(); rs.hasNext(); ) {
            Map.Entry<String, JsonNode> r = rs.next();
            int row = parseIndex(r.getKey());
            if (row < 0) continue;
            for (Iterator<Map.Entry<String, JsonNode>> cs = r.getValue().fields(); cs.hasNext(); ) {
                Map.Entry<String, JsonNode> c = cs.next();
                int col = parseIndex(c.getKey());
                if (col < 0 || col >= SpreadsheetParser.MAX_COLS) continue;
                String v = text(c.getValue());
                if (!v.isEmpty()) grid.computeIfAbsent(row, k -> new TreeMap<>()).put(col, v);
            }
        }
        List<List<String>> out = new ArrayList<>();
        for (Map<Integer, String> cols : grid.values()) {
            int last = ((TreeMap<Integer, String>) cols).lastKey();
            List<String> cells = new ArrayList<>();
            for (int c = 0; c <= last; c++) cells.add(cols.getOrDefault(c, ""));
            out.add(cells);
        }
        return out;
    }

    /** Giá trị hiển thị của ô: {@code v} (công thức đã có kết quả tính), chữ giàu {@code p} thì ghép đoạn. */
    private static String text(JsonNode cell) {
        JsonNode v = cell.path("v");
        String s;
        if (!v.isMissingNode() && !v.isNull()) {
            s = v.isNumber() ? v.numberValue().toString() : v.asText();
            if (v.isNumber() && s.endsWith(".0")) s = s.substring(0, s.length() - 2);
        } else {
            s = cell.path("p").path("body").path("dataStream").asText("");
        }
        return s.replace('\r', ' ').replace('\n', ' ').strip();
    }

    private static int parseIndex(String key) {
        try {
            return Integer.parseInt(key);
        } catch (NumberFormatException e) {
            return -1;
        }
    }
}
