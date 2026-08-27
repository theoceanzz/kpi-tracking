package com.kpitracking.service;

import com.kpitracking.exception.BusinessException;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Luật cho tệp minh chứng đính kèm báo cáo: nhận loại nào, nặng bao nhiêu, mỗi báo cáo mấy tệp.
 *
 * <p>Tách khỏi {@code SubmissionAttachmentService} vì đây là thứ kiểm được bằng test đơn vị mà
 * không cần Cloudinary, không cần cơ sở dữ liệu, không cần cả một ngữ cảnh Spring.
 *
 * <p>Ba lớp kiểm, và lớp thứ ba mới là lớp thật sự có giá trị:
 * <ol>
 *   <li>phần mở rộng nằm trong danh sách trắng — chặn nhầm lẫn thông thường;</li>
 *   <li>kiểu MIME client khai phải khớp phần mở rộng — chặn client cẩu thả;</li>
 *   <li><b>mấy byte đầu của chính nội dung tệp</b> phải đúng định dạng — chặn người cố ý.</li>
 * </ol>
 * Hai lớp đầu chỉ đọc thứ do client gửi lên, mà client thì sửa được: đổi tên {@code virus.exe}
 * thành {@code bang-chung.jpg} là qua sạch cả hai. Chỉ nội dung tệp là không nói dối được.
 */
@Component
public class AttachmentPolicy {

    public static final long MAX_FILE_BYTES = 10L * 1024 * 1024;
    public static final int MAX_FILES_PER_SUBMISSION = 5;

    /** Tên tệp dài quá thì cắt. Cột {@code file_name} là VARCHAR(255) nên 120 còn dư chỗ. */
    private static final int MAX_FILE_NAME_LENGTH = 120;

    /**
     * Phần mở rộng → các kiểu MIME mà trình duyệt được phép khai cho nó.
     *
     * <p>Dùng {@link LinkedHashMap} chứ không phải {@code Map.of}: thứ tự này chính là thứ tự
     * {@link #allowedExtensions()} trả ra cho người dùng đọc, mà thứ tự của {@code Map.of} thì
     * xáo theo băm.
     *
     * <p>Một tệp JPEG có thể được khai bằng ba kiểu khác nhau tuỳ trình duyệt và hệ điều hành —
     * {@code image/pjpeg} là di sản của IE nhưng vẫn còn gặp.
     */
    private static final Map<String, Set<String>> ALLOWED = new LinkedHashMap<>();

