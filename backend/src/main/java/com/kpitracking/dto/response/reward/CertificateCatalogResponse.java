package com.kpitracking.dto.response.reward;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Mọi thứ màn hình in chứng nhận cần để vẽ, gói trong một lần gọi.
 *
 * <p>Nhận diện của tổ chức đi kèm danh sách mẫu thay vì để frontend tự gọi API tổ chức:
 * nhân viên thường KHÔNG có quyền đọc hồ sơ công ty, mà chứng nhận của họ vẫn phải có
 * tên và logo công ty trên đó.
 */
@Data
@Builder
public class CertificateCatalogResponse {

    private String organizationName;
    private String organizationLogoUrl;

    private List<CertificateTemplateResponse> templates;
}
