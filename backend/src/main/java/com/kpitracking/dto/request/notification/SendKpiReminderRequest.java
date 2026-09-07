package com.kpitracking.dto.request.notification;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

/**
 * Thư nhắc tiến độ KPI do quản lý tự soạn trên dashboard.
 *
 * <p>Chỉ nhận {@code userId} chứ không nhận địa chỉ email tự do — địa chỉ nhận được
 * tra ngược từ hồ sơ nhân sự và có kiểm tra phạm vi quản lý, để endpoint này không
 * thành đường gửi thư tới bất kỳ ai qua máy chủ của hệ thống.
 */
@Getter
@Setter
public class SendKpiReminderRequest {

    @NotNull
    private UUID userId;

    @NotBlank
    @Size(max = 200)
    private String subject;

    @NotBlank
    @Size(max = 5000)
    private String body;
}
