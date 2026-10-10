package com.kpitracking.exception;

import java.io.IOException;

/**
 * Kho tệp (Cloudinary) không nhận được tệp sau khi đã hết số lần thử: timeout, rớt kết nối, máy chủ
 * từ chối. Là {@link IOException} để các chỗ đang {@code catch (IOException)} (nạp tài liệu RAG bỏ qua
 * ảnh hỏng, kho tài liệu) vẫn chạy như cũ; chỗ nào để nó bay lên controller thì
 * {@code GlobalExceptionHandler} trả {@link ErrorCode#FILE_STORAGE_UNAVAILABLE} (503) kèm tên tệp —
 * frontend coi 503 là lỗi thử lại được và hiện nút Thử lại.
 */
public class FileStorageUnavailableException extends IOException implements CodedException {

    private final String fileName;

    public FileStorageUnavailableException(String fileName, Throwable cause) {
        super("Cloudinary upload failed for " + fileName + ": " + (cause != null ? cause.getMessage() : ""), cause);
        this.fileName = fileName == null ? "" : fileName;
    }

    @Override
    public ErrorCode getErrorCode() {
        return ErrorCode.FILE_STORAGE_UNAVAILABLE;
    }

    @Override
    public Object[] getArgs() {
        return new Object[]{fileName};
    }
}
