package com.kpitracking.service.reward.urbox;

import com.kpitracking.config.UrboxProperties;
import com.kpitracking.dto.request.urbox.ImportUrboxGiftRequest;
import com.kpitracking.dto.response.reward.GiftItemResponse;
import com.kpitracking.dto.response.urbox.UrboxCatalogPageResponse;
import com.kpitracking.dto.response.urbox.UrboxGiftResponse;
import com.kpitracking.dto.response.urbox.UrboxStatusResponse;
import com.kpitracking.dto.response.urbox.UrboxTaxonomyResponse;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.RewardGiftItem;
import com.kpitracking.enums.GiftItemStatus;
import com.kpitracking.enums.GiftItemType;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.RewardGiftItemRepository;
import com.kpitracking.service.reward.RewardContext;
import com.kpitracking.service.reward.urbox.UrboxApiModels.UrboxGift;
import com.kpitracking.service.reward.urbox.UrboxApiModels.UrboxGiftList;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Duyệt kho quà UrBox và nhập quà về danh mục của tổ chức.
 *
 * <h2>Nhập từng món, không đồng bộ cả kho</h2>
 * Giftset UrBox có hơn một nghìn món và đổi liên tục. Đồng bộ hết vào cửa hàng sẽ chôn
 * vùi vài món quà nội bộ mà công ty thật sự muốn trao, và biến mỗi lần UrBox đổi danh
 * sách thành một đợt xáo trộn cửa hàng mà không ai yêu cầu. Quản trị viên chọn tay đúng
 * những món hợp với ngân sách của mình.
 *
 * <h2>Chụp lại phần hiển thị lúc nhập</h2>
 * Tên, ảnh, mệnh giá, điều kiện sử dụng được chép vào {@code reward_gift_items} ngay lúc
 * nhập. Cửa hàng của nhân viên vì thế không gọi UrBox lần nào — đúng khuyến nghị của họ
 * (đọc kho quà 1 lần/ngày), và cửa hàng vẫn mở được khi UrBox có sự cố.
 */
@Service
@RequiredArgsConstructor
public class UrboxCatalogService {

    private final UrboxClient client;
    private final UrboxProperties props;
    private final RewardGiftItemRepository giftRepository;
    private final OrganizationRepository organizationRepository;
    private final RewardContext context;

    public UrboxStatusResponse getStatus() {
        return UrboxStatusResponse.builder()
                .enabled(props.isConfigured())
                .canOrder(props.isOrderConfigured())
                .sandbox(props.getBaseUrl() != null && props.getBaseUrl().contains("sand"))
                .signed(props.getPrivateKey() != null && !props.getPrivateKey().isBlank())
                .build();
    }

    // ─────────────────────────────── Duyệt kho ───────────────────────────────

    /**
     * CỐ Ý không có {@code @Transactional}: hàm này gọi HTTP ra ngoài, và giữ một
     * transaction mở suốt cuộc gọi đó chỉ để đọc hai dòng dữ liệu là cách nhanh nhất
     * làm cạn pool kết nối. Đọc xong dữ liệu cần rồi mới gọi ra ngoài.
     */
    public UrboxCatalogPageResponse browse(String catId, String brandId, String title,
                                           Integer page, Integer perPage) {
        UUID orgId = context.getCurrentOrgId();
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", orgId));
        Set<String> alreadyImported = importedSkus(orgId);

        int size = perPage == null || perPage < 1 ? 24 : Math.min(perPage, 100);
        // UrBox đánh số trang từ 1; giao diện của hệ thống đếm từ 0 như mọi chỗ khác.
        int pageNo = (page == null || page < 0 ? 0 : page) + 1;

        UrboxGiftList result = client.listGifts(catId, brandId, title, pageNo, size);
        List<UrboxGift> items = result == null || result.items() == null ? List.of() : result.items();

        long rate = org.getPointExchangeRate() == null || org.getPointExchangeRate() <= 0
                ? 1000L : org.getPointExchangeRate();

        return UrboxCatalogPageResponse.builder()
                .items(items.stream().map(g -> toResponse(g, alreadyImported, rate)).toList())
                .page(pageNo - 1)
                .totalPages(result == null ? 1 : result.totalPage())
                .totalResult(result == null ? null : result.totalResult())
                .build();
    }

