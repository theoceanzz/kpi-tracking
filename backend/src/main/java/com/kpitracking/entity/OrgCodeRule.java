package com.kpitracking.entity;

import com.kpitracking.enums.CodeType;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Quy tắc sinh mã của MỘT loại đối tượng trong MỘT tổ chức.
 *
 * Không có cột "số thứ tự kế tiếp": số tiếp theo được suy ra từ các mã đã tồn tại cùng
 * tiền tố đã dựng. Nhờ vậy mẫu chứa {YYYY} tự động đánh số lại từ 1 mỗi năm mà không cần
 * thêm khoá "chu kỳ reset", và sửa mẫu giữa kỳ không để lại bộ đếm lệch với dữ liệu thật.
 */
@Entity
@Table(name = "org_code_rules")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class OrgCodeRule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Enumerated(EnumType.STRING)
    @Column(name = "code_type", nullable = false, length = 40)
    private CodeType codeType;

    /** TẮT ⇒ người dùng phải tự nhập mã như trước. */
    @Column(name = "auto_generate", nullable = false)
    @Builder.Default
    private Boolean autoGenerate = true;

    /**
     * Cho phép người dùng gõ mã riêng thay vì lấy mã sinh sẵn. Mặc định KHÔNG: mã đã in ra
     * báo cáo, để mỗi người tự đặt một kiểu thì mẫu chung mất tác dụng.
     */
    @Column(name = "allow_manual_override", nullable = false)
    @Builder.Default
    private Boolean allowManualOverride = false;

    /** Mẫu mã, ví dụ {@code OBJ-{YYYY}-{###}}. Xem CodeType để biết token dùng được. */
    @Column(name = "pattern", nullable = false, length = 100)
    private String pattern;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;
}
