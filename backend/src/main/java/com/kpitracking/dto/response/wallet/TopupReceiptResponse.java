package com.kpitracking.dto.response.wallet;

import lombok.*;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Biên nhận thu tiền của một lần nạp ví.
 *
 * <p>Mang cả các trường rời (để giao diện lọc, sắp xếp, hiện danh sách) lẫn {@link #html} —
 * bản in đầy đủ do máy chủ dựng. Bản in không dựng lại ở frontend: các nội dung bắt buộc theo
 * Điều 10 Nghị định 123/2020/NĐ-CP phải giống hệt nhau trên email và trên màn hình, và hai nơi
 * cùng dựng là hai nơi có thể lệch.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TopupReceiptResponse {

    private UUID id;
    private UUID topupOrderId;

    /** VD {@code PT2026/00000042}. */
    private String number;
    private LocalDate issuedDate;

    private String sellerName;
    private String buyerName;

    private String description;
    private Long amountBeforeTax;
    private Integer vatRate;
    private Long vatAmount;
    private Long totalAmount;
    private String totalInWords;

    private String paymentMethod;
    private String paymentReference;

    /** Bản in đầy đủ, HTML tự đứng được — dùng để hiện trên màn hình và để in. */
    private String html;
}
