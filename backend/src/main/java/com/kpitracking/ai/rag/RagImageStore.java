package com.kpitracking.ai.rag;

import java.io.IOException;

/**
 * Nơi cất ảnh bóc từ tài liệu RAG, trả về URL mà client hiển thị được.
 *
 * <p>Tách interface vì hai môi trường cần hai chỗ khác nhau: SaaS có Cloudinary; on-premise (hồ sơ
 * DATC) không được gửi ảnh ra ngoài, và máy dev thì Cloudinary chỉ có giá trị giữ chỗ. Chọn bằng
 * {@code app.ai.rag.image-store = local | cloudinary}; mặc định {@code local} vì nó chạy được ở
 * mọi nơi mà không cần khoá gì.
 */
public interface RagImageStore {

    /** @return URL (tuyệt đối hoặc tương đối gốc API) để nhúng vào Markdown */
    String store(byte[] bytes, String fileName, String sha256) throws IOException;
}
