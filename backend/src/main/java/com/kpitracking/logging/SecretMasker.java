package com.kpitracking.logging;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Lưới an toàn thứ hai cho log: che các chuỗi trông như secret TRƯỚC khi ghi ra, dù ai đó lỡ log.
 * Không thay cho việc không log secret ngay từ đầu — chỉ đỡ những ca sót.
 *
 * <p>Dùng chung cho pattern text (local, qua {@link SecretMaskingConverter}) và JSON prod
 * (qua {@code MaskingJsonGeneratorDecorator} + {@link SecretMaskingValueMasker}).
 */
public final class SecretMasker {

    public static final String MASK = "***";

    /** Thứ tự quan trọng: mẫu cụ thể (JWT, key có tiền tố) trước, mẫu "field=value" chung sau. */
    public static final List<Pattern> PATTERNS = List.of(
            // JWT: header.payload.signature
            Pattern.compile("eyJ[A-Za-z0-9_\\-]{10,}\\.eyJ[A-Za-z0-9_\\-]{10,}\\.[A-Za-z0-9_\\-]{10,}"),
            // Bearer <token>
            Pattern.compile("(?i)(Bearer\\s+)[A-Za-z0-9._\\-]{8,}"),
            // Key có tiền tố nhận biết được
            Pattern.compile("sk-ant-[A-Za-z0-9_\\-]{16,}"),
            Pattern.compile("\\bsk-[A-Za-z0-9]{16,}"),
            Pattern.compile("AIza[0-9A-Za-z_\\-]{30,}"),
            Pattern.compile("\\bhf_[A-Za-z0-9]{16,}"),
            Pattern.compile("\\bgsk_[A-Za-z0-9]{16,}"),
            Pattern.compile("\\bAKIA[0-9A-Z]{16}\\b"),
            Pattern.compile("xox[baprs]-[0-9A-Za-z\\-]{10,}"),
            // field=value / field: value / "field":"value" với tên field nhạy cảm
            Pattern.compile("(?i)((?:password|passwd|pwd|token|refresh_?token|access_?token|secret|app_?secret|"
                    + "client_?secret|otp|api[_\\-]?key|apikey|private[_\\-]?key|authorization|cookie)"
                    + "\"?\\s*[=:]\\s*\"?)([^\\s,;\"'}\\]]{4,})")
    );

    private SecretMasker() {
    }

    public static String mask(String text) {
        if (text == null || text.isEmpty()) return text;
        String out = text;
        for (Pattern p : PATTERNS) {
            out = p.matcher(out).replaceAll(m -> m.groupCount() >= 1 && m.group(1) != null
                    ? Matcher.quoteReplacement(m.group(1) + MASK)
                    : MASK);
        }
        return out;
    }
}
