package com.kpitracking.service.document;

import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Luật tệp của thư viện tài liệu (docs/DOCUMENTS_DESIGN.md §5.1, §9, §10). Cùng ba lớp kiểm như
 * {@code AttachmentPolicy}: đuôi tệp trong danh sách trắng, MIME khai khớp đuôi, và — lớp duy nhất client
 * không nói dối được — mấy byte đầu của nội dung. Thêm một lớp riêng cho tài liệu: DOCX không được mang
 * macro ({@code word/vbaProject.bin}), vì đổi tên {@code .docm} thành {@code .docx} là qua được ba lớp kia.
 *
 * <p>Lớp thuần, không Spring, không DB — test đơn vị được.
 */
public final class DocumentPolicy {

    public static final long MAX_FILE_BYTES = 10L * 1024 * 1024;
    private static final int MAX_FILE_NAME_LENGTH = 120;

    /**
     * Loại tệp nhận được. Thêm loại mới ở đây VÀ phải có {@code DocumentParser} đọc được nó. Kiểu MIME ĐẦU TIÊN của
     * mỗi đuôi là kiểu được lưu; các kiểu sau là những gì trình duyệt / hệ điều hành hay khai cho đuôi đó.
     */
    private static final Map<String, List<String>> ALLOWED = Map.of(
            "docx", List.of("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            "pdf", List.of("application/pdf"),
            "xlsx", List.of("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            "txt", List.of("text/plain"),
            "md", List.of("text/markdown", "text/x-markdown", "text/plain"),
            // Windows khai .csv là "application/vnd.ms-excel" khi máy có cài Excel.
            "csv", List.of("text/csv", "text/plain", "application/vnd.ms-excel"));

    public static final List<String> ALLOWED_EXTENSIONS = List.of("docx", "pdf", "xlsx", "txt", "md", "csv");

    private DocumentPolicy() {}

    /** Kết quả đã kiểm: tên an toàn, đuôi, kiểu MIME chuẩn để lưu. */
    public record Checked(String fileName, String extension, String contentType) {}

    public static Checked check(String originalName, String declaredType, byte[] bytes) {
        String name = safeFileName(originalName);
        if (bytes == null || bytes.length == 0) {
            throw new BusinessException(ErrorCode.FILE_EMPTY, name);
        }
        if (bytes.length > MAX_FILE_BYTES) {
            throw new BusinessException(ErrorCode.DOCUMENT_FILE_TOO_LARGE, name, MAX_FILE_BYTES / (1024 * 1024));
        }
        String ext = extensionOf(name);
        List<String> types = ALLOWED.get(ext);
        if (types == null) {
            throw new BusinessException(ErrorCode.DOCUMENT_FILE_TYPE_NOT_ALLOWED, name, String.join(", ", ALLOWED_EXTENSIONS));
        }
        // Bỏ qua khi client không khai hoặc khai "không biết" — lớp magic byte bên dưới vẫn chặn.
        if (declaredType != null && !declaredType.isBlank()
                && !"application/octet-stream".equalsIgnoreCase(declaredType)
                && !types.contains(declaredType.split(";")[0].strip().toLowerCase(Locale.ROOT))) {
            throw new BusinessException(ErrorCode.DOCUMENT_FILE_TYPE_NOT_ALLOWED, name, String.join(", ", ALLOWED_EXTENSIONS));
        }
        boolean signatureOk = switch (ext) {
            case "pdf" -> startsWith(bytes, 0x25, 0x50, 0x44, 0x46);            // %PDF
            case "docx" -> startsWith(bytes, 0x50, 0x4B, 0x03, 0x04) && isMacroFreeOffice(bytes, "word/document.xml");
            case "xlsx" -> startsWith(bytes, 0x50, 0x4B, 0x03, 0x04) && isMacroFreeOffice(bytes, "xl/workbook.xml");
            case "txt", "md", "csv" -> isPlainUtf8Text(bytes);
            default -> false;
        };
        if (!signatureOk) {
            throw new BusinessException(ErrorCode.DOCUMENT_FILE_TYPE_NOT_ALLOWED, name, String.join(", ", ALLOWED_EXTENSIONS));
        }
        return new Checked(name, ext, types.get(0));
    }

    /** DOCX thật, không macro — giữ tên cũ cho test. */
    static boolean isMacroFreeDocx(byte[] bytes) {
        return isMacroFreeOffice(bytes, "word/document.xml");
    }

    /**
     * Tệp Office Open XML thật: là ZIP, có phần thân {@code bodyEntry} ({@code word/document.xml},
     * {@code xl/workbook.xml}), KHÔNG có {@code vbaProject.bin} (macro — đổi tên .docm/.xlsm thành .docx/.xlsx là
     * qua được ba lớp kia). Đọc hỏng giữa chừng thì từ chối — một chốt chặn mặc định phải là TỪ CHỐI.
     */
    static boolean isMacroFreeOffice(byte[] bytes, String bodyEntry) {
        boolean hasBody = false;
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            ZipEntry e;
            int entries = 0;
            while ((e = zip.getNextEntry()) != null) {
                // Chặn zip bom kiểu hàng chục nghìn mục rỗng: DOCX thật hiếm khi quá vài trăm mục.
                if (++entries > 5000) return false;
                String n = e.getName().toLowerCase(Locale.ROOT);
                if (n.endsWith("vbaproject.bin")) return false;
                if (n.equals(bodyEntry)) hasBody = true;
            }
        } catch (IOException ex) {
            return false;
        }
        return hasBody;
    }

    /**
     * Văn bản thuần: UTF-8 hợp lệ (cho phép BOM) và không có byte NUL — tệp nhị phân đổi đuôi thành .txt sẽ có NUL
     * hoặc chuỗi byte UTF-8 hỏng. Tiếng Việt gõ ở Windows-1258 cũng bị từ chối: K.AI đọc ra chữ vỡ còn tệ hơn không đọc.
     */
    static boolean isPlainUtf8Text(byte[] bytes) {
        for (byte b : bytes) if (b == 0) return false;
        int start = startsWith(bytes, 0xEF, 0xBB, 0xBF) ? 3 : 0;
        try {
            java.nio.charset.StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
                    .onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT)
                    .decode(java.nio.ByteBuffer.wrap(bytes, start, bytes.length - start));
            return true;
        } catch (java.nio.charset.CharacterCodingException e) {
            return false;
        }
    }

