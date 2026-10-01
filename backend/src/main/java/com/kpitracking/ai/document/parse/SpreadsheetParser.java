package com.kpitracking.ai.document.parse;

import com.kpitracking.ai.document.model.Block;
import com.kpitracking.ai.document.model.FileRef;
import com.kpitracking.ai.document.model.ParsedDocument;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.FormulaEvaluator;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Excel ({@code .xlsx}, {@code .xls}): mỗi trang tính một tiêu đề cấp 1 "Trang tính: …", mỗi hàng một
 * {@link Block.TableRow}. Công thức lấy GIÁ TRỊ đã tính.
 *
 * <p>Bảng dài lấy PHẦN ĐẦU và DÒNG CUỐI (thường là dòng tổng), ghi rõ đã bỏ bao nhiêu dòng — "cắt có kiểm
 * soát". Tối đa {@link #MAX_SHEETS} trang tính, {@link #MAX_COLS} cột.
 */
@Component
public class SpreadsheetParser implements DocumentParser {

    static final int HEAD_ROWS = 40;
    static final int MAX_SHEETS = 5;
    static final int MAX_COLS = 30;
    /** Tiền tố tiêu đề trang tính — {@code SheetSectioning} nhận ra mục theo nó. */
    public static final String SHEET_PREFIX = "Trang tính: ";

    @Override
    public Set<String> formats() {
        return Set.of("xlsx", "xls");
    }

    @Override
    public boolean accepts(FileRef file) {
        return formats().contains(file.extension());
    }

    @Override
    public ParsedDocument parse(FileRef file) throws Exception {
        try (Workbook wb = WorkbookFactory.create(new ByteArrayInputStream(file.bytes()))) {
            DataFormatter fmt = new DataFormatter();
            FormulaEvaluator eval = wb.getCreationHelper().createFormulaEvaluator();
            List<Block> blocks = new ArrayList<>();
            boolean truncated = wb.getNumberOfSheets() > MAX_SHEETS;
            for (int s = 0; s < Math.min(wb.getNumberOfSheets(), MAX_SHEETS); s++) {
                Sheet sheet = wb.getSheetAt(s);
                List<List<String>> rows = new ArrayList<>();
                for (Row row : sheet) {
                    List<String> cells = cells(row, fmt, eval);
                    if (cells != null) rows.add(cells);
                }
                if (rows.isEmpty()) continue;
                blocks.add(new Block.Heading(1, SHEET_PREFIX + sheet.getSheetName()));
                if (rows.size() <= HEAD_ROWS + 1) {
                    rows.forEach(r -> blocks.add(new Block.TableRow(r)));
                } else {
                    truncated = true;
                    rows.subList(0, HEAD_ROWS).forEach(r -> blocks.add(new Block.TableRow(r)));
                    blocks.add(new Block.Paragraph("… (bỏ " + (rows.size() - HEAD_ROWS - 1) + " dòng) …"));
                    blocks.add(new Block.TableRow(rows.get(rows.size() - 1)));
                    blocks.add(new Block.Paragraph("↑ dòng cuối của trang tính"));
                }
            }
            ParsedDocument parsed = new ParsedDocument(file.name(), file.extension(), blocks,
                    ParsedDocument.TextSource.TEXT, truncated, null);
            if (parsed.isEmpty()) throw new Unparseable("bảng tính trống");
            return parsed;
        }
    }

    private static List<String> cells(Row row, DataFormatter fmt, FormulaEvaluator eval) {
        List<String> cells = new ArrayList<>();
        boolean any = false;
        for (int c = 0; c < Math.min(row.getLastCellNum(), MAX_COLS); c++) {
            Cell cell = row.getCell(c);
            String v;
            try {
                v = cell == null ? "" : fmt.formatCellValue(cell, eval).strip();
            } catch (RuntimeException e) {
                v = cell == null ? "" : cell.toString();
            }
            if (!v.isEmpty()) any = true;
            cells.add(v.replace('\n', ' '));
        }
        return any ? cells : null;
    }
}
