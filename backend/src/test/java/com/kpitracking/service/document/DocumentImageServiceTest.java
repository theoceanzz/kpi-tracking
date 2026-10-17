package com.kpitracking.service.document;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentImageServiceTest {

    private static byte[] pad(byte[] head) {
        byte[] b = new byte[16];
        System.arraycopy(head, 0, b, 0, Math.min(head.length, 16));
        return b;
    }

    @Test
    @DisplayName("Nhận diện ảnh theo chữ ký tệp: PNG/JPEG/GIF/WebP nhận, SVG / HTML / tệp ngắn bị từ chối")
    void signatures() {
        assertThat(DocumentImageService.imageExtension(pad(new byte[]{(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}))).isEqualTo("png");
        assertThat(DocumentImageService.imageExtension(pad(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0}))).isEqualTo("jpg");
        assertThat(DocumentImageService.imageExtension(pad("GIF89a".getBytes(StandardCharsets.US_ASCII)))).isEqualTo("gif");
        assertThat(DocumentImageService.imageExtension(pad("RIFF\0\0\0\0WEBPVP8 ".getBytes(StandardCharsets.US_ASCII)))).isEqualTo("webp");
        assertThat(DocumentImageService.imageExtension(pad("<svg xmlns=\"http".getBytes(StandardCharsets.US_ASCII)))).isNull();
        assertThat(DocumentImageService.imageExtension(pad("<html><script>".getBytes(StandardCharsets.US_ASCII)))).isNull();
        assertThat(DocumentImageService.imageExtension(new byte[]{(byte) 0x89, 'P'})).isNull();
    }
}
