package com.kpitracking.service.reward;

import com.kpitracking.dto.request.reward.CreateRedemptionRequest;
import com.kpitracking.dto.request.reward.RedemptionDecisionRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.reward.RedemptionResponse;
import com.kpitracking.entity.RewardGiftItem;
import com.kpitracking.entity.RewardRedemption;
import com.kpitracking.entity.RewardTransaction;
import com.kpitracking.entity.User;
import com.kpitracking.enums.GiftItemStatus;
import com.kpitracking.enums.RedemptionStatus;
import com.kpitracking.enums.RewardSourceType;
import com.kpitracking.enums.RewardTransactionType;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.RewardGiftItemRepository;
import com.kpitracking.repository.RewardRedemptionRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.RewardWalletService;
import com.kpitracking.service.reward.fulfillment.RewardFulfillmentProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
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
 * <h2>Thứ tự thao tác khi đặt</h2>
 * Giữ tồn kho TRƯỚC, trừ điểm SAU. Nếu trừ điểm hỏng (không đủ số dư) thì cả
 * transaction quay lui và tồn kho tự trả về — không cần bù trừ tay. Làm ngược lại
 * cũng đúng về mặt kỹ thuật, nhưng thứ tự này khiến ca thất bại phổ biến nhất
 * (hết hàng) dừng sớm, chưa kịp đụng vào sổ cái.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RewardRedemptionService {

    private final RewardRedemptionRepository redemptionRepository;
    private final RewardGiftItemRepository giftRepository;
    private final RewardWalletService walletService;
    private final PermissionChecker permissionChecker;
    private final RewardContext context;
    private final List<RewardFulfillmentProvider> fulfillmentProviders;

    // ────────────────────────────── ĐẶT ĐỔI ──────────────────────────────

    @Transactional
    public RedemptionResponse redeem(CreateRedemptionRequest request) {
        User me = context.getCurrentUser();
        UUID orgId = context.getOrgIdOf(me.getId());

        RewardGiftItem gift = giftRepository.findById(request.getGiftItemId())
                .orElseThrow(() -> new ResourceNotFoundException("Quà tặng", "id", request.getGiftItemId()));
        if (!gift.getOrganization().getId().equals(orgId)) {
            throw new BusinessException("Quà này không thuộc tổ chức của bạn.");
        }
        if (gift.getStatus() != GiftItemStatus.ACTIVE) {
            throw new BusinessException("Quà \"" + gift.getName() + "\" hiện không còn được đổi.");
        }

        int qty = request.getQuantity();
        int totalCost = gift.getPointCost() * qty;

        // Bước 1: giữ tồn kho bằng UPDATE có điều kiện. Đọc-rồi-ghi ở đây sẽ khiến hai
        // người đổi món cuối cùng cùng lúc đều thành công.
        if (!Boolean.TRUE.equals(gift.getUnlimitedStock())) {
            int affected = giftRepository.tryReserveStock(gift.getId(), qty);
            if (affected == 0) {
                throw new BusinessException("Quà \"" + gift.getName()
                        + "\" đã hết hàng hoặc không đủ số lượng bạn chọn.");
            }
        }

        // Quà nhận ngay thì hoàn tất luôn: không có ai phải trao gì cả, để nó nằm chờ
        // chỉ tạo ra một hàng đợi giả mà người quản lý phải bấm cho hết.
        boolean needsDelivery = Boolean.TRUE.equals(gift.getRequiresDelivery());
        Instant now = Instant.now();

        // Bước 2: lưu yêu cầu để có id, vì id đó là thành phần của khoá chống ghi trùng.
        RewardRedemption redemption = redemptionRepository.save(RewardRedemption.builder()
                .organization(gift.getOrganization())
                .user(me)
                .giftItem(gift)
                .giftNameSnapshot(gift.getName())
                .giftImageSnapshot(gift.getImageUrl())
                .quantity(qty)
                .pointsSpent(totalCost)
                .status(needsDelivery ? RedemptionStatus.PENDING : RedemptionStatus.DELIVERED)
                .deliveredAt(needsDelivery ? null : now)
                .note(request.getNote())
                .build());

        // Bước 3: trừ điểm. Không đủ số dư thì ném lỗi ⇒ cả transaction quay lui,
        // tồn kho ở bước 1 tự trả về.
        RewardTransaction tx = walletService.applyTransaction(RewardWalletService.LedgerEntry.builder()
                .organizationId(orgId)
                .userId(me.getId())
                .amount(-totalCost)
                .type(RewardTransactionType.SPEND)
                .sourceType(RewardSourceType.REDEMPTION)
                .sourceRefId(redemption.getId())
                .idempotencyKey(RewardWalletService.key("redeem", redemption.getId()))
                .note("Đổi quà: " + gift.getName() + (qty > 1 ? " x" + qty : ""))
                .actor(me)
                .build());

        redemption.setTransactionId(tx.getId());
        return toResponse(redemptionRepository.save(redemption));
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
        return toResponse(redemptionRepository.save(r));
    }

    @Transactional
    public RedemptionResponse reject(UUID id, RedemptionDecisionRequest request) {
        RewardRedemption r = loadPending(id);
        User actor = assertCanFulfill();
        refundAndRestore(r, actor, "Từ chối đổi quà: " + r.getGiftNameSnapshot());

        r.setStatus(RedemptionStatus.REJECTED);
        r.setHandledBy(actor);
        r.setHandledAt(Instant.now());
        if (request != null && request.getNote() != null) r.setNote(request.getNote());
        return toResponse(redemptionRepository.save(r));
    }

    /** Người đổi tự huỷ khi yêu cầu còn đang chờ xử lý. */
    @Transactional
    public RedemptionResponse cancel(UUID id) {
        RewardRedemption r = loadPending(id);
        User me = context.getCurrentUser();
        if (!r.getUser().getId().equals(me.getId())) {
            throw new ForbiddenException("Chỉ người tạo yêu cầu mới huỷ được yêu cầu này.");
        }
        refundAndRestore(r, me, "Huỷ đổi quà: " + r.getGiftNameSnapshot());

        r.setStatus(RedemptionStatus.CANCELLED);
        r.setHandledAt(Instant.now());
        return toResponse(redemptionRepository.save(r));
    }

    /**
     * Đánh dấu đã trao quà tận tay.
     *
     * <p>Nhận cả yêu cầu đang {@code PENDING}, không bắt phải qua bước duyệt: điểm đã
     * được kiếm hợp lệ và tồn kho đã giữ ngay lúc đặt, nên chẳng còn gì để "duyệt".
     * Bắt người quản lý bấm duyệt rồi mới bấm giao là hai thao tác cho một việc.
     *
     * <p>Vẫn nhận {@code APPROVED} để các yêu cầu tạo từ trước khi bỏ bước duyệt
     * không bị kẹt.
     */
    @Transactional
    public RedemptionResponse deliver(UUID id, RedemptionDecisionRequest request) {
        RewardRedemption r = redemptionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Yêu cầu đổi quà", "id", id));
        if (r.getStatus() != RedemptionStatus.PENDING && r.getStatus() != RedemptionStatus.APPROVED) {
            throw new BusinessException("Yêu cầu này không còn ở trạng thái chờ giao "
                    + "(hiện đang " + r.getStatus() + ").");
        }
        User actor = assertCanFulfill();

        // Gọi kênh giao quà tương ứng. v1 chỉ có quà nội bộ nên đây là no-op, nhưng đi
        // qua interface từ bây giờ để sau nối sàn quà tặng thì không phải mổ hàm này.
        RewardGiftItem gift = r.getGiftItem();
        fulfillmentProviders.stream()
                .filter(p -> p.supports(gift.getType()))
                .findFirst()
                .ifPresent(provider -> {
                    var result = provider.fulfill(r);
                    if (result.externalRef() != null) r.setExternalOrderId(result.externalRef());
                    // Hệ thống ngoài lỗi KHÔNG được chặn việc ghi nhận đã giao: quà có thể
                    // đã trao tay rồi. Chỉ ghi log để xử lý sau.
                    if (!result.ok()) {
                        log.warn("Giao quà qua kênh ngoài thất bại, redemptionId={}, lý do={}",
                                r.getId(), result.message());
                    }
                });

        r.setStatus(RedemptionStatus.DELIVERED);
        r.setDeliveredAt(Instant.now());
        r.setHandledBy(actor);
        r.setHandledAt(Instant.now());
        if (request != null && request.getNote() != null) r.setNote(request.getNote());
        return toResponse(redemptionRepository.save(r));
    }

    /**
     * Hoàn điểm và trả tồn kho. Dùng chung cho cả từ chối lẫn tự huỷ vì hai luồng khác
     * nhau ở trạng thái cuối, còn phần bù trừ thì y hệt.
     */
    private void refundAndRestore(RewardRedemption r, User actor, String note) {
        RewardTransaction refund = walletService.applyTransaction(RewardWalletService.LedgerEntry.builder()
                .organizationId(r.getOrganization().getId())
                .userId(r.getUser().getId())
                .amount(r.getPointsSpent())
                .type(RewardTransactionType.REFUND)
                .sourceType(RewardSourceType.REDEMPTION)
                .sourceRefId(r.getId())
                .reversalOfTransactionId(r.getTransactionId())
                .idempotencyKey(RewardWalletService.key("redeem_refund", r.getId()))
                .note(note)
                .actor(actor)
                .build());
        r.setRefundTransactionId(refund.getId());

        if (!Boolean.TRUE.equals(r.getGiftItem().getUnlimitedStock())) {
            giftRepository.restoreStock(r.getGiftItem().getId(), r.getQuantity());
        }
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
                me.getId(), context.getOrgIdOf(me.getId()), PageRequest.of(page, size)));
    }

    @Transactional(readOnly = true)
    public PageResponse<RedemptionResponse> search(RedemptionStatus status, int page, int size) {
        return toPage(redemptionRepository.search(
                context.getCurrentOrgId(), status, PageRequest.of(page, size)));
    }

    @Transactional(readOnly = true)
    public long countPending() {
        return redemptionRepository.countByOrganizationIdAndStatus(
                context.getCurrentOrgId(), RedemptionStatus.PENDING);
    }

    private PageResponse<RedemptionResponse> toPage(Page<RewardRedemption> page) {
        return PageResponse.<RedemptionResponse>builder()
                .content(page.getContent().stream().map(this::toResponse).toList())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }

    private RedemptionResponse toResponse(RewardRedemption r) {
        return RedemptionResponse.builder()
                .id(r.getId())
                .userId(r.getUser().getId())
                .userFullName(r.getUser().getFullName())
                .userEmail(r.getUser().getEmail())
                .userEmployeeCode(r.getUser().getEmployeeCode())
                .giftItemId(r.getGiftItem().getId())
                .giftNameSnapshot(r.getGiftNameSnapshot())
                // Lấy ảnh đã CHỤP, không lấy ảnh hiện tại của món quà — nếu không thì
                // đổi ảnh quà sẽ làm lịch sử hiện tên cũ kèm ảnh mới.
                .giftImageUrl(r.getGiftImageSnapshot())
                .quantity(r.getQuantity())
                .pointsSpent(r.getPointsSpent())
                .status(r.getStatus())
                .handledByUserId(r.getHandledBy() != null ? r.getHandledBy().getId() : null)
                .handledByName(r.getHandledBy() != null ? r.getHandledBy().getFullName() : null)
                .handledAt(r.getHandledAt())
                .deliveredAt(r.getDeliveredAt())
                .note(r.getNote())
                .createdAt(r.getCreatedAt())
                .build();
    }
}
