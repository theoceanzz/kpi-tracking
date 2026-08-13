package com.kpitracking.controller;

import com.kpitracking.dto.request.reward.GiftItemRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.reward.GiftItemResponse;
import com.kpitracking.service.CloudinaryStorageService;
import com.kpitracking.service.reward.RewardGiftService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reward-gifts")
@RequiredArgsConstructor
public class RewardGiftController {

    private final RewardGiftService giftService;
    private final CloudinaryStorageService cloudinaryStorageService;

    /** Cửa hàng cho nhân viên: chỉ quà đang bật, kèm cờ đủ điểm của người đang xem. */
    @GetMapping
    @PreAuthorize("hasAuthority('REWARD:VIEW_MY')")
    public ResponseEntity<ApiResponse<List<GiftItemResponse>>> getShop() {
        return ResponseEntity.ok(ApiResponse.success(giftService.getShop()));
    }

    /** Màn hình quản trị: lấy cả quà đang tắt. */
    @GetMapping("/manage")
    @PreAuthorize("hasAuthority('GIFT:MANAGE')")
    public ResponseEntity<ApiResponse<List<GiftItemResponse>>> listForManage() {
        return ResponseEntity.ok(ApiResponse.success(giftService.listForManage()));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('GIFT:MANAGE')")
    public ResponseEntity<ApiResponse<GiftItemResponse>> create(
            @Valid @RequestBody GiftItemRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã thêm quà tặng", giftService.create(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('GIFT:MANAGE')")
    public ResponseEntity<ApiResponse<GiftItemResponse>> update(
            @PathVariable UUID id, @Valid @RequestBody GiftItemRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã cập nhật quà tặng",
                giftService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('GIFT:MANAGE')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        giftService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Đã xoá quà tặng"));
    }

    /**
     * Tải ảnh quà, trả về URL công khai. Cùng cách làm với ảnh trong mẫu email:
     * không nhúng base64 vì sẽ làm phình cột trong DB.
     */
    @PostMapping(value = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('GIFT:MANAGE')")
    public ResponseEntity<ApiResponse<Map<String, String>>> uploadImage(
            @RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Chưa chọn ảnh để tải lên");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new IllegalArgumentException("Chỉ chấp nhận tệp ảnh");
        }
        if (file.getSize() > 5 * 1024 * 1024) {
            throw new IllegalArgumentException("Ảnh không được vượt quá 5MB");
        }
        String url = cloudinaryStorageService.uploadFile(file, "reward-gifts").get("url");
        return ResponseEntity.ok(ApiResponse.success(Map.of("url", url)));
    }
}
