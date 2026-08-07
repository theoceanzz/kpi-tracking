package com.kpitracking.service.email;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Danh mục toàn bộ email hệ thống có thể gửi: nhãn hiển thị, các biến dùng được,
 * biến BẮT BUỘC, và nội dung mặc định.
 *
 * <p>Đây là nguồn sự thật duy nhất — thêm loại mail mới thì khai báo ở đây, giao diện
 * cấu hình sẽ tự có thêm mục tương ứng mà không phải sửa gì ở frontend.
 *
 * <p>Nội dung mặc định là HTML thân email. Các thuộc tính {@code data-email="..."} cho
 * trình soạn ở frontend nhận ra đâu là nút bấm / ô mã / bảng thông tin / khung nhấn mạnh
 * và mở lên sửa bằng giao diện — sửa xong nó dựng lại đúng HTML này. Class CSS phải khớp
 * với {@link EmailLayout}.
 *
 * <p>{@code requiredVariables} là chốt an toàn: mail OTP mà thiếu {@code {{ma_otp}}} thì
 * người dùng sẽ không bao giờ đăng nhập lại được, nên hệ thống từ chối lưu.
 */
public final class EmailTemplateCatalog {

    private EmailTemplateCatalog() {}

    @Getter
    @AllArgsConstructor
    public static class TemplateDef {
        private final String code;
        private final String label;
        private final String description;
        /** Nhóm để gom mục trên giao diện. */
        private final String group;
        /** Tiêu đề hiện trên dải header của mail. */
        private final String headerTitle;
        private final String defaultSubject;
        private final String defaultBody;
        /** Tên biến → mô tả, hiện thành các chip bấm-để-chèn trên giao diện. */
        private final Map<String, String> variables;
        private final List<String> requiredVariables;

        /**
         * Ai làm chủ công tắc bật/tắt gửi của loại mail này — xem {@link #CONTROL_SELF},
         * {@link #CONTROL_NOTIFICATION_SETTINGS}, {@link #CONTROL_LOCKED}.
         * Suy ra từ mã và nhóm nên không phải khai lại ở từng mục.
         */
        public String getEnabledControl() {
            if (LOCKED_CODES.contains(code)) return CONTROL_LOCKED;
            if (GROUP_KPI.equals(group)) return CONTROL_NOTIFICATION_SETTINGS;
            return CONTROL_SELF;
        }
    }

    /** Bật/tắt ngay tại màn hình template. */
    public static final String CONTROL_SELF = "self";
    /**
     * Công tắc thuộc về tab "Thiết lập thông báo" (OrgNotificationConfig) — nơi đó
     * quản cả kênh email lẫn chuông trong hệ thống. Có thêm công tắc ở đây nữa thì
     * hai chỗ cùng chặn được một thứ, người dùng tắt bên này lại đi tìm bên kia.
     */
    public static final String CONTROL_NOTIFICATION_SETTINGS = "notification_settings";
    /**
     * Không cho tắt. Tắt mail khôi phục mật khẩu / xác thực / cấp tài khoản đồng nghĩa
     * khoá cả tổ chức ra ngoài hệ thống, mà lại không có dấu hiệu lỗi nào để lần ra.
     */
    public static final String CONTROL_LOCKED = "locked";

    private static final java.util.Set<String> LOCKED_CODES = java.util.Set.of(
            "auth_reset_password", "auth_verify_email", "auth_account_details");

    public static final String GROUP_ACCOUNT = "Tài khoản & bảo mật";
    public static final String GROUP_KPI = "Thông báo KPI";
    public static final String GROUP_EVALUATION = "Đánh giá";

    private static final Map<String, TemplateDef> BY_CODE = new LinkedHashMap<>();

    private static void register(TemplateDef def) {
        BY_CODE.put(def.getCode(), def);
    }

