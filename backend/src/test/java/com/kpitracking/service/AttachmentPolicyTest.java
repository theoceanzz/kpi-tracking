package com.kpitracking.service;

import com.kpitracking.exception.BusinessException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Chốt chặn tệp đính kèm là thứ chỉ có giá trị khi nó chặn được người CỐ Ý, nên phần lớn test ở đây
 * là các ca gửi lên tệp trông hợp lệ mà nội dung thì không.
 */
class AttachmentPolicyTest {

    private final AttachmentPolicy policy = new AttachmentPolicy();

    /** 4 byte đầu của một tệp JPEG thật (SOI + APP0). */
    private static final byte[] JPEG_HEAD = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0};
    private static final byte[] PDF_HEAD = "%PDF-1.7\n...".getBytes(StandardCharsets.US_ASCII);

    private MultipartFile file(String name, String type, byte[] content) {
        return new MockMultipartFile("files", name, type, content);
    }

    private MultipartFile jpeg(String name) {
        return file(name, "image/jpeg", JPEG_HEAD);
    }

    @Test
    @DisplayName("ảnh và PDF hợp lệ thì đi qua")
    void acceptsValidEvidence() {
        assertThatCode(() -> policy.validate(new MultipartFile[]{
                jpeg("bang-chung.jpg"),
                file("bao-cao.pdf", "application/pdf", PDF_HEAD),
        }, 0)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("client không khai Content-Type vẫn nhận, miễn nội dung đúng định dạng")
    void acceptsMissingContentTypeWhenBytesAreRight() {
        // Vài trình duyệt không khai kiểu cho đuôi tệp chúng không nhận ra. Chặn ở đây là chặn nhầm
        // người dùng thật, trong khi lớp chữ ký byte vẫn đủ sức giữ.
        assertThatCode(() -> policy.validate(new MultipartFile[]{
                file("bang-chung.jpg", null, JPEG_HEAD),
        }, 0)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("phần mở rộng không nằm trong danh sách cho phép -> từ chối")
    void rejectsDisallowedExtension() {
        assertThatThrownBy(() -> policy.validate(new MultipartFile[]{
                file("virus.exe", "application/octet-stream", JPEG_HEAD),
        }, 0))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("không được hỗ trợ")
                // Nói không thôi thì người dùng phải đoán; thông điệp phải kèm cả danh sách nhận được.
                .hasMessageContaining("PDF");
    }

    @Test
    @DisplayName("SVG bị từ chối — trình duyệt chạy script bên trong nó")
    void rejectsSvg() {
        byte[] svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>"
                .getBytes(StandardCharsets.UTF_8);
        assertThatThrownBy(() -> policy.validate(new MultipartFile[]{
                file("logo.svg", "image/svg+xml", svg),
        }, 0)).isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("TỆP ĐỔI ĐUÔI bị chữ ký byte bắt — đây mới là lớp thật sự giữ được")
    void rejectsRenamedFile() {
        byte[] html = "<html><script>alert(1)</script></html>".getBytes(StandardCharsets.UTF_8);
        // Đuôi hợp lệ, kiểu MIME khai cũng hợp lệ. Hai lớp đầu cho qua sạch.
        assertThatThrownBy(() -> policy.validate(new MultipartFile[]{
                file("bang-chung.jpg", "image/jpeg", html),
        }, 0))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("không đúng là định dạng");
    }

    @Test
    @DisplayName("khai Content-Type lệch hẳn với phần mở rộng -> từ chối")
    void rejectsMismatchedContentType() {
        assertThatThrownBy(() -> policy.validate(new MultipartFile[]{
                file("bang-chung.jpg", "text/html", JPEG_HEAD),
        }, 0))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("không khớp");
    }

    @Test
    @DisplayName("quá dung lượng -> từ chối, và nói rõ nặng bao nhiêu")
    void rejectsOversizedFile() {
        byte[] big = new byte[(int) AttachmentPolicy.MAX_FILE_BYTES + 1];
        System.arraycopy(JPEG_HEAD, 0, big, 0, JPEG_HEAD.length);
        assertThatThrownBy(() -> policy.validate(new MultipartFile[]{
                file("to.jpg", "image/jpeg", big),
        }, 0))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("vượt quá giới hạn")
                .hasMessageContaining("10.0 MB");
    }

    @Test
    @DisplayName("tệp rỗng -> từ chối")
    void rejectsEmptyFile() {
        assertThatThrownBy(() -> policy.validate(new MultipartFile[]{
                file("rong.jpg", "image/jpeg", new byte[0]),
        }, 0))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("rỗng");
    }

    @Test
    @DisplayName("giới hạn số tệp tính CẢ tệp đã đính kèm trước đó")
    void countsAlreadyAttachedFiles() {
        MultipartFile[] two = {jpeg("a.jpg"), jpeg("b.jpg")};

        assertThatCode(() -> policy.validate(two, 3)).doesNotThrowAnyException();

        // 4 + 2 = 6. Chỉ đếm mảng gửi lên thì lô này lọt, và người dùng tải nhiều lần là vượt trần.
        assertThatThrownBy(() -> policy.validate(two, 4))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("tối đa 5 tệp");
    }

    @Test
    @DisplayName("không gửi tệp nào -> từ chối thay vì lặng lẽ không làm gì")
    void rejectsEmptyBatch() {
        assertThatThrownBy(() -> policy.validate(new MultipartFile[0], 0))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("tên tệp chứa đường dẫn bị cắt về tên cơ sở")
    void stripsPathFromFileName() {
        assertThat(policy.safeFileName("../../etc/passwd")).isEqualTo("passwd");
        assertThat(policy.safeFileName("C:\\Users\\admin\\bang-chung.jpg")).isEqualTo("bang-chung.jpg");
        assertThat(policy.safeFileName("   ")).isEqualTo("tep-dinh-kem");
    }

    @Test
    @DisplayName("tên tệp quá dài bị cắt ngắn")
    void truncatesLongFileName() {
        assertThat(policy.safeFileName("a".repeat(500))).hasSize(120);
    }
}
