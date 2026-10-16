package com.kpitracking.service.document;

import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.service.CloudinaryStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

/**
 * Ảnh chèn vào trình soạn (tài liệu trực tuyến và thư gửi tài liệu): chọn từ máy, dán, kéo thả. Ảnh lên kho tệp công
 * khai và trả URL — thư gửi ra ngoài phải có URL công khai thì người nhận mới thấy ảnh (ảnh nhúng base64 bị phần lớn
 * trình đọc thư chặn và làm phình tài liệu).
 *
 * <p>Ai được tải: mọi thành viên tổ chức (ai soạn tài liệu / thư cũng cần chèn ảnh). Chỉ nhận PNG, JPEG, GIF, WebP —
 * nhận diện bằng mấy byte đầu của tệp, không tin tên hay Content-Type trình duyệt khai. Không nhận SVG: SVG chứa được mã.
 *
 * <p>Không {@code @Transactional}: tệp lên Cloudinary ngoài transaction (CLAUDE.md — "Tải tệp — MỘT đường chung").
 */
@Service
@RequiredArgsConstructor
public class DocumentImageService {

    static final long MAX_BYTES = 5L * 1024 * 1024;

    private final DocumentService base;
    private final CloudinaryStorageService storage;

    public String upload(MultipartFile file) {
        DocumentService.Viewer v = base.viewer();
        if (!v.access().member() || v.orgId() == null) throw new ForbiddenException(ErrorCode.DOCUMENT_FORBIDDEN);
        if (file == null || file.isEmpty()) throw new BusinessException(ErrorCode.NO_IMAGE_SELECTED_UPLOAD);
        if (file.getSize() > MAX_BYTES) throw new BusinessException(ErrorCode.IMAGE_MUST_NOT_EXCEED_5MB_2);
        byte[] head;
        try {
            head = file.getInputStream().readNBytes(16);
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.ONLY_IMAGE_FILES_ACCEPTED);
        }
        if (imageExtension(head) == null) throw new BusinessException(ErrorCode.ONLY_IMAGE_FILES_ACCEPTED);
        try {
            Map<String, String> stored = storage.uploadFile(file, "documents/images/" + v.orgId());
            return stored.get("url");
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.DOCUMENT_STORAGE_FAILED);
        }
    }

    /** Loại ảnh theo chữ ký tệp, {@code null} = không phải ảnh nhận được. */
    static String imageExtension(byte[] b) {
        if (b == null || b.length < 12) return null;
        if ((b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return "png";
        if ((b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return "jpg";
        if (b[0] == 'G' && b[1] == 'I' && b[2] == 'F' && b[3] == '8') return "gif";
        if (b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return "webp";
        return null;
    }
}
