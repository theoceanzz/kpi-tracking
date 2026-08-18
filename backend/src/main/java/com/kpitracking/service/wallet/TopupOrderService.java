package com.kpitracking.service.wallet;

import com.kpitracking.dto.request.wallet.CreateTopupRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.wallet.TopupOrderResponse;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.TopupOrder;
import com.kpitracking.entity.User;
import com.kpitracking.enums.TopupOrderStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.TopupOrderRepository;
import com.kpitracking.service.CashWalletService;
import com.kpitracking.service.reward.RewardContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Tạo và quản lý đơn nạp tiền.
 *
 * <p>Đơn nạp chỉ là một lời hẹn: "tôi sẽ chuyển {@code amount} đồng với nội dung
 * {@code code}". Tiền chỉ thực sự vào ví khi webhook SePay báo về. Vì vậy đơn
 * không giữ tiền, không khoá gì, và việc huỷ đơn không hoàn lại thứ gì.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TopupOrderService {

    /** Số lần thử sinh mã trước khi bỏ cuộc. Đụng mã ở 32^8 khả năng là gần như không thể. */
    private static final int MAX_CODE_ATTEMPTS = 5;

    /** Chặn người dùng tạo hàng loạt đơn treo làm rác bảng và rối màn hình của chính họ. */
    private static final int MAX_PENDING_ORDERS = 5;

    private final TopupOrderRepository orderRepository;
    private final OrganizationRepository organizationRepository;
    private final SepayQrBuilder qrBuilder;
    private final RewardContext context;

    @Transactional
    public TopupOrderResponse create(CreateTopupRequest request) {
        User me = context.getCurrentUser();
        UUID orgId = context.getOrgIdOf(me.getId());
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", orgId));

        assertWalletEnabled(org);

        if (org.getSepayAccountNumber() == null || org.getSepayAccountNumber().isBlank()
                || org.getSepayBankCode() == null || org.getSepayBankCode().isBlank()) {
            throw new BusinessException("Tổ chức chưa cấu hình tài khoản ngân hàng nhận tiền. "
                    + "Vui lòng liên hệ quản trị viên.");
        }

        long amount = request.getAmount();
        if (amount < org.getTopupMinAmount() || amount > org.getTopupMaxAmount()) {
            throw new BusinessException("Số tiền nạp phải từ "
                    + CashWalletService.formatVnd(org.getTopupMinAmount()) + " đến "
                    + CashWalletService.formatVnd(org.getTopupMaxAmount()) + ".");
        }

        long pending = orderRepository.countByOrganizationIdAndUserIdAndStatus(
                orgId, me.getId(), TopupOrderStatus.PENDING);
        if (pending >= MAX_PENDING_ORDERS) {
            throw new BusinessException("Bạn đang có " + pending + " đơn nạp chờ thanh toán. "
                    + "Vui lòng hoàn tất hoặc huỷ bớt trước khi tạo đơn mới.");
        }

        String code = generateUniqueCode();
        Instant expiresAt = Instant.now().plus(Duration.ofMinutes(org.getTopupExpireMinutes()));

        TopupOrder order = orderRepository.save(TopupOrder.builder()
                .organization(org)
                .user(me)
                .code(code)
                .amount(amount)
                .status(TopupOrderStatus.PENDING)
                .qrUrl(qrBuilder.build(org, amount, code))
                // Chụp lại cấu hình ngân hàng lúc tạo đơn: đổi tài khoản về sau không
                // được làm sai mã QR mà người dùng đang mở trên màn hình.
                .bankCode(org.getSepayBankCode())
                .bankAccountNumber(org.getSepayAccountNumber())
                .expiresAt(expiresAt)
                .build());

        log.info("Tạo đơn nạp {} cho user {} số tiền {}", code, me.getId(), amount);
        return toResponse(order, org);
    }

    @Transactional(readOnly = true)
    public PageResponse<TopupOrderResponse> getMine(int page, int size) {
        User me = context.getCurrentUser();
        UUID orgId = context.getOrgIdOf(me.getId());
        Organization org = organizationRepository.findById(orgId).orElse(null);

        Page<TopupOrder> result = orderRepository.findByOrganizationIdAndUserIdOrderByCreatedAtDesc(
                orgId, me.getId(), PageRequest.of(page, size));

        return PageResponse.<TopupOrderResponse>builder()
                .content(result.getContent().stream().map(o -> toResponse(o, org)).toList())
                .page(result.getNumber())
                .size(result.getSize())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .last(result.isLast())
                .build();
    }

    /** Dùng cho màn hình chờ chuyển khoản: giao diện hỏi lại mỗi vài giây tới khi PAID. */
    @Transactional(readOnly = true)
    public TopupOrderResponse getById(UUID id) {
        TopupOrder order = orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Đơn nạp tiền", "id", id));
        User me = context.getCurrentUser();
        if (!order.getUser().getId().equals(me.getId())) {
            throw new ForbiddenException("Bạn không có quyền xem đơn nạp tiền này.");
        }
        return toResponse(order, order.getOrganization());
    }

    /**
     * Huỷ đơn đang chờ.
     *
     * <p>BẮT BUỘC khoá dòng trước khi kiểm trạng thái. Không có khoá thì kịch bản
     * sau xảy ra được: webhook đang giữ đơn để ghi có đúng lúc người dùng bấm huỷ,
     * lệnh huỷ chờ khoá rồi ghi đè {@code CANCELLED} lên đơn vừa {@code PAID}.
     * Tiền không sai (sổ cái tách biệt và khoá chống ghi trùng đã ghi xong), nhưng
     * người dùng nhìn thấy đơn "đã huỷ" trong khi tiền đã vào ví — sai lệch giữa
     * hai màn hình là thứ khiến người ta không tin hệ thống tiền.
     */
    @Transactional
    public TopupOrderResponse cancel(UUID id) {
        TopupOrder order = orderRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Đơn nạp tiền", "id", id));

        User me = context.getCurrentUser();
        if (!order.getUser().getId().equals(me.getId())) {
            throw new ForbiddenException("Bạn không có quyền huỷ đơn nạp tiền này.");
        }
        if (order.getStatus() == TopupOrderStatus.PAID) {
            throw new BusinessException("Đơn này đã nhận được tiền nên không thể huỷ. "
                    + "Số dư ví của bạn đã được cộng.");
        }
        if (order.getStatus() != TopupOrderStatus.PENDING) {
            throw new BusinessException("Chỉ huỷ được đơn đang chờ thanh toán.");
        }

        order.setStatus(TopupOrderStatus.CANCELLED);
        orderRepository.save(order);
        return toResponse(order, order.getOrganization());
    }

    private void assertWalletEnabled(Organization org) {
        if (!Boolean.TRUE.equals(org.getEnableCashWallet())) {
            throw new BusinessException("Tổ chức của bạn chưa bật tính năng ví tiền.");
        }
    }

    private String generateUniqueCode() {
        for (int i = 0; i < MAX_CODE_ATTEMPTS; i++) {
            String code = SepayCodeFormat.generate();
            if (!orderRepository.existsByCode(code)) {
                return code;
            }
        }
        throw new BusinessException("Không sinh được mã đơn nạp, vui lòng thử lại.");
    }

    TopupOrderResponse toResponse(TopupOrder o, Organization org) {
        return TopupOrderResponse.builder()
                .id(o.getId())
                .userId(o.getUser().getId())
                .fullName(o.getUser().getFullName())
                .code(o.getCode())
                .amount(o.getAmount())
                .paidAmount(o.getPaidAmount())
                .status(o.getStatus())
                .qrUrl(o.getQrUrl())
                .bankCode(o.getBankCode())
                .bankAccountNumber(o.getBankAccountNumber())
                .bankAccountHolder(org != null ? org.getSepayAccountHolder() : null)
                .expiresAt(o.getExpiresAt())
                .paidAt(o.getPaidAt())
                .createdAt(o.getCreatedAt())
                .build();
    }
}
