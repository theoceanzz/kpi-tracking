package com.kpitracking.service.reward.urbox;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Hình dạng dữ liệu UrBox trả về, chép đúng theo tài liệu "API tích hợp kho quà Evoucher".
 *
 * <p>Mọi record đều {@code ignoreUnknown}: UrBox thêm trường mới vào response bất cứ lúc
 * nào và điều đó KHÔNG được phép làm chết luồng đổi quà của nhân viên.
 *
 * <p>Nhiều trường số được UrBox trả về dưới dạng CHUỖI ({@code "price": "100000"}) và
 * cùng một trường có thể đổi kiểu giữa hai endpoint. Ở đây giữ nguyên {@code String} rồi
 * ép kiểu một chỗ trong {@link UrboxCatalogService} thay vì rải rác {@code @JsonFormat}.
 */
public final class UrboxApiModels {

    private UrboxApiModels() {
    }

    /**
     * Vỏ bọc chung mọi phản hồi.
     *
     * <p>UrBox trả HTTP 200 kể cả khi lỗi — {@code done = 1} mới là thành công thật,
     * {@code status} mang mã lỗi nghiệp vụ (xem bảng mã lỗi trong tài liệu).
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UrboxEnvelope<T>(Integer done, String msg, Integer status, T data) {

        public boolean ok() {
            return done != null && done == 1;
        }
    }

    // ────────────────────────────── Kho quà ──────────────────────────────

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UrboxGiftList(List<UrboxGift> items,
                                Integer totalPage,
                                String totalResult) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UrboxGift(
            String id,
            String title,
            /** Xem bảng "Loại quà tặng" trong tài liệu: 1 = voucher tiền mặt, 10 = item… */
            String type,
            String price,
            @JsonProperty("cat_id") String catId,
            @JsonProperty("cat_title") String catTitle,
            @JsonProperty("parent_cat_id") String parentCatId,
            @JsonProperty("brand_id") String brandId,
            /**
             * Ở {@code gift/lists} đây là MÃ thương hiệu ("500"); ở {@code gift/detail}
             * lại là TÊN thương hiệu ("Eve Flowers"). Đừng hiển thị thẳng trường này —
             * dùng {@code UrboxCatalogService#brandOf}.
             */
            String brand,
            @JsonProperty("brand_name") String brandName,
            @JsonProperty("brandImage") String brandImage,
            String image,
            @JsonProperty("expire_duration") String expireDuration,
            @JsonProperty("code_display") String codeDisplay,
            /** 1 = còn hàng, 2 = hết. Chỉ có khi request kèm {@code stock=1}. */
            Integer stock,
            /** Mô tả quà (HTML). Chỉ có khi request kèm {@code field=content,…}. */
            String content,
            /** Điều kiện sử dụng (HTML) — BẮT BUỘC hiển thị trước khi đổi. */
            String note,
            @JsonProperty("code_quantity") String codeQuantity,
            List<UrboxOffice> office) {
    }

    /** Cửa hàng áp dụng voucher. UrBox yêu cầu hiển thị nếu quà có. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UrboxOffice(String id,
                              String address,
                              String phone,
                              @JsonProperty("title_city") String titleCity,
                              @JsonProperty("brand_title") String brandTitle) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UrboxCategory(String id, String title, String images) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UrboxBrandList(List<UrboxBrand> items,
                                 @JsonProperty("brand_count") String brandCount,
                                 Integer totalPage) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UrboxBrand(String id,
                             String title,
                             String images,
                             @JsonProperty("gift_count") Integer giftCount,
                             @JsonProperty("cat_id") String catId,
                             @JsonProperty("cat_title") String catTitle) {
    }

    // ────────────────────────────── Đặt đơn ──────────────────────────────

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UrboxOrder(
            /**
             * 1 = chưa thanh toán (đơn tạo hụt), 2 = đã thanh toán và đã xuất code.
             * Chỉ {@code pay = 2} mới được coi là giao quà thành công.
             */
            Integer pay,
            @JsonProperty("transaction_id") String transactionId,
            String linkCart,
            UrboxCart cart) {

        public boolean paid() {
            return pay != null && pay == 2;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UrboxCart(String id,
                            String cartNo,
                            @JsonProperty("money_total") String moneyTotal,
                            @JsonProperty("link_gift") List<String> linkGift,
                            @JsonProperty("code_link_gift") List<UrboxVoucher> codeLinkGift) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UrboxVoucher(
            @JsonProperty("cart_detail_id") String cartDetailId,
            String code,
            /** Có giá trị thì BẮT BUỘC hiển thị kèm code. */
            String pin,
            /** Có giá trị thì BẮT BUỘC hiển thị kèm code. */
            String serial,
            String link,
            String token,
            @JsonProperty("priceId") String priceId,
            /** Hạn dùng dạng dd/MM/yyyy — hiển thị nguyên văn, không tự diễn giải. */
            String expired,
            @JsonProperty("code_display") String codeDisplay,
            /** 1 QR, 2 Barcode, 3 vật lý, 4 text, 5 cả QR lẫn Barcode. */
            @JsonProperty("code_display_type") Integer codeDisplayType,
            /** Ảnh mã do UrBox sinh sẵn — dùng ảnh này thay vì tự vẽ QR. */
            @JsonProperty("code_image") String codeImage) {
    }
}
