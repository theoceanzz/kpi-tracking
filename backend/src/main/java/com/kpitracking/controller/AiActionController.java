package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.service.ai.action.PendingAction;
import com.kpitracking.service.ai.action.PendingActionExecutor;
import com.kpitracking.service.ai.action.PendingActionStore;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Xác nhận và chạy một thao tác GHI mà trợ lý đã chuẩn bị.
 *
 * <p><b>KHÔNG đi qua model.</b> Lúc này mọi thứ đã được giải nghĩa xong và nằm trong kho; việc còn
 * lại thuần cơ học. Cho model tham gia bước này là trả tiền token cho một việc không cần suy nghĩ,
 * và mở thêm một chỗ để nó nói sai về kết quả.
 *
 * <p><b>Ba lớp chặn, và không lớp nào thừa:</b>
 * <ol>
 *   <li>kho chỉ trả hành động cho ĐÚNG người đã tạo ra nó;</li>
 *   <li>danh sách id client gửi lên phải là TẬP CON của lời mời gốc — nên không chèn thêm được;</li>
 *   <li>dịch vụ nghiệp vụ vẫn kiểm quyền và cấp bậc cho từng mục như khi bấm trên giao diện.</li>
 * </ol>
 * Bỏ lớp thứ hai là dựng lại đúng lỗ hổng {@code bulk-review} vừa phải vá: một endpoint nhận danh
 * sách id tuỳ ý rồi ghi.
 */
@RestController
@RequestMapping("/api/v1/ai/actions")
@RequiredArgsConstructor
@Tag(name = "AI Actions", description = "Xác nhận các thao tác ghi do trợ lý đề nghị")
public class AiActionController {

    private final PendingActionStore store;
    private final PendingActionExecutor executor;
    private final UserRepository userRepository;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ConfirmRequest {
        /**
         * Các mục người dùng còn để chọn. Bỏ trống = làm hết.
         *
         * <p>Chỉ dùng để THU HẸP: id nào không có trong lời mời gốc sẽ bị bỏ qua.
         */
        private List<UUID> itemIds;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ConfirmResponse {
        /** Câu để client chèn vào khung chat như một lời của trợ lý. */
        private String text;
        private int succeeded;
        private int failed;
        /** Nhãn kèm lý do của các mục không chạy được. */
        private List<String> failures;
    }

    @PostMapping("/{actionId}/confirm")
    @Operation(summary = "Xác nhận và chạy một thao tác do trợ lý chuẩn bị")
    public ResponseEntity<ApiResponse<ConfirmResponse>> confirm(
            @PathVariable String actionId,
            @RequestBody(required = false) ConfirmRequest request) {

        UUID me = currentUserId();
        PendingAction action = store.take(actionId, me);
        if (action == null) {
            // Một câu cho cả ba trường hợp (không có / hết hạn / của người khác) là có chủ đích:
            // phân biệt chúng là nói cho người hỏi biết khoá nào có thật.
            return ResponseEntity.ok(ApiResponse.success(ConfirmResponse.builder()
                    .text("Lời mời xác nhận này không còn hiệu lực. Bạn hỏi lại trợ lý giúp mình nhé.")
                    .succeeded(0).failed(0).failures(List.of())
                    .build()));
        }

        PendingAction toRun = narrow(action, request == null ? null : request.getItemIds());
        if (toRun.isEmpty()) {
            return ResponseEntity.ok(ApiResponse.success(ConfirmResponse.builder()
                    .text("Bạn chưa chọn mục nào nên mình không thực hiện gì cả.")
                    .succeeded(0).failed(0).failures(List.of())
                    .build()));
        }

        PendingActionExecutor.Outcome outcome = executor.execute(toRun);
        return ResponseEntity.ok(ApiResponse.success(ConfirmResponse.builder()
                .text(executor.summarize(toRun, outcome))
                .succeeded(outcome.succeeded().size())
                .failed(outcome.failed().size())
                .failures(outcome.failed())
                .build()));
    }

    /** Giữ lại đúng những mục người dùng còn chọn; id lạ bị loại chứ không được thêm vào. */
    private static PendingAction narrow(PendingAction action, List<UUID> keep) {
        if (keep == null || keep.isEmpty()) return action;
        List<PendingAction.Item> items = action.items().stream()
                .filter(i -> keep.contains(i.id()))
                .toList();
        return new PendingAction(action.id(), action.kind(), action.title(), action.decision(),
                action.note(), items, action.createdAt());
    }

    private UUID currentUserId() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email))
                .getId();
    }
}
