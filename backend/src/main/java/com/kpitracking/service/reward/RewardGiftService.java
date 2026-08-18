package com.kpitracking.service.reward;

import com.kpitracking.dto.request.reward.GiftItemRequest;
import com.kpitracking.dto.response.reward.GiftItemResponse;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.RewardGiftItem;
import com.kpitracking.entity.RewardWallet;
import com.kpitracking.enums.GiftItemStatus;
import com.kpitracking.enums.GiftItemType;
import com.kpitracking.enums.RedemptionStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.RewardGiftItemRepository;
import com.kpitracking.repository.RewardRedemptionRepository;
import com.kpitracking.repository.RewardWalletRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/** Danh mục quà của tổ chức. */
@Service
@RequiredArgsConstructor
public class RewardGiftService {

    private final RewardGiftItemRepository giftRepository;
    private final RewardRedemptionRepository redemptionRepository;
    private final RewardWalletRepository walletRepository;
    private final OrganizationRepository organizationRepository;
    private final RewardContext context;

    /**
     * Cửa hàng cho nhân viên: chỉ quà đang bật, kèm cờ đủ điểm hay không.
     *
     * <p>Cờ {@code affordable} tính ở đây thay vì để giao diện tự so số dư với từng món —
     * như vậy luật hiển thị luôn khớp luật trừ điểm thật, và giao diện không phải biết
     * quy tắc nghiệp vụ.
     */
    @Transactional(readOnly = true)
    public List<GiftItemResponse> getShop() {
        var me = context.getCurrentUser();
        UUID orgId = context.getOrgIdOf(me.getId());
        int balance = walletRepository.findByOrganizationIdAndUserId(orgId, me.getId())
                .map(RewardWallet::getBalance)
                .orElse(0);

        return giftRepository
                .findByOrganizationIdAndStatusOrderByDisplayOrderAscNameAsc(orgId, GiftItemStatus.ACTIVE)
                .stream()
                .map(g -> toResponse(g, balance))
                .toList();
    }

    /**
     * Màn hình quản trị: lấy cả quà đang tắt, kèm số yêu cầu đang chờ của từng món.
     *
     * <p>Con số đó là lý do người quản lý bị chặn sửa tồn kho hoặc xoá quà — hiện sẵn
     * để họ hiểu trước khi bấm, thay vì bấm rồi mới nhận thông báo lỗi.
     */
    @Transactional(readOnly = true)
    public List<GiftItemResponse> listForManage() {
        UUID orgId = context.getCurrentOrgId();

        // Đếm một lần cho cả danh sách thay vì mỗi món một truy vấn.
        Map<UUID, Long> pendingByGift = redemptionRepository.countPendingByGift(orgId).stream()
                .collect(Collectors.toMap(row -> (UUID) row[0], row -> (Long) row[1]));

        return giftRepository
                .findByOrganizationIdOrderByDisplayOrderAscNameAsc(orgId)
                .stream()
                .map(g -> {
                    GiftItemResponse res = toResponse(g, null);
                    res.setPendingRedemptionCount(pendingByGift.getOrDefault(g.getId(), 0L).intValue());
                    return res;
                })
                .toList();
    }

    @Transactional
    public GiftItemResponse create(GiftItemRequest request) {
        UUID orgId = context.getCurrentOrgId();
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", orgId));

        RewardGiftItem gift = RewardGiftItem.builder()
                .organization(org)
                .name(request.getName())
                .description(request.getDescription())
                .imageUrl(request.getImageUrl())
                .pointCost(request.getPointCost())
                .unlimitedStock(Boolean.TRUE.equals(request.getUnlimitedStock()))
                // Mặc định CẦN trao tay: đánh nhầm thành "nhận ngay" sẽ khiến nhân viên
                // tưởng đã nhận quà trong khi chẳng ai gửi gì cho họ.
                .requiresDelivery(request.getRequiresDelivery() == null
                        || request.getRequiresDelivery())
                .type(request.getType() != null ? request.getType() : GiftItemType.INTERNAL)
                .status(request.getStatus() != null ? request.getStatus() : GiftItemStatus.ACTIVE)
                .displayOrder(request.getDisplayOrder() != null ? request.getDisplayOrder() : 0)
                .build();
        gift.setStockByAdmin(Boolean.TRUE.equals(request.getUnlimitedStock()) ? 0 : request.getStockQuantity());

        return toResponse(giftRepository.save(gift), null);
    }

