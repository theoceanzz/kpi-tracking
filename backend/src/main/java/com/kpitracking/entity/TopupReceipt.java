package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Biên nhận thu tiền của một đơn nạp ví đã nhận được tiền.
 *
 * <h2>Đây là BIÊN NHẬN, không phải hoá đơn GTGT</h2>
 * Hoá đơn điện tử hợp lệ theo Nghị định 123/2020/NĐ-CP và Thông tư 78/2021/TT-BTC phải được cấp
 * qua tổ chức cung cấp dịch vụ hoá đơn điện tử đã đăng ký với cơ quan thuế, và (với hoá đơn có mã)
 * phải được cơ quan thuế cấp mã trước khi giao cho người mua. KeyGo không phải tổ chức đó và không
 * tự sinh ra ký hiệu hoá đơn hợp lệ được — làm giả một ký hiệu trông giống hoá đơn thật là chuyện
 * tệ hơn hẳn việc không có gì.
 *
 * <p>Cái bản ghi này giữ là chứng từ thu tiền mang ĐỦ các nội dung bắt buộc mà Điều 10 Nghị định
 * 123/2020/NĐ-CP đòi hỏi ở một chứng từ: thông tin người bán (tên, mã số thuế, địa chỉ), thông tin
 * người mua, tên khoản thu, số lượng, đơn giá, thành tiền, thuế suất và tiền thuế, tổng tiền thanh
 * toán bằng số và BẰNG CHỮ, hình thức thanh toán, số và ngày lập, người lập. Nhờ vậy khi tổ chức
 * nối được nhà cung cấp hoá đơn điện tử thì mọi trường cần phát hành đều đã có sẵn ở đây, không
 * phải đi dựng lại từ dữ liệu thô.
 *
 * <h2>Vì sao chụp lại toàn bộ thông tin bên bán và bên mua</h2>
 * Chứng từ phải nói đúng sự thật TẠI THỜI ĐIỂM LẬP. Công ty đổi tên, đổi địa chỉ, nhân viên đổi
 * họ tên hay nghỉ việc là chuyện thường; trỏ khoá ngoại rồi đọc ra lúc in sẽ khiến biên nhận của
 * năm ngoái tự đổi nội dung — thứ khiến nó vô giá trị khi đối chiếu sổ sách.
 */
@Entity
@Table(name = "topup_receipts")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TopupReceipt {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    /**
     * Đơn nạp đã sinh ra khoản thu này.
     *
     * <p>Tính duy nhất một-đơn-một-biên-nhận do ràng buộc {@code UNIQUE} ở migration giữ, KHÔNG
     * khai {@code unique = true} ở đây: cấu hình chạy với {@code ddl-auto: update}, và Hibernate
     * sẽ thêm một ràng buộc trùng lặp mang tên nó tự sinh bên cạnh ràng buộc đã có.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "topup_order_id", nullable = false)
    private TopupOrder topupOrder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // ───────────────────────── Số hiệu chứng từ ─────────────────────────

    /**
     * Ký hiệu chứng từ, VD {@code PT2026}. Cấu thành từ tiền tố tổ chức cấu hình và năm lập —
     * số thứ tự bắt đầu lại từ 1 mỗi năm, theo đúng cách đánh số chứng từ kế toán.
     */
    @Column(name = "series", nullable = false, length = 20)
    private String series;

    /** Số thứ tự trong ký hiệu. UNIQUE cùng {@code (organization_id, series)}, không có lỗ hổng. */
    @Column(name = "number", nullable = false)
    private Integer number;

    /** Ngày lập chứng từ. Là NGÀY TIỀN VỀ, không phải ngày sinh bản ghi này. */
    @Column(name = "issued_date", nullable = false)
    private LocalDate issuedDate;

    // ───────────────────────── Bên bán (bên thu tiền) ─────────────────────────

    @Column(name = "seller_name", nullable = false)
    private String sellerName;

    @Column(name = "seller_tax_code", length = 50)
    private String sellerTaxCode;

    @Column(name = "seller_address", columnDefinition = "text")
    private String sellerAddress;

    @Column(name = "seller_phone", length = 50)
    private String sellerPhone;

    @Column(name = "seller_bank_account", length = 50)
    private String sellerBankAccount;

    @Column(name = "seller_bank_name", length = 100)
    private String sellerBankName;

    // ───────────────────────── Bên mua (người nộp tiền) ─────────────────────────

    @Column(name = "buyer_name", nullable = false)
    private String buyerName;

    /** Mã số thuế cá nhân người nộp, nếu tổ chức có lưu. Thường trống với nhân viên. */
    @Column(name = "buyer_tax_code", length = 50)
    private String buyerTaxCode;

    @Column(name = "buyer_email")
    private String buyerEmail;

    @Column(name = "buyer_employee_code", length = 100)
    private String buyerEmployeeCode;

    /** Đơn vị công tác của người nộp tại thời điểm lập. */
    @Column(name = "buyer_org_unit")
    private String buyerOrgUnit;

    // ───────────────────────── Nội dung khoản thu ─────────────────────────

    @Column(name = "description", nullable = false, columnDefinition = "text")
    private String description;

    /**
     * Thành tiền TRƯỚC thuế, đơn vị đồng.
     *
     * <p>Tất cả tiền ở đây là số nguyên đồng, không có phần thập phân — đúng cách ví tiền đang
     * ghi sổ. Dùng {@code BigDecimal} ở đây sẽ tạo ra hai cách biểu diễn cho cùng một con số.
     */
    @Column(name = "amount_before_tax", nullable = false)
    private Long amountBeforeTax;

    /**
     * Thuế suất phần trăm áp cho khoản thu, VD {@code 0}, {@code 8}, {@code 10}.
     *
     * <p>Mặc định 0: tiền nạp vào ví là khoản THU TRƯỚC, chưa phát sinh việc cung cấp hàng hoá
     * hay dịch vụ nào, nên nghĩa vụ thuế phát sinh ở thời điểm nhân viên đổi điểm lấy quà chứ
     * không phải lúc nạp. Tổ chức nào xác định khác thì đặt lại thuế suất trong Cấu hình ví.
     */
    @Column(name = "vat_rate", nullable = false)
    private Integer vatRate;

    @Column(name = "vat_amount", nullable = false)
    private Long vatAmount;

    @Column(name = "total_amount", nullable = false)
    private Long totalAmount;

    /** Tổng tiền thanh toán viết bằng chữ — nội dung bắt buộc, sinh từ {@link #totalAmount}. */
    @Column(name = "total_in_words", nullable = false, columnDefinition = "text")
    private String totalInWords;

    // ───────────────────────── Thanh toán ─────────────────────────

    @Column(name = "payment_method", nullable = false, length = 50)
    private String paymentMethod;

    /** Nội dung chuyển khoản người nộp đã dùng — đường đối chiếu với sao kê ngân hàng. */
    @Column(name = "payment_reference", length = 100)
    private String paymentReference;

    /** Bút toán trong sổ cái ví tiền tương ứng với khoản thu này. */
    @Column(name = "cash_transaction_id")
    private UUID cashTransactionId;

    /** Người/bộ phận đứng tên lập chứng từ, do tổ chức cấu hình. */
    @Column(name = "issuer_name")
    private String issuerName;

    @Column(name = "issuer_title", length = 120)
    private String issuerTitle;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    /** VD {@code PT2026/00000042} — số chứng từ hiển thị trên thư và trên màn hình. */
    @Transient
    public String getDisplayNumber() {
        return series + "/" + String.format("%08d", number);
    }
}
