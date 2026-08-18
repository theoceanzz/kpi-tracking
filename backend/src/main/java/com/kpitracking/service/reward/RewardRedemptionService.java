package com.kpitracking.service.reward;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.dto.request.reward.CreateRedemptionRequest;
import com.kpitracking.dto.request.reward.RedemptionDecisionRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.reward.RedemptionResponse;
import com.kpitracking.dto.response.reward.RedemptionVoucherResponse;
import com.kpitracking.entity.RewardGiftItem;
import com.kpitracking.entity.RewardRedemption;
import com.kpitracking.entity.User;
import com.kpitracking.enums.RedemptionStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.RewardRedemptionRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.reward.fulfillment.RewardFulfillmentProvider;
import com.kpitracking.service.reward.fulfillment.RewardFulfillmentProviders;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Đổi điểm lấy quà.
 *
 * <h2>Trừ điểm NGAY khi đặt, không phải khi được duyệt</h2>
 * Nếu chỉ "giữ chỗ" mềm thì một người có 100 điểm đặt được năm yêu cầu 100 điểm cùng
 * lúc, rồi cả năm cùng được duyệt. Trừ ngay giữ cho bất biến "số dư luôn là số tiêu
 * được" luôn đúng. Từ chối hoặc huỷ thì hoàn lại bằng một bút toán REFUND riêng —
 * hai dòng trong sổ cái là điều cần thiết để truy vết, không phải rác.
 *
 * <h2>Quà voucher điện tử đi qua hai pha</h2>
 * Ghi sổ (commit) → gọi nhà cung cấp ngoài → ghi kết quả (commit lần hai). Phần ghi sổ
 * nằm ở {@link RewardRedemptionTx}; hàm điều phối ở đây CỐ Ý không mang
 * {@code @Transactional} để cuộc gọi mạng không kéo dài transaction, và để một lần
 * timeout không xoá mất mã giao dịch — thứ duy nhất lấy lại được voucher đã mua.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RewardRedemptionService {

    private final RewardRedemptionRepository redemptionRepository;
    private final RewardRedemptionTx tx;
    private final PermissionChecker permissionChecker;
    private final RewardContext context;
    private final RewardFulfillmentProviders fulfillmentProviders;
    private final ObjectMapper objectMapper;

    // ────────────────────────────── ĐẶT ĐỔI ──────────────────────────────

    /** CỐ Ý không có {@code @Transactional} — xem phần "hai pha" ở javadoc của lớp. */
    public RedemptionResponse redeem(CreateRedemptionRequest request) {
        RewardRedemption redemption = tx.create(request);

        Optional<RewardFulfillmentProvider> provider =
                fulfillmentProviders.find(redemption.getGiftItem().getType());
        if (provider.isPresent() && provider.get().fulfillsOnRedeem()) {
            return toOwnerResponse(runFulfillment(redemption, provider.get()));
        }
        return toOwnerResponse(redemption);
    }

    /**
     * Gọi nhà cung cấp ngoài rồi ghi kết quả. Ba kết cục, ba cách ghi khác nhau:
     *
     * <ul>
     *   <li>Thành công ⇒ lưu mã quà, đóng yêu cầu ở {@code DELIVERED}.</li>
     *   <li>Bị từ chối dứt khoát ⇒ hoàn điểm, trả tồn kho, đóng ở {@code FAILED}. Nếu lý
     *       do là chính món quà đã hỏng ở phía nhà cung cấp thì ẩn luôn nó khỏi cửa hàng.</li>
     *   <li>KHÔNG BIẾT (timeout, đứt mạng) ⇒ giữ nguyên {@code PENDING} và ghi lý do.
     *       Hoàn điểm ở ca này là vừa mất tiền vừa mất hàng nếu voucher thật ra đã xuất;
     *       người có quyền xử lý bấm "Giao quà" để hỏi lại bằng mã giao dịch cũ.</li>
     * </ul>
     */
    private RewardRedemption runFulfillment(RewardRedemption redemption,
                                            RewardFulfillmentProvider provider) {
        UUID id = redemption.getId();
        RewardFulfillmentProvider.FulfillmentResult result = provider.fulfill(redemption);

        if (result.ok()) {
            return tx.settleSuccess(id, result.externalRef(), result.payload());
        }
        if (result.retryable()) {
            log.warn("Chưa xác định được kết quả xuất quà cho yêu cầu {}: {}", id, result.message());
            return tx.recordPendingError(id, result.message());
        }
        log.warn("Nhà cung cấp từ chối xuất quà cho yêu cầu {}: {}", id, result.message());
        return tx.settleFailure(id, result.message(), result.giftUnavailable());
    }

    // ──────────────────────────── QUYẾT ĐỊNH ────────────────────────────

    @Transactional
    public RedemptionResponse approve(UUID id, RedemptionDecisionRequest request) {
        RewardRedemption r = loadPending(id);
        User actor = assertCanFulfill();

        r.setStatus(RedemptionStatus.APPROVED);
        r.setHandledBy(actor);
        r.setHandledAt(Instant.now());
        if (request != null && request.getNote() != null) r.setNote(request.getNote());
        return toManagerResponse(redemptionRepository.save(r));
    }

    @Transactional
    public RedemptionResponse reject(UUID id, RedemptionDecisionRequest request) {
        RewardRedemption r = loadPending(id);
        User actor = assertCanFulfill();
        tx.refundAndRestore(r, actor, "Từ chối đổi quà: " + r.getGiftNameSnapshot());

        r.setStatus(RedemptionStatus.REJECTED);
        r.setHandledBy(actor);
        r.setHandledAt(Instant.now());
        if (request != null && request.getNote() != null) r.setNote(request.getNote());
        return toManagerResponse(redemptionRepository.save(r));
    }

    /** Người đổi tự huỷ khi yêu cầu còn đang chờ xử lý. */
    @Transactional
    public RedemptionResponse cancel(UUID id) {
        RewardRedemption r = loadPending(id);
        User me = context.getCurrentUser();
        if (!r.getUser().getId().equals(me.getId())) {
            throw new ForbiddenException("Chỉ người tạo yêu cầu mới huỷ được yêu cầu này.");
        }
        // Quà ngoài đã xuất mã thì không còn ở PENDING nên không rơi vào đây được. Ca
        // duy nhất còn PENDING là đơn treo vì chưa rõ kết quả — huỷ lúc đó có thể hoàn
        // điểm cho một voucher đã xuất, nên chặn lại và để người vận hành tra đơn.
        if (r.getFulfillmentError() != null) {
            throw new BusinessException("Yêu cầu này đang chờ xác nhận từ nhà cung cấp quà "
                    + "nên chưa huỷ được. Bộ phận hỗ trợ sẽ xử lý và hoàn điểm nếu quà không xuất được.");
        }
        tx.refundAndRestore(r, me, "Huỷ đổi quà: " + r.getGiftNameSnapshot());

        r.setStatus(RedemptionStatus.CANCELLED);
        r.setHandledAt(Instant.now());
        return toOwnerResponse(redemptionRepository.save(r));
    }

    /**
     * Đánh dấu đã trao quà tận tay — và với quà ngoài là THỬ LẠI việc xuất quà.
     *
     * <p>Nhận cả yêu cầu đang {@code PENDING}, không bắt phải qua bước duyệt: điểm đã
     * được kiếm hợp lệ và tồn kho đã giữ ngay lúc đặt, nên chẳng còn gì để "duyệt".
     * Bắt người quản lý bấm duyệt rồi mới bấm giao là hai thao tác cho một việc.
     *
     * <p>Vẫn nhận {@code APPROVED} để các yêu cầu tạo từ trước khi bỏ bước duyệt
     * không bị kẹt.
     */
    public RedemptionResponse deliver(UUID id, RedemptionDecisionRequest request) {
        User actor = assertCanFulfill();
        RewardRedemption r = tx.loadForDelivery(id);

        Optional<RewardFulfillmentProvider> external = fulfillmentProviders
                .find(r.getGiftItem().getType())
                .filter(RewardFulfillmentProvider::fulfillsOnRedeem);

        if (external.isPresent()) {
            // Hỏi lại nhà cung cấp bằng ĐÚNG mã giao dịch cũ: nếu đơn đã tồn tại, họ trả
            // về quà đã xuất thay vì bán thêm lần nữa. Đây là đường lấy lại quà cho một
            // yêu cầu treo vì timeout.
            RewardRedemption settled = runFulfillment(r, external.get());
            if (settled.getStatus() == RedemptionStatus.PENDING) {
                throw new BusinessException("Vẫn chưa lấy được quà từ nhà cung cấp: "
                        + settled.getFulfillmentError());
            }
            return toManagerResponse(settled);
        }

        return toManagerResponse(tx.markDeliveredByHand(
                id, actor, request == null ? null : request.getNote()));
    }

    private RewardRedemption loadPending(UUID id) {
        RewardRedemption r = redemptionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Yêu cầu đổi quà", "id", id));
        if (r.getStatus() != RedemptionStatus.PENDING) {
            throw new BusinessException("Yêu cầu này không còn ở trạng thái chờ xử lý.");
        }
        return r;
    }

    private User assertCanFulfill() {
        User me = context.getCurrentUser();
        if (!permissionChecker.hasPermission(me.getId(), "GIFT:FULFILL")) {
            throw new ForbiddenException("Bạn không có quyền xử lý yêu cầu đổi quà.");
        }
        return me;
    }

    // ──────────────────────────────── ĐỌC ────────────────────────────────

    @Transactional(readOnly = true)
    public PageResponse<RedemptionResponse> getMyRedemptions(int page, int size) {
        User me = context.getCurrentUser();
        return toPage(redemptionRepository.findByUserIdAndOrganizationIdOrderByCreatedAtDesc(
                me.getId(), context.getOrgIdOf(me.getId()), PageRequest.of(page, size)), true);
    }

    @Transactional(readOnly = true)
    public PageResponse<RedemptionResponse> search(RedemptionStatus status, int page, int size) {
        return toPage(redemptionRepository.search(
                context.getCurrentOrgId(), status, PageRequest.of(page, size)), false);
    }

    @Transactional(readOnly = true)
    public long countPending() {
        return redemptionRepository.countByOrganizationIdAndStatus(
                context.getCurrentOrgId(), RedemptionStatus.PENDING);
    }

    private PageResponse<RedemptionResponse> toPage(Page<RewardRedemption> page, boolean withVouchers) {
        return PageResponse.<RedemptionResponse>builder()
                .content(page.getContent().stream()
                        .map(r -> toResponse(r, withVouchers))
                        .toList())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }

    /** Phản hồi cho chính người đã đổi — có mã quà. */
    private RedemptionResponse toOwnerResponse(RewardRedemption r) {
        return toResponse(r, true);
    }

    /** Phản hồi cho người xử lý yêu cầu — KHÔNG có mã quà. Ai cầm mã là người tiêu được nó. */
    private RedemptionResponse toManagerResponse(RewardRedemption r) {
        return toResponse(r, false);
    }

    private RedemptionResponse toResponse(RewardRedemption r, boolean withVouchers) {
        RewardGiftItem gift = r.getGiftItem();
        return RedemptionResponse.builder()
                .id(r.getId())
                .userId(r.getUser().getId())
                .userFullName(r.getUser().getFullName())
                .userEmail(r.getUser().getEmail())
                .userEmployeeCode(r.getUser().getEmployeeCode())
                .giftItemId(gift.getId())
                .giftNameSnapshot(r.getGiftNameSnapshot())
                // Lấy ảnh đã CHỤP, không lấy ảnh hiện tại của món quà — nếu không thì
                // đổi ảnh quà sẽ làm lịch sử hiện tên cũ kèm ảnh mới.
                .giftImageUrl(r.getGiftImageSnapshot())
                .giftTerms(gift.getExternalTerms())
                .quantity(r.getQuantity())
                .pointsSpent(r.getPointsSpent())
                .status(r.getStatus())
                .handledByUserId(r.getHandledBy() != null ? r.getHandledBy().getId() : null)
                .handledByName(r.getHandledBy() != null ? r.getHandledBy().getFullName() : null)
                .handledAt(r.getHandledAt())
                .deliveredAt(r.getDeliveredAt())
                .note(r.getNote())
                .createdAt(r.getCreatedAt())
                .externalProvider(gift.getExternalProvider())
                .externalOrderId(r.getExternalOrderId())
                .fulfillmentError(r.getFulfillmentError())
                .vouchers(withVouchers ? parseVouchers(r) : null)
                .build();
    }

    /**
     * Đọc mã quà từ cột jsonb.
     *
     * <p>Dữ liệu hỏng KHÔNG được phép làm chết cả trang lịch sử đổi quà: trả về danh sách
     * rỗng và ghi log, người dùng vẫn còn link quà của UrBox trong email/SMS.
     */
    private List<RedemptionVoucherResponse> parseVouchers(RewardRedemption r) {
        String json = r.getFulfillmentPayload();
        if (json == null || json.isBlank()) return null;
        try {
            Map<String, Object> payload = objectMapper.readValue(json, new TypeReference<>() {
            });
            Object vouchers = payload.get("vouchers");
            if (!(vouchers instanceof List<?> list) || list.isEmpty()) return null;
            return objectMapper.convertValue(list, new TypeReference<List<RedemptionVoucherResponse>>() {
            });
        } catch (Exception e) {
            log.error("Không đọc được dữ liệu quà ngoài của yêu cầu {}: {}", r.getId(), e.getMessage());
            return null;
        }
    }
}
