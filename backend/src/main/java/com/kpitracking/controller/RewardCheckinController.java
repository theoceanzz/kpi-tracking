package com.kpitracking.controller;

import com.kpitracking.dto.request.reward.RewardCheckinConfigRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.reward.RewardCheckinConfigResponse;
import com.kpitracking.dto.response.reward.RewardCheckinStatusResponse;
import com.kpitracking.service.reward.RewardCheckinService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/reward-checkins")
@RequiredArgsConstructor
public class RewardCheckinController {

    private final RewardCheckinService checkinService;

    /**
     * Trạng thái điểm danh của chính mình. Dùng {@code REWARD:VIEW_MY} — quyền cá nhân
     * mà mọi vai trò đều có, vì điểm danh là việc ai cũng làm, không phải quyền quản lý.
     */
    @GetMapping("/me")
    @PreAuthorize("hasAuthority('REWARD:VIEW_MY')")
    public ResponseEntity<ApiResponse<RewardCheckinStatusResponse>> getMyStatus() {
        return ResponseEntity.ok(ApiResponse.success(checkinService.getMyStatus()));
    }

    @PostMapping("/me")
    @PreAuthorize("hasAuthority('REWARD:VIEW_MY')")
    public ResponseEntity<ApiResponse<RewardCheckinStatusResponse>> checkin() {
        RewardCheckinStatusResponse status = checkinService.checkin();
        return ResponseEntity.ok(ApiResponse.success(
                "Điểm danh thành công, bạn nhận được " + status.getTodayPoints() + " điểm", status));
    }

    /**
     * Cấu hình của tổ chức. Cùng quyền với hạn mức và chương trình tự động — đây là nơi
     * quyết định điểm được phát ra, nên phải là {@code REWARD:CONFIG} chứ không phải
     * {@code REWARD:GRANT}.
     */
    @GetMapping("/config")
    @PreAuthorize("hasAuthority('REWARD:CONFIG')")
    public ResponseEntity<ApiResponse<RewardCheckinConfigResponse>> getConfig() {
        return ResponseEntity.ok(ApiResponse.success(checkinService.getConfig()));
    }

    @PutMapping("/config")
    @PreAuthorize("hasAuthority('REWARD:CONFIG')")
    public ResponseEntity<ApiResponse<RewardCheckinConfigResponse>> saveConfig(
            @Valid @RequestBody RewardCheckinConfigRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã lưu cấu hình điểm danh",
                checkinService.saveConfig(request)));
    }
}
