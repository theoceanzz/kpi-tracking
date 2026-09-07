package com.kpitracking.controller;

import com.kpitracking.dto.request.urbox.ImportUrboxGiftRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.reward.GiftItemResponse;
import com.kpitracking.dto.response.urbox.UrboxCatalogPageResponse;
import com.kpitracking.dto.response.urbox.UrboxStatusResponse;
import com.kpitracking.dto.response.urbox.UrboxTaxonomyResponse;
import com.kpitracking.service.reward.urbox.UrboxCatalogService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Kho quà eVoucher UrBox — màn hình chọn quà của quản trị viên.
 *
 * <p>Toàn bộ endpoint ở đây yêu cầu {@code GIFT:MANAGE}: chúng gọi thẳng ra API của
 * UrBox, và UrBox giới hạn tần suất. Mở cho nhân viên nghĩa là mỗi lượt mở cửa hàng là
 * một request ra ngoài — nhân viên chỉ nhìn thấy quà ĐÃ NHẬP, phục vụ từ dữ liệu đã chụp
 * trong {@code reward_gift_items}.
 */
@RestController
@RequestMapping("/api/v1/urbox")
@RequiredArgsConstructor
public class UrboxCatalogController {

    private final UrboxCatalogService catalogService;

    /**
     * Trạng thái kết nối. KHÔNG đòi {@code GIFT:MANAGE} vì giao diện cần biết có nên
     * hiện tab kho quà UrBox hay không trước cả khi người dùng bấm vào đâu — và câu trả
     * lời không tiết lộ gì ngoài việc tính năng có bật hay không.
     */
    @GetMapping("/status")
    public ResponseEntity<ApiResponse<UrboxStatusResponse>> getStatus() {
        return ResponseEntity.ok(ApiResponse.success(catalogService.getStatus()));
    }

    @GetMapping("/gifts")
    @PreAuthorize("hasAuthority('GIFT:MANAGE')")
    public ResponseEntity<ApiResponse<UrboxCatalogPageResponse>> browse(
            @RequestParam(required = false) String catId,
            @RequestParam(required = false) String brandId,
            @RequestParam(required = false) String title,
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "24") Integer size) {
        return ResponseEntity.ok(ApiResponse.success(
                catalogService.browse(catId, brandId, title, page, size)));
    }

    /** {@code parentId = 2} là danh mục quà eVoucher, {@code 136} là quà vật lý. */
    @GetMapping("/categories")
    @PreAuthorize("hasAuthority('GIFT:MANAGE')")
    public ResponseEntity<ApiResponse<List<UrboxTaxonomyResponse>>> listCategories(
            @RequestParam(required = false) Integer parentId) {
        return ResponseEntity.ok(ApiResponse.success(catalogService.listCategories(parentId)));
    }

    @GetMapping("/brands")
    @PreAuthorize("hasAuthority('GIFT:MANAGE')")
    public ResponseEntity<ApiResponse<List<UrboxTaxonomyResponse>>> listBrands(
            @RequestParam(required = false) String catId) {
        return ResponseEntity.ok(ApiResponse.success(catalogService.listBrands(catId)));
    }

    /** Nhập một món UrBox vào danh mục quà của tổ chức. */
    @PostMapping("/gifts/import")
    @PreAuthorize("hasAuthority('GIFT:MANAGE')")
    public ResponseEntity<ApiResponse<GiftItemResponse>> importGift(
            @Valid @RequestBody ImportUrboxGiftRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Đã thêm quà vào danh mục", catalogService.importGift(request)));
    }
}
