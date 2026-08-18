package com.kpitracking.service.wallet;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.dto.request.wallet.SepayWebhookPayload;
import com.kpitracking.entity.SepayWebhookEvent;
import com.kpitracking.entity.TopupOrder;
import com.kpitracking.enums.CashSourceType;
import com.kpitracking.enums.CashTransactionType;
import com.kpitracking.enums.SepayEventStatus;
import com.kpitracking.enums.TopupOrderStatus;
import com.kpitracking.event.WalletEvents;
import com.kpitracking.repository.SepayWebhookEventRepository;
import com.kpitracking.repository.TopupOrderRepository;
import com.kpitracking.service.CashWalletService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Optional;

/**
 * Xử lý một callback SePay. Tách khỏi {@link SepayWebhookService} vì lớp kia cần
 * bắt được lỗi của lớp này rồi ghi lại bằng một transaction KHÁC — gọi chéo qua
 * hai bean là cách duy nhất để proxy transaction của Spring nhận ra ranh giới đó.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SepayEventProcessor {

    private static final DateTimeFormatter SEPAY_DATE =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    private final SepayWebhookEventRepository eventRepository;
    private final TopupOrderRepository orderRepository;
    private final CashWalletService cashWalletService;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;

    /**
     * Đường xử lý chính. Thứ tự các bước ở đây là phần dễ sai nhất của cả module,
     * nên viết ra rõ ràng:
     *
     * <ol>
     *   <li>Dựng bản ghi sự kiện với payload thô — mất webhook là mất tiền người
     *       dùng, và payload thô là thứ duy nhất cứu được.</li>
     *   <li>Trùng {@code sepayId} ⇒ SePay gửi lại một giao dịch đã nhận ⇒
     *       {@code DUPLICATE}, dừng.</li>
     *   <li>Không phải tiền vào ⇒ {@code IGNORED}, dừng.</li>
     *   <li>Không trích được mã đơn, hoặc không tìm thấy đơn ⇒ {@code UNMATCHED},
     *       KHÔNG ghi có.</li>
     *   <li>Đơn đã {@code PAID} ⇒ {@code UNMATCHED}, KHÔNG ghi có. Im lặng bỏ qua
     *       là nuốt tiền, mà ghi có tự động là trả hai lần.</li>
     *   <li>Ghi có ĐÚNG số tiền thực nhận, kể cả khi lệch so với số đề nghị.</li>
     * </ol>
     */
    @Transactional
    public SepayEventStatus process(SepayWebhookPayload payload) {
        SepayWebhookEvent event = newEvent(payload);

        // (2) SePay gửi lại một giao dịch đã nhận trước đó.
        if (payload.getId() != null && eventRepository.existsBySepayId(payload.getId())) {
            event.setStatus(SepayEventStatus.DUPLICATE);
            event.setErrorMessage("SePay gửi lại giao dịch đã tiếp nhận trước đó, bỏ qua.");
            eventRepository.save(event);
            return SepayEventStatus.DUPLICATE;
        }

        // (3) Tiền ra không liên quan tới nạp ví.
        if (!"in".equalsIgnoreCase(payload.getTransferType())) {
            event.setStatus(SepayEventStatus.IGNORED);
            event.setErrorMessage("Không phải giao dịch tiền vào (transferType="
                    + payload.getTransferType() + ").");
            eventRepository.save(event);
            return SepayEventStatus.IGNORED;
        }

        // (4) Trích mã đơn: ưu tiên trường code SePay đã tách sẵn, không có thì
        // tìm trong nội dung thô — ngân hàng thường chèn thêm chữ vào nội dung.
        Optional<String> code = SepayCodeFormat.extractFrom(payload.getCode())
                .or(() -> SepayCodeFormat.extractFrom(payload.getContent()));

        if (code.isEmpty()) {
            return unmatched(event, "Không tìm thấy mã đơn nạp trong nội dung chuyển khoản. "
                    + "Hãy tìm đúng đơn của người chuyển rồi gán tay, hoặc ghi có trực tiếp cho họ.");
        }

        Optional<TopupOrder> found = orderRepository.findByCode(code.get());
        if (found.isEmpty()) {
            return unmatched(event, "Mã " + code.get() + " không khớp đơn nạp nào trong hệ thống.");
        }

        // Khoá dòng đơn trước khi đọc trạng thái: người dùng có thể đang bấm huỷ
        // đúng lúc này, và cả hai đường đều phải thấy cùng một trạng thái.
        TopupOrder order = orderRepository.findByIdForUpdate(found.get().getId()).orElseThrow();
        event.setMatchedOrder(order);

        // (5) Tiền về cho một đơn đã thanh toán. Hai khả năng, người đối soát
        // không tự phân biệt được nên thông điệp phải nêu cả hai và cách xử lý.
        if (!order.isCreditable()) {
            return unmatched(event, "Đơn " + order.getCode() + " đã ở trạng thái đã thanh toán từ "
                    + order.getPaidAt() + ". Nếu đây là lần chuyển khoản thứ hai của người dùng "
                    + "⇒ ghi có bằng cách chọn 'Ghi có cho người dùng'. Nếu đây là webhook về muộn "
                    + "sau khi đơn đã được gán tay ⇒ chọn 'Bỏ qua'.");
        }

        // (6) Ghi có ĐÚNG SỐ TIỀN THỰC NHẬN. Ví là số dư 1:1 chứ không phải món
        // hàng giá cố định, nên số đề nghị chỉ là số đề nghị. Giữ tiền người dùng
        // lại trong hàng đợi chỉ vì lệch vài nghìn phí ngân hàng là sai.
        long received = payload.getTransferAmount() == null ? 0L : payload.getTransferAmount();
        if (received <= 0) {
            return unmatched(event, "Số tiền chuyển khoản không hợp lệ: " + received);
        }
        boolean mismatch = received != order.getAmount();

        var tx = cashWalletService.applyTransaction(CashWalletService.CashLedgerEntry.builder()
                .organizationId(order.getOrganization().getId())
                .userId(order.getUser().getId())
                .amount(received)
                .type(CashTransactionType.TOPUP)
                .sourceType(CashSourceType.SEPAY)
                .sourceRefId(order.getId())
                .idempotencyKey(CashWalletService.key("topup", order.getId()))
                .note("Nạp tiền qua SePay, mã " + order.getCode()
                        + (mismatch ? " (lệch so với số đề nghị "
                            + CashWalletService.formatVnd(order.getAmount()) + ")" : ""))
                .build());

        order.setStatus(TopupOrderStatus.PAID);
        order.setPaidAt(Instant.now());
        order.setPaidAmount(received);
        order.setCashTransactionId(tx.getId());
        orderRepository.save(order);

        event.setStatus(SepayEventStatus.MATCHED);
        event.setAmountMismatch(mismatch);
        if (mismatch) {
            event.setErrorMessage("Đã ghi có đủ " + CashWalletService.formatVnd(received)
                    + " nhưng lệch so với số đề nghị " + CashWalletService.formatVnd(order.getAmount())
                    + ". Cần xác nhận rồi đóng lại.");
        }
        eventRepository.save(event);

        eventPublisher.publishEvent(new WalletEvents.TopupPaidEvent(this, order, received));
        log.info("Ghi có {} cho đơn {} (user {})", received, order.getCode(), order.getUser().getId());
        return SepayEventStatus.MATCHED;
    }

    /**
     * Đường dự phòng: đường chính đã ném lỗi nên transaction của nó bị huỷ, kể cả
     * bản ghi sự kiện. Chạy trong transaction MỚI để ít nhất còn lại dấu vết rằng
     * có tiền về mà hệ thống chưa xử lý được.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(SepayWebhookPayload payload, Exception cause) {
        try {
            if (payload.getId() != null && eventRepository.existsBySepayId(payload.getId())) {
                return;
            }
            SepayWebhookEvent event = newEvent(payload);
            event.setStatus(SepayEventStatus.UNMATCHED);
            event.setErrorMessage("Xử lý tự động thất bại: " + cause.getMessage()
                    + ". Tiền có thể đã về tài khoản — cần kiểm tra sao kê rồi xử lý tay.");
            eventRepository.save(event);
        } catch (Exception e) {
            // Đã ở đường dự phòng, không còn gì để cứu ngoài dòng log này.
            log.error("Không ghi nổi sự kiện SePay thất bại, sepayId={}", payload.getId(), e);
        }
    }

    private SepayEventStatus unmatched(SepayWebhookEvent event, String message) {
        event.setStatus(SepayEventStatus.UNMATCHED);
        event.setErrorMessage(message);
        eventRepository.save(event);
        log.warn("Sự kiện SePay chưa khớp đơn: {}", message);
        return SepayEventStatus.UNMATCHED;
    }

    private SepayWebhookEvent newEvent(SepayWebhookPayload p) {
        return SepayWebhookEvent.builder()
                .sepayId(p.getId())
                .gateway(p.getGateway())
                .transactionDate(parseDate(p.getTransactionDate()))
                .accountNumber(p.getAccountNumber())
                .subAccount(p.getSubAccount())
                .code(p.getCode())
                .content(p.getContent())
                .transferType(p.getTransferType())
                .transferAmount(p.getTransferAmount())
                .accumulated(p.getAccumulated())
                .referenceCode(p.getReferenceCode())
                .rawPayload(toJson(p))
                .amountMismatch(false)
                .build();
    }

    private Instant parseDate(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return LocalDateTime.parse(raw.trim(), SEPAY_DATE).atZone(VN).toInstant();
        } catch (Exception e) {
            log.warn("Không đọc được transactionDate '{}' của SePay", raw);
            return null;
        }
    }

    private String toJson(SepayWebhookPayload p) {
        try {
            return objectMapper.writeValueAsString(p);
        } catch (Exception e) {
            // raw_payload là NOT NULL và là thứ cuối cùng cứu được tiền, nên thà
            // lưu một chuỗi mô tả lỗi còn hơn để cả bản ghi không ghi được.
            return "{\"serializationError\":\"" + e.getMessage() + "\"}";
        }
    }
}
