package com.kpitracking.event;

import com.kpitracking.ai.document.model.FileRef;

import java.util.List;
import java.util.UUID;

/**
 * Sự kiện của luồng nhân viên tự nhờ AI soi bài trước khi nộp.
 *
 * <p>Khác {@link AiReviewEvents}: bài đang soạn CHƯA được lưu ở đâu cả (chữ trong form, tệp còn ở máy người dùng),
 * nên sự kiện mang luôn nội dung sang luồng nền — chỉ trong bộ nhớ, không ghi xuống CSDL. Không mang entity.
 */
public final class AiSelfCheckEvents {

    private AiSelfCheckEvents() {}

    /**
     * Dòng {@code QUEUED} đã ghi; luồng nền đọc bài và gọi mô hình.
     *
     * @param requesterEmail  người nộp — sổ token của luồng nền cần biết ai dùng
     * @param files           tệp người dùng vừa chọn (chưa tải lên kho), đã đọc sẵn thành byte ở luồng request
     * @param storedFiles     tệp đã tải lên của bản nháp đang sửa: tên + địa chỉ để tải
     */
    public record Requested(UUID checkId, String requesterEmail, String note, Double actualValue,
                            String qualitativeLevel, List<FileRef> files, List<StoredFile> storedFiles) {}

    public record StoredFile(String fileName, String url) {}
}
