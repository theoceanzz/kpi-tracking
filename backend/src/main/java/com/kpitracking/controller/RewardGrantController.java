package com.kpitracking.controller;

import com.kpitracking.dto.request.reward.CreateRewardGrantRequest;
import com.kpitracking.dto.request.reward.GrantDecisionRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.reward.RewardGrantResponse;
import com.kpitracking.dto.response.reward.RevokePreviewResponse;
import com.kpitracking.enums.RewardGrantStatus;
import com.kpitracking.service.reward.RewardGrantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reward-grants")
@RequiredArgsConstructor
public class RewardGrantController {

    private final RewardGrantService grantService;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('REWARD:GRANT','REWARD:APPROVE','REWARD:VIEW')")
    public ResponseEntity<ApiResponse<PageResponse<RewardGrantResponse>>> search(
            @RequestParam(required = false) RewardGrantStatus status,
            @RequestParam(required = false) UUID grantorId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                grantService.search(status, grantorId, page, size)));
    }

    /**
     * Các lần chính mình được thưởng, để tự in chứng nhận.
     *
     * <p>Mở ở {@code REWARD:VIEW_MY} — nhân viên thường không có quyền xem danh sách đề
     * nghị của tổ chức, nhưng phần thưởng của chính họ thì phải xem và in được. Service
     * chỉ trả về phần của người gọi, không kèm người nhận khác.
     */
    @GetMapping("/my-awards")
    @PreAuthorize("hasAuthority('REWARD:VIEW_MY')")
    public ResponseEntity<ApiResponse<PageResponse<RewardGrantResponse>>> myAwards(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(grantService.searchMyAwards(page, size)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('REWARD:GRANT','REWARD:APPROVE','REWARD:VIEW')")
    public ResponseEntity<ApiResponse<RewardGrantResponse>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(grantService.getById(id)));
    }

    /**
     * Tạo đề nghị thưởng. Trong hạn mức thì phát điểm ngay; vượt hạn mức thì trả về
     * {@code requiresApproval = true} kèm {@code approvalReason} để giao diện hiện
     * đúng thông điệp thay vì phải đoán từ trạng thái.
     */
    @PostMapping
    @PreAuthorize("hasAuthority('REWARD:GRANT')")
    public ResponseEntity<ApiResponse<RewardGrantResponse>> create(
            @Valid @RequestBody CreateRewardGrantRequest request) {
        RewardGrantResponse result = grantService.createGrant(request);
        String message = Boolean.TRUE.equals(result.getRequiresApproval())
                ? "Đã gửi đề nghị thưởng, đang chờ cấp trên duyệt"
                : "Đã thưởng điểm thành công";
        return ResponseEntity.ok(ApiResponse.success(message, result));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAuthority('REWARD:APPROVE')")
    public ResponseEntity<ApiResponse<RewardGrantResponse>> approve(
            @PathVariable UUID id, @RequestBody(required = false) GrantDecisionRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Đã duyệt và phát điểm thưởng", grantService.approve(id, request)));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAuthority('REWARD:APPROVE')")
    public ResponseEntity<ApiResponse<RewardGrantResponse>> reject(
            @PathVariable UUID id, @RequestBody(required = false) GrantDecisionRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Đã từ chối đề nghị thưởng", grantService.reject(id, request)));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('REWARD:GRANT')")
    public ResponseEntity<ApiResponse<RewardGrantResponse>> cancel(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Đã huỷ đề nghị thưởng", grantService.cancel(id)));
    }

    /**
     * Xem trước hậu quả thu hồi trước khi thực hiện. Thu hồi ghi thẳng vào sổ cái và
     * không hoàn tác được, nên người quản trị cần thấy ai bị trừ bao nhiêu, ai sẽ âm
     * số dư — trước khi bấm.
     */
    @GetMapping("/{id}/revoke-preview")
    @PreAuthorize("hasAuthority('REWARD:APPROVE')")
    public ResponseEntity<ApiResponse<RevokePreviewResponse>> previewRevoke(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(grantService.previewRevoke(id)));
    }

    @PostMapping("/{id}/revoke")
    @PreAuthorize("hasAuthority('REWARD:APPROVE')")
    public ResponseEntity<ApiResponse<RewardGrantResponse>> revoke(
            @PathVariable UUID id, @RequestBody(required = false) GrantDecisionRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Đã thu hồi điểm thưởng", grantService.revoke(id, request)));
    }
}
