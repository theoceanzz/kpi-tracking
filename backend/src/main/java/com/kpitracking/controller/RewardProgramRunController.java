package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.reward.RewardProgramRunResponse;
import com.kpitracking.service.reward.RewardProgramRunService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reward-program-runs")
@RequiredArgsConstructor
public class RewardProgramRunController {

    private final RewardProgramRunService runService;

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('REWARD:CONFIG','REWARD:VIEW')")
    public ResponseEntity<ApiResponse<RewardProgramRunResponse>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(runService.getById(id)));
    }

    /**
     * Phát thưởng thật. Trước khi ghi sổ cái, hệ thống tính LẠI bảng xếp hạng và so vân
     * tay với bản xem trước — lệch thì từ chối, để không phát ra một danh sách khác với
     * danh sách người quản trị đã nhìn.
     */
    @PostMapping("/{id}/issue")
    @PreAuthorize("hasAuthority('REWARD:CONFIG')")
    public ResponseEntity<ApiResponse<RewardProgramRunResponse>> issue(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Đã phát thưởng", runService.issue(id)));
    }

    @PostMapping("/{id}/revert")
    @PreAuthorize("hasAuthority('REWARD:CONFIG')")
    public ResponseEntity<ApiResponse<RewardProgramRunResponse>> revert(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                "Đã thu hồi toàn bộ điểm của lần phát này", runService.revert(id)));
    }
}
