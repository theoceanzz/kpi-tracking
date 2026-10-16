package com.kpitracking.service.email;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.util.HtmlUtils;

import java.util.Map;
import java.util.regex.Pattern;

/**
 * Dựng HTML thân thư từ mảng khối BlockNote — cùng trình soạn với tài liệu trực tuyến (thư người dùng tự soạn, VD gửi
 * tài liệu qua email).
 *
 * <p>Không bao giờ nhận HTML từ trình duyệt: chỉ đọc JSON và tự sinh thẻ theo DANH SÁCH TRẮNG — loại khối / kiểu chữ lạ
 * thì chỉ lấy chữ bên trong. Chữ luôn được escape, link chỉ nhận {@code http(s):} / {@code mailto:}, màu chỉ nhận TÊN trong
 * bảng màu của BlockNote (ánh xạ sang mã hex ở đây), căn lề chỉ nhận left/center/right/justify. Style viết inline vì trình
 * đọc thư bỏ thẻ {@code <style>}.
 */
public final class MailDocRenderer {

    /** Giới hạn để một JSON lồng sâu / quá nhiều khối không làm treo luồng gửi. */
    static final int MAX_DEPTH = 24;
    static final int MAX_NODES = 5000;

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Pattern HREF = Pattern.compile("^(https?://|mailto:)[^\\s\"'<>]+$", Pattern.CASE_INSENSITIVE);
    private static final Pattern IMAGE_URL = Pattern.compile("^https://[^\\s\"'<>]+$", Pattern.CASE_INSENSITIVE);
    private static final Pattern ALIGN = Pattern.compile("^(left|center|right|justify)$");

    /** Bảng màu mặc định của BlockNote (giao diện sáng) — trùng `editor/colors.ts` phía frontend. */
    private static final Map<String, String> TEXT = Map.of(
            "gray", "#9b9a97", "brown", "#64473a", "red", "#e03e3e", "orange", "#d9730d", "yellow", "#dfab01",
            "green", "#4d6461", "blue", "#0b6e99", "purple", "#6940a5", "pink", "#ad1a72");
    private static final Map<String, String> BACKGROUND = Map.of(
            "gray", "#ebeced", "brown", "#e9e5e3", "red", "#fbe4e4", "orange", "#f6e9d9", "yellow", "#fbf3db",
            "green", "#ddedea", "blue", "#ddebf1", "purple", "#eae4f2", "pink", "#f4dfeb");

    /** Phông chữ cho phép — đúng giá trị CSS mà `editor/formatting.ts` (FONT_FAMILIES) lưu vào tài liệu. */
    private static final java.util.Set<String> FONT_FAMILIES = java.util.Set.of(
            "Arial, Helvetica, sans-serif", "\"Times New Roman\", Times, serif", "Georgia, serif",
            "Verdana, Geneva, sans-serif", "Tahoma, Geneva, sans-serif", "\"Trebuchet MS\", sans-serif",
            "\"Courier New\", Courier, monospace");
    private static final Pattern FONT_SIZE = Pattern.compile("^(\\d{1,2})px$");

    private static final String BASE = "color:#1e293b;font-size:15px;line-height:1.6;";

    private MailDocRenderer() {}

    /** JSON không đọc được / vượt giới hạn. */
    public static class InvalidDocException extends RuntimeException {
        InvalidDocException(String message) {
            super(message);
        }
    }

    public static String render(String json) {
        JsonNode root;
        try {
            root = JSON.readTree(json);
        } catch (Exception e) {
            throw new InvalidDocException("not json");
        }
        if (root == null || !root.isArray()) throw new InvalidDocException("not a block list");
        StringBuilder out = new StringBuilder();
        new Walker(out).blocks(root, 0);
        return out.toString();
    }

    private static final class Walker {
        private final StringBuilder out;
        private int nodes;

        Walker(StringBuilder out) {
            this.out = out;
        }

        /** Các khối liền nhau; mục danh sách cùng loại liền nhau gom vào một {@code <ul>/<ol>}. */
        void blocks(JsonNode list, int depth) {
            if (depth > MAX_DEPTH) throw new InvalidDocException("too deep");
            String openList = null;
            for (JsonNode b : list) {
                String type = b.path("type").asText("");
                String listTag = switch (type) {
                    case "bulletListItem" -> "ul";
                    case "numberedListItem" -> "ol";
                    default -> null;
                };
                if (openList != null && !openList.equals(listTag)) {
                    out.append("</").append(openList).append('>');
                    openList = null;
                }
                if (listTag != null && openList == null) {
                    out.append('<').append(listTag).append(" style='margin:0 0 12px;padding-left:24px;").append(BASE).append("'>");
                    openList = listTag;
                }
                block(b, type, depth);
            }
            if (openList != null) out.append("</").append(openList).append('>');
        }

