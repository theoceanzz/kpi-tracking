package com.kpitracking.service.wallet;

import com.kpitracking.dto.request.wallet.SepayWebhookPayload;
import com.kpitracking.enums.SepayEventStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Cổng nhận webhook SePay: xác thực nguồn gọi, rồi giao việc cho
 * {@link SepayEventProcessor}.
 *
 * <p><b>Không có {@code @Transactional} ở đây, và đó là chủ ý.</b> Lớp này phải
 * bắt được lỗi của đường xử lý chính rồi ghi lại dấu vết bằng một transaction
 * khác — nếu nằm chung transaction thì lỗi làm huỷ luôn cả bản ghi sự kiện, tức
 * mất dấu một khoản tiền đã thật sự về tài khoản.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SepayWebhookService {

    private static final String API_KEY_PREFIX = "Apikey ";

    private final SepayEventProcessor processor;

    @Value("${sepay.webhook-api-key:}")
    private String webhookApiKey;

    /**
     * Danh sách IP được phép gọi webhook, phân tách bằng dấu phẩy. Để trống là
     * TẮT lớp kiểm tra này — chỉ bật khi SePay công bố dải IP cố định, vì nếu họ
     * đổi IP mà cấu hình chưa cập nhật thì toàn bộ giao dịch nạp chết lặng.
     */
    @Value("${sepay.webhook-allowed-ips:}")
    private String allowedIps;

    public boolean isAuthorized(String authorizationHeader) {
        if (webhookApiKey == null || webhookApiKey.isBlank()) {
            log.error("Chưa cấu hình sepay.webhook-api-key — từ chối mọi webhook để "
                    + "không ai cộng tiền vào ví bằng một request ẩn danh");
            return false;
        }
        if (authorizationHeader == null || !authorizationHeader.startsWith(API_KEY_PREFIX)) {
            return false;
        }
        String provided = authorizationHeader.substring(API_KEY_PREFIX.length()).trim();
        // So sánh hằng thời gian: so bằng equals() sẽ dừng ở ký tự lệch đầu tiên và
        // để lộ dần khoá qua thời gian phản hồi.
        return MessageDigest.isEqual(
                provided.getBytes(StandardCharsets.UTF_8),
                webhookApiKey.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Địa chỉ gọi tới có nằm trong danh sách cho phép không.
     *
     * <p><b>Đọc phần tử CUỐI của {@code X-Forwarded-For}, không phải phần tử
     * đầu.</b> nginx của dự án dùng {@code $proxy_add_x_forwarded_for}, tức NỐI
     * THÊM địa chỉ nó thấy vào cuối header mà client gửi lên. Nếu lấy phần tử đầu
     * thì kẻ tấn công chỉ cần tự đặt {@code X-Forwarded-For: <ip-của-sepay>} là
     * qua được — lớp bảo vệ khi đó còn tệ hơn không có, vì nó tạo cảm giác an
     * toàn giả. {@code request.getRemoteAddr()} cũng không dùng được: nó trả về
     * địa chỉ của container nginx.
     */
    public boolean isAllowedIp(String forwardedFor, String remoteAddr) {
        Set<String> allowed = parseAllowedIps();
        if (allowed.isEmpty()) {
            return true;
        }
        String client = resolveClientIp(forwardedFor, remoteAddr);
        boolean ok = client != null && allowed.contains(client);
        if (!ok) {
            log.warn("Webhook SePay bị từ chối do IP không nằm trong danh sách cho phép: {}", client);
        }
        return ok;
    }

    String resolveClientIp(String forwardedFor, String remoteAddr) {
        if (forwardedFor == null || forwardedFor.isBlank()) {
            return remoteAddr;
        }
        List<String> hops = Arrays.stream(forwardedFor.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
        return hops.isEmpty() ? remoteAddr : hops.get(hops.size() - 1);
    }

    private Set<String> parseAllowedIps() {
        if (allowedIps == null || allowedIps.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(allowedIps.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }

    /**
     * Luôn trả về kết quả, không bao giờ ném ra ngoài: SePay chỉ cần biết là đã
     * nhận. Ném lỗi ra chỉ khiến họ retry vô ích trong khi vấn đề thật nằm ở phía
     * này và cần người xử lý tay.
     */
    public SepayEventStatus handle(SepayWebhookPayload payload) {
        try {
            return processor.process(payload);
        } catch (Exception e) {
            log.error("Xử lý webhook SePay thất bại, sepayId={}", payload.getId(), e);
            processor.recordFailure(payload, e);
            return SepayEventStatus.UNMATCHED;
        }
    }
}
