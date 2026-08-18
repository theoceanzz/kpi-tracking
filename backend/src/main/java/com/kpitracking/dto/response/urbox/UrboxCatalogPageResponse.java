package com.kpitracking.dto.response.urbox;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Một trang kho quà UrBox.
 *
 * <p>Không dùng {@code PageResponse} chung: UrBox chỉ trả về SỐ TRANG, không trả tổng số
 * phần tử theo bộ lọc hiện tại. Nhét vào khuôn phân trang của hệ thống sẽ phải bịa ra
 * {@code totalElements}, và giao diện sẽ hiển thị một con số không có thật.
 */
@Data
@Builder
public class UrboxCatalogPageResponse {

    private List<UrboxGiftResponse> items;

    private Integer page;

    private Integer totalPages;

    /** Tổng số quà UrBox báo về, dạng chuỗi vì họ trả về như vậy. Có thể null. */
    private String totalResult;
}
