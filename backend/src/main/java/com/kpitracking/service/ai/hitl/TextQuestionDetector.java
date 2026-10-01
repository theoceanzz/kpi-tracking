package com.kpitracking.service.ai.hitl;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Nhận ra câu trả lời mà TOÀN BỘ chỉ là một câu hỏi xin thông tin, để biến nó thành thẻ hỏi giữa lượt.
 *
 * <p>Model không phải lúc nào cũng gọi {@code ask_user}: nó hay viết câu hỏi ra chữ rồi kết thúc lượt
 * (vd "Bạn muốn đặt mục tiêu tối thiểu là bao nhiêu? - 99.0% - 99.5% - 98.0%"). Người dùng khi đó phải
 * gõ lại và lượt mới chạy từ đầu. Bắt ở đây thì câu hỏi ấy cũng thành thẻ bấm được.
 *
 * <p>Cố ý BẢO THỦ — nhận nhầm một câu trả lời thật thành câu hỏi thì người dùng mất câu trả lời. Không
 * nhận: có bảng, dài, lời từ chối, lời mời "bạn có muốn … không?", danh sách quá 5 mục (là nội dung,
 * không phải lựa chọn).
 */
public final class TextQuestionDetector {

    private TextQuestionDetector() {}

    /** Phần chữ (ngoài danh sách lựa chọn) dài hơn thế này là một câu trả lời có kèm câu hỏi, không phải câu hỏi. */
    static final int MAX_PROSE_CHARS = 500;
    static final int MAX_OPTIONS = 5;
    /**
     * Dòng nhắc SAU danh sách lựa chọn ("Vui lòng chọn một trong các đội trên", "(Bạn có thể chọn một
     * hoặc nhiều)") — model hay thêm (đo được ở H02/H05). Ngắn thế này là lời nhắc, dài hơn là nội dung.
     */
    static final int MAX_TAIL_CHARS = 200;

