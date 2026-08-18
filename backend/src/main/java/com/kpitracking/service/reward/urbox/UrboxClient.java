package com.kpitracking.service.reward.urbox;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.config.UrboxProperties;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.service.reward.urbox.UrboxApiModels.*;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Lớp gọi HTTP tới UrBox. CHỈ biết giao thức — không biết gì về ví điểm, tổ chức hay
 * yêu cầu đổi quà.
 *
 * <h2>Vì sao GET truyền tham số trên query string</h2>
 * Tài liệu UrBox viết mẫu {@code curl -X GET --data '{...}'} (thân JSON trên GET). Đã thử
 * cả hai cách trên sandbox, cả hai đều chạy; chọn query string vì thân request trên GET là
 * thứ nhiều proxy và request factory mặc định của Spring không cho phép.
 *
 * <h2>UrBox trả HTTP 200 cho cả lỗi</h2>
 * Phải đọc {@code done} trong thân phản hồi. Coi mã HTTP là đủ sẽ khiến "quà đã hết"
 * lặng lẽ đi tiếp thành một đơn rỗng.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UrboxClient {

    private final UrboxProperties props;
    private final ObjectMapper objectMapper;

    private RestClient http;

    /** Giữ lại để log ra được URL đầy đủ khi chẩn đoán. */
    private String baseUrl;

    @PostConstruct
    void init() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) props.getConnectTimeout().toMillis());
        factory.setReadTimeout((int) props.getReadTimeout().toMillis());

        this.baseUrl = props.getBaseUrl() == null ? "" : props.getBaseUrl().trim();

        this.http = RestClient.builder()
                .baseUrl(this.baseUrl)
                .requestFactory(factory)
                .build();
        log.info("UrBox: {} (base-url {})", props.isConfigured() ? "đã bật" : "chưa cấu hình", this.baseUrl);
    }

    // ─────────────────────────────── Đọc kho quà ───────────────────────────────

    /**
     * Danh sách quà trong giftset UrBox đã cấu hình riêng cho KeyGo.
     *
     * <p>UrBox chặn 500 quà mỗi request, nên {@code perPage} luôn phải truyền — bỏ trống
     * thì bộ quà lớn hơn 500 sẽ bị cắt lặng lẽ.
     */
    public UrboxGiftList listGifts(String catId, String brandId, String title,
                                   Integer pageNo, Integer perPage) {
        return get("/4.0/gift/lists",
                params -> {
                    putIfPresent(params, "cat_id", catId);
                    putIfPresent(params, "brand_id", brandId);
                    putIfPresent(params, "title", title);
                    putIfPresent(params, "page_no", pageNo);
                    putIfPresent(params, "per_page", perPage);
                    // Điều kiện sử dụng và mô tả là thứ BẮT BUỘC hiển thị trước khi đổi;
                    // không xin ở đây thì phải gọi thêm gift/detail cho từng món.
                    params.add("field", "content,note,office");
                    // Lấy cả quà đã hết để hiện xám thay vì biến mất không lời giải thích.
                    params.add("stock", "1");
                    params.add("lang", "vi");
                },
                new ParameterizedTypeReference<UrboxEnvelope<UrboxGiftList>>() {
                });
    }

    public UrboxGift getGiftDetail(String giftId) {
        return get("/4.0/gift/detail",
                params -> {
                    params.add("id", giftId);
                    params.add("lang", "vi");
                },
                new ParameterizedTypeReference<UrboxEnvelope<UrboxGift>>() {
                });
    }

    /** {@code parentId = 2} là danh mục quà eVoucher, {@code 136} là quà vật lý. */
    public List<UrboxCategory> listCategories(Integer parentId) {
        return get("/2.0/category/catbyparent",
                params -> {
                    params.add("parent_id", String.valueOf(parentId == null ? 2 : parentId));
                    params.add("lang", "vi");
                },
                new ParameterizedTypeReference<UrboxEnvelope<List<UrboxCategory>>>() {
                });
    }

    public UrboxBrandList listBrands(String catId, Integer pageNo, Integer perPage) {
        return get("/4.0/gift/brand",
                params -> {
                    putIfPresent(params, "cat_id", catId);
                    putIfPresent(params, "page_no", pageNo);
                    putIfPresent(params, "per_page", perPage);
                },
                new ParameterizedTypeReference<UrboxEnvelope<UrboxBrandList>>() {
                });
    }

    // ─────────────────────────────── Đặt đơn ───────────────────────────────

    /**
     * Đặt đơn đổi quà eVoucher.
     *
     * <p>{@code transactionId} PHẢI ổn định theo yêu cầu đổi quà bên KeyGo. UrBox coi nó
     * là khoá chống trùng: gọi lại cùng một mã sẽ trả về ĐÚNG đơn cũ kèm mã quà đã xuất,
     * thay vì trừ tiền lần nữa. Đây là đường thoát duy nhất khi request bị timeout —
     * sinh mã mới lúc đó là mua quà hai lần.
     *
     * @throws BusinessException khi UrBox từ chối, kèm nguyên văn thông điệp của họ để
     *                           người vận hành tra được bảng mã lỗi.
     */
    public UrboxOrder placeOrder(String siteUserId, String transactionId,
                                 List<OrderLine> lines, String phone, String email,
                                 String fullName) {
        if (!props.isOrderConfigured()) {
            throw new BusinessException("Kết nối UrBox chưa được cấu hình đầy đủ "
                    + "(thiếu campaign_code). Liên hệ quản trị hệ thống.");
        }

        List<Map<String, Object>> dataBuy = lines.stream().map(OrderLine::toPayload).toList();

        // Chỉ 7 trường này được ký, đúng như tài liệu. Ký thừa hay thiếu một trường đều
        // cho ra chữ ký UrBox không xác thực được.
        Map<String, Object> signed = new TreeMap<>();
        signed.put("app_id", props.getAppId());
        signed.put("app_secret", props.getAppSecret());
        signed.put("campaign_code", props.getCampaignCode());
        signed.put("dataBuy", dataBuy);
        signed.put("isSendSms", props.isSendSms() ? 1 : 0);
        signed.put("site_user_id", siteUserId);
        signed.put("transaction_id", transactionId);

        Map<String, Object> body = new LinkedHashMap<>(signed);
        body.put("shorten", props.isShortenLink() ? 1 : 0);
        // Số điện thoại phục vụ tra cứu chăm sóc khách hàng phía UrBox. Chỉ gửi khi có —
        // gửi chuỗi rỗng sẽ rơi vào nhánh kiểm tra định dạng của họ.
        putIfPresent(body, "ttphone", phone);
        putIfPresent(body, "ttemail", email);
        putIfPresent(body, "ttfullname", fullName);

        String signature = sign(signed);

        UrboxEnvelope<UrboxOrder> response;
        try {
            response = http.post()
                    .uri("/2.0/cart/cartPayVoucher")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Signature", signature == null ? "" : signature)
                    .body(body)
                    .retrieve()
                    .body(new ParameterizedTypeReference<UrboxEnvelope<UrboxOrder>>() {
                    });
        } catch (RestClientResponseException e) {
            // Vẫn coi là "không biết" chứ không phải "thất bại", kể cả với 4xx: UrBox có
            // thể đã ghi nhận đơn rồi mới hỏng ở tầng trả lời. Đường an toàn duy nhất là
            // hỏi lại bằng chính transaction_id này, không phải hoàn điểm rồi cho đổi lại.
            log.error("UrBox cartPayVoucher trả HTTP {} cho đơn {}: {}",
                    e.getStatusCode().value(), transactionId,
                    abbreviate(e.getResponseBodyAsString()));
            throw new UrboxUnreachableException(transactionId, e);
        } catch (RestClientException e) {
            log.error("Không gọi được UrBox cartPayVoucher, transactionId={}: {}",
                    transactionId, e.getMessage());
            throw new UrboxUnreachableException(transactionId, e);
        }

        if (response == null || !response.ok() || response.data() == null) {
            String detail = response == null ? "không có phản hồi" : response.msg();
            Integer status = response == null ? null : response.status();
            log.warn("UrBox từ chối đơn transactionId={}: status={} msg={}",
                    transactionId, status, detail);
            // Giữ nguyên MÃ của UrBox chứ không chỉ thông điệp: người gọi phải phân biệt
            // được "món quà này hết sạch" với "đơn hàng trục trặc" để quyết định có rút
            // quà khỏi cửa hàng hay không. Dò chuỗi tiếng Việt để đoán là cách hỏng ngay
            // lần đầu UrBox sửa câu chữ.
            throw new UrboxRejectedException(status == null ? 0 : status,
                    "UrBox từ chối đơn đổi quà"
                            + (detail == null || detail.isBlank() ? "" : ": " + detail)
                            + (status == null ? "" : " (mã " + status + ")"));
        }
        return response.data();
    }

    /** Một dòng quà trong đơn. {@code amount} chỉ dùng cho quà cho phép tự nhập mệnh giá. */
    public record OrderLine(String priceId, int quantity, Long amount) {

        Map<String, Object> toPayload() {
            Map<String, Object> line = new LinkedHashMap<>();
            line.put("priceId", priceId);
            line.put("quantity", quantity);
            if (amount != null) line.put("amount", amount);
            return line;
        }
    }

    /** Đường truyền hỏng — KHÁC với "UrBox từ chối". Đơn có thể đã tồn tại bên UrBox. */
    public static class UrboxUnreachableException extends RuntimeException {
        public UrboxUnreachableException(String transactionId, Throwable cause) {
            super("Không kết nối được tới UrBox (transaction_id=" + transactionId + ")", cause);
        }
    }

    // ─────────────────────────────── Chữ ký ───────────────────────────────

    /**
     * Ký theo đúng công thức UrBox: sắp key theo alphabet → json_encode → SHA256withRSA
     * → base64.
     *
     * <p>{@link TreeMap} lo phần sắp xếp, Jackson sinh JSON không khoảng trắng giống
     * {@code json_encode} của PHP. Cả 7 trường được ký đều thuần ASCII nên không vướng
     * khác biệt escape unicode giữa hai ngôn ngữ.
     *
     * <p>Trả {@code null} khi chưa cấu hình private key — sandbox không kiểm chữ ký, còn
     * PROD sẽ tự từ chối đơn, rõ ràng hơn là để service tự đoán.
     */
    private String sign(Map<String, Object> signedFields) {
        String pem = props.getPrivateKey();
        if (pem == null || pem.isBlank()) {
            return null;
        }
        try {
            String json = objectMapper.writeValueAsString(signedFields);
            Signature rsa = Signature.getInstance("SHA256withRSA");
            rsa.initSign(loadPrivateKey(pem));
            rsa.update(json.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(rsa.sign());
        } catch (Exception e) {
            log.error("Không ký được request UrBox: {}", e.getMessage());
            throw new BusinessException("Không ký được yêu cầu gửi UrBox. "
                    + "Kiểm tra lại private key trong cấu hình.");
        }
    }

    private static PrivateKey loadPrivateKey(String pem) throws Exception {
        String base64 = pem
                .replaceAll("-----BEGIN (RSA )?PRIVATE KEY-----", "")
                .replaceAll("-----END (RSA )?PRIVATE KEY-----", "")
                .replaceAll("\\s", "");
        byte[] der = Base64.getDecoder().decode(base64);
        return KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(der));
    }

    // ─────────────────────────────── Hạ tầng ───────────────────────────────

    private <T> T get(String path,
                      java.util.function.Consumer<MultiValueMap<String, String>> paramFiller,
                      ParameterizedTypeReference<UrboxEnvelope<T>> type) {
        if (!props.isConfigured()) {
            throw new BusinessException("Kết nối kho quà UrBox chưa được bật. "
                    + "Liên hệ quản trị hệ thống để cấu hình.");
        }

        UrboxEnvelope<T> response;
        try {
            response = http.get()
                    .uri(uriBuilder -> {
                        uriBuilder.path(path);
                        uriBuilder.queryParam("app_id", props.getAppId());
                        uriBuilder.queryParam("app_secret", props.getAppSecret());
                        MultiValueMap<String, String> extra =
                                new org.springframework.util.LinkedMultiValueMap<>();
                        paramFiller.accept(extra);
                        uriBuilder.queryParams(extra);
                        return uriBuilder.build();
                    })
                    .retrieve()
                    .body(type);
        } catch (RestClientResponseException e) {
            // UrBox TRẢ LỜI, chỉ là bằng một mã lỗi HTTP — khác hẳn không gọi được. Gộp
            // hai ca vào một câu "không kết nối được" từng khiến việc chẩn đoán đi sai
            // hướng: sandbox 404 cả host thì lỗi nằm ở phía họ, còn timeout thì ở mạng.
            //
            // In URL ĐẦY ĐỦ: câu hỏi đầu tiên khi gặp 404 luôn là "mình gọi đúng địa chỉ
            // chưa", và đoán mò câu đó tốn thời gian hơn nhiều so với một dòng log.
            log.error("UrBox {} trả HTTP {}: {}", maskedUrl(path), e.getStatusCode().value(),
                    abbreviate(e.getResponseBodyAsString()));
            throw new BusinessException("Máy chủ UrBox trả lỗi HTTP "
                    + e.getStatusCode().value() + " khi đọc kho quà"
                    + (e.getStatusCode().value() == 404
                    ? " — sai địa chỉ máy chủ, hoặc môi trường UrBox đang bảo trì." : "."));
        } catch (RestClientException e) {
            log.error("Không gọi được UrBox {}: {}", maskedUrl(path), e.getMessage());
            throw new BusinessException("Không kết nối được tới kho quà UrBox. Thử lại sau ít phút.");
        }

        if (response == null || !response.ok()) {
            String detail = response == null ? "không có phản hồi" : response.msg();
            log.warn("UrBox {} trả lỗi: {}", path, detail);
            throw new BusinessException("UrBox báo lỗi khi đọc kho quà"
                    + (detail == null || detail.isBlank() ? "" : ": " + detail));
        }
        return response.data();
    }

    /**
     * URL đầy đủ để đưa vào log, KHÔNG kèm app_secret.
     *
     * <p>Chỉ ghi mỗi đường dẫn thì không trả lời được câu hỏi quan trọng nhất lúc gặp
     * 404 — "có đang gọi đúng máy chủ không". Nhưng log nguyên query string sẽ rải
     * app_secret ra khắp file log và mọi hệ thống thu thập log phía sau.
     */
    private String maskedUrl(String path) {
        return baseUrl + path + "?app_id=" + props.getAppId() + "&app_secret=***";
    }

    /** Thân lỗi của UrBox có thể là cả một trang HTML — cắt ngắn để log còn đọc được. */
    private static String abbreviate(String body) {
        if (body == null || body.isBlank()) return "(rỗng)";
        String flat = body.replaceAll("\\s+", " ").trim();
        return flat.length() > 300 ? flat.substring(0, 300) + "…" : flat;
    }

    private static void putIfPresent(MultiValueMap<String, String> params, String key, Object value) {
        if (value != null && !String.valueOf(value).isBlank()) {
            params.add(key, String.valueOf(value));
        }
    }

    private static void putIfPresent(Map<String, Object> body, String key, Object value) {
        if (value != null && !String.valueOf(value).isBlank()) {
            body.put(key, value);
        }
    }
}