    @Transactional
    public GiftItemResponse update(UUID id, GiftItemRequest request) {
        RewardGiftItem gift = load(id);

        gift.setName(request.getName());
        gift.setDescription(request.getDescription());
        gift.setImageUrl(request.getImageUrl());
        gift.setPointCost(request.getPointCost());
        gift.setUnlimitedStock(Boolean.TRUE.equals(request.getUnlimitedStock()));
        if (request.getRequiresDelivery() != null) {
            gift.setRequiresDelivery(request.getRequiresDelivery());
        }
        // Quà nhập từ nhà cung cấp ngoài KHÔNG được đổi loại: đổi thành quà nội bộ là
        // biến một voucher phải mua thật thành thứ hệ thống tưởng tự trao tay được, và
        // mọi lượt đổi sau đó sẽ đóng ở "đã giao" mà chẳng có mã quà nào.
        if (request.getType() != null && gift.getExternalProvider() == null) {
            gift.setType(request.getType());
        }
        if (request.getStatus() != null) gift.setStatus(request.getStatus());
        if (request.getDisplayOrder() != null) gift.setDisplayOrder(request.getDisplayOrder());

        // Đặt lại tồn kho bằng con số tuyệt đối — đường DUY NHẤT ngoài luồng đổi quà
        // được chạm vào tồn kho. Luồng đổi quà dùng UPDATE có điều kiện ở repository.
        //
        // CHẶN khi đang có yêu cầu chờ: tồn kho hiện tại đã bị trừ đi phần giữ chỗ cho
        // các yêu cầu đó. Ghi đè một con số tuyệt đối lên sẽ xoá mất phần giữ chỗ, rồi
        // khi yêu cầu bị từ chối thì restoreStock lại cộng thêm ⇒ tồn kho phình lên
        // không đúng thực tế.
        boolean stockChanged = !Boolean.TRUE.equals(request.getUnlimitedStock())
                && request.getStockQuantity() != null
                && !request.getStockQuantity().equals(gift.getStockQuantity());
        if (stockChanged) {
            long pending = redemptionRepository.countByGiftItemIdAndStatus(id, RedemptionStatus.PENDING);
            if (pending > 0) {
                throw new BusinessException("Không thể sửa tồn kho khi đang có " + pending
                        + " yêu cầu đổi chờ xử lý — số tồn hiện tại đã trừ sẵn phần giữ chỗ cho các "
                        + "yêu cầu đó. Hãy xử lý xong rồi sửa, hoặc chọn \"Không giới hạn số lượng\".");
            }
            gift.setStockByAdmin(request.getStockQuantity());
        }

        return toResponse(giftRepository.save(gift), null);
    }

    /**
     * Xoá quà — CHỈ được phép khi chưa từng có ai đổi món này.
     *
     * <p>Quà bị xoá mềm sẽ biến mất khỏi mọi truy vấn vì entity mang
     * {@code @SQLRestriction("deleted_at IS NULL")}. Yêu cầu đổi cũ trỏ về nó qua
     * {@code @ManyToOne} sẽ ném {@code EntityNotFoundException} lúc nạp — làm vỡ cả màn
     * hình "Quà đã đổi" của nhân viên lẫn tab duyệt. Việc hoàn tồn kho khi từ chối cũng
     * hỏng theo, vì câu UPDATE có điều kiện {@code deleted_at IS NULL}.
     *
     * <p>Với quà đã có lịch sử, thứ người quản lý thực sự cần là ẨN nó khỏi cửa hàng
     * ({@code status = INACTIVE}) chứ không phải xoá — lịch sử vẫn đọc được, nhân viên
     * không đổi thêm được nữa.
     */
    @Transactional
    public void delete(UUID id) {
        RewardGiftItem gift = load(id);

        long pending = redemptionRepository.countByGiftItemIdAndStatus(id, RedemptionStatus.PENDING);
        if (pending > 0) {
            throw new BusinessException("Không thể xoá \"" + gift.getName() + "\" vì đang có "
                    + pending + " yêu cầu đổi chờ xử lý. Hãy duyệt hoặc từ chối các yêu cầu đó trước, "
                    + "hoặc bỏ chọn \"Đang bày bán\" để tạm ẩn quà khỏi cửa hàng.");
        }

        long total = redemptionRepository.countByGiftItemId(id);
        if (total > 0) {
            throw new BusinessException("Không thể xoá \"" + gift.getName() + "\" vì đã có " + total
                    + " lượt đổi trong lịch sử — xoá sẽ làm hỏng lịch sử đổi quà của nhân viên. "
                    + "Hãy bỏ chọn \"Đang bày bán\" để ẩn quà khỏi cửa hàng thay vì xoá.");
        }

        gift.setDeletedAt(Instant.now());
        giftRepository.save(gift);
    }

    private RewardGiftItem load(UUID id) {
        RewardGiftItem gift = giftRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Quà tặng", "id", id));
        if (!gift.getOrganization().getId().equals(context.getCurrentOrgId())) {
            throw new BusinessException("Quà này không thuộc tổ chức của bạn.");
        }
        return gift;
    }

    private GiftItemResponse toResponse(RewardGiftItem g, Integer viewerBalance) {
        boolean unlimited = Boolean.TRUE.equals(g.getUnlimitedStock());
        boolean available = g.getStatus() == GiftItemStatus.ACTIVE
                && (unlimited || g.getStockQuantity() > 0);

        return GiftItemResponse.builder()
                .id(g.getId())
                .name(g.getName())
                .description(g.getDescription())
                .imageUrl(g.getImageUrl())
                .pointCost(g.getPointCost())
                .stockQuantity(unlimited ? null : g.getStockQuantity())
                .unlimitedStock(unlimited)
                .requiresDelivery(g.getRequiresDelivery())
                .type(g.getType())
                .status(g.getStatus())
                .displayOrder(g.getDisplayOrder())
                .available(available)
                .affordable(viewerBalance == null ? null : viewerBalance >= g.getPointCost())
                .externalProvider(g.getExternalProvider())
                .externalValue(g.getExternalValue())
                .externalBrand(g.getExternalBrand())
                .externalTerms(g.getExternalTerms())
                .externalExpireText(g.getExternalExpireText())
                .build();
    }
}
