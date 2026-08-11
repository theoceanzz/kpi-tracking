package com.kpitracking.service;

import com.kpitracking.entity.Organization;
import com.kpitracking.enums.LarkConnectionMode;
import com.kpitracking.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Lấy credential Lark của một tổ chức.
 *
 * <p>Hiện chỉ hỗ trợ {@link LarkConnectionMode#CUSTOM_APP}: mỗi công ty tự tạo ứng dụng trong Lark
 * của họ và nhập App ID / App Secret vào KeyGo. Chế độ {@link LarkConnectionMode#STORE} đòi hỏi
 * KeyGo có tư cách ISV và app đã được Lark duyệt — chưa khả dụng.
 *
 * <p>Đây là <b>điểm cắm duy nhất</b> khi chuyển sang Store app: chỉ hàm này cần biết credential
 * lấy từ đâu, phần còn lại của luồng (chọn công ty, đối chiếu tenant_key, tự tạo người dùng)
 * không phụ thuộc vào mode.
 */
@Component
@RequiredArgsConstructor
public class LarkCredentialResolver {

    public LarkCredentials resolve(Organization organization) {
        if (organization.getLarkConnectionMode() == LarkConnectionMode.STORE) {
            throw new BusinessException("Chế độ ứng dụng Lark dùng chung chưa được hỗ trợ. "
                    + "Vui lòng dùng chế độ tự tạo ứng dụng.");
        }

        if (organization.getLarkAppId() == null || organization.getLarkAppId().isBlank()
                || organization.getLarkAppSecret() == null || organization.getLarkAppSecret().isBlank()) {
            throw new BusinessException("Tổ chức chưa cấu hình App ID / App Secret của Lark.");
        }
        return new LarkCredentials(organization.getLarkAppId(), organization.getLarkAppSecret());
    }

    public record LarkCredentials(String appId, String appSecret) {
    }
}
