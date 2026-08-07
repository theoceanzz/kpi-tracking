package com.kpitracking.service.email;

/**
 * Khung HTML chung của mọi email hệ thống (header gradient + thân + footer).
 * Tách riêng để cả mail dựng cứng lẫn mail sinh từ template tuỳ chỉnh dùng chung
 * một bộ khung — đổi giao diện một chỗ là đổi tất cả.
 */
public final class EmailLayout {

    private EmailLayout() {}

    /** Bọc đoạn HTML thân mail vào khung chuẩn. */
    public static String wrap(String title, String content) {
        return "<!DOCTYPE html>" +
               "<html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'>" +
               "<style>" +
               "  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }" +
               "  .wrapper { width: 100%; table-layout: fixed; background-color: #f8fafc; padding: 40px 0; }" +
               "  .main { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }" +
               "  .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center; }" +
               "  .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.025em; text-transform: uppercase; }" +
               "  .body { padding: 40px; color: #1e293b; line-height: 1.6; }" +
               "  .body p { margin-top: 0; margin-bottom: 16px; font-size: 16px; color: #475569; }" +
               "  .token-container { background-color: #f1f5f9; border-radius: 12px; padding: 30px; text-align: center; margin: 32px 0; border: 1px solid #e2e8f0; }" +
               "  .token-label { font-size: 14px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; display: block; }" +
               "  .token-value { font-family: 'Courier New', monospace; font-size: 36px; font-weight: 800; color: #2563eb; letter-spacing: 8px; margin: 0; }" +
               "  .footer { padding: 30px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; }" +
               "  .footer p { margin: 0; font-size: 13px; color: #94a3b8; }" +
               "  .btn { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; transition: background-color 0.2s; }" +
               "  .score-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }" +
               "  .score-table th { background-color: #1e293b; color: #ffffff; padding: 10px; text-align: left; font-weight: 600; }" +
               "  .score-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; color: #475569; }" +
               "  .score-box { background-color: #f1f5f9; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #e2e8f0; }" +
               "  @media (max-width: 600px) { .main { border-radius: 0; } .body { padding: 30px 20px; } }" +
               "</style></head><body>" +
               "<div class='wrapper'>" +
               "  <div class='main'>" +
               "    <div class='header'><h1>" + title + "</h1></div>" +
               "    <div class='body'>" + content + "</div>" +
               "    <div class='footer'>" +
               "      <p>© 2026 KeyGo Performance Tracking. Mọi quyền được bảo lưu.</p>" +
               "      <p style='margin-top: 8px;'>Email này được gửi tự động, vui lòng không phản hồi.</p>" +
               "    </div>" +
               "  </div>" +
               "</div>" +
               "</body></html>";
    }
}
