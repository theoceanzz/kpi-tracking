package com.kpitracking.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestClientCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

import java.time.Duration;

/**
 * Timeout mặc định cho mọi {@code RestClient} dựng từ {@code RestClient.Builder} của Spring Boot —
 * trong đó có client gọi OpenAI/Gemini/HuggingFace của Spring AI.
 *
 * <p>Không có timeout thì một nhà cung cấp AI treo sẽ giữ thread Tomcat vô hạn; đủ vài request là
 * hết pool. Read timeout để cao vì một lượt suy luận có thể kéo dài; đường streaming đi qua
 * {@code WebClient} (reactor-netty) và không chịu cấu hình này.
 */
@Configuration
public class HttpClientTimeoutConfig {

    @Bean
    public RestClientCustomizer defaultRestClientTimeouts(
            @Value("${app.http.connect-timeout:10s}") Duration connectTimeout,
            @Value("${app.http.read-timeout:120s}") Duration readTimeout) {
        return builder -> {
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(connectTimeout);
            factory.setReadTimeout(readTimeout);
            builder.requestFactory(factory);
        };
    }
}