    public List<UrboxTaxonomyResponse> listCategories(Integer parentId) {
        List<UrboxApiModels.UrboxCategory> categories = client.listCategories(parentId);
        if (categories == null) return List.of();
        return categories.stream()
                .map(c -> UrboxTaxonomyResponse.builder()
                        .id(c.id())
                        .name(c.title())
                        .imageUrl(c.images())
                        .build())
                .toList();
    }

    public List<UrboxTaxonomyResponse> listBrands(String catId) {
        var brands = client.listBrands(catId, 1, 100);
        if (brands == null || brands.items() == null) return List.of();
        return brands.items().stream()
                .map(b -> UrboxTaxonomyResponse.builder()
                        .id(b.id())
                        .name(b.title())
                        .imageUrl(b.images())
                        .giftCount(b.giftCount())
                        .build())
                .toList();
    }

    // ─────────────────────────────── Nhập quà ───────────────────────────────

    /**
     * Nhập một món UrBox vào danh mục quà của tổ chức.
     *
     * <p>Gọi {@code gift/detail} chứ không dùng lại dữ liệu màn hình danh sách: giao diện
     * có thể đang giữ một trang đã cũ, và detail là nơi UrBox trả về đầy đủ điều kiện sử
     * dụng — thứ bắt buộc phải hiển thị trước khi nhân viên bấm đổi. Nó cũng là phép kiểm
     * tra rằng món quà thật sự thuộc giftset của KeyGo.
     *
     * <p>Không mở transaction bao quanh cả hàm: chỉ có đúng một lệnh ghi ở cuối, còn ở
     * giữa là một cuộc gọi HTTP. Bao lại chỉ để "cho chắc" là giữ kết nối DB chờ mạng.
     */
    public GiftItemResponse importGift(ImportUrboxGiftRequest request) {
        UUID orgId = context.getCurrentOrgId();
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", orgId));

        if (giftRepository.existsByOrganizationIdAndExternalProviderAndExternalSku(
                orgId, UrboxFulfillmentProvider.PROVIDER, request.getUrboxGiftId())) {
            throw new BusinessException("Món quà này đã có trong danh mục của bạn. "
                    + "Hãy sửa giá điểm ở danh mục thay vì nhập lại.");
        }

        UrboxGift gift = client.getGiftDetail(request.getUrboxGiftId());
        if (gift == null || gift.id() == null) {
            throw new BusinessException("Không tìm thấy quà này trong kho UrBox của bạn.");
        }

        long rate = org.getPointExchangeRate() == null || org.getPointExchangeRate() <= 0
                ? 1000L : org.getPointExchangeRate();
        Long value = parseLong(gift.price());
        Integer pointCost = request.getPointCost() != null
                ? request.getPointCost()
                : suggestPointCost(value, rate);
        if (pointCost == null || pointCost < 1) {
            throw new BusinessException("Không suy được giá điểm cho quà này. Hãy nhập số điểm cụ thể.");
        }

        boolean unlimited = request.getStockQuantity() == null;

        RewardGiftItem item = RewardGiftItem.builder()
                .organization(org)
                .name(request.getName() != null && !request.getName().isBlank()
                        ? request.getName().trim() : gift.title())
                .description(gift.content())
                .imageUrl(imageOf(gift))
                .pointCost(pointCost)
                .unlimitedStock(unlimited)
                // Voucher điện tử: mã về ngay trên màn hình, không ai phải trao tay.
                .requiresDelivery(false)
                .type(GiftItemType.EXTERNAL_VOUCHER)
                .status(GiftItemStatus.ACTIVE)
                .displayOrder(request.getDisplayOrder() != null ? request.getDisplayOrder() : 0)
                .externalProvider(UrboxFulfillmentProvider.PROVIDER)
                .externalSku(gift.id())
                .externalValue(value)
                .externalBrand(brandOf(gift))
                .externalTerms(gift.note())
                .externalExpireText(gift.expireDuration())
                .externalCodeDisplay(gift.codeDisplay())
                .externalSyncedAt(Instant.now())
                .build();
        item.setStockByAdmin(unlimited ? 0 : request.getStockQuantity());

        RewardGiftItem saved = giftRepository.save(item);
        return GiftItemResponse.builder()
                .id(saved.getId())
                .name(saved.getName())
                .description(saved.getDescription())
                .imageUrl(saved.getImageUrl())
                .pointCost(saved.getPointCost())
                .stockQuantity(unlimited ? null : saved.getStockQuantity())
                .unlimitedStock(unlimited)
                .requiresDelivery(false)
                .type(saved.getType())
                .status(saved.getStatus())
                .displayOrder(saved.getDisplayOrder())
                .available(unlimited || saved.getStockQuantity() > 0)
                .externalProvider(saved.getExternalProvider())
                .externalValue(saved.getExternalValue())
                .externalBrand(saved.getExternalBrand())
                .externalTerms(saved.getExternalTerms())
                .externalExpireText(saved.getExternalExpireText())
                .build();
    }