    /** Cắt về tên cơ sở (bỏ đường dẫn máy người dùng, chặn {@code ../}), tối đa 120 ký tự, giữ đuôi. */
    public static String safeFileName(String original) {
        if (original == null || original.isBlank()) return "tai-lieu";
        String name = original.replace('\\', '/');
        int slash = name.lastIndexOf('/');
        if (slash >= 0) name = name.substring(slash + 1);
        name = name.strip();
        if (name.isEmpty()) return "tai-lieu";
        if (name.length() <= MAX_FILE_NAME_LENGTH) return name;
        String ext = extensionOf(name);
        int keep = MAX_FILE_NAME_LENGTH - (ext.isEmpty() ? 0 : ext.length() + 1);
        return name.substring(0, keep) + (ext.isEmpty() ? "" : "." + ext);
    }

    /** Tiêu đề mặc định: tên tệp bỏ đuôi. */
    public static String defaultTitle(String fileName) {
        String ext = extensionOf(fileName);
        return ext.isEmpty() ? fileName : fileName.substring(0, fileName.length() - ext.length() - 1);
    }

    static String extensionOf(String name) {
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) return "";
        return name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private static boolean startsWith(byte[] bytes, int... expected) {
        if (bytes.length < expected.length) return false;
        for (int i = 0; i < expected.length; i++) {
            if ((bytes[i] & 0xFF) != expected[i]) return false;
        }
        return true;
    }
}
