package com.kpitracking.controller;

import com.kpitracking.dto.request.reward.RewardProgramRequest;
import com.kpitracking.dto.request.reward.RewardRunPreviewRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.reward.RewardProgramResponse;
import com.kpitracking.dto.response.reward.RewardProgramRunResponse;
import com.kpitracking.service.reward.RewardProgramRunService;
import com.kpitracking.service.reward.RewardProgramService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reward-programs")
@RequiredArgsConstructor
public class RewardProgramController {

    private final RewardProgramService programService;
    private final RewardProgramRunService runService;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('REWARD:CONFIG','REWARD:VIEW')")
    public ResponseEntity<ApiResponse<List<RewardProgramResponse>>> list() {
        return ResponseEntity.ok(ApiResponse.success(programService.list()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('REWARD:CONFIG','REWARD:VIEW')")
    public ResponseEntity<ApiResponse<RewardProgramResponse>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(programService.getById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('REWARD:CONFIG')")
    public ResponseEntity<ApiResponse<RewardProgramResponse>> create(
            @Valid @RequestBody RewardProgramRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã tạo chương trình thưởng",
                programService.create(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('REWARD:CONFIG')")
    public ResponseEntity<ApiResponse<RewardProgramResponse>> update(
            @PathVariable UUID id, @Valid @RequestBody RewardProgramRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã cập nhật chương trình",
                programService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('REWARD:CONFIG')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        programService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Đã xoá chương trình"));
    }

    /**
     * Tính bảng xếp hạng và lưu thành bản xem trước. CHƯA phát điểm cho ai.
     *
     * @param targetId id của kỳ hoặc đợt, tuỳ phạm vi của chương trình
     */
    @PostMapping("/{id}/preview")
    @PreAuthorize("hasAuthority('REWARD:CONFIG')")
    public ResponseEntity<ApiResponse<RewardProgramRunResponse>> preview(
            @PathVariable UUID id, @Valid @RequestBody RewardRunPreviewRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                runService.preview(id, request.getTargetId(), request.getTiers())));
    }

    @GetMapping("/{id}/runs")
    @PreAuthorize("hasAnyAuthority('REWARD:CONFIG','REWARD:VIEW')")
    public ResponseEntity<ApiResponse<List<RewardProgramRunResponse>>> listRuns(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(runService.listByProgram(id)));
    }
}