        private void block(JsonNode b, String type, int depth) {
            if (++nodes > MAX_NODES) throw new InvalidDocException("too large");
            String style = blockStyle(b.path("props"));
            switch (type) {
                case "heading" -> {
                    int level = Math.max(1, Math.min(3, b.path("props").path("level").asInt(1)));
                    String size = level == 1 ? "22px" : level == 2 ? "19px" : "17px";
                    out.append("<h").append(level).append(" style='margin:16px 0 8px;font-weight:700;color:#0f172a;font-size:")
                       .append(size).append(';').append(style).append("'>");
                    inline(b.get("content"));
                    out.append("</h").append(level).append('>');
                    children(b, depth);
                }
                case "bulletListItem", "numberedListItem" -> {
                    out.append("<li style='margin:0 0 4px;").append(style).append("'>");
                    inline(b.get("content"));
                    JsonNode kids = b.get("children");
                    if (kids != null && kids.isArray() && !kids.isEmpty()) blocks(kids, depth + 1);
                    out.append("</li>");
                }
                case "checkListItem" -> {
                    boolean checked = b.path("props").path("checked").asBoolean(false);
                    out.append("<p style='margin:0 0 6px;").append(BASE).append(style).append("'>")
                       .append(checked ? "&#9745; " : "&#9744; ");
                    inline(b.get("content"));
                    out.append("</p>");
                    children(b, depth);
                }
                case "quote" -> {
                    out.append("<blockquote style='margin:0 0 12px;padding:4px 0 4px 12px;border-left:3px solid #cbd5e1;color:#475569;")
                       .append(style).append("'>");
                    inline(b.get("content"));
                    out.append("</blockquote>");
                    children(b, depth);
                }
                case "codeBlock" -> {
                    out.append("<pre style='margin:0 0 12px;padding:12px;border-radius:8px;background:#f1f5f9;color:#0f172a;font-size:13px;white-space:pre-wrap;'>");
                    inlineText(b.get("content"));
                    out.append("</pre>");
                }
                case "divider" -> out.append("<hr style='border:none;border-top:1px solid #e2e8f0;margin:16px 0;'/>");
                case "table" -> table(b.path("content"));
                case "image" -> image(b.path("props"), style);
                // Đoạn văn và mọi loại khối không có trong danh sách (tệp, video…): chỉ lấy chữ.
                default -> {
                    out.append("<p style='margin:0 0 12px;").append(BASE).append(style).append("'>");
                    inline(b.get("content"));
                    out.append("</p>");
                    children(b, depth);
                }
            }
        }

        /** Khối con (thụt lề) của khối không phải danh sách. */
        private void children(JsonNode b, int depth) {
            JsonNode kids = b.get("children");
            if (kids == null || !kids.isArray() || kids.isEmpty()) return;
            out.append("<div style='margin-left:24px;'>");
            blocks(kids, depth + 1);
            out.append("</div>");
        }

        /** Ảnh: chỉ link https (ảnh đã tải lên kho công khai) — không data:, không http, không javascript:. */
        private void image(JsonNode props, String style) {
            String url = text(props, "url");
            if (url == null || !IMAGE_URL.matcher(url).matches()) return;
            int width = Math.min(560, Math.max(40, props.path("previewWidth").asInt(560)));
            String caption = text(props, "caption");
            String alt = caption != null && !caption.isEmpty() ? caption : (text(props, "name") == null ? "" : text(props, "name"));
            out.append("<div style='margin:0 0 12px;").append(style).append("'>")
               .append("<img src='").append(esc(url)).append("' alt='").append(esc(alt)).append("' width='").append(width)
               .append("' style='max-width:100%;height:auto;border-radius:6px;display:inline-block;'/>");
            if (caption != null && !caption.isEmpty()) {
                out.append("<div style='font-size:13px;color:#64748b;margin-top:4px;'>").append(esc(caption)).append("</div>");
            }
            out.append("</div>");
        }

