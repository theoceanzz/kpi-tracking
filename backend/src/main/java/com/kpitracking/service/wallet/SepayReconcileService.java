package com.kpitracking.service.wallet;

import com.kpitracking.dto.request.wallet.ResolveSepayEventRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.wallet.SepayEventResponse;
import com.kpitracking.dto.response.wallet.WalletReconcileResponse;
import com.kpitracking.entity.CashTransaction;
import com.kpitracking.entity.SepayWebhookEvent;
import com.kpitracking.entity.TopupOrder;
import com.kpitracking.entity.User;
import com.kpitracking.enums.CashSourceType;
import com.kpitracking.enums.CashTransactionType;
import com.kpitracking.enums.SepayEventStatus;
import com.kpitracking.enums.TopupOrderStatus;
import com.kpitracking.event.WalletEvents;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.SepayWebhookEventRepository;
import com.kpitracking.repository.TopupOrderRepository;
import com.kpitracking.service.CashWalletService;
import com.kpitracking.service.reward.RewardContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Hàng đợi đối soát và cách đóng một sự kiện SePay chưa xử lý.
 *
 * <p><b>Ghi có bằng tay và đóng sự kiện phải là MỘT thao tác, trong MỘT
 * transaction.</b> Nếu tách làm hai lời gọi rời thì chắc chắn sẽ có lúc làm cái
 * này quên cái kia — và cái quên phổ biến nhất là quên đóng, để lại dòng đã xử lý
 * xong nằm mãi trong hàng đợi. Sau vài tháng hàng đợi toàn rác và không ai còn
 * nhìn nó nữa, đúng lúc nó cần được nhìn nhất.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SepayReconcileService {

    private final SepayWebhookEventRepository eventRepository;
    private final TopupOrderRepository orderRepository;
    private final CashWalletService cashWalletService;
    private final ApplicationEventPublisher eventPublisher;
    private final RewardContext context;

    /** Mặc định trả về đúng hàng đợi; {@code all = true} để xem toàn bộ lịch sử. */
    @Transactional(readOnly = true)
    public PageResponse<SepayEventResponse> list(boolean all, int page, int size) {
        var pageable = PageRequest.of(page, size);
        Page<SepayWebhookEvent> result = all
                ? eventRepository.findAllByOrderByReceivedAtDesc(pageable)
                : eventRepository.findReconcileQueue(pageable);

        return PageResponse.<SepayEventResponse>builder()
                .content(result.getContent().stream().map(this::toResponse).toList())
                .page(result.getNumber())
                .size(result.getSize())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .last(result.isLast())
                .build();
    }

    @Transactional(readOnly = true)
    public WalletReconcileResponse reconcile() {
        var inconsistent = cashWalletService.findInconsistentWallets(context.getCurrentOrgId());
        long unresolved = eventRepository.countUnresolved();
        long mismatch = eventRepository.countAmountMismatch();

        return WalletReconcileResponse.builder()
                .inconsistentWalletIds(inconsistent)
                .unresolvedEventCount(unresolved)
                .amountMismatchCount(mismatch)
                .clean(inconsistent.isEmpty() && unresolved == 0 && mismatch == 0)
                .build();
    }

    /**
     * Đóng một sự kiện. Ba cách xử lý, cùng kết thúc bằng việc ghi nhóm cột
     * {@code resolution*} trong cùng transaction với bút toán (nếu có).
     *
     * <p>Khoá dòng sự kiện trước khi làm bất cứ gì: tiền vốn đã an toàn nhờ khoá
     * chống ghi trùng ở sổ cái, nhưng hai người cùng bấm trước khi transaction đầu
     * commit sẽ cùng đọc được {@code resolvedAt IS NULL} và cùng ghi — người thua
     * cuộc ghi đè {@code resolvedBy} và {@code resolutionNote} của người thắng,
     * tức hỏng đúng thứ mà nhóm cột này sinh ra để giữ.
     */
    @Transactional
    public SepayEventResponse resolve(UUID eventId, ResolveSepayEventRequest request) {
        User actor = context.getCurrentUser();

        SepayWebhookEvent event = eventRepository.findByIdForUpdate(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Sự kiện SePay", "id", eventId));

        if (event.getResolvedAt() != null) {
            throw new BusinessException("Sự kiện này đã được "
                    + (event.getResolvedBy() != null ? event.getResolvedBy().getFullName() : "người khác")
                    + " xử lý lúc " + event.getResolvedAt() + ".");
        }

        CashTransaction tx = switch (request.getMode()) {
            case MATCH_ORDER -> matchOrder(event, request, actor);
            case CREDIT_USER -> creditUser(event, request, actor);
            case IGNORE -> null;
        };

        event.setResolvedAt(Instant.now());
        event.setResolvedBy(actor);
        event.setResolutionNote(request.getNote());
        event.setResolutionTransactionId(tx != null ? tx.getId() : null);
        eventRepository.save(event);

        log.info("Đóng sự kiện SePay {} bằng cách {} bởi {}", eventId, request.getMode(), actor.getId());
        return toResponse(event);
    }

    /**
     * Gán sự kiện vào một đơn có sẵn và ghi có cho chủ đơn.
     *
     * <p>Dùng ĐÚNG khoá mà webhook dùng ({@code topup:{orderId}}). Đây là lớp
     * phòng thủ thứ hai chứ không phải cơ chế chính: webhook về sau khi đơn đã
     * {@code PAID} bị chặn ngay ở bước kiểm trạng thái đơn của
     * {@link SepayEventProcessor} và không bao giờ chạm tới sổ cái, nên khoá này
     * trên thực tế không có dịp kích hoạt. Vẫn dùng chung vì nó miễn phí và đúng.
     */
    private CashTransaction matchOrder(SepayWebhookEvent event,
                                       ResolveSepayEventRequest request, User actor) {
        if (request.getOrderId() == null) {
            throw new BusinessException("Vui lòng chọn đơn nạp cần gán.");
        }
        long received = requireReceivedAmount(event);

        TopupOrder order = orderRepository.findByIdForUpdate(request.getOrderId())
                .orElseThrow(() -> new ResourceNotFoundException("Đơn nạp tiền", "id", request.getOrderId()));

        if (!order.isCreditable()) {
            throw new BusinessException("Đơn " + order.getCode() + " đã được thanh toán. "
                    + "Nếu đây là khoản tiền thứ hai thì hãy chọn 'Ghi có cho người dùng'.");
        }

        CashTransaction tx = cashWalletService.applyTransaction(
                CashWalletService.CashLedgerEntry.builder()
                        .organizationId(order.getOrganization().getId())
                        .userId(order.getUser().getId())
                        .amount(received)
                        .type(CashTransactionType.TOPUP)
                        .sourceType(CashSourceType.SEPAY)
                        .sourceRefId(order.getId())
                        .idempotencyKey(CashWalletService.key("topup", order.getId()))
                        .note("Gán tay giao dịch SePay vào đơn " + order.getCode()
                                + ": " + request.getNote())
                        .actor(actor)
                        .build());

        order.setStatus(TopupOrderStatus.PAID);
        order.setPaidAt(Instant.now());
        order.setPaidAmount(received);
        order.setCashTransactionId(tx.getId());
        orderRepository.save(order);

        event.setMatchedOrder(order);
        event.setAmountMismatch(received != order.getAmount());
        eventPublisher.publishEvent(new WalletEvents.TopupPaidEvent(this, order, received));
        return tx;
    }

    /**
     * Ghi có thẳng vào ví của một người, không qua đơn nào. Dùng cho khoản tiền
     * thứ hai của cùng một mã, hoặc nội dung chuyển khoản sai hoàn toàn nhưng vẫn
     * xác định được chủ nhân.
     *
     * <p>Khoá suy ra từ id sự kiện, KHÔNG cần mã yêu cầu do client sinh: một sự
     * kiện chỉ ghi có được đúng một lần dù người xử lý bấm bao nhiêu lần.
     */
    private CashTransaction creditUser(SepayWebhookEvent event,
                                       ResolveSepayEventRequest request, User actor) {
        if (request.getUserId() == null) {
            throw new BusinessException("Vui lòng chọn người được ghi có.");
        }
        long received = requireReceivedAmount(event);
        UUID orgId = context.getOrgIdOf(request.getUserId());

        return cashWalletService.applyTransaction(
                CashWalletService.CashLedgerEntry.builder()
                        .organizationId(orgId)
                        .userId(request.getUserId())
                        .amount(received)
                        .type(CashTransactionType.ADJUST)
                        .sourceType(CashSourceType.MANUAL)
                        .sourceRefId(event.getId())
                        .idempotencyKey(CashWalletService.key("sepay_resolve", event.getId()))
                        .note("Ghi có tay từ giao dịch SePay #" + event.getSepayId()
                                + ": " + request.getNote())
                        .actor(actor)
                        .build());
    }

    /**
     * Số tiền ghi có LUÔN lấy từ sự kiện, không bao giờ từ người dùng nhập. Một ô
     * số tiền tự do sẽ phá chính sách "ghi có đúng số tiền thực nhận" ngay ở
     * đường dễ sai nhất: gõ nhầm một chữ số thì số dư lệch khỏi tiền thật đã về mà
     * không còn gì để đối chiếu, vì con số lẽ ra dùng để đối chiếu chính là con số
     * vừa bị gõ đè.
     */
    private long requireReceivedAmount(SepayWebhookEvent event) {
        Long amount = event.getTransferAmount();
        if (amount == null || amount <= 0) {
            throw new BusinessException("Sự kiện này không có số tiền hợp lệ nên không ghi có được. "
                    + "Nếu cần cộng tiền cho ai đó, hãy dùng chức năng điều chỉnh số dư.");
        }
        return amount;
    }

    private SepayEventResponse toResponse(SepayWebhookEvent e) {
        TopupOrder order = e.getMatchedOrder();
        return SepayEventResponse.builder()
                .id(e.getId())
                .sepayId(e.getSepayId())
                .gateway(e.getGateway())
                .transactionDate(e.getTransactionDate())
                .accountNumber(e.getAccountNumber())
                .code(e.getCode())
                .content(e.getContent())
                .transferType(e.getTransferType())
                .transferAmount(e.getTransferAmount())
                .referenceCode(e.getReferenceCode())
                .status(e.getStatus())
                .amountMismatch(e.getAmountMismatch())
                .errorMessage(e.getErrorMessage())
                .matchedOrderId(order != null ? order.getId() : null)
                .matchedOrderCode(order != null ? order.getCode() : null)
                .matchedOrderAmount(order != null ? order.getAmount() : null)
                .matchedOrderUserName(order != null ? order.getUser().getFullName() : null)
                .resolvedAt(e.getResolvedAt())
                .resolvedByName(e.getResolvedBy() != null ? e.getResolvedBy().getFullName() : null)
                .resolutionNote(e.getResolutionNote())
                .resolutionTransactionId(e.getResolutionTransactionId())
                .inQueue(e.isInReconcileQueue())
                .receivedAt(e.getReceivedAt())
                .build();
    }
}