    // ─────────────────────────────── Nội bộ ───────────────────────────────

    private Set<String> importedSkus(UUID orgId) {
        return giftRepository
                .findByOrganizationIdAndExternalProvider(orgId, UrboxFulfillmentProvider.PROVIDER)
                .stream()
                .map(RewardGiftItem::getExternalSku)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
    }

    private UrboxGiftResponse toResponse(UrboxGift g, Set<String> imported, long rate) {
        Long value = parseLong(g.price());
        return UrboxGiftResponse.builder()
                .urboxGiftId(g.id())
                .name(g.title())
                .imageUrl(imageOf(g))
                .brandName(brandOf(g))
                .brandImageUrl(g.brandImage())
                .categoryName(g.catTitle())
                .value(value)
                .expireText(g.expireDuration())
                .codeDisplay(g.codeDisplay())
                .content(g.content())
                .terms(g.note())
                // stock = 1 còn hàng, 2 hết. Không có trường này thì coi như còn — UrBox
                // chỉ trả về khi được hỏi, và chặn nhầm một món còn hàng thì tệ hơn.
                .inStock(g.stock() == null || g.stock() != 2)
                .imported(imported.contains(g.id()))
                .suggestedPointCost(suggestPointCost(value, rate))
                .build();
    }

    /**
     * Làm tròn LÊN: làm tròn xuống nghĩa là bán quà rẻ hơn số tiền tổ chức thật sự bỏ ra
     * cho món đó.
     */
    private static Integer suggestPointCost(Long value, long rate) {
        if (value == null || value <= 0) return null;
        long points = (value + rate - 1) / rate;
        return (int) Math.max(1, Math.min(points, Integer.MAX_VALUE));
    }

    /**
     * Ảnh quà. UrBox để trống {@code image} ở khá nhiều món trong giftset thử — rơi về
     * ảnh thương hiệu còn hơn một ô xám không nói lên điều gì.
     */
    private static String imageOf(UrboxGift g) {
        if (g.image() != null && !g.image().isBlank()) return g.image();
        return g.brandImage();
    }

    /**
     * Tên thương hiệu. {@code gift/lists} trả MÃ thương hiệu vào trường {@code brand}
     * ("500") còn {@code gift/detail} trả TÊN ("Eve Flowers") — hiển thị thẳng sẽ cho ra
     * một con số vô nghĩa ở màn hình danh sách.
     */
    private static String brandOf(UrboxGift g) {
        if (g.brandName() != null && !g.brandName().isBlank()) return g.brandName();
        String brand = g.brand();
        if (brand == null || brand.isBlank() || brand.chars().allMatch(Character::isDigit)) {
            return null;
        }
        return brand;
    }

    private static Long parseLong(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
