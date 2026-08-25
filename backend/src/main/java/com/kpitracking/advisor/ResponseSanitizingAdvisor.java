package com.kpitracking.advisor;


import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Lọc câu trả lời trước khi đưa cho người dùng: vá bảng Markdown bị vỡ, xoá tên tool nội bộ lọt ra.
 *
 * <p><b>KHÔNG còn là advisor của Spring AI</b>, dù tên lớp vẫn giữ. Từ khi ứng dụng tự sở hữu vòng
 * lặp agent, đường trả lời không đi qua {@code ChatClient} nên không advisor nào chạy được; phần
 * {@code adviseCall}/{@code adviseStream} vì thế đã bỏ. Nay {@code FinishNode} gọi thẳng
 * {@link #sanitizeText} một lần trên TOÀN VĂN.
 *
 * <p>Lọc trên toàn văn chứ không theo từng mẩu là bắt buộc: một tên tool bị cắt đôi qua hai mẩu
 * chữ sẽ lọt lưới nếu lọc theo mẩu.
 */
public class ResponseSanitizingAdvisor {

    /**
     * Pre-compiled matcher for internal tool-name leaks. Matches an (optional) lead-in verb and an
     * (optional) "tool" noun followed by a known tool name (with or without surrounding backticks),
     * e.g. "Sử dụng công cụ `compare_org_units`", "dùng get_kpi_detail", "`search_users`".
     * {@code null} when no tool names were supplied (redaction disabled).
     */
    private final Pattern toolLeakPattern;

    /** Replacement phrase shown to the user in place of any leaked internal tool name. */
    private static final String TOOL_REPLACEMENT = "tính năng tương ứng";

    public ResponseSanitizingAdvisor(Collection<String> toolNames) {
        this.toolLeakPattern = buildToolLeakPattern(toolNames);
    }

    private static Pattern buildToolLeakPattern(Collection<String> toolNames) {
        if (toolNames == null || toolNames.isEmpty()) {
            return null;
        }
        // Longest names first so e.g. "get_kpi_period_breakdown" matches before "get_kpi".
        List<String> sorted = new ArrayList<>(toolNames);
        sorted.removeIf(n -> n == null || n.isBlank());
        if (sorted.isEmpty()) {
            return null;
        }
        sorted.sort((a, b) -> Integer.compare(b.length(), a.length()));
        StringBuilder alt = new StringBuilder();
        for (int i = 0; i < sorted.size(); i++) {
            if (i > 0) alt.append('|');
            alt.append(Pattern.quote(sorted.get(i).trim()));
        }
        String regex = "(?iu)(?:\\b(?:bằng cách|hãy|nên|có thể)\\s+)?"
                + "(?:(?:công cụ|tool|hàm|chức năng|function)\\s+)?"
                + "`?\\b(?:" + alt + ")\\b`?";
        return Pattern.compile(regex);
    }

    /**
     * Lọc toàn văn — dùng cho đường LUỒNG, nơi advisor không lọc được vì chữ về theo từng mẩu.
     * {@code FinishNode} gọi một lần sau khi đã gom đủ văn bản.
     */
    public String sanitizeText(String result) {
        return sanitize(result);
    }

    /**
     * Dấu xuống dòng BÊN TRONG một ô bảng Markdown.
     *
     * <p>Model viết danh sách gạch đầu dòng trong ô bảng bằng {@code <br>} — cách duy nhất xuống
     * dòng được trong ô. Nhưng một dấu xuống dòng THẬT sẽ làm VỠ bảng, còn để nguyên {@code <br>}
     * thì client nuốt mất (không bật HTML thô) khiến hai gạch đầu dòng dính liền.
     *
     * <p>Bản trước nối bằng {@code " / "}, và đó chính là chuỗi chạy dài {@code "• A / • B / • C"}
     * mà người dùng thấy — không đọc nổi. Nay dùng LINE SEPARATOR (U+2028): Markdown coi là ký tự
     * thường nên bảng không vỡ, client tách ra thành dòng (xem {@code AnswerMarkdown}), và nếu chỗ
     * nào quên xử lý thì nó cũng chỉ là khoảng trắng chứ không hiện rác ra màn hình.
     */
    public static final String CELL_LINE_BREAK = "\u2028";

    private String sanitize(String result) {
        if (result == null) return "";
        result = repairTableRows(result);
        String[] lines = result.split("\n", -1);
        for (int i = 0; i < lines.length; i++) {
            if (lines[i].stripLeading().startsWith("|")) {
                lines[i] = lines[i].replaceAll("(?i)<br\\s*/?>", CELL_LINE_BREAK);
            } else {
                lines[i] = lines[i].replaceAll("(?i)<br\\s*/?>", "\n");
            }
        }
        result = String.join("\n", lines);
        result = result.replaceAll("(?m)(\\|[^\\n]+)\\n{2,}(?=\\|)", "$1\n");
        result = redactToolNames(result);
        result = redactFieldKeys(result);
        return result.strip();
    }

    /** Dòng phân cách của bảng Markdown, vd {@code |-----|------|}. */
    private static final Pattern TABLE_SEPARATOR = Pattern.compile("[|\\s:-]+");

    /** Đầu dòng dạng danh sách mà model hay chèn nhầm vào bảng: "1. ", "2) ", "- ", "* ". */
    private static final Pattern LEADING_LIST_MARKER = Pattern.compile("^(?:\\d+[.)]|[-*+])\\s+");

    private static boolean isTableSeparator(String line) {
        String s = line.strip();
        return s.startsWith("|") && s.indexOf('-') >= 0 && TABLE_SEPARATOR.matcher(s).matches();
    }

    private static int countPipes(String s) {
        int n = 0;
        for (int i = 0; i < s.length(); i++) {
            if (s.charAt(i) == '|') n++;
        }
        return n;
    }

    /**
     * Vá bảng Markdown bị hỏng. Model nhỏ đôi khi viết đúng dòng tiêu đề + dòng phân cách nhưng
     * các dòng dữ liệu lại THIẾU dấu {@code |} mở đầu (thường bị thay bằng "1.", "2.", "-"), khiến
     * trình render hiện tiêu đề thành bảng còn dữ liệu rơi xuống thành danh sách — bảng vỡ đôi.
     *
     * <p>Chỉ sửa dòng nằm ngay trong một bảng đã hợp lệ (tiêu đề + phân cách) VÀ có đúng số cột
     * như tiêu đề sau khi bỏ ký tự đánh số thừa; mọi trường hợp khác để nguyên, nên không có
     * nguy cơ biến văn bản thường thành bảng.
     */
    private String repairTableRows(String text) {
        if (text == null || text.indexOf('|') < 0) return text;
        String[] lines = text.split("\n", -1);
        int headerPipes = -1; // > 0 nghĩa là đang ở trong một bảng
        for (int i = 0; i < lines.length; i++) {
            String stripped = lines[i].strip();

            if (headerPipes < 0) {
                if (stripped.startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
                    headerPipes = countPipes(stripped);
                    i++; // bỏ qua dòng phân cách
                }
                continue;
            }

            if (stripped.isEmpty()) {          // dòng trống -> kết thúc bảng
                headerPipes = -1;
                continue;
            }
            if (stripped.startsWith("|")) continue; // dòng bảng vốn đã đúng

            String candidate = LEADING_LIST_MARKER.matcher(stripped).replaceFirst("");
            if (candidate.endsWith("|") && countPipes(candidate) == headerPipes - 1) {
                lines[i] = "| " + candidate;    // trả lại dấu | mở đầu bị thiếu
            } else {
                headerPipes = -1;               // không phải dòng bảng -> bảng đã hết
            }
        }
        return String.join("\n", lines);
    }

    /**
     * Removes leaked internal tool names from user-facing text, replacing each leak (and its
     * optional "công cụ/tool" scaffolding) with a neutral business phrase so the sentence still
     * reads naturally — e.g. "Sử dụng công cụ `compare_org_units` để…" → "Sử dụng tính năng
     * tương ứng để…". Only known tool names are touched, avoiding false positives.
     */
    private String redactToolNames(String text) {
        if (toolLeakPattern == null || text == null || text.isEmpty()) {
            return text;
        }
        String redacted = toolLeakPattern.matcher(text).replaceAll(TOOL_REPLACEMENT);
        // Tidy up artifacts left behind: empty backticks and doubled spaces.
        redacted = redacted.replaceAll("`\\s*`", "");
        redacted = redacted.replaceAll("[ \\t]{2,}", " ");
        return redacted;
    }

    /**
     * Removes leaked internal JSON field/param keys that the model occasionally parrots despite
     * the confidentiality rule. Such keys surface as a bare camelCase/lowercase ASCII identifier
     * wrapped in backticks (e.g. {@code `managers`}, {@code `fullName`}) — Vietnamese business
     * text never looks like that, so this is safe. First drops a parenthetical aside built around
     * such a key (cleanest — e.g. "(được liệt kê trong `managers` của …)"), then strips any
     * remaining standalone leak, then tidies whitespace/punctuation. UPPER-CASE tokens (e.g.
     * status codes {@code `APPROVED`}) are intentionally left untouched.
     */
    private String redactFieldKeys(String text) {
        if (text == null || text.isEmpty()) return text;
        // "(… `managers` …)" -> "" : an aside that only exists to reference an internal key.
        String out = text.replaceAll("\\s*\\([^()]*`[a-z][A-Za-z0-9_]*`[^()]*\\)", "");
        // Any leftover standalone `identifier` leak -> drop the backticked token.
        out = out.replaceAll("`[a-z][A-Za-z0-9_]*`", "");
        // Tidy: collapse doubled spaces and remove space before punctuation.
        out = out.replaceAll("[ \\t]{2,}", " ").replaceAll("\\s+([.,;:])", "$1");
        return out;
    }
}
