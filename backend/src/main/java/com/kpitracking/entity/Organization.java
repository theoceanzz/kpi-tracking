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
