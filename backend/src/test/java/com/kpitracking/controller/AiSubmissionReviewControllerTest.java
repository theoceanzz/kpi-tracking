package com.kpitracking.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tầng controller: MỌI endpoint phải đòi quyền AI_REVIEW (thiếu quyền -> Spring Security trả 403 trước khi
 * vào service). Phạm vi đơn vị kiểm ở service — xem {@code ReviewContextBuilderTest}.
 *
 * <p>Test theo chú thích thay vì dựng cả Spring context: điều cần chốt là KHÔNG ai thêm được một endpoint
 * mới mà quên {@code @PreAuthorize}.
 */
class AiSubmissionReviewControllerTest {

    private static List<Method> endpoints() {
        return Arrays.stream(AiSubmissionReviewController.class.getDeclaredMethods())
                .filter(m -> m.isAnnotationPresent(GetMapping.class) || m.isAnnotationPresent(PostMapping.class)
                        || m.isAnnotationPresent(PutMapping.class) || m.isAnnotationPresent(PatchMapping.class)
                        || m.isAnnotationPresent(DeleteMapping.class))
                .toList();
    }

    @Test
    @DisplayName("mọi endpoint đều có @PreAuthorize đòi quyền AI_REVIEW")
    void everyEndpointRequiresAiReviewAuthority() {
        assertThat(endpoints()).isNotEmpty();
        for (Method m : endpoints()) {
            PreAuthorize pre = m.getAnnotation(PreAuthorize.class);
            assertThat(pre).as("thiếu @PreAuthorize ở %s", m.getName()).isNotNull();
            assertThat(pre.value()).as("quyền của %s", m.getName()).contains("AI_REVIEW:");
        }
    }

    @Test
    @DisplayName("ghi cấu hình chỉ cho AI_REVIEW:CONFIG; nhờ AI chấm chỉ cho AI_REVIEW:USE")
    void writeEndpointsNeedTheRightAuthority() throws Exception {
        Method update = AiSubmissionReviewController.class.getMethod("updateSettings",
                com.kpitracking.dto.request.ai.AiReviewSettingsRequest.class);
        assertThat(update.getAnnotation(PreAuthorize.class).value()).isEqualTo("hasAuthority('AI_REVIEW:CONFIG')");

        Method request = AiSubmissionReviewController.class.getMethod("request",
                com.kpitracking.dto.request.ai.AiSubmissionReviewRequest.class);
        assertThat(request.getAnnotation(PreAuthorize.class).value()).isEqualTo("hasAuthority('AI_REVIEW:USE')");
    }
}
