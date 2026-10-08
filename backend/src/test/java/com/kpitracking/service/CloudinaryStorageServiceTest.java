package com.kpitracking.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.FileStorageUnavailableException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.SocketTimeoutException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Cổng chung tới Cloudinary: mọi chỗ tải tệp đều dựa vào ba lời hứa ở đây — có timeout, thử lại khi
 * lỗi mạng, và không để rác trên Cloudinary khi bước lưu DB hỏng.
 */
class CloudinaryStorageServiceTest {

    private final Uploader uploader = mock(Uploader.class);
    private CloudinaryStorageService service;

    @BeforeEach
    void setUp() {
        Cloudinary cloudinary = mock(Cloudinary.class);
        when(cloudinary.uploader()).thenReturn(uploader);
        PlatformTransactionManager txManager = mock(PlatformTransactionManager.class);
        when(txManager.getTransaction(any())).thenAnswer(inv -> new SimpleTransactionStatus());
        service = new CloudinaryStorageService(cloudinary, txManager);
    }

    private static MultipartFile file(String name) {
        return new MockMultipartFile("files", name, "image/png", new byte[]{1, 2, 3});
    }

    private static Map<String, Object> ok(String publicId) {
        return Map.of("secure_url", "https://cdn/" + publicId, "public_id", publicId, "resource_type", "image");
    }

    @Test
    @DisplayName("gửi kèm timeout — SDK mặc định chờ vô hạn")
    @SuppressWarnings("unchecked")
    void sendsTimeouts() throws Exception {
        when(uploader.upload(any(), anyMap())).thenReturn(ok("a"));

        service.uploadFile(file("a.png"), "f");

        verify(uploader).upload(any(), (Map<String, Object>) org.mockito.ArgumentMatchers.argThat((Map<String, Object> m) ->
                m.get("timeout") instanceof Integer && m.get("connect_timeout") instanceof Integer));
    }

    @Test
    @DisplayName("lỗi mạng thì thử lại, lần sau được là xong")
    void retriesNetworkErrors() throws Exception {
        when(uploader.upload(any(), anyMap()))
                .thenThrow(new SocketTimeoutException("Read timed out"))
                .thenReturn(ok("a"));

        assertThat(service.uploadFile(file("a.png"), "f")).containsEntry("public_id", "a");
        verify(uploader, times(2)).upload(any(), anyMap());
    }

    @Test
    @DisplayName("hết lượt thử thì báo FILE_STORAGE_UNAVAILABLE kèm tên tệp")
    void givesUpWithCodedError() throws Exception {
        when(uploader.upload(any(), anyMap())).thenThrow(new SocketTimeoutException("Read timed out"));

        assertThatThrownBy(() -> service.uploadFile(file("bao-cao.png"), "f"))
                .isInstanceOf(FileStorageUnavailableException.class)
                .satisfies(e -> {
                    FileStorageUnavailableException ex = (FileStorageUnavailableException) e;
                    assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FILE_STORAGE_UNAVAILABLE);
                    assertThat(ex.getArgs()).containsExactly("bao-cao.png");
                });
        verify(uploader, times(3)).upload(any(), anyMap());
    }

    @Test
    @DisplayName("Cloudinary từ chối hẳn thì không thử lại")
    void doesNotRetryRejections() throws Exception {
        when(uploader.upload(any(), anyMap())).thenThrow(new RuntimeException("Invalid image file"));

        assertThatThrownBy(() -> service.uploadFile(file("a.png"), "f"))
                .isInstanceOf(FileStorageUnavailableException.class);
        verify(uploader, times(1)).upload(any(), anyMap());
    }

    @Test
    @DisplayName("uploadThenSave: kiểm tra chạy trước khi tải và chạy lại trước khi lưu")
    void checksBeforeUploadAndAgainBeforeSave() throws Exception {
        when(uploader.upload(any(), anyMap())).thenReturn(ok("a"), ok("b"));
        AtomicInteger checks = new AtomicInteger();

        List<String> saved = service.uploadThenSave(new MultipartFile[]{file("a.png"), file("b.png")}, "f",
                checks::incrementAndGet,
                (ctx, stored) -> stored.stream().map(CloudinaryStorageService.StoredFile::publicId).toList());

        assertThat(checks.get()).isEqualTo(2);
        assertThat(saved).containsExactly("a", "b");
    }

    @Test
    @DisplayName("uploadThenSave: kiểm tra hỏng thì không tệp nào lên Cloudinary")
    void failedCheckUploadsNothing() throws Exception {
        assertThatThrownBy(() -> service.uploadThenSave(new MultipartFile[]{file("a.png")}, "f",
                () -> { throw new IllegalStateException("không có quyền"); },
                (ctx, stored) -> "x"))
                .isInstanceOf(IllegalStateException.class);
        verify(uploader, never()).upload(any(), anyMap());
    }

    @Test
    @DisplayName("uploadThenSave: lưu hỏng thì xoá những tệp đã lên")
    void failedSaveCleansUp() throws Exception {
        when(uploader.upload(any(), anyMap())).thenReturn(ok("a"), ok("b"));
        when(uploader.destroy(any(), anyMap())).thenReturn(Map.of("result", "ok"));

        assertThatThrownBy(() -> service.uploadThenSave(new MultipartFile[]{file("a.png"), file("b.png")}, "f",
                () -> "ctx",
                (ctx, stored) -> { throw new IllegalStateException("kỳ vừa bị khoá"); }))
                .isInstanceOf(IllegalStateException.class);
        verify(uploader).destroy(eq("a"), anyMap());
        verify(uploader).destroy(eq("b"), anyMap());
    }

    @Test
    @DisplayName("uploadThenSave: tệp thứ hai hỏng thì xoá tệp thứ nhất")
    void failedSecondUploadCleansFirst() throws Exception {
        when(uploader.upload(any(), anyMap()))
                .thenReturn(ok("a"))
                .thenThrow(new IOException("reset"));
        when(uploader.destroy(any(), anyMap())).thenReturn(Map.of("result", "ok"));

        assertThatThrownBy(() -> service.uploadThenSave(new MultipartFile[]{file("a.png"), file("b.png")}, "f",
                () -> "ctx", (ctx, stored) -> "x"))
                .isInstanceOf(FileStorageUnavailableException.class);
        verify(uploader).destroy(eq("a"), anyMap());
    }
}
