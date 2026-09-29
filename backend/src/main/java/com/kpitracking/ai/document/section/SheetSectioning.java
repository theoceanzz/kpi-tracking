package com.kpitracking.ai.document.section;

import com.kpitracking.ai.document.model.Block;
import com.kpitracking.ai.document.model.DocumentSection;
import com.kpitracking.ai.document.model.ParsedDocument;
import com.kpitracking.ai.document.parse.SpreadsheetParser;

import java.util.ArrayList;
import java.util.List;

/**
 * Cắt bảng tính: mỗi TRANG TÍNH một mục (tên trang tính là tiêu đề — thường là một nhóm chỉ tiêu / một khía
 * cạnh BSC). Trang tính dài chia theo độ dài, DÒNG TIÊU ĐỀ cột được lặp ở đầu mỗi phần để mô hình vẫn biết cột
 * nào là "Trọng số", cột nào là "Mục tiêu".
 */
public final class SheetSectioning implements SectioningStrategy {

    public static final SheetSectioning INSTANCE = new SheetSectioning();

    private SheetSectioning() {}

    @Override
    public String name() {
        return "sheet";
    }

    @Override
    public List<DocumentSection> sections(ParsedDocument doc) {
        List<DocumentSection> out = new ArrayList<>();
        String sheet = null;
        List<String> lines = new ArrayList<>();
        for (Block b : doc.blocks()) {
            if (b instanceof Block.Heading h && h.text().startsWith(SpreadsheetParser.SHEET_PREFIX)) {
                flush(out, sheet, lines);
                sheet = h.text().substring(SpreadsheetParser.SHEET_PREFIX.length());
            } else {
                String line = ParsedDocument.lineOf(b);
                if (line != null && !line.isBlank()) lines.add(line);
            }
        }
        flush(out, sheet, lines);
        return out.isEmpty() ? SizeSectioning.INSTANCE.sections(doc) : out;
    }

    private static void flush(List<DocumentSection> out, String sheet, List<String> lines) {
        if (lines.isEmpty()) return;
        List<String> path = List.of(sheet == null ? "Bảng tính" : sheet);
        String header = lines.get(0);
        List<DocumentSection> parts = SizeSectioning.split(String.join("\n", lines), path);
        for (int i = 0; i < parts.size(); i++) {
            DocumentSection p = parts.get(i);
            out.add(i == 0 ? p : new DocumentSection(p.path(), header + "\n" + p.text()));
        }
        lines.clear();
    }
}