    private static Map<String, String> vars(String... pairs) {
        Map<String, String> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < pairs.length; i += 2) m.put(pairs[i], pairs[i + 1]);
        return m;
    }

    // ── Bộ dựng HTML cho các khối đặc thù, khớp với node TipTap ở frontend ──

    private static String button(String label, String url) {
        return "<p data-email=\"button\" style=\"text-align:center;margin:32px 0;\">"
                + "<a href=\"" + url + "\" class=\"btn\">" + label + "</a></p>";
    }

    private static String code(String label, String value) {
        return "<div data-email=\"code\" class=\"token-container\">"
                + "<span class=\"token-label\">" + label + "</span>"
                + "<div class=\"token-value\">" + value + "</div></div>";
    }

    private static String alert(String variant, String text) {
        String color;
        String bg;
        switch (variant) {
            case "warning" -> { color = "#b45309"; bg = "#fffbeb"; }
            case "danger"  -> { color = "#b91c1c"; bg = "#fef2f2"; }
            case "success" -> { color = "#047857"; bg = "#ecfdf5"; }
            default        -> { color = "#1d4ed8"; bg = "#eff6ff"; }
        }
        return "<div data-email=\"alert\" data-variant=\"" + variant + "\""
                + " style=\"background-color:" + bg + ";border-left:4px solid " + color
                + ";border-radius:8px;padding:14px 18px;margin:20px 0;color:" + color
                + ";font-weight:600;\"><p>" + text + "</p></div>";
    }

    /** rows: nhãn1, giá trị1, nhãn2, giá trị2… */
    private static String info(String... rows) {
        StringBuilder sb = new StringBuilder();
        StringBuilder json = new StringBuilder("[");
        int pairs = rows.length / 2;
        for (int i = 0; i < pairs; i++) {
            String label = rows[i * 2];
            String value = rows[i * 2 + 1];
            sb.append("<p style=\"margin:0 0 ").append(i == pairs - 1 ? "0" : "8px").append(";\">")
              .append("<strong>").append(label).append(":</strong> ").append(value).append("</p>");
            if (i > 0) json.append(',');
            json.append("{&quot;label&quot;:&quot;").append(label)
                .append("&quot;,&quot;value&quot;:&quot;").append(value).append("&quot;}");
        }
        json.append(']');
        // data-rows để trình soạn đọc lại thành các ô nhập nhãn–giá trị.
        return "<div data-email=\"info\" class=\"score-box\" data-rows=\"" + json + "\">" + sb + "</div>";
    }

    static {
        // ───────────────────────── Tài khoản & bảo mật ─────────────────────────
        register(new TemplateDef(
                "auth_reset_password", "Khôi phục mật khẩu",
                "Gửi mã OTP khi người dùng bấm quên mật khẩu.",
                GROUP_ACCOUNT, "Bảo mật Tài khoản",
                "Khôi phục Mật khẩu Bảo mật",
                "<p>Xin chào,</p>"
                + "<p>Gần đây chúng tôi nhận được yêu cầu <strong>khôi phục mật khẩu</strong> cho tài khoản gắn liền với địa chỉ email này.</p>"
                + "<p>Mã bảo mật để thiết lập lại mật khẩu của bạn là:</p>"
                + code("Mã xác thực bảo mật", "{{ma_otp}}")
                + alert("danger", "Mã này chỉ có hiệu lực trong vòng 60 phút.")
                + "<p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này để đảm bảo an toàn.</p>",
                vars("ma_otp", "Mã OTP khôi phục mật khẩu", "email", "Email người nhận"),
                List.of("ma_otp")));

        register(new TemplateDef(
                "auth_verify_email", "Xác thực email",
                "Gửi mã OTP xác thực địa chỉ email.",
                GROUP_ACCOUNT, "Xác nhận Email",
                "Xác nhận Tham gia Mạng lưới KeyGo",
                "<p>Chào mừng bạn đã gia nhập,</p>"
                + "<p>Để hoàn tất thủ tục đăng ký và kích hoạt tài khoản trên hệ thống KeyGo, vui lòng sử dụng mã OTP dưới đây:</p>"
                + code("Mã OTP kích hoạt", "{{ma_otp}}")
                + "<p>Mã này sẽ hết hạn sau 24 giờ kể từ khi được gửi.</p>",
                vars("ma_otp", "Mã OTP xác thực", "email", "Email người nhận"),
                List.of("ma_otp")));

        register(new TemplateDef(
                "auth_welcome_verify", "Chào mừng & xác thực",
                "Gửi khi tổ chức mới đăng ký: chào mừng kèm mã OTP xác thực.",
                GROUP_ACCOUNT, "Chào mừng & Xác thực",
                "Chào mừng tới KeyGo - Xác thực Tài khoản",
                "<p>Xin chào <strong>{{ten_nguoi_nhan}}</strong>,</p>"
                + "<p>Chúc mừng! Hồ sơ và dữ liệu hệ thống của công ty đã được khởi tạo thành công trên nền tảng KeyGo.</p>"
                + "<p>Để bắt đầu trải nghiệm, vui lòng xác thực tài khoản của bạn bằng mã OTP bên dưới:</p>"
                + code("Mã OTP xác thực", "{{ma_otp}}")
                + "<p>Sau khi xác thực, bạn có thể đăng nhập để quản lý KPI và trao quyền cho đội ngũ của mình.</p>",
                vars("ten_nguoi_nhan", "Họ tên người nhận", "ma_otp", "Mã OTP xác thực", "email", "Email người nhận"),
                List.of("ma_otp")));

        register(new TemplateDef(
                "auth_welcome", "Chào mừng",
                "Gửi sau khi tài khoản tổ chức đã kích hoạt xong.",
                GROUP_ACCOUNT, "Phát triển Thành công",
                "Chào mừng tới Hệ sinh thái KeyGo",
                "<p>Xin chào <strong>{{ten_nguoi_nhan}}</strong>,</p>"
                + "<p>Chúc mừng bạn! Hồ sơ và dữ liệu hệ thống của công ty đã được khởi tạo thành công trên nền tảng KeyGo.</p>"
                + "<p>Giờ đây, bạn có toàn quyền truy cập để <strong>quản lý luồng công việc</strong>, "
                + "<strong>trao quyền đội ngũ</strong> và <strong>đo lường kết quả dữ liệu</strong> tức thì.</p>"
                + button("Mở hệ thống", "{{link_he_thong}}")
                + "<p>Trân trọng,<br><strong>Ban Giám đốc KeyGo</strong></p>",
                vars("ten_nguoi_nhan", "Họ tên người nhận", "email", "Email người nhận",
                        "link_he_thong", "Đường dẫn tới hệ thống"),
                List.of()));

        register(new TemplateDef(
                "auth_account_details", "Cấp tài khoản",
                "Gửi thông tin đăng nhập khi quản trị viên tạo tài khoản cho nhân sự.",
                GROUP_ACCOUNT, "Thông tin Tài khoản",
                "Thông tin Truy cập Hệ thống KeyGo",
                "<p>Xin chào <strong>{{ten_nguoi_nhan}}</strong>,</p>"
                + "<p>Tài khoản của bạn đã được khởi tạo thành công trên hệ thống quản trị KeyGo. "
                + "Dưới đây là thông tin đăng nhập cá nhân của bạn:</p>"
                + info("Email", "{{email}}", "Mật khẩu", "{{mat_khau}}")
                + button("Đăng nhập ngay", "{{link_he_thong}}/login")
                + alert("warning", "Vì lý do an toàn, bạn nên đổi mật khẩu ngay sau khi đăng nhập lần đầu."),
                vars("ten_nguoi_nhan", "Họ tên người nhận", "email", "Email đăng nhập",
                        "mat_khau", "Mật khẩu được cấp", "link_he_thong", "Đường dẫn tới hệ thống"),
                List.of("mat_khau")));

        // ───────────────────────── Thông báo KPI ─────────────────────────
        registerNotification("kpi_submitted", "KPI được nộp",
                "Khi nhân viên nộp chỉ tiêu KPI.");
        registerNotification("kpi_assigned", "KPI được giao",
                "Khi một chỉ tiêu KPI được giao cho nhân viên.");
        registerNotification("kpi_approved", "KPI được duyệt",
                "Khi chỉ tiêu KPI được phê duyệt.");
        registerNotification("kpi_rejected", "KPI bị từ chối",
                "Khi chỉ tiêu KPI bị từ chối.");
        registerNotification("kpi_approval_reverted", "Thu hồi phê duyệt KPI",
                "Khi phê duyệt của một chỉ tiêu KPI bị thu hồi.");
        registerNotification("submission_submitted", "Báo cáo KPI cần duyệt",
                "Khi nhân viên nộp báo cáo kết quả cho một chỉ tiêu.");
        registerNotification("submission_reviewed", "Báo cáo KPI đã được duyệt",
                "Khi báo cáo kết quả được cán bộ quản lý xem xét.");
        registerNotification("reminder_deadline", "Nhắc hạn nộp",
                "Nhắc nhở tự động khi sắp tới hạn nộp báo cáo.");

        // ───────────────────────── Đánh giá ─────────────────────────
        register(new TemplateDef(
                "cycle_evaluation_result", "Gửi kết quả đánh giá kỳ",
                "Gửi cho nhân viên kết quả đánh giá tổng hợp của một kỳ.",
                GROUP_EVALUATION, "Kết quả Đánh giá Kỳ",
                "Kết quả đánh giá {{ky_danh_gia}} của bạn",
                "<p>Xin chào <strong>{{ten_nhan_vien}}</strong>,</p>"
                + "<p>Kết quả đánh giá của bạn trong <strong>{{ky_danh_gia}}</strong> tại đơn vị "
                + "<strong>{{don_vi}}</strong> đã được chốt. Dưới đây là tổng hợp điểm của bạn:</p>"
                + info(
                        "Điểm tự đánh giá", "{{diem_tu_danh_gia}}",
                        "Điểm cán bộ quản lý đánh giá", "{{diem_qltt}}",
                        "Điểm chốt kỳ", "{{diem_chot}} — xếp loại {{xep_loai}}",
                        "Mức định tính", "{{muc_dinh_tinh}}",
                        "Xếp loại ma trận", "{{xep_loai_ma_tran}}")
                + "<h2>Chi tiết điểm từng đợt trong kỳ</h2>"
                + "<p>{{bang_diem_dot}}</p>"
                + "<p><strong>Nhận xét:</strong> {{nhan_xet}}</p>"
                + button("Xem chi tiết trên hệ thống", "{{link_he_thong}}/kpi-cycles/evaluation")
                + "<p>Nếu có thắc mắc về kết quả, vui lòng liên hệ trực tiếp cán bộ quản lý của bạn.</p>"
                + "<p>Trân trọng,<br><strong>{{nguoi_gui}}</strong></p>",
                vars(
                        "ten_nhan_vien", "Họ tên nhân viên",
                        "don_vi", "Tên đơn vị của nhân viên",
                        "ky_danh_gia", "Tên kỳ đánh giá",
                        "diem_tu_danh_gia", "Điểm nhân viên tự đánh giá",
                        "diem_qltt", "Điểm cán bộ quản lý đánh giá",
                        "diem_chot", "Điểm chốt kỳ",
                        "xep_loai", "Nhãn xếp loại theo điểm chốt",
                        "muc_dinh_tinh", "Mức định tính (thang 0–5)",
                        "xep_loai_ma_tran", "Xếp loại ma trận hiệu suất (1–5)",
                        "nhan_xet", "Nhận xét của người đánh giá",
                        "bang_diem_dot", "Bảng điểm từng đợt trong kỳ",
                        "nguoi_gui", "Họ tên người gửi email",
                        "link_he_thong", "Đường dẫn tới hệ thống"),
                List.of("ten_nhan_vien")));
    }

    /** Mail thông báo sự kiện: nội dung do hệ thống sinh, template chỉ bọc thêm lời chào/kết. */
    private static void registerNotification(String code, String label, String description) {
        register(new TemplateDef(
                code, label, description, GROUP_KPI, "Thông báo Hệ thống",
                "{{tieu_de}}",
                "<p>Xin chào <strong>{{ten_nguoi_nhan}}</strong>,</p>"
                + "<p>{{noi_dung}}</p>"
                + button("Mở hệ thống", "{{link_he_thong}}"),
                vars(
                        "tieu_de", "Tiêu đề thông báo do hệ thống sinh",
                        "noi_dung", "Nội dung chi tiết do hệ thống sinh",
                        "ten_nguoi_nhan", "Họ tên người nhận",
                        "link_he_thong", "Đường dẫn tới hệ thống"),
                List.of("noi_dung")));
    }

    public static TemplateDef get(String code) {
        return BY_CODE.get(code);
    }

    public static boolean exists(String code) {
        return BY_CODE.containsKey(code);
    }

    public static List<TemplateDef> all() {
        return List.copyOf(BY_CODE.values());
    }
}
