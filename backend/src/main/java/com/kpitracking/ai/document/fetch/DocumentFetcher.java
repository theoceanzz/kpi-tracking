package com.kpitracking.ai.document.fetch;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Tải nội dung một tệp minh chứng từ nơi lưu (Cloudinary / GCS / R2 trả URL https).
 *
 * <p>Chỉ nhận {@code http(s)}, có trần kích thước và thời gian — URL nằm trong CSDL do hệ thống ghi, nhưng
 * một bản ghi hỏng không được biến máy chủ thành công cụ tải tuỳ ý hay treo luồng phân tích.
 */
@Component
public class DocumentFetcher {

    private final HttpClient client;
    private final long maxBytes;
    private final Duration timeout;
    private final java.util.Set<String> allowedHosts;

    /**
     * {@code allowedHosts}: chỉ tải từ các máy này (mặc định kho tệp Cloudinary) — địa chỉ tệp do máy chủ
     * ghi lúc tải lên, nhưng vẫn chặn thêm một lớp để luồng AI không thành đường gọi vào mạng nội bộ.
     * Để trống = không giới hạn. Không theo chuyển hướng vì cùng lý do.
     */
    public DocumentFetcher(@Value("${app.ai.review.evidence.max-bytes:10485760}") long maxBytes,
                           @Value("${app.ai.review.evidence.fetch-timeout-seconds:20}") int timeoutSeconds,
                           @Value("${app.ai.review.evidence.allowed-hosts:res.cloudinary.com}") String allowedHosts) {
        this.maxBytes = maxBytes;
        this.timeout = Duration.ofSeconds(timeoutSeconds);
        this.allowedHosts = java.util.Arrays.stream(allowedHosts.split(","))
                .map(h -> h.strip().toLowerCase()).filter(h -> !h.isEmpty())
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
        this.client = HttpClient.newBuilder()
                .connectTimeout(timeout)
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    public byte[] fetch(String url) throws IOException, InterruptedException {
        URI uri = URI.create(url);
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if (!scheme.equals("https") && !scheme.equals("http")) {
            throw new IOException("địa chỉ tệp không hợp lệ");
        }
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();
        if (!allowedHosts.isEmpty() && !allowedHosts.contains(host)) {
            throw new IOException("tệp không nằm trong kho tệp của hệ thống");
        }
        HttpRequest req = HttpRequest.newBuilder(uri).timeout(timeout).GET().build();
        HttpResponse<InputStream> res = client.send(req, HttpResponse.BodyHandlers.ofInputStream());
        if (res.statusCode() / 100 != 2) {
            res.body().close();
            throw new IOException("không tải được tệp (HTTP " + res.statusCode() + ")");
        }
        try (InputStream in = res.body(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            long total = 0;
            int n;
            while ((n = in.read(buf)) > 0) {
                total += n;
                if (total > maxBytes) throw new IOException("tệp lớn hơn giới hạn đọc");
                out.write(buf, 0, n);
            }
            return out.toByteArray();
        }
    }
}
