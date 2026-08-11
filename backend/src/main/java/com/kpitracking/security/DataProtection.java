package com.kpitracking.security;

import com.kpitracking.config.JwtConfig;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Bảo vệ dữ liệu nhạy cảm trước khi ghi xuống database.
 *
 * <p>Hai cơ chế phục vụ hai mục đích khác nhau:
 * <ul>
 *   <li>{@link #encrypt}/{@link #decrypt} — AES-GCM với IV ngẫu nhiên. Dùng cho giá trị cần đọc
 *       lại được (app secret, tenant key thật). Mỗi lần mã hoá ra chuỗi khác nhau nên
 *       <b>không</b> so sánh hay đánh index được.</li>
 *   <li>{@link #blindIndex} — HMAC-SHA256 tất định. Dùng cho giá trị chỉ cần tra cứu / so sánh
 *       (tenant key, lark open id). Đánh unique index và so bằng {@code =} được, không cần giải mã.</li>
 * </ul>
 *
 * <p><b>Cảnh báo:</b> đổi khoá sẽ làm mọi blind index cũ không khớp nữa và không có đường phục hồi
 * (HMAC một chiều). Các tổ chức sẽ phải kết nối lại Lark.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DataProtection {

    private static final String AES_TRANSFORMATION = "AES/GCM/NoPadding";
    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_BITS = 128;
    /** Đủ dài để không đoán được; tương đương 32 ký tự base64 (~24 byte entropy). */
    private static final int MIN_PROD_KEY_LENGTH = 32;

    private final JwtConfig jwtConfig;
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * Khoá gốc. <b>Bắt buộc ở production.</b> Ngoài production, để trống thì derive từ
     * {@code jwt.secret} cho tiện chạy local — xem {@link #init()}.
     */
    @Value("${app.security.data-key:}")
    private String configuredKey;

    private final Environment environment;

    private SecretKeySpec aesKey;
    private SecretKeySpec hmacKey;

    @PostConstruct
    void init() {
        boolean isProduction = environment.acceptsProfiles(Profiles.of("prod"));
        boolean hasKey = configuredKey != null && !configuredKey.isBlank();

        if (isProduction && (!hasKey || configuredKey.trim().length() < MIN_PROD_KEY_LENGTH)) {
            // Thà chết lúc khởi động còn hơn chạy êm hàng tháng bằng khoá suy ra được:
            // jwt.secret ở prod có giá trị mặc định là placeholder nằm sẵn trong repo, nếu
            // rơi vào nhánh dự phòng thì App Secret Lark của mọi khách hàng coi như không mã hoá.
            throw new IllegalStateException(
                    "Thiếu hoặc quá ngắn: app.security.data-key ở môi trường production. "
                            + "Đặt biến DATA_ENCRYPTION_KEY (tối thiểu " + MIN_PROD_KEY_LENGTH
                            + " ký tự ngẫu nhiên) trước khi khởi động. "
                            + "Sinh khoá: openssl rand -base64 48");
        }

        String master;
        if (hasKey) {
            master = configuredKey;
        } else {
            master = jwtConfig.getSecret();
            log.warn("app.security.data-key chưa được đặt — đang dẫn xuất khoá bảo vệ dữ liệu từ "
                    + "jwt.secret. Chấp nhận được ở môi trường phát triển, KHÔNG dùng cho production.");
        }

        // Hai khoá độc lập dẫn xuất từ cùng một chuỗi gốc bằng nhãn khác nhau
        this.aesKey = new SecretKeySpec(derive(master, "keygo-data-aes"), "AES");
        this.hmacKey = new SecretKeySpec(derive(master, "keygo-data-hmac"), HMAC_ALGORITHM);
    }

    private static byte[] derive(String master, String label) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(label.getBytes(StandardCharsets.UTF_8));
            return digest.digest(master.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("Không dẫn xuất được khoá bảo vệ dữ liệu", e);
        }
    }

    /** Mã hoá một chuỗi. Kết quả là base64 của (IV || ciphertext || tag). */
    public String encrypt(String plainText) {
        if (plainText == null) {
            return null;
        }
        try {
            byte[] iv = new byte[GCM_IV_LENGTH];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(AES_TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, aesKey, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] cipherText = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));

            byte[] combined = new byte[iv.length + cipherText.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(cipherText, 0, combined, iv.length, cipherText.length);
            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new IllegalStateException("Không mã hoá được dữ liệu nhạy cảm", e);
        }
    }

    public String decrypt(String encoded) {
        if (encoded == null || encoded.isBlank()) {
            return null;
        }
        try {
            byte[] combined = Base64.getDecoder().decode(encoded);
            byte[] iv = new byte[GCM_IV_LENGTH];
            System.arraycopy(combined, 0, iv, 0, GCM_IV_LENGTH);
            byte[] cipherText = new byte[combined.length - GCM_IV_LENGTH];
            System.arraycopy(combined, GCM_IV_LENGTH, cipherText, 0, cipherText.length);

            Cipher cipher = Cipher.getInstance(AES_TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, aesKey, new GCMParameterSpec(GCM_TAG_BITS, iv));
            return new String(cipher.doFinal(cipherText), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Không giải mã được dữ liệu nhạy cảm. "
                    + "Nhiều khả năng khoá app.security.data-key đã bị thay đổi.", e);
        }
    }

    /**
     * Sinh chỉ mục mù (HMAC-SHA256, hex 64 ký tự) để tra cứu / so sánh mà không lưu giá trị thật.
     * Cùng đầu vào luôn ra cùng kết quả nên đánh unique index được.
     */
    public String blindIndex(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(hmacKey);
            return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("Không tạo được chỉ mục mù", e);
        }
    }

    /** So sánh chống tấn công thời gian. */
    public boolean matchesBlindIndex(String value, String storedHash) {
        if (value == null || storedHash == null) {
            return false;
        }
        return MessageDigest.isEqual(
                blindIndex(value).getBytes(StandardCharsets.UTF_8),
                storedHash.getBytes(StandardCharsets.UTF_8));
    }
}
