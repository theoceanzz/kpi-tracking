package com.kpitracking.controller;

import com.kpitracking.dto.request.landing.LandingLeadRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.service.LandingLeadService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Endpoint public của trang giới thiệu — nằm dưới /api/v1/public/** nên không cần đăng nhập/CSRF. */
@RestController
@RequestMapping("/api/v1/public")
@RequiredArgsConstructor
public class PublicLandingController {

    private final LandingLeadService landingLeadService;

    @PostMapping("/leads")
    public ResponseEntity<ApiResponse<Void>> submitLead(@Valid @RequestBody LandingLeadRequest request,
                                                        HttpServletRequest http) {
        landingLeadService.submit(request, clientIp(http));
        return ResponseEntity.ok(ApiResponse.success("Đã nhận đăng ký. Chúng tôi sẽ liên hệ trong 24 giờ làm việc."));
    }

    /** Sau nginx/Traefik: lấy hop đầu của X-Forwarded-For; gọi thẳng thì dùng remote addr. */
    private static String clientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(xff)) return xff.split(",")[0].trim();
        return req.getRemoteAddr();
    }
}
