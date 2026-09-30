package com.kpitracking.service.ai.review.evidence;

import com.kpitracking.ai.document.model.Block;
import com.kpitracking.ai.document.model.ParsedDocument;

import java.util.ArrayList;
import java.util.List;

/**
 * Rút một tệp minh chứng dài về trần ký tự mà KHÔNG mất phần giải trình.
 *
 * <p>Trước đây chỉ lấy N ký tự đầu. Báo cáo thật hay đặt bảng số liệu dài ở giữa và phần giải thích nguyên nhân /
 * kế hoạch ở cuối, nên cắt đầu làm AI kết luận "chưa giải trình" dù bài đã có (tệp mẫu 04: 20 bảng đẩy mục "Giải thích
 * kết quả" ra sau ký tự 6.000). Cách rút, dừng ở tầng đầu tiên vừa trần:
 * <ol>
 *   <li>giữ nguyên;</li>
 *   <li>mỗi bảng chỉ còn dòng tiêu đề + {@value #TABLE_ROWS_FIRST} dòng đầu (bảng là số liệu lặp; tiêu đề và đoạn văn —
 *       nơi có giải trình — giữ nguyên, đúng thứ tự tài liệu);</li>
 *   <li>mỗi bảng còn tiêu đề + {@value #TABLE_ROWS_SECOND} dòng;</li>
 *   <li>tài liệu toàn chữ: giữ phần đầu và phần CUỐI (kết luận / kế hoạch thường nằm cuối), lược đoạn giữa.</li>
 * </ol>
 * Chỗ nào bị lược đều có dòng đánh dấu, để mô hình biết phần đó không có mặt chứ không phải bài thiếu.
 */
public final class EvidenceCondenser {

    static final int TABLE_ROWS_FIRST = 3;
    static final int TABLE_ROWS_SECOND = 1;
    /** Phần đầu chiếm bấy nhiêu trần khi phải lược đoạn giữa; còn lại dành cho phần cuối. */
    static final double HEAD_SHARE = 0.7;
    private static final int ALL_ROWS = -1;

    private EvidenceCondenser() {}

    /** @param truncated có lược / cắt phần nào không */
    public record Result(String text, boolean truncated) {}

    public static Result condense(List<Block> blocks, String note, int maxChars) {
        String full = render(blocks, ALL_ROWS, note);
        if (full.length() <= maxChars) return new Result(full, false);
        for (int keep : new int[]{TABLE_ROWS_FIRST, TABLE_ROWS_SECOND}) {
            String t = render(blocks, keep, note);
            if (t.length() <= maxChars) return new Result(t, true);
        }
        return new Result(headAndTail(render(blocks, TABLE_ROWS_SECOND, note), maxChars, full.length()), true);
    }

    /** Dựng chữ theo thứ tự tài liệu; các dòng bảng liền nhau là một bảng, giữ tiêu đề + {@code keepRows} dòng. */
    static String render(List<Block> blocks, int keepRows, String note) {
        List<String> lines = new ArrayList<>();
        int i = 0;
        while (i < blocks.size()) {
            if (!(blocks.get(i) instanceof Block.TableRow)) {
                add(lines, ParsedDocument.lineOf(blocks.get(i++)));
                continue;
            }
            int end = i;
            while (end < blocks.size() && blocks.get(end) instanceof Block.TableRow) end++;
            int rows = end - i;
            int keep = keepRows == ALL_ROWS ? rows : Math.min(rows, 1 + keepRows);
            for (int k = i; k < i + keep; k++) add(lines, ParsedDocument.lineOf(blocks.get(k)));
            if (rows > keep) lines.add("[… bảng còn " + (rows - keep) + " dòng, đã lược]");
            i = end;
        }
        if (note != null && !note.isBlank()) lines.add(note.strip());
        return String.join("\n", lines).strip();
    }

    /** Giữ đầu + cuối, lược đoạn giữa; cắt ở ranh giới dòng khi có dòng gần đó. */
    static String headAndTail(String text, int maxChars, int originalLength) {
        if (text.length() <= maxChars) return text;
        int headLen = (int) (maxChars * HEAD_SHARE);
        int tailLen = maxChars - headLen;
        int headEnd = snapBack(text, headLen);
        int tailStart = snapForward(text, text.length() - tailLen, tailLen / 5);
        if (tailStart <= headEnd) tailStart = headEnd;
        return text.substring(0, headEnd).stripTrailing()
                + "\n[… đã lược đoạn giữa: đọc " + maxChars + "/" + originalLength + " ký tự …]\n"
                + text.substring(tailStart).stripLeading();
    }

    private static int snapBack(String text, int pos) {
        int nl = text.lastIndexOf('\n', pos);
        return nl > pos - pos / 5 && nl > 0 ? nl : pos;
    }

    private static int snapForward(String text, int pos, int window) {
        int nl = text.indexOf('\n', pos);
        return nl >= 0 && nl < pos + window ? nl + 1 : pos;
    }

    private static void add(List<String> lines, String line) {
        if (line != null && !line.isBlank()) lines.add(line);
    }
}
