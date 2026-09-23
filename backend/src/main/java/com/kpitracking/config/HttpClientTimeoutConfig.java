package com.kpitracking.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestClientCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

import java.time.Duration;

/**
 * Timeout mặc định cho mọi {@code RestClient} dựng từ {@code RestClient.Builder} của Spring Boot.
 *
 * <p>Không có timeout thì một dịch vụ ngoài treo sẽ giữ thread Tomcat vô hạn; đủ vài request là
 * hết pool. Client gọi model AI của langchain4j KHÔNG đi qua đây — nó có timeout riêng ở
 * {@code app.ai.model.timeout-seconds} (LangChain4jConfig).
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
