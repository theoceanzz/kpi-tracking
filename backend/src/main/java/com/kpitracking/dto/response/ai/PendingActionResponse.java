package com.kpitracking.dto.response.ai;

import com.kpitracking.service.ai.action.PendingAction;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * Lời mời xác nhận một thao tác GHI, gửi kèm câu trả lời của trợ lý.
 *
 * <p>Client vẽ nó thành một thẻ có danh sách và nút xác nhận — cùng khuôn với
 * {@code FormPatchPreview}: hiện trước từng mục, cho bỏ chọn, rồi mới cho bấm. Khác ở chỗ sau khi
 * bấm thì BACKEND thực thi (gọi {@code POST /ai/actions/{id}/confirm}), chứ không phải giao diện
 * điền vào form.
 *
 * <p><b>Có {@code id} của từng mục là có chủ đích:</b> người dùng bỏ chọn được vài mục, và client
 * gửi lại đúng những id còn chọn. Kho ở backend kiểm danh sách đó phải là TẬP CON của lời mời gốc,
 * nên không ai chèn thêm id lạ vào được.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PendingActionResponse {

    /** Khoá để xác nhận. Dùng đúng một lần. */
    private String id;

    /** Loại việc, để client chọn biểu tượng / màu. */
    private String kind;

    /** APPROVE hoặc REJECT; vắng với việc chỉ có một chiều (nhắc nhở). */
    private String decision;

    /** Một dòng tóm tắt, vd "Duyệt 7 bản nộp của Team Backend". */
    private String title;

    /** Ghi chú / lý do sẽ lưu kèm. */
    private String note;

    private List<Item> items;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Item {
        private UUID id;
        /** Tên đọc được, vd "Nguyễn Văn Staff — Số task hoàn thành". */
        private String label;
        /** Thông tin phụ để thẩm định, vd "kỳ Tháng 6/2026, đạt 12/10 task". */
        private String detail;
    }

    public static PendingActionResponse from(PendingAction action) {
        if (action == null || action.isEmpty()) return null;
        return PendingActionResponse.builder()
                .id(action.id())
                .kind(action.kind().name())
                .decision(action.decision() == null ? null : action.decision().name())
                .title(action.title())
                .note(action.note())
                .items(action.items().stream()
                        .map(i -> Item.builder()
                                .id(i.id())
                                .label(i.label())
                                .detail(i.detail())
                                .build())
                        .toList())
                .build();
    }
}