        private void table(JsonNode content) {
            JsonNode rows = content.get("rows");
            if (rows == null || !rows.isArray()) return;
            out.append("<table style='border-collapse:collapse;margin:0 0 12px;").append(BASE).append("'>");
            for (JsonNode row : rows) {
                if (++nodes > MAX_NODES) throw new InvalidDocException("too large");
                out.append("<tr>");
                for (JsonNode cell : row.path("cells")) {
                    out.append("<td style='border:1px solid #cbd5e1;padding:6px 10px;vertical-align:top;'>");
                    // Ô bảng: mảng chữ (bản cũ) hoặc {type: tableCell, content: [...]}.
                    inline(cell.isArray() ? cell : cell.get("content"));
                    out.append("</td>");
                }
                out.append("</tr>");
            }
            out.append("</table>");
        }

        private void inline(JsonNode content) {
            if (content == null || !content.isArray()) return;
            for (JsonNode c : content) {
                if (++nodes > MAX_NODES) throw new InvalidDocException("too large");
                String type = c.path("type").asText("");
                if ("link".equals(type)) {
                    String href = text(c, "href");
                    boolean ok = href != null && HREF.matcher(href).matches();
                    if (ok) {
                        out.append("<a href='").append(esc(href))
                           .append("' style='color:#2563eb;text-decoration:underline;' target='_blank' rel='noopener noreferrer'>");
                    }
                    inline(c.get("content"));
                    if (ok) out.append("</a>");
                } else {
                    styledText(c);
                }
            }
        }

        /** Chỉ chữ, bỏ mọi kiểu — cho khối mã. */
        private void inlineText(JsonNode content) {
            if (content == null || !content.isArray()) return;
            for (JsonNode c : content) {
                if ("link".equals(c.path("type").asText(""))) inlineText(c.get("content"));
                else out.append(esc(c.path("text").asText("")));
            }
        }

        private void styledText(JsonNode c) {
            String text = esc(c.path("text").asText("")).replace("\n", "<br/>");
            JsonNode s = c.path("styles");
            StringBuilder open = new StringBuilder();
            StringBuilder close = new StringBuilder();
            wrapIf(s.path("bold").asBoolean(false), "strong", open, close);
            wrapIf(s.path("italic").asBoolean(false), "em", open, close);
            wrapIf(s.path("underline").asBoolean(false), "u", open, close);
            wrapIf(s.path("strike").asBoolean(false), "s", open, close);
            String css = "";
            String color = TEXT.get(s.path("textColor").asText(""));
            if (color != null) css += "color:" + color + ";";
            String bg = BACKGROUND.get(s.path("backgroundColor").asText(""));
            if (bg != null) css += "background-color:" + bg + ";";
            java.util.regex.Matcher size = FONT_SIZE.matcher(s.path("fontSize").asText(""));
            if (size.matches() && Integer.parseInt(size.group(1)) >= 6) css += "font-size:" + size.group(1) + "px;";
            String family = s.path("fontFamily").asText("");
            // Tên phông có dấu " — viết thành &quot; cho khỏi gãy thuộc tính style.
            if (FONT_FAMILIES.contains(family)) css += "font-family:" + family.replace("\"", "&quot;") + ";";
            if (s.path("code").asBoolean(false)) css += "font-family:monospace;background-color:#f1f5f9;padding:0 3px;border-radius:3px;";
            if (!css.isEmpty()) {
                open.append("<span style='").append(css).append("'>");
                close.insert(0, "</span>");
            }
            out.append(open).append(text).append(close);
        }

        private static void wrapIf(boolean on, String tag, StringBuilder open, StringBuilder close) {
            if (!on) return;
            open.append('<').append(tag).append('>');
            close.insert(0, "</" + tag + ">");
        }

        /** Màu chữ / nền / căn lề của cả khối — chỉ giá trị trong danh sách. */
        private static String blockStyle(JsonNode props) {
            StringBuilder css = new StringBuilder();
            String align = text(props, "textAlignment");
            if (align != null && ALIGN.matcher(align).matches() && !"left".equals(align)) css.append("text-align:").append(align).append(';');
            String color = TEXT.get(props.path("textColor").asText(""));
            if (color != null) css.append("color:").append(color).append(';');
            String bg = BACKGROUND.get(props.path("backgroundColor").asText(""));
            if (bg != null) css.append("background-color:").append(bg).append(';');
            return css.toString();
        }

        private static String text(JsonNode n, String field) {
            JsonNode v = n.get(field);
            return v != null && v.isTextual() ? v.asText().trim() : null;
        }

        private static String esc(String s) {
            return HtmlUtils.htmlEscape(s, "UTF-8");
        }
    }
}
