package com.kpitracking.entity;

import com.kpitracking.entity.converter.EncryptedStringConverter;
import com.kpitracking.enums.LarkConnectionMode;
import com.kpitracking.enums.OrganizationStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "organizations")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Organization {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "name", nullable = false, unique = true)
    private String name;

    @Column(name = "code", nullable = false, unique = true)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private OrganizationStatus status = OrganizationStatus.ACTIVE;

    // ===== Hồ sơ doanh nghiệp =====

    /** Logo công ty. URL Cloudinary công khai. */
    @Column(name = "logo_url", columnDefinition = "text")
    private String logoUrl;

    /** Ảnh bìa trang hồ sơ (khuyến nghị 1200x300). */
    @Column(name = "cover_url", columnDefinition = "text")
    private String coverUrl;

    /** Lĩnh vực hoạt động. Chuỗi tự do — danh mục ngành nghề do giao diện gợi ý, không phải enum. */
    @Column(name = "industry", length = 120)
    private String industry;

    @Column(name = "tax_code", length = 50)
    private String taxCode;

    /** Quy mô nhân sự do công ty tự khai, không phải số người dùng thực tế trong hệ thống. */
    @Column(name = "employee_count")
    private Integer employeeCount;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "organization", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("levelOrder ASC")
    private java.util.List<OrgHierarchyLevel> hierarchyLevels;

    @Column(name = "evaluation_max_score")
    @Builder.Default
    private Double evaluationMaxScore = 100.0;

    @OneToMany(mappedBy = "organization", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("threshold DESC")
    private java.util.List<EvaluationLevel> evaluationLevels;

    @OneToMany(mappedBy = "organization", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    private java.util.List<QualitativeLevel> qualitativeLevels;

    /** Performance rating matrix (JSON): { rowHeader, colHeader, rows[], cols[], cells[][] }. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "performance_matrix", columnDefinition = "jsonb")
    private String performanceMatrix;

    /** Luật xếp loại ĐƠN VỊ theo phân bố % xếp loại thành viên (JSON): { rules: [{ levelName, color, conditions:[...] }] }. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "unit_classification_rules", columnDefinition = "jsonb")
    private String unitClassificationRules;

    @Column(name = "kpi_reminder_percentage")
    @Builder.Default
    private Integer kpiReminderPercentage = 50;

    /**
     * Nhắc trưởng đơn vị chấm/chốt trước ngày kết thúc đợt-kỳ bao nhiêu ngày. 0 = tắt.
     * Cùng khuôn với {@code kpiReminderPercentage}: một con số cho cả tổ chức.
     */
    @Column(name = "evaluation_reminder_days")
    @Builder.Default
    private Integer evaluationReminderDays = 3;

    @Column(name = "enable_okr")
    @Builder.Default
    private Boolean enableOkr = false;

    @Column(name = "enable_waterfall")
    @Builder.Default
    private Boolean enableWaterfall = false;

    @Column(name = "enable_ai")
    @Builder.Default
    private Boolean enableAi = true;

    @Column(name = "enable_qualitative")
    @Builder.Default
    private Boolean enableQualitative = false;

    @Column(name = "enable_bsc")
    @Builder.Default
    private Boolean enableBsc = false;

    /** Chấm hạnh kiểm theo bộ tiêu chí có trọng số (đợt/kỳ). Mặc định TẮT. */
    @Column(name = "enable_conduct")
    @Builder.Default
    private Boolean enableConduct = false;

    /** Thang điểm mỗi tiêu chí hạnh kiểm — mặc định 5, trùng trần trục hành vi của ma trận xếp loại. */
    @Column(name = "conduct_max_score")
    @Builder.Default
    private Double conductMaxScore = com.kpitracking.constant.ConductConstants.DEFAULT_MAX_SCORE;

    // Bộ tiêu chí hạnh kiểm KHÔNG map thành collection ở đây: nó được đọc/ghi qua
    // ConductCriteriaRepository, và một collection cascade+orphanRemoval nạp lười ở đây
    // chỉ tạo nguy cơ xoá nhầm tiêu chí vừa thêm khi lưu tổ chức.

    /** Thưởng điểm & đổi quà. Mặc định TẮT để không tổ chức nào bỗng dưng thấy menu lạ. */
    @Column(name = "enable_reward")
    @Builder.Default
    private Boolean enableReward = false;

    // ===== Ví tiền thật =====

    /** Ví tiền & nạp SePay. Mặc định TẮT, giống enable_reward. */
    @Column(name = "enable_cash_wallet", nullable = false)
    @Builder.Default
    private Boolean enableCashWallet = false;

    /**
     * Số ĐỒNG đổi được 1 điểm thưởng. Mỗi bút toán quy đổi tự chụp lại tỉ giá tại
     * thời điểm đó, nên đổi tỉ giá không làm sai lệch lịch sử cũ.
     */
    @Column(name = "point_exchange_rate", nullable = false)
    @Builder.Default
    private Long pointExchangeRate = 1000L;

    @Column(name = "topup_min_amount", nullable = false)
    @Builder.Default
    private Long topupMinAmount = 10_000L;

    @Column(name = "topup_max_amount", nullable = false)
    @Builder.Default
    private Long topupMaxAmount = 50_000_000L;

    @Column(name = "topup_expire_minutes", nullable = false)
    @Builder.Default
    private Integer topupExpireMinutes = 30;

    /** Tài khoản nhận tiền. Webhook đối chiếu, giao diện dựng ảnh VietQR từ đây. */
    @Column(name = "sepay_account_number", length = 50)
    private String sepayAccountNumber;

    @Column(name = "sepay_bank_code", length = 20)
    private String sepayBankCode;

    @Column(name = "sepay_account_holder")
    private String sepayAccountHolder;

    // ===== Biên nhận thu tiền nạp ví =====
    //
    // Các trường dưới đây là nội dung BẮT BUỘC của một chứng từ thu tiền theo Điều 10 Nghị định
    // 123/2020/NĐ-CP. Chúng nằm ở tổ chức chứ không phải hằng số vì mỗi tổ chức là một pháp nhân
    // khác nhau, và được CHỤP LẠI vào từng biên nhận lúc lập (xem {@code TopupReceipt}).

    /**
     * Gửi biên nhận cho mỗi lần nạp tiền thành công. Bật sẵn: người vừa chuyển tiền thật cho
     * công ty có quyền nhận một chứng từ, và tổ chức nào đã phát hành hoá đơn điện tử qua nhà
     * cung cấp riêng thì tắt đi để khỏi gửi hai loại giấy cho cùng một khoản.
     */
    @Column(name = "receipt_enabled", nullable = false)
    @Builder.Default
    private Boolean receiptEnabled = true;

    /**
     * Tên pháp nhân trên chứng từ, theo giấy đăng ký kinh doanh. Bỏ trống thì dùng {@link #name} —
     * tên thương hiệu thường trùng tên pháp nhân, và một chứng từ có tên gần đúng vẫn hơn hẳn
     * một chứng từ trống tên người bán.
     */
    @Column(name = "legal_name")
    private String legalName;

    /** Địa chỉ trụ sở ghi trên chứng từ. */
    @Column(name = "business_address", columnDefinition = "text")
    private String businessAddress;

    @Column(name = "contact_phone", length = 50)
    private String contactPhone;

    /** Tiền tố ký hiệu chứng từ; ký hiệu đầy đủ là tiền tố + năm lập, VD {@code PT2026}. */
    @Column(name = "receipt_series_prefix", nullable = false, length = 10)
    @Builder.Default
    private String receiptSeriesPrefix = "PT";

    /**
     * Thuế suất phần trăm áp cho khoản tiền nạp ví.
     *
     * <p>Mặc định 0 vì nạp ví là khoản THU TRƯỚC — chưa cung cấp hàng hoá dịch vụ nào nên chưa
     * phát sinh nghĩa vụ thuế; nghĩa vụ đó phát sinh lúc nhân viên đổi điểm lấy quà. Tổ chức nào
     * được tư vấn khác thì đặt lại ở đây.
     */
    @Column(name = "receipt_vat_rate", nullable = false)
    @Builder.Default
    private Integer receiptVatRate = 0;

    /** Người đứng tên lập chứng từ, VD "Phòng Kế toán". */
    @Column(name = "receipt_issuer_name")
    private String receiptIssuerName;

    @Column(name = "receipt_issuer_title", length = 120)
    private String receiptIssuerTitle;

    // ===== Hạn mức token AI =====

    /** Ngân sách token/tháng do quản trị nền tảng cấp. Tổng phân bổ không được vượt số này. */
    @Column(name = "ai_monthly_token_limit", nullable = false)
    @Builder.Default
    private Long aiMonthlyTokenLimit = 0L;

    /** Cho phép quản lý cấp dưới tự chia hạn mức cho nhân sự trong đơn vị họ. */
    @Column(name = "ai_allow_sub_delegation", nullable = false)
    @Builder.Default
    private Boolean aiAllowSubDelegation = false;

    // ===== Lark SSO =====

    /** Bật đăng nhập bằng Lark cho tổ chức này. Chỉ bật được khi đã cấu hình đủ. */
    @Column(name = "lark_enabled", nullable = false)
    @Builder.Default
    private Boolean larkEnabled = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "lark_connection_mode", nullable = false)
    @Builder.Default
    private LarkConnectionMode larkConnectionMode = LarkConnectionMode.CUSTOM_APP;

    /** App ID của Lark. Không phải bí mật — nằm ngay trong URL authorize người dùng nhìn thấy. */
    @Column(name = "lark_app_id")
    private String larkAppId;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "lark_app_secret_enc")
    private String larkAppSecret;

    /** HMAC-SHA256 của tenant_key — dùng để so sánh mỗi lần đăng nhập, có unique index. */
    @Column(name = "lark_tenant_key_hash")
    private String larkTenantKeyHash;

    /** tenant_key thật, mã hoá AES-GCM. Chỉ cần tới ở mode STORE. */
    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "lark_tenant_key_enc")
    private String larkTenantKey;

    /** Tên tổ chức trên Lark, hiện lại cho quản trị viên xác nhận. */
    @Column(name = "lark_tenant_name")
    private String larkTenantName;

    /** Logo doanh nghiệp trên Lark. URL công khai, không mã hoá. */
    @Column(name = "lark_tenant_avatar_url")
    private String larkTenantAvatarUrl;

    @Column(name = "lark_verified_at")
    private Instant larkVerifiedAt;

    /** Đơn vị gán cho người dùng được tạo tự động khi đăng nhập Lark lần đầu. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lark_default_org_unit_id")
    private OrgUnit larkDefaultOrgUnit;

    /** Vai trò gán cho người dùng được tạo tự động khi đăng nhập Lark lần đầu. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lark_default_role_id")
    private Role larkDefaultRole;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;
}
