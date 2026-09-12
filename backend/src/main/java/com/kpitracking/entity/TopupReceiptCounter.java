package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

/**
 * Bộ đếm số chứng từ của một tổ chức trong một ký hiệu (thực tế là một năm).
 *
 * <p><b>Vì sao là một bảng riêng chứ không phải {@code MAX(number) + 1}:</b> chứng từ thu tiền
 * phải đánh số LIÊN TỤC, KHÔNG TRÙNG và KHÔNG NHẢY CÓC. {@code MAX + 1} đọc ngoài khoá thì hai
 * webhook về cùng lúc sẽ cùng đọc ra một số; unique index bắt được cú va chạm nhưng nó ném lỗi
 * đúng vào lúc tiền đã vào ví và người dùng đang chờ biên nhận. Dòng đếm này được khoá bằng
 * {@code SELECT ... FOR UPDATE} nên cú thứ hai chờ và nhận số kế tiếp.
 *
 * <p><b>Vì sao không dùng SEQUENCE của Postgres:</b> sequence không quay lui khi transaction
 * rollback, nên số sẽ có lỗ hổng — đúng thứ mà chứng từ kế toán không được phép có. Bộ đếm nằm
 * trong cùng transaction với biên nhận thì hai cái sống chết cùng nhau.
 */
@Entity
@Table(name = "topup_receipt_counters",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_topup_receipt_counters",
                columnNames = {"organization_id", "series"}))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TopupReceiptCounter {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "series", nullable = false, length = 20)
    private String series;

    /** Số đã cấp gần nhất. Số kế tiếp là giá trị này cộng một. */
    @Column(name = "last_number", nullable = false)
    @Builder.Default
    private Integer lastNumber = 0;
}
