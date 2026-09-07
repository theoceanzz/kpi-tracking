package com.kpitracking.config;

import com.kpitracking.security.AuthCookieService;
import com.kpitracking.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.util.matcher.AndRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.util.StringUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import jakarta.servlet.http.HttpServletResponse;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final UserDetailsService userDetailsService;
    private final CookieProperties cookieProperties;
    private static final String CSRF_COOKIE = AuthCookieService.CSRF_COOKIE;

    /**
     * Các endpoint không cần xác thực — dùng chung cho cả authorizeHttpRequests và danh sách
     * bỏ qua CSRF (chưa có phiên thì không có gì để CSRF lợi dụng).
     */
    private static final String[] PUBLIC_ENDPOINTS = {
            "/api/v1/auth/register",
            "/api/v1/auth/login",
            "/api/v1/auth/refresh-token",
            "/api/v1/auth/logout",
            "/api/v1/auth/forgot-password",
            "/api/v1/auth/reset-password",
            "/api/v1/auth/verify-email",
            "/api/v1/auth/resend-verification",
            "/api/v1/auth/lark/**",
            "/api/v1/public/**",
            "/api/v1/webhooks/sepay",
            "/ws/**"
    };

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        // Token nằm trong cookie nên trình duyệt tự gửi kèm mọi request — đó chính là điều kiện
        // cần của CSRF. Dùng double-submit cookie: Spring ghi XSRF-TOKEN (đọc được bằng JS),
        // axios tự đọc và gửi lại ở header X-XSRF-TOKEN.
        CsrfTokenRequestAttributeHandler csrfHandler = new CsrfTokenRequestAttributeHandler();
        // null = ghi cookie ngay ở mọi response thay vì chờ ai đó đọc token (deferred loading
        // của Spring Security 6 khiến cookie không bao giờ được phát cho SPA).
        csrfHandler.setCsrfRequestAttributeName(null);

        // Cookie CSRF phải đọc được bằng JS từ chính origin của SPA. Prod chạy SPA ở keygo.vn còn
        // API ở api.keygo.vn: mặc định Spring ghi cookie host-only cho api.keygo.vn, document.cookie
        // bên keygo.vn không thấy nó nên axios không bao giờ gắn được header X-XSRF-TOKEN.
        // Dùng chung Domain/Secure/SameSite với cookie phiên để hai bên luôn nhất quán.
        CookieCsrfTokenRepository csrfTokenRepository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        csrfTokenRepository.setCookieName(CSRF_COOKIE);
        csrfTokenRepository.setCookieCustomizer(cookie -> {
            cookie.secure(cookieProperties.isSecure());
            cookie.sameSite(cookieProperties.getSameSite());
            if (StringUtils.hasText(cookieProperties.getDomain())) {
                cookie.domain(cookieProperties.getDomain());
            }
        });

        http
            .csrf(csrf -> csrf
                .csrfTokenRepository(csrfTokenRepository)
                .csrfTokenRequestHandler(csrfHandler)
                .requireCsrfProtectionMatcher(csrfProtectionMatcher())
                .ignoringRequestMatchers(PUBLIC_ENDPOINTS))
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .exceptionHandling(exceptions -> exceptions
                .authenticationEntryPoint((request, response, authException) -> 
                    response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized"))
            )
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                .requestMatchers("/api/v1/provinces/**").permitAll()
                .requestMatchers("/actuator/health").permitAll()
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/swagger-ui.html").permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .anyRequest().authenticated()
            )
            .authenticationProvider(authenticationProvider())
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * Chỉ bắt buộc CSRF token với request đi bằng cookie.
     *
     * Trình duyệt không bao giờ tự gắn header Authorization, và một trang lạ cũng không đặt được
     * header đó lên request gửi sang đây (CORS preflight chặn). Vì vậy request đã mang Bearer token
     * theo định nghĩa không phải CSRF — miễn cho nó để Swagger, Postman và client không phải
     * trình duyệt vẫn gọi được các endpoint POST/PUT/DELETE.
     */
    private RequestMatcher csrfProtectionMatcher() {
        return new AndRequestMatcher(
                CsrfFilter.DEFAULT_CSRF_MATCHER,
                request -> {
                    String authHeader = request.getHeader("Authorization");
                    return authHeader == null || !authHeader.startsWith("Bearer ");
                });
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        // setAllowedOrigins (không phải OriginPatterns): với allowCredentials=true, một pattern
        // như "*" sẽ phản chiếu lại mọi Origin và cho phép gửi kèm cookie phiên.
        configuration.setAllowedOrigins(allowedOrigins());
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    private List<String> allowedOrigins() {
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(o -> !o.isEmpty())
                .toList();

        if (origins.isEmpty() || origins.contains("*")) {
            throw new IllegalStateException(
                    "app.cors.allowed-origins phải liệt kê origin cụ thể (ví dụ https://keygo.vn). "
                            + "Không được dùng '*' vì phiên đăng nhập đi bằng cookie.");
        }

        return origins;
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
