package com.kpitracking.service.email;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MailDocRendererTest {

    private static String block(String type, String props, String content, String children) {
        return "{\"type\":\"" + type + "\",\"props\":{" + props + "},\"content\":[" + content + "],\"children\":[" + children + "]}";
    }

    private static String text(String t, String styles) {
        return "{\"type\":\"text\",\"text\":\"" + t + "\",\"styles\":{" + styles + "}}";
    }

    @Test
    @DisplayName("Định dạng thường: tiêu đề, đậm/nghiêng/gạch chân, màu theo tên, link, danh sách gom nhóm + lồng, căn giữa")
    void formats() {
        String html = MailDocRenderer.render("["
                + block("heading", "\"level\":2", text("Báo giá", ""), "") + ","
                + block("paragraph", "\"textAlignment\":\"center\"",
                        text("Đậm", "\"bold\":true,\"italic\":true") + "," + text("đỏ", "\"textColor\":\"red\",\"backgroundColor\":\"yellow\""), "") + ","
                + block("bulletListItem", "", text("một", "\"underline\":true"), block("bulletListItem", "", text("con", ""), "")) + ","
                + block("bulletListItem", "", text("hai", ""), "") + ","
                + block("numberedListItem", "", text("số", ""), "") + ","
                + block("paragraph", "", "{\"type\":\"link\",\"href\":\"https://keygo.vn\",\"content\":[" + text("KeyGo", "") + "]}", "")
                + "]");
        assertThat(html)
                .contains("<h2 ").contains("Báo giá</h2>")
                .contains("text-align:center;")
                .contains("<strong><em>Đậm</em></strong>")
                .contains("<span style='color:#e03e3e;background-color:#fbf3db;'>đỏ</span>")
                .contains("<a href='https://keygo.vn'");
        // Hai mục chấm liền nhau ⇒ MỘT <ul> (mục con lồng bên trong), rồi mới tới <ol>.
        assertThat(html.indexOf("<ul")).isLessThan(html.indexOf("<u>một</u>"));
        assertThat(html.split("<ul", -1)).hasSize(3); // ul ngoài + ul của mục con
        assertThat(html.indexOf("hai")).isLessThan(html.indexOf("<ol"));
    }

    @Test
    @DisplayName("Ảnh https hiện thành <img> co theo khung thư, kèm chú thích; căn giữa giữ nguyên")
    void image() {
        String html = MailDocRenderer.render("["
                + block("image", "\"url\":\"https://res.cloudinary.com/x/a.png\",\"caption\":\"Sơ đồ <b>\",\"previewWidth\":900,\"textAlignment\":\"center\"", "", "")
                + "]");
        assertThat(html)
                .contains("<img src='https://res.cloudinary.com/x/a.png'")
                .contains("width='560'").contains("max-width:100%")
                .contains("text-align:center;")
                .contains("Sơ đồ &lt;b&gt;").doesNotContain("<b>");
    }

    @Test
    @DisplayName("Phông và cỡ chữ: chỉ nhận phông trong danh sách và cỡ dạng số px")
    void fonts() {
        String html = MailDocRenderer.render("["
                + block("paragraph", "", text("to", "\"fontSize\":\"24px\",\"fontFamily\":\"Georgia, serif\"") + ","
                        + text("tnr", "\"fontFamily\":\"\\\"Times New Roman\\\", Times, serif\"") + ","
                        + text("x", "\"fontSize\":\"24px;color:red\",\"fontFamily\":\"Comic Sans; x:y\""), "")
                + "]");
        assertThat(html)
                .contains("<span style='font-size:24px;font-family:Georgia, serif;'>to</span>")
                .contains("font-family:&quot;Times New Roman&quot;, Times, serif;'>tnr")
                .contains(">x<").doesNotContain("color:red").doesNotContain("Comic");
    }

    @Test
    @DisplayName("Chữ luôn escape; khối lạ chỉ giữ chữ; link javascript:, màu / căn lề ngoài danh sách đều bị bỏ")
    void hostileInput() {
        String html = MailDocRenderer.render("["
                + block("paragraph", "", text("<script>alert(1)</script>", ""), "") + ","
                + block("video", "\"url\":\"https://evil\"", text("chữ", ""), "") + ","
                + block("image", "\"url\":\"javascript:alert(1)\"", "", "") + ","
                + block("image", "\"url\":\"data:image/png;base64,AAAA\"", "", "") + ","
                + block("paragraph", "", "{\"type\":\"link\",\"href\":\"javascript:alert(1)\",\"content\":[" + text("x", "") + "]}", "") + ","
                + block("paragraph", "\"textColor\":\"red;background:url(x)\"", text("y", "\"textColor\":\"#000;position:fixed\""), "") + ","
                + block("paragraph", "\"textAlignment\":\"left;position:fixed\"", text("z", ""), "")
                + "]");
        assertThat(html)
                .contains("&lt;script&gt;alert(1)&lt;/script&gt;").doesNotContain("<script")
                .contains("chữ").doesNotContain("<img").doesNotContain("evil").doesNotContain("data:image")
                .doesNotContain("javascript:").contains(">x<")
                .doesNotContain("url(x)").doesNotContain("position:fixed");
    }

    @Test
    @DisplayName("Không phải mảng khối / lồng quá sâu ⇒ InvalidDocException")
    void invalid() {
        assertThatThrownBy(() -> MailDocRenderer.render("<p>html</p>")).isInstanceOf(MailDocRenderer.InvalidDocException.class);
        assertThatThrownBy(() -> MailDocRenderer.render("{\"type\":\"doc\"}")).isInstanceOf(MailDocRenderer.InvalidDocException.class);
        String deep = "[";
        for (int i = 0; i < 40; i++) deep += "{\"type\":\"quote\",\"children\":[";
        deep += "]}".repeat(40) + "]";
        String finalDeep = deep;
        assertThatThrownBy(() -> MailDocRenderer.render(finalDeep)).isInstanceOf(MailDocRenderer.InvalidDocException.class);
    }
}