    private static final Pattern BULLET = Pattern.compile("^\\s*(?:[-*•]|\\d+[.)])\\s+(.+?)\\s*$");
    private static final Pattern REFUSAL = Pattern.compile(
            "(không có quyền|ngoài phạm vi|không tồn tại|không tìm thấy|xin lỗi)",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    /** Lời mời xem thêm sau khi đã trả lời — không phải xin thông tin để làm tiếp. */
    private static final Pattern OFFER = Pattern.compile(
            "(có muốn|có cần|muốn mình|cần mình|mình có thể)[^?]*\\?\\s*$",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern MULTI = Pattern.compile(
            "(chọn (được )?nhiều|một hoặc nhiều|các (đơn vị|mục|người) nào)",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    /** @return câu hỏi (kèm lựa chọn nếu có), hoặc {@code null} khi câu trả lời không phải một câu hỏi thuần */
    public static PendingQuestion.Item detect(String answer) {
        if (answer == null || answer.isBlank()) return null;
        String[] lines = answer.strip().split("\\R");
        boolean hasTable = false;
        for (String l : lines) {
            if (l.stripLeading().startsWith("|")) { hasTable = true; break; }
        }
        if (hasTable) lines = choiceTableAsBullets(lines);
        if (lines == null) return null;   // bảng có số liệu = là câu trả lời, không phải câu hỏi

        // Danh sách lựa chọn = khối gạch đầu dòng CUỐI CÙNG; sau nó chỉ được có một lời nhắc ngắn.
        int lastBullet = -1;
        for (int i = lines.length - 1; i >= 0; i--) {
            if (BULLET.matcher(lines[i]).matches()) { lastBullet = i; break; }
        }
        int firstOption = lines.length;
        StringBuilder tail = new StringBuilder();
        if (lastBullet >= 0) {
            firstOption = lastBullet;
            while (firstOption > 0 && (lines[firstOption - 1].isBlank() || BULLET.matcher(lines[firstOption - 1]).matches())) {
                firstOption--;
            }
            for (int i = lastBullet + 1; i < lines.length; i++) {
                if (!lines[i].isBlank()) tail.append(' ').append(lines[i].strip());
            }
            if (tail.length() > MAX_TAIL_CHARS) return null;
        }
        List<PendingQuestion.Option> options = new ArrayList<>();
        for (int i = firstOption; i <= lastBullet; i++) {
            Matcher m = BULLET.matcher(lines[i]);
            if (!m.matches()) continue;
            String label = clean(m.group(1));
            if (!label.isEmpty()) options.add(PendingQuestion.Option.of(label, label));
        }
        if (options.size() > MAX_OPTIONS) return null;

        StringBuilder prose = new StringBuilder();
        for (int i = 0; i < firstOption; i++) {
            if (BULLET.matcher(lines[i]).matches()) return null;   // danh sách giữa bài = nội dung
            if (prose.length() > 0) prose.append(' ');
            prose.append(lines[i].strip());
        }
        // Không có danh sách: cả câu trả lời là phần chữ (tail rỗng). Câu hỏi thật đôi khi nằm ở lời
        // nhắc sau danh sách ("Các đơn vị: - A - B  Bạn muốn xem đơn vị nào?") -> ghép vào.
        String lead = clean(prose.toString());
        String after = clean(tail.toString());
        String hintInLead = "";
        Matcher h = TRAILING_HINT.matcher(lead);
        if (h.find() && lead.substring(0, h.start()).strip().endsWith("?")) {
            hintInLead = h.group(1);
            lead = lead.substring(0, h.start()).strip();
        }
        String question = !lead.endsWith("?") && after.endsWith("?") ? (lead + " " + after).strip() : lead;
        if (question.isEmpty() || question.length() > MAX_PROSE_CHARS) return null;
        if (REFUSAL.matcher(question).find()) return null;

        boolean endsAsQuestion = question.endsWith("?") || (!options.isEmpty() && question.endsWith(":"));
        if (!endsAsQuestion) return null;
        if (OFFER.matcher(question).find()) return null;

        String hint = question + " " + tail + " " + hintInLead;
        return new PendingQuestion.Item(question, options, MULTI.matcher(hint).find());
    }

    /**
     * Lời nhắc trong ngoặc ngay sau câu hỏi: "Bạn muốn so sánh team nào? (Bạn có thể chọn nhiều team)"
     * (đo được ở H05). Tách ra để câu hỏi vẫn kết thúc bằng "?", còn lời nhắc dùng để đoán chọn nhiều.
     */
    private static final Pattern TRAILING_HINT = Pattern.compile("\\s*[*_]*\\(([^()]{1,160})\\)[*_]*\\s*$");

    private static final Pattern INDEX_CELL = Pattern.compile("^\\d{1,2}[.)]?$");
    private static final Pattern SEPARATOR_ROW = Pattern.compile("^\\|[\\s:|-]+\\|?$");

    /**
     * Model đôi khi bày lựa chọn thành BẢNG ("| Lựa chọn | Tên nhóm |" rồi mỗi dòng một nhóm — đo được
     * ở D03). Chỉ nhận bảng LỰA CHỌN THUẦN: mỗi dòng đúng một ô chữ (ngoài ô số thứ tự), không số
     * liệu nào khác — khi đó đổi các dòng thành gạch đầu dòng để phần còn lại xử lý như danh sách.
     * Bảng kèm số liệu ("| Team Backend | 3 |") là câu trả lời, trả {@code null}.
     */
    private static String[] choiceTableAsBullets(String[] lines) {
        List<String> out = new ArrayList<>();
        boolean header = true;
        for (String l : lines) {
            String t = l.strip();
            if (!t.startsWith("|")) { out.add(l); continue; }
            if (SEPARATOR_ROW.matcher(t).matches()) continue;
            if (header) { header = false; continue; }   // dòng tiêu đề
            List<String> labels = new ArrayList<>();
            String[] cells = t.replaceAll("^\\||\\|$", "").split("\\|");
            for (int i = 0; i < cells.length; i++) {
                String c = clean(cells[i]);
                if (c.isEmpty()) continue;
                // Chỉ ô ĐẦU mới có thể là số thứ tự; số ở ô khác là số liệu ("| Phòng IT | 5 |").
                if (i == 0 && INDEX_CELL.matcher(c).matches()) continue;
                labels.add(c);
            }
            if (labels.size() != 1) return null;
            if (labels.get(0).matches(".*\\d.*") && !labels.get(0).matches(".*\\p{L}.*")) return null;
            out.add("- " + labels.get(0));
        }
        return out.toArray(String[]::new);
    }

    /** Bỏ định dạng Markdown hay gặp trong câu hỏi/lựa chọn: đậm, nghiêng, mã. */
    private static String clean(String s) {
        return s.replace("**", "").replace("__", "").replace("`", "").strip();
    }
}
