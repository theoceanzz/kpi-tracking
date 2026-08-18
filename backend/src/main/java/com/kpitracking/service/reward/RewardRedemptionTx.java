package com.kpitracking.service.reward;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.dto.request.reward.CreateRedemptionRequest;
import com.kpitracking.entity.RewardGiftItem;
import com.kpitracking.entity.RewardRedemption;
import com.kpitracking.entity.RewardTransaction;
import com.kpitracking.entity.User;
import com.kpitracking.enums.GiftItemStatus;
import com.kpitracking.enums.RedemptionStatus;
import com.kpitracking.enums.RewardSourceType;
import com.kpitracking.enums.RewardTransactionType;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.RewardGiftItemRepository;
import com.kpitracking.repository.RewardRedemptionRepository;
import com.kpitracking.service.RewardWalletService;
import com.kpitracking.service.reward.fulfillment.RewardFulfillmentProviders;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Các đơn vị GHI SỔ của luồng đổi quà, mỗi hàm một transaction riêng.
 *
 * <h2>Vì sao tách khỏi {@link RewardRedemptionService}</h2>
 * Quà voucher điện tử phải gọi HTTP sang UrBox. Cuộc gọi đó KHÔNG được nằm trong
 * transaction ghi sổ vì hai lý do độc lập nhau:
 *
 * <ul>
 *   <li>Giữ transaction mở suốt một cuộc gọi mạng dài (UrBox công bố timeout 60s) là
 *       cách nhanh nhất để cạn pool kết nối khi có vài chục người đổi quà cùng lúc.</li>
 *   <li>Quan trọng hơn: nếu gọi trong transaction rồi rollback khi timeout, dòng yêu cầu
 *       đổi biến mất cùng với mã giao dịch của nó — trong khi UrBox có thể đã xuất
 *       voucher. Mã đó là thứ DUY NHẤT lấy lại được món quà đã mua.</li>
 * </ul>
 *
 * <p>Nên thứ tự bắt buộc là: ghi sổ và COMMIT trước → gọi ra ngoài → ghi kết quả bằng
 * một transaction khác.
 *
 * <p>Spring chỉ áp dụng {@code @Transactional} khi gọi qua proxy, nên các hàm này phải
 * nằm ở một bean khác chứ không thể là hàm private của service.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RewardRedemptionTx {

    private final RewardRedemptionRepository redemptionRepository;
    private final RewardGiftItemRepository giftRepository;
    private final RewardWalletService walletService;
    private final RewardFulfillmentProviders fulfillmentProviders;
    private final RewardContext context;
    private final ObjectMapper objectMapper;

    /**
     * Tạo yêu cầu đổi: giữ tồn kho, ghi yêu cầu, trừ điểm — trong một transaction.
     *
     * <h2>Thứ tự thao tác</h2>
     * Giữ tồn kho TRƯỚC, trừ điểm SAU. Nếu trừ điểm hỏng (không đủ số dư) thì cả
     * transaction quay lui và tồn kho tự trả về. Làm ngược lại cũng đúng về kỹ thuật,
     * nhưng thứ tự này khiến ca thất bại phổ biến nhất (hết hàng) dừng sớm, chưa kịp
     * đụng vào sổ cái.
     */
    @Transactional
    public RewardRedemption create(CreateRedemptionRequest request) {
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

        // Giữ tồn kho bằng UPDATE có điều kiện. Đọc-rồi-ghi ở đây sẽ khiến hai người đổi
        // món cuối cùng cùng lúc đều thành công.
        if (!Boolean.TRUE.equals(gift.getUnlimitedStock())) {
            int affected = giftRepository.tryReserveStock(gift.getId(), qty);
            if (affected == 0) {
                throw new BusinessException("Quà \"" + gift.getName()
                        + "\" đã hết hàng hoặc không đủ số lượng bạn chọn.");
            }
        }

        // Quà do hệ thống ngoài xuất phải nằm chờ cho tới khi có mã quà thật, dù nó cũng
        // là loại "nhận ngay". Đóng luôn ở trạng thái đã giao rồi mới đi gọi UrBox sẽ
        // khiến một đơn hỏng hiện là "đã nhận" trong lịch sử của nhân viên.
        boolean waitForExternal = fulfillmentProviders.fulfillsOnRedeem(gift.getType());
        boolean needsDelivery = Boolean.TRUE.equals(gift.getRequiresDelivery());
        boolean settleNow = !needsDelivery && !waitForExternal;
        Instant now = Instant.now();

        // Lưu yêu cầu để có id, vì id đó là thành phần của khoá chống ghi trùng.
        RewardRedemption redemption = redemptionRepository.save(RewardRedemption.builder()
                .organization(gift.getOrganization())
                .user(me)
                .giftItem(gift)
                .giftNameSnapshot(gift.getName())
                .giftImageSnapshot(gift.getImageUrl())
                .quantity(qty)
                .pointsSpent(totalCost)
                .status(settleNow ? RedemptionStatus.DELIVERED : RedemptionStatus.PENDING)
                .deliveredAt(settleNow ? now : null)
                .note(request.getNote())
                .build());

        // Trừ điểm. Không đủ số dư thì ném lỗi ⇒ cả transaction quay lui, tồn kho tự trả về.
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
        return redemptionRepository.save(redemption);
    }

    /**
     * Nạp một yêu cầu đang chờ giao, kèm người đổi và món quà.
     *
     * <p>Mở transaction riêng thay vì dựa vào {@code open-in-view}: đối tượng này được
     * đọc tiếp trong lúc gọi HTTP sang nhà cung cấp — nghĩa là NGOÀI mọi transaction ghi
     * sổ — nên phải tự bảo đảm hai quan hệ lazy đã nạp xong.
     */
    @Transactional(readOnly = true)
    public RewardRedemption loadForDelivery(UUID id) {
        RewardRedemption r = load(id);
        if (r.getStatus() != RedemptionStatus.PENDING && r.getStatus() != RedemptionStatus.APPROVED) {
            throw new BusinessException("Yêu cầu này không còn ở trạng thái chờ giao "
                    + "(hiện đang " + r.getStatus() + ").");
        }
        return r;
    }

    /**
     * Quà nội bộ đã được trao tận tay: chỉ ghi nhận, không có hệ thống nào để gọi.
     *
     * <p>Người gọi đã kiểm tra quyền và trạng thái trước khi vào đây.
     */
    @Transactional
    public RewardRedemption markDeliveredByHand(UUID id, User actor, String note) {
        RewardRedemption r = load(id);
        Instant now = Instant.now();

        r.setStatus(RedemptionStatus.DELIVERED);
        r.setDeliveredAt(now);
        // Nhận cả đối tượng User thay vì id: phản hồi dựng SAU khi transaction đóng nên
        // một proxy chưa nạp sẽ ném LazyInitializationException lúc đọc tên người xử lý.
        r.setHandledBy(actor);
        r.setHandledAt(now);
        if (note != null) r.setNote(note);
        return redemptionRepository.save(r);
    }

    /** Hệ thống ngoài đã xuất quà: ghi mã đơn, lưu mã voucher, đóng yêu cầu. */
    @Transactional
    public RewardRedemption settleSuccess(UUID id, String externalRef, Map<String, Object> payload) {
        RewardRedemption r = load(id);
        Instant now = Instant.now();

        if (externalRef != null) r.setExternalOrderId(externalRef);
        r.setFulfillmentPayload(toJson(payload));
        r.setFulfillmentError(null);
        r.setFulfilledAt(now);
        r.setStatus(RedemptionStatus.DELIVERED);
        r.setDeliveredAt(now);
        return redemptionRepository.save(r);
    }

    /**
     * Hệ thống ngoài từ chối DỨT KHOÁT: hoàn điểm, trả tồn kho, đóng ở {@code FAILED}.
     *
     * <p>Chỉ gọi khi chắc chắn không có đơn nào được tạo bên kia. Với ca "không biết"
     * phải dùng {@link #recordPendingError} — hoàn điểm trong khi voucher đã xuất là mất
     * cả tiền lẫn hàng.
     */
    @Transactional
    public RewardRedemption settleFailure(UUID id, String message, boolean giftUnavailable) {
        RewardRedemption r = load(id);
        if (r.getStatus() != RedemptionStatus.PENDING && r.getStatus() != RedemptionStatus.APPROVED) {
            // Đã có người xử lý bằng tay trong lúc chờ. Không hoàn điểm lần hai.
            log.warn("Bỏ qua hoàn điểm cho yêu cầu {} vì đang ở trạng thái {}", id, r.getStatus());
            return r;
        }

        refundAndRestore(r, r.getUser(), "Không xuất được quà: " + r.getGiftNameSnapshot());
        r.setStatus(RedemptionStatus.FAILED);
        r.setFulfillmentError(message);
        r.setHandledAt(Instant.now());

        // Rút món quà khỏi cửa hàng khi nhà cung cấp báo nó hỏng hẳn. Chỉ ẩn (INACTIVE)
        // chứ không xoá: quà về hàng thì người quản lý bật lại bằng một cú bấm, còn lịch
        // sử đổi quà của nhân viên vẫn nguyên vẹn.
        if (giftUnavailable) {
            RewardGiftItem gift = r.getGiftItem();
            if (gift.getStatus() == GiftItemStatus.ACTIVE) {
                gift.setStatus(GiftItemStatus.INACTIVE);
                giftRepository.save(gift);
                log.warn("Đã ẩn quà \"{}\" ({}) khỏi cửa hàng vì nhà cung cấp không xuất được",
                        gift.getName(), gift.getId());
            }
        }
        return redemptionRepository.save(r);
    }

    /**
     * Không rõ hệ thống ngoài đã xuất quà hay chưa: GIỮ NGUYÊN yêu cầu, chỉ ghi lại lý
     * do. Người có quyền xử lý bấm "Giao quà" là hệ thống hỏi lại UrBox bằng đúng mã
     * giao dịch cũ và lấy về đơn đã tạo (nếu có).
     */
    @Transactional
    public RewardRedemption recordPendingError(UUID id, String message) {
        RewardRedemption r = load(id);
        r.setFulfillmentError(message);
        return redemptionRepository.save(r);
    }

    /**
     * Hoàn điểm và trả tồn kho. Dùng chung cho từ chối, tự huỷ và đơn ngoài hỏng — ba
     * luồng khác nhau ở trạng thái cuối, còn phần bù trừ thì y hệt.
     *
     * <p>Không mở transaction riêng: người gọi luôn đang ở trong một transaction, và phần
     * bù trừ này phải sống chết cùng việc đổi trạng thái.
     */
    public void refundAndRestore(RewardRedemption r, User actor, String note) {
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

    /**
     * Nạp yêu cầu kèm người đổi và món quà.
     *
     * <p>Chạm vào hai quan hệ lazy NGAY trong transaction là cố ý: đối tượng trả về sẽ
     * được đọc tiếp sau khi transaction đóng (để dựng phản hồi, để đặt đơn UrBox), lúc
     * đó proxy chưa nạp sẽ ném {@code LazyInitializationException}.
     */
    private RewardRedemption load(UUID id) {
        RewardRedemption r = redemptionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Yêu cầu đổi quà", "id", id));
        r.getUser().getEmail();
        r.getGiftItem().getName();
        return r;
    }

    private String toJson(Map<String, Object> payload) {
        if (payload == null) return null;
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            // Mất phần hiển thị mã quà thì tệ, nhưng làm hỏng cả việc ghi nhận đã giao
            // còn tệ hơn: nhân viên sẽ thấy đơn treo trong khi voucher đã xuất.
            log.error("Không tuần tự hoá được dữ liệu quà ngoài: {}", e.getMessage());
            return null;
        }
    }
}
