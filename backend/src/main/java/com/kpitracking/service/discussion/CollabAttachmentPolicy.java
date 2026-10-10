package com.kpitracking.service.discussion;

import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.service.AttachmentPolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Luật tệp đính kèm cho thảo luận và công việc: rộng hơn minh chứng báo cáo ({@link AttachmentPolicy}) — nhận thêm
 * GIF, PowerPoint, TXT, CSV, ZIP — nhưng cùng ba lớp kiểm: đuôi tệp, MIME client khai, và mấy byte đầu của nội
 * dung. TXT/CSV không có chữ ký nên kiểm "là văn bản" (không có byte 0 trong 512 byte đầu).
 */
@Component
@RequiredArgsConstructor
public class CollabAttachmentPolicy {

    public static final long MAX_FILE_BYTES = 10L * 1024 * 1024;
    public static final int MAX_FILES_PER_COMMENT = 5;
    public static final int MAX_FILES_PER_TASK = 10;
    private static final String HINT_KEY = "discussion.attachment.allowedTypes";

    private static final Map<String, Set<String>> ALLOWED = new LinkedHashMap<>();

    static {
        ALLOWED.put("jpg", Set.of("image/jpeg", "image/jpg", "image/pjpeg"));
        ALLOWED.put("jpeg", Set.of("image/jpeg", "image/jpg", "image/pjpeg"));
        ALLOWED.put("png", Set.of("image/png"));
        ALLOWED.put("webp", Set.of("image/webp"));
        ALLOWED.put("gif", Set.of("image/gif"));
        ALLOWED.put("pdf", Set.of("application/pdf"));
        ALLOWED.put("doc", Set.of("application/msword"));
        ALLOWED.put("docx", Set.of("application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
        ALLOWED.put("xls", Set.of("application/vnd.ms-excel"));
        ALLOWED.put("xlsx", Set.of("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        ALLOWED.put("ppt", Set.of("application/vnd.ms-powerpoint"));
        ALLOWED.put("pptx", Set.of("application/vnd.openxmlformats-officedocument.presentationml.presentation"));
        ALLOWED.put("txt", Set.of("text/plain"));
        ALLOWED.put("csv", Set.of("text/csv", "text/plain", "application/vnd.ms-excel", "application/csv"));
        ALLOWED.put("zip", Set.of("application/zip", "application/x-zip-compressed", "application/x-zip"));
    }

    private final AttachmentPolicy attachmentPolicy;

    /** Kiểm cả lô TRƯỚC khi đẩy tệp nào lên kho. {@code alreadyAttached} = số tệp đối tượng đang có. */
    public void validate(MultipartFile[] files, int alreadyAttached, int max, ErrorCode tooMany) {
        if (files == null || files.length == 0) return;
        if (alreadyAttached + files.length > max) {
            throw new BusinessException(tooMany, max);
        }
        for (MultipartFile f : files) validateOne(f);
    }

    public String safeFileName(String original) {
        return attachmentPolicy.safeFileName(original);
    }

    public static boolean isImage(String contentType) {
        return contentType != null && contentType.toLowerCase(Locale.ROOT).startsWith("image/");
    }

    private void validateOne(MultipartFile file) {
        String name = safeFileName(file.getOriginalFilename());
        String hint = ErrorMessages.text(HINT_KEY, "");
        if (file.isEmpty()) throw new BusinessException(ErrorCode.FILE_EMPTY, name);
        if (file.getSize() > MAX_FILE_BYTES) {
            throw new BusinessException(ErrorCode.FILE_EXCEEDING_PER_FILE_LIMIT, name,
                    (file.getSize() / 1024 / 1024) + " MB", (MAX_FILE_BYTES / 1024 / 1024) + " MB");
        }
        int dot = name.lastIndexOf('.');
        String ext = dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
        Set<String> types = ALLOWED.get(ext);
        if (types == null) throw new BusinessException(ErrorCode.FILE_NOT_SUPPORTED, name, hint);
        String declared = file.getContentType();
        if (declared != null && !declared.isBlank() && !"application/octet-stream".equalsIgnoreCase(declared)
                && !types.contains(declared.toLowerCase(Locale.ROOT))) {
            throw new BusinessException(ErrorCode.FILE_DECLARES_TYPE_DOES_NOT_MATCH_EXTENSION, name, declared, ext, hint);
        }
        if (!signatureMatches(file, ext)) {
            throw new BusinessException(ErrorCode.CONTENT_FILE_NOT_REALLY, name, ext, hint);
        }
    }

    private static boolean signatureMatches(MultipartFile file, String ext) {
        byte[] head = new byte[512];
        int read;
        try (InputStream in = file.getInputStream()) {
            read = in.readNBytes(head, 0, head.length);
        } catch (IOException e) {
            return false;
        }
        if (read < 1) return false;
        return switch (ext) {
            case "jpg", "jpeg" -> starts(head, read, 0, 0xFF, 0xD8, 0xFF);
            case "png" -> starts(head, read, 0, 0x89, 0x50, 0x4E, 0x47);
            case "gif" -> starts(head, read, 0, 0x47, 0x49, 0x46, 0x38);
            case "webp" -> starts(head, read, 0, 0x52, 0x49, 0x46, 0x46) && starts(head, read, 8, 0x57, 0x45, 0x42, 0x50);
            case "pdf" -> starts(head, read, 0, 0x25, 0x50, 0x44, 0x46);
            case "docx", "xlsx", "pptx" -> starts(head, read, 0, 0x50, 0x4B, 0x03, 0x04);
            // ZIP rỗng bắt đầu bằng bản ghi "end of central directory".
            case "zip" -> starts(head, read, 0, 0x50, 0x4B, 0x03, 0x04) || starts(head, read, 0, 0x50, 0x4B, 0x05, 0x06);
            case "doc", "xls", "ppt" -> starts(head, read, 0, 0xD0, 0xCF, 0x11, 0xE0);
            case "txt", "csv" -> isText(head, read);
            default -> false;
        };
    }

    private static boolean starts(byte[] b, int read, int offset, int... expected) {
        if (read < offset + expected.length) return false;
        for (int i = 0; i < expected.length; i++) {
            if ((b[offset + i] & 0xFF) != expected[i]) return false;
        }
        return true;
    }

    private static boolean isText(byte[] b, int read) {
        for (int i = 0; i < read; i++) if (b[i] == 0) return false;
        return true;
    }
}
