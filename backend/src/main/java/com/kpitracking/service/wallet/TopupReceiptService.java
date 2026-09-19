package com.kpitracking.service.wallet;

import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.TopupOrder;
import com.kpitracking.entity.TopupReceipt;
import com.kpitracking.entity.TopupReceiptCounter;
import com.kpitracking.entity.User;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.wallet.TopupReceiptResponse;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.TopupOrderRepository;
import com.kpitracking.repository.TopupReceiptCounterRepository;
import com.kpitracking.repository.TopupReceiptRepository;
import com.kpitracking.service.CashWalletService;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.reward.RewardContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/**
 * Lập biên nhận thu tiền cho một đơn nạp đã nhận được tiền, và dựng bản in của nó.
 *
 * <h2>Phạm vi pháp lý</h2>
 * Xem javadoc của {@link TopupReceipt}: đây là CHỨNG TỪ THU TIỀN mang đủ nội dung bắt buộc theo
 * Điều 10 Nghị định 123/2020/NĐ-CP, không phải hoá đơn điện tử có mã của cơ quan thuế — thứ chỉ
 * tổ chức cung cấp dịch vụ hoá đơn đã đăng ký mới phát hành được. Bản in nói rõ điều đó thay vì
 * để người nhận tự hiểu nhầm.
 *
 * <h2>Lập một lần, không lập lại</h2>
 * Số chứng từ đã cấp là đã cấp. Gọi lại cho cùng một đơn sẽ trả về đúng biên nhận cũ chứ không
 * sinh số mới: webhook SePay có thể về hai lần, và hai tờ biên nhận mang hai số khác nhau cho
 * cùng một khoản tiền là sai lệch sổ sách chứ không phải chuyện nhỏ.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TopupReceiptService {

    private final TopupReceiptRepository receiptRepository;
    private final TopupReceiptCounterRepository counterRepository;
    private final TopupOrderRepository orderRepository;
    private final RewardContext context;
    private final PermissionChecker permissionChecker;

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    /**
     * Lập biên nhận cho một đơn đã thanh toán, hoặc trả về tờ đã lập.
     *
     * <p>Chạy trong transaction MỚI: nơi gọi là listener của sự kiện "đã nhận tiền", chạy sau khi
     * transaction ghi tiền đã đóng. Tách hẳn ra cũng có nghĩa là biên nhận hỏng không kéo theo
     * việc gì — tiền đã vào ví từ trước và không phụ thuộc tờ giấy này.
     *
     * @return {@code null} nếu tổ chức đã tắt biên nhận, hoặc đơn chưa ở trạng thái đã thanh toán
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public TopupReceipt issueFor(UUID orderId) {
        TopupOrder order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Đơn nạp tiền", "id", orderId));

        return receiptRepository.findByTopupOrderId(orderId)
                .orElseGet(() -> create(order));
    }

    private TopupReceipt create(TopupOrder order) {
        Organization org = order.getOrganization();
        if (!Boolean.TRUE.equals(org.getReceiptEnabled())) return null;

        // Số tiền trên chứng từ là số THỰC NHẬN, không phải số đề nghị: chứng từ thu tiền phải
        // khớp với số tiền đã thực sự vào tài khoản, nếu không nó vô dụng khi đối chiếu sao kê.
        Long received = order.getPaidAmount();
        if (received == null || received <= 0) {
            log.warn("Đơn {} chưa có số tiền thực nhận, chưa lập biên nhận", order.getCode());
            return null;
        }

        LocalDate issuedDate = (order.getPaidAt() == null
                ? java.time.Instant.now() : order.getPaidAt()).atZone(VN).toLocalDate();
        String series = org.getReceiptSeriesPrefix() + issuedDate.getYear();
        int number = nextNumber(org.getId(), series);

        int vatRate = org.getReceiptVatRate() == null ? 0 : org.getReceiptVatRate();
        // Tổng tiền thanh toán là số tiền người ta đã chuyển — con số duy nhất không được sai.
        // Phần trước thuế suy NGƯỢC ra từ nó rồi lấy phần chênh làm tiền thuế, thay vì tính xuôi
        // rồi cộng lại: tính xuôi có làm tròn nên tổng sinh ra lệch vài đồng so với sao kê.
        long beforeTax = vatRate == 0 ? received : Math.round(received * 100.0 / (100 + vatRate));
        long vatAmount = received - beforeTax;

        User buyer = order.getUser();
        TopupReceipt receipt = TopupReceipt.builder()
                .organization(org)
                .topupOrder(order)
                .user(buyer)
                .series(series)
                .number(number)
                .issuedDate(issuedDate)

                .sellerName(blankTo(org.getLegalName(), org.getName()))
                .sellerTaxCode(org.getTaxCode())
                .sellerAddress(org.getBusinessAddress())
                .sellerPhone(org.getContactPhone())
                .sellerBankAccount(blankTo(order.getBankAccountNumber(), org.getSepayAccountNumber()))
                .sellerBankName(blankTo(order.getBankCode(), org.getSepayBankCode()))

                .buyerName(buyer.getFullName())
                .buyerEmail(buyer.getEmail())
                .buyerEmployeeCode(buyer.getEmployeeCode())
                .buyerOrgUnit(orgUnitNameOf(buyer.getId()))

                .description("Nạp tiền vào ví nội bộ KeyGo — mã đơn " + order.getCode())
                .amountBeforeTax(beforeTax)
                .vatRate(vatRate)
                .vatAmount(vatAmount)
                .totalAmount(received)
                .totalInWords(VndInWords.convert(received))

                .paymentMethod("Chuyển khoản ngân hàng")
                .paymentReference(order.getCode())
                .cashTransactionId(order.getCashTransactionId())

                .issuerName(org.getReceiptIssuerName())
                .issuerTitle(org.getReceiptIssuerTitle())
                .build();

        TopupReceipt saved = receiptRepository.save(receipt);
        log.info("Đã lập biên nhận {} cho đơn nạp {}", saved.getDisplayNumber(), order.getCode());
        return saved;
    }

    /**
     * Cấp số kế tiếp trong ký hiệu, dưới khoá dòng bộ đếm.
     *
     * <p>Dòng đếm chưa tồn tại thì tạo mới. Hai tổ chức lần đầu cùng lúc sẽ cùng rơi vào nhánh
     * tạo, nhưng unique index {@code (organization_id, series)} chặn cú thứ hai — và cú đó nằm
     * trong transaction của một biên nhận sẽ quay lui rồi được webhook gửi lại. Việc này chỉ xảy
     * ra ở giao dịch đầu tiên của một năm nên không đáng đánh đổi lấy một vòng khoá phức tạp hơn.
     */
    private int nextNumber(UUID orgId, String series) {
        TopupReceiptCounter counter = counterRepository.findForUpdate(orgId, series)
                .orElseGet(() -> counterRepository.save(TopupReceiptCounter.builder()
                        .organizationId(orgId)
                        .series(series)
                        .lastNumber(0)
                        .build()));

        int next = counter.getLastNumber() + 1;
        counter.setLastNumber(next);
        counterRepository.save(counter);
        return next;
    }

    /**
     * Bản in của biên nhận: một bảng HTML tự đứng được, dùng cho cả thân email lẫn màn hình xem
     * chứng từ.
     *
     * <p>Bảng HTML thuần, không CSS ngoài, không flexbox: hộp thư (Outlook, Gmail) cắt bỏ phần lớn
     * CSS hiện đại, và một chứng từ vỡ bố cục khi in ra thì không dùng để đối chiếu được.
     */
    public String renderHtml(TopupReceipt r) {
        StringBuilder sb = new StringBuilder();

        sb.append("<div style=\"border:1px solid #cbd5e1;border-radius:8px;padding:20px;")
          .append("font-family:Arial,Helvetica,sans-serif;color:#0f172a;\">");

        sb.append("<p style=\"text-align:center;margin:0 0 4px;font-size:18px;font-weight:bold;\">")
          .append("BIÊN NHẬN THU TIỀN</p>");
        sb.append("<p style=\"text-align:center;margin:0 0 4px;\">Số: <strong>")
          .append(esc(r.getDisplayNumber())).append("</strong> &nbsp;|&nbsp; Ngày lập: <strong>")
          .append(r.getIssuedDate().format(DATE)).append("</strong></p>");
        sb.append("<p style=\"text-align:center;margin:0 0 16px;font-size:12px;color:#64748b;\">")
          .append("Lập theo nội dung quy định tại Điều 10 Nghị định 123/2020/NĐ-CP</p>");

        sb.append(section("ĐƠN VỊ THU TIỀN (BÊN BÁN)"));
        sb.append(table(
                "Tên đơn vị", r.getSellerName(),
                "Mã số thuế", r.getSellerTaxCode(),
                "Địa chỉ", r.getSellerAddress(),
                "Điện thoại", r.getSellerPhone(),
                "Tài khoản nhận", join(r.getSellerBankAccount(), r.getSellerBankName())));

        sb.append(section("NGƯỜI NỘP TIỀN (BÊN MUA)"));
        sb.append(table(
                "Họ và tên", r.getBuyerName(),
                "Mã nhân viên", r.getBuyerEmployeeCode(),
                "Đơn vị công tác", r.getBuyerOrgUnit(),
                "Mã số thuế", r.getBuyerTaxCode(),
                "Email", r.getBuyerEmail()));

        sb.append(section("NỘI DUNG KHOẢN THU"));
        sb.append("<table style=\"width:100%;border-collapse:collapse;font-size:14px;\">");
        sb.append("<tr style=\"background:#f1f5f9;\">")
          .append(th("Nội dung")).append(th("ĐVT")).append(th("SL"))
          .append(thRight("Đơn giá")).append(thRight("Thành tiền")).append("</tr>");
        sb.append("<tr>")
          .append(td(esc(r.getDescription()))).append(td("Lần")).append(td("1"))
          .append(tdRight(CashWalletService.formatVnd(r.getAmountBeforeTax())))
          .append(tdRight(CashWalletService.formatVnd(r.getAmountBeforeTax())))
          .append("</tr>");
        sb.append("</table>");

        sb.append("<table style=\"width:100%;border-collapse:collapse;font-size:14px;margin-top:8px;\">");
        sb.append(totalRow("Cộng tiền hàng", CashWalletService.formatVnd(r.getAmountBeforeTax()), false));
        sb.append(totalRow("Thuế suất GTGT",
                r.getVatRate() == 0 ? "Không chịu thuế / không kê khai" : r.getVatRate() + "%", false));
        sb.append(totalRow("Tiền thuế GTGT", CashWalletService.formatVnd(r.getVatAmount()), false));
        sb.append(totalRow("TỔNG TIỀN THANH TOÁN", CashWalletService.formatVnd(r.getTotalAmount()), true));
        sb.append("</table>");

        sb.append("<p style=\"margin:12px 0 0;font-size:14px;\"><strong>Số tiền bằng chữ:</strong> ")
          .append(esc(r.getTotalInWords())).append("</p>");
        sb.append("<p style=\"margin:4px 0 0;font-size:14px;\"><strong>Hình thức thanh toán:</strong> ")
          .append(esc(r.getPaymentMethod()))
          .append(" &nbsp;|&nbsp; <strong>Nội dung chuyển khoản:</strong> ")
          .append(esc(r.getPaymentReference())).append("</p>");

        if (notBlank(r.getIssuerName())) {
            sb.append("<p style=\"margin:16px 0 0;font-size:14px;text-align:right;\">")
              .append(notBlank(r.getIssuerTitle()) ? esc(r.getIssuerTitle()) + "<br>" : "")
              .append("<strong>").append(esc(r.getIssuerName())).append("</strong></p>");
        }

        // Câu này BẮT BUỘC phải có trên bản in. Người nhận cầm một tờ giấy trông như hoá đơn mà
        // không biết nó không thay thế được hoá đơn GTGT thì sẽ đem đi kê khai thuế và bị loại —
        // hậu quả rơi vào họ chứ không phải hệ thống đã in ra nó.
        sb.append("<p style=\"margin:16px 0 0;padding-top:12px;border-top:1px solid #e2e8f0;")
          .append("font-size:12px;color:#64748b;\">")
          .append("Chứng từ này xác nhận đơn vị đã nhận đủ số tiền ghi trên đây. Đây KHÔNG phải hoá "
                + "đơn giá trị gia tăng: hoá đơn điện tử có mã của cơ quan thuế được phát hành qua "
                + "tổ chức cung cấp dịch vụ hoá đơn điện tử. Nếu bạn cần hoá đơn GTGT cho khoản này, "
                + "vui lòng liên hệ bộ phận kế toán của đơn vị kèm số chứng từ ở trên.")
          .append("</p>");

        sb.append("</div>");
        return sb.toString();
    }

    // ────────────────────────── Đọc ──────────────────────────

    /**
     * Biên nhận của một đơn nạp.
     *
     * <p>Chủ đơn luôn xem được biên nhận của mình. Người khác phải có {@code WALLET:VIEW} —
     * chứng từ này mang tên, mã nhân viên và số tiền của một cá nhân, không phải thứ để bất kỳ
     * ai có id đơn cũng đọc được.
     */
    @Transactional(readOnly = true)
    public TopupReceiptResponse getByOrderId(UUID orderId) {
        TopupReceipt r = receiptRepository.findByTopupOrderId(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Biên nhận thu tiền", "đơn nạp", orderId));

        User me = context.getCurrentUser();
        UUID receiptOrgId = r.getOrganization() != null ? r.getOrganization().getId() : null;
        if (!r.getUser().getId().equals(me.getId())
                && !permissionChecker.hasPermissionInOrganization(me.getId(), "WALLET:VIEW", receiptOrgId)) {
            throw new ForbiddenException("Bạn không có quyền xem biên nhận của người khác.");
        }
        return toResponse(r);
    }

    @Transactional(readOnly = true)
    public PageResponse<TopupReceiptResponse> getMine(int page, int size) {
        User me = context.getCurrentUser();
        Page<TopupReceipt> result = receiptRepository
                .findByOrganizationIdAndUserIdOrderByNumberDesc(
                        context.getOrgIdOf(me.getId()), me.getId(), PageRequest.of(page, size));
        return toPage(result);
    }

    /** Sổ chứng từ của cả tổ chức — dành cho kế toán đối chiếu. */
    @Transactional(readOnly = true)
    public PageResponse<TopupReceiptResponse> getForOrg(int page, int size) {
        Page<TopupReceipt> result = receiptRepository.findByOrganizationIdOrderByNumberDesc(
                context.getCurrentOrgId(), PageRequest.of(page, size));
        return toPage(result);
    }

    private PageResponse<TopupReceiptResponse> toPage(Page<TopupReceipt> result) {
        return PageResponse.<TopupReceiptResponse>builder()
                .content(result.getContent().stream().map(this::toResponse).toList())
                .page(result.getNumber())
                .size(result.getSize())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .last(result.isLast())
                .build();
    }

    private TopupReceiptResponse toResponse(TopupReceipt r) {
        return TopupReceiptResponse.builder()
                .id(r.getId())
                .topupOrderId(r.getTopupOrder().getId())
                .number(r.getDisplayNumber())
                .issuedDate(r.getIssuedDate())
                .sellerName(r.getSellerName())
                .buyerName(r.getBuyerName())
                .description(r.getDescription())
                .amountBeforeTax(r.getAmountBeforeTax())
                .vatRate(r.getVatRate())
                .vatAmount(r.getVatAmount())
                .totalAmount(r.getTotalAmount())
                .totalInWords(r.getTotalInWords())
                .paymentMethod(r.getPaymentMethod())
                .paymentReference(r.getPaymentReference())
                .html(renderHtml(r))
                .build();
    }

    // ────────────────────────── Bộ dựng HTML ──────────────────────────

    private static String section(String title) {
        return "<p style=\"margin:16px 0 6px;font-size:13px;font-weight:bold;"
                + "letter-spacing:.4px;color:#334155;\">" + title + "</p>";
    }

    /** rows: nhãn1, giá trị1, nhãn2, giá trị2… Dòng có giá trị rỗng bị bỏ hẳn. */
    private static String table(String... rows) {
        StringBuilder sb = new StringBuilder(
                "<table style=\"width:100%;border-collapse:collapse;font-size:14px;\">");
        for (int i = 0; i + 1 < rows.length; i += 2) {
            if (!notBlank(rows[i + 1])) continue;
            sb.append("<tr><td style=\"padding:3px 8px 3px 0;color:#64748b;width:34%;\">")
              .append(esc(rows[i])).append("</td><td style=\"padding:3px 0;\">")
              .append(esc(rows[i + 1])).append("</td></tr>");
        }
        return sb.append("</table>").toString();
    }

    private static String th(String label) {
        return "<th style=\"padding:6px 8px;border:1px solid #e2e8f0;text-align:left;"
                + "font-size:12px;\">" + label + "</th>";
    }

    private static String thRight(String label) {
        return "<th style=\"padding:6px 8px;border:1px solid #e2e8f0;text-align:right;"
                + "font-size:12px;\">" + label + "</th>";
    }

    private static String td(String value) {
        return "<td style=\"padding:6px 8px;border:1px solid #e2e8f0;\">" + value + "</td>";
    }

    private static String tdRight(String value) {
        return "<td style=\"padding:6px 8px;border:1px solid #e2e8f0;text-align:right;"
                + "white-space:nowrap;\">" + value + "</td>";
    }

    private static String totalRow(String label, String value, boolean bold) {
        String weight = bold ? "font-weight:bold;" : "";
        return "<tr><td style=\"padding:4px 8px 4px 0;text-align:right;color:#334155;" + weight + "\">"
                + label + "</td><td style=\"padding:4px 0;text-align:right;width:38%;white-space:nowrap;"
                + weight + "\">" + value + "</td></tr>";
    }

    // ────────────────────────── Tiện ích ──────────────────────────

    private String orgUnitNameOf(UUID userId) {
        try {
            OrgUnit unit = context.getPrimaryOrgUnit(userId);
            return unit == null ? null : unit.getName();
        } catch (Exception e) {
            // Người chưa gắn đơn vị vẫn nạp tiền được; thiếu một dòng thông tin phụ không phải
            // lý do để bỏ luôn cả chứng từ.
            return null;
        }
    }

    private static String blankTo(String value, String fallback) {
        return notBlank(value) ? value : fallback;
    }

    private static String join(String a, String b) {
        if (!notBlank(a)) return b;
        if (!notBlank(b)) return a;
        return a + " — " + b;
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    /**
     * Thoát HTML cho mọi giá trị do người dùng nhập.
     *
     * <p>Tên đơn vị, địa chỉ, họ tên và ghi chú đều đi thẳng vào thân email. Không thoát thì một
     * cái tên chứa thẻ HTML sẽ làm vỡ bố cục chứng từ, và tệ hơn là chèn được nội dung lạ vào một
     * tờ giấy mà người nhận tin là do hệ thống lập.
     */
    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