    static {
        ALLOWED.put("jpg", Set.of("image/jpeg", "image/jpg", "image/pjpeg"));
        ALLOWED.put("jpeg", Set.of("image/jpeg", "image/jpg", "image/pjpeg"));
        ALLOWED.put("png", Set.of("image/png"));
        ALLOWED.put("webp", Set.of("image/webp"));
        ALLOWED.put("pdf", Set.of("application/pdf"));
        ALLOWED.put("doc", Set.of("application/msword"));
        ALLOWED.put("docx", Set.of("application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
        ALLOWED.put("xls", Set.of("application/vnd.ms-excel"));
        ALLOWED.put("xlsx", Set.of("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
    }

    private static final String ALLOWED_HINT =
            "Chỉ nhận ảnh (JPG, PNG, WebP), PDF, Word (DOC, DOCX) và Excel (XLS, XLSX).";

    /**
     * Kiểm cả lô. Ném ngay ở tệp hỏng đầu tiên, nên tầng gọi phải gọi hàm này TRƯỚC khi đẩy bất kỳ
     * tệp nào lên kho — nửa lô đã lên rồi mới ném là để lại rác phải đi dọn tay.
     *
     * @param alreadyAttached số tệp báo cáo ĐANG có. Giới hạn là của báo cáo chứ không phải của một
     *                        lần gửi; chỉ đếm mảng gửi lên thì tải 5 tệp rồi tải tiếp 5 tệp vẫn lọt.
     */
    public void validate(MultipartFile[] files, int alreadyAttached) {
        if (files == null || files.length == 0) {
            throw new BusinessException("Chưa chọn tệp nào để đính kèm.");
        }

        int total = alreadyAttached + files.length;
        if (total > MAX_FILES_PER_SUBMISSION) {
            throw new BusinessException(String.format(
                    "Mỗi báo cáo chỉ đính kèm tối đa %d tệp. Báo cáo này đang có %d tệp, "
                            + "bạn vừa chọn thêm %d. Hãy bớt bớt rồi thử lại.",
                    MAX_FILES_PER_SUBMISSION, alreadyAttached, files.length));
        }

        for (MultipartFile file : files) {
            validateOne(file);
        }
    }

    private void validateOne(MultipartFile file) {
        String name = safeFileName(file.getOriginalFilename());

        if (file.isEmpty()) {
            throw new BusinessException("Tệp \"" + name + "\" rỗng. Hãy chọn lại tệp có nội dung.");
        }

        if (file.getSize() > MAX_FILE_BYTES) {
            throw new BusinessException(String.format(
                    "Tệp \"%s\" nặng %s, vượt quá giới hạn %s mỗi tệp.",
                    name, humanSize(file.getSize()), humanSize(MAX_FILE_BYTES)));
        }

        String ext = extensionOf(name);
        Set<String> allowedTypes = ALLOWED.get(ext);
        if (allowedTypes == null) {
            throw new BusinessException("Tệp \"" + name + "\" không được hỗ trợ. " + ALLOWED_HINT);
        }

        // Kiểu MIME do client khai. Bỏ qua khi client không khai, hoặc khai kiểu "không biết": vài
        // trình duyệt gửi application/octet-stream cho đuôi tệp chúng không nhận ra, mà đó là thiếu
        // hiểu biết chứ không phải dấu hiệu tấn công — lớp magic byte bên dưới vẫn chặn được.
        String declared = file.getContentType();
        if (declared != null && !declared.isBlank()
                && !"application/octet-stream".equalsIgnoreCase(declared)
                && !allowedTypes.contains(declared.toLowerCase(Locale.ROOT))) {
            throw new BusinessException("Tệp \"" + name + "\" khai báo kiểu \"" + declared
                    + "\" không khớp với phần mở rộng \"." + ext + "\". " + ALLOWED_HINT);
        }

        if (!signatureMatches(file, ext)) {
            throw new BusinessException("Nội dung tệp \"" + name + "\" không đúng là định dạng \"."
                    + ext + "\". Có thể tệp đã bị đổi phần mở rộng. " + ALLOWED_HINT);
        }
    }

    /**
     * Đối chiếu mấy byte đầu tệp với chữ ký của định dạng.
     *
     * <p>Đọc 12 byte vì WebP là định dạng cần nhiều nhất: {@code RIFF} ở đầu rồi {@code WEBP} ở
     * byte thứ 8, ở giữa là 4 byte độ dài.
     *
     * <p>Đọc lỗi thì trả false chứ không ném: không đọc nổi nội dung nghĩa là không chứng minh được
     * tệp hợp lệ, mà mặc định của một chốt chặn phải là TỪ CHỐI.
     */
    private boolean signatureMatches(MultipartFile file, String ext) {
        byte[] head = new byte[12];
        int read;
        try (InputStream in = file.getInputStream()) {
            read = in.readNBytes(head, 0, head.length);
        } catch (IOException e) {
            return false;
        }
        if (read < 4) return false;

        return switch (ext) {
            case "jpg", "jpeg" -> startsWith(head, 0xFF, 0xD8, 0xFF);
            case "png" -> startsWith(head, 0x89, 0x50, 0x4E, 0x47);
            // RIFF....WEBP — cần đủ 12 byte mới kiểm được vế sau.
            case "webp" -> read >= 12
                    && startsWith(head, 0x52, 0x49, 0x46, 0x46)
                    && startsWithAt(head, 8, 0x57, 0x45, 0x42, 0x50);
            case "pdf" -> startsWith(head, 0x25, 0x50, 0x44, 0x46);
            // docx/xlsx là tệp ZIP; doc/xls là OLE2 compound file.
            case "docx", "xlsx" -> startsWith(head, 0x50, 0x4B, 0x03, 0x04);
            case "doc", "xls" -> startsWith(head, 0xD0, 0xCF, 0x11, 0xE0);
            default -> false;
        };
    }

    private static boolean startsWith(byte[] bytes, int... expected) {
        return startsWithAt(bytes, 0, expected);
    }

    private static boolean startsWithAt(byte[] bytes, int offset, int... expected) {
        if (bytes.length < offset + expected.length) return false;
        for (int i = 0; i < expected.length; i++) {
            // & 0xFF vì byte trong Java có dấu: 0x89 đọc ra là -119, so thẳng thì không bao giờ khớp.
            if ((bytes[offset + i] & 0xFF) != expected[i]) return false;
        }
        return true;
    }

    /**
     * Cắt tên tệp về tên cơ sở an toàn để lưu và để hiển thị.
     *
     * <p>Tên do client gửi, mà vài trình duyệt cũ gửi cả đường dẫn đầy đủ
     * ({@code C:\Users\admin\bang-chung.jpg}). Giữ nguyên là vừa lộ đường dẫn máy người dùng, vừa
     * mở cửa cho mấy trò {@code ../} nếu sau này có ai đem tên này đi ghép vào đường dẫn thật.
     */
    public String safeFileName(String original) {
        if (original == null || original.isBlank()) return "tep-dinh-kem";

        String name = original.replace('\\', '/');
        int slash = name.lastIndexOf('/');
        if (slash >= 0) name = name.substring(slash + 1);
        name = name.strip();

        if (name.isEmpty()) return "tep-dinh-kem";
        return name.length() <= MAX_FILE_NAME_LENGTH ? name : name.substring(0, MAX_FILE_NAME_LENGTH);
    }

    private static String extensionOf(String name) {
        int dot = name.lastIndexOf('.');
        // Không có dấu chấm, hoặc dấu chấm nằm cuối ("bao-cao.") — cả hai đều là không có đuôi.
        if (dot < 0 || dot == name.length() - 1) return "";
        return name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private static String humanSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.0f KB", bytes / 1024.0);
        return String.format("%.1f MB", bytes / (1024.0 * 1024));
    }

    /** Danh sách đuôi tệp được nhận, theo thứ tự khai báo. */
    public static List<String> allowedExtensions() {
        return List.copyOf(ALLOWED.keySet());
    }
}
