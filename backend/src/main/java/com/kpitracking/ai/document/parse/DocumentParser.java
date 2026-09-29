package com.kpitracking.ai.document.parse;

import com.kpitracking.ai.document.model.FileRef;
import com.kpitracking.ai.document.model.ParsedDocument;

import java.util.Set;

/**
 * Đọc MỘT định dạng tệp thành {@link ParsedDocument} (Strategy). {@link ParserRegistry} chọn bản cài theo
 * {@link #accepts} — đuôi tệp CỘNG nội dung đầu tệp, vì người dùng hay đổi tên (.doc thật ra là .docx…).
 *
 * <p>Ném {@link Unparseable} khi tệp đúng định dạng nhưng không có chữ để lấy (PDF scan, tài liệu chỉ có
 * ảnh) — {@link DocumentReader} quyết định chuyển sang mô hình đọc ảnh hay báo "không đọc được". Lỗi khác
 * (tệp hỏng, có mật khẩu) cứ ném ngoại lệ thường.
 */
public interface DocumentParser {

    /** Các đuôi tệp (chữ thường, không dấu chấm) bản cài này nhận — dùng để kiểm tệp tải lên. */
    Set<String> formats();

    /** Có đọc tệp này không (xét đuôi và vài byte đầu). */
    boolean accepts(FileRef file);

    ParsedDocument parse(FileRef file) throws Exception;

    /** Tệp đọc được định dạng nhưng không có lớp chữ; thông điệp là lý do cho người dùng. */
    final class Unparseable extends Exception {
        public Unparseable(String reason) {
            super(reason);
        }
    }

    // ── nhận dạng nội dung ──────────────────────────────────────────────────

    /** OOXML (docx, xlsx) là tệp zip — bắt đầu bằng "PK". */
    static boolean isZip(byte[] b) {
        return b.length > 1 && b[0] == 'P' && b[1] == 'K';
    }

    /** Word 97 / Excel 97 (OLE2 compound file). */
    static boolean isOle2(byte[] b) {
        return b.length > 3 && (b[0] & 0xFF) == 0xD0 && (b[1] & 0xFF) == 0xCF && (b[2] & 0xFF) == 0x11 && (b[3] & 0xFF) == 0xE0;
    }

    static boolean isPdf(byte[] b) {
        return b.length > 3 && b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F';
    }
}
