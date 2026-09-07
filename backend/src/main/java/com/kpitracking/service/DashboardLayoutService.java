package com.kpitracking.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.dto.request.dashboard.SaveDashboardLayoutRequest;
import com.kpitracking.dto.response.dashboard.DashboardLayoutResponse;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserDashboardLayout;
import com.kpitracking.enums.DashboardScope;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.UserDashboardLayoutRepository;
import com.kpitracking.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Bố cục trang chủ của chính người dùng đang đăng nhập.
 * Mọi thao tác đều lấy user từ SecurityContext — không bao giờ nhận userId từ client,
 * nên không có đường nào đọc/ghi bố cục của người khác.
 */
@Service
@RequiredArgsConstructor
public class DashboardLayoutService {

    private final UserDashboardLayoutRepository layoutRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
    }

    @Transactional(readOnly = true)
    public DashboardLayoutResponse get(DashboardScope scope) {
        User currentUser = getCurrentUser();
        return layoutRepository.findByUserIdAndScope(currentUser.getId(), scope)
                .map(entity -> DashboardLayoutResponse.builder()
                        .scope(entity.getScope())
                        .layout(entity.getLayout())
                        .updatedAt(entity.getUpdatedAt())
                        .build())
                // Chưa tuỳ chỉnh bao giờ: trả layout null để frontend dùng preset mặc định
                .orElseGet(() -> DashboardLayoutResponse.builder().scope(scope).build());
    }

    @Transactional
    public DashboardLayoutResponse save(SaveDashboardLayoutRequest request) {
        User currentUser = getCurrentUser();
        String layout = normalizeLayout(request.getLayout());

        UserDashboardLayout entity = layoutRepository
                .findByUserIdAndScope(currentUser.getId(), request.getScope())
                .orElseGet(() -> UserDashboardLayout.builder()
                        .user(currentUser)
                        .scope(request.getScope())
                        .build());
        entity.setLayout(layout);

        entity = layoutRepository.save(entity);
        return DashboardLayoutResponse.builder()
                .scope(entity.getScope())
                .layout(entity.getLayout())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    @Transactional
    public void reset(DashboardScope scope) {
        User currentUser = getCurrentUser();
        layoutRepository.deleteByUserIdAndScope(currentUser.getId(), scope);
    }

    /**
     * Cột là jsonb nên JSON hỏng sẽ nổ ở tầng DB thành lỗi 500 khó hiểu.
     * Kiểm ngay tại đây để trả 400 kèm thông điệp rõ ràng.
     */
    private String normalizeLayout(String raw) {
        try {
            JsonNode node = objectMapper.readTree(raw);
            if (!node.isArray()) {
                throw new BusinessException("Bố cục phải là một mảng JSON");
            }
            return objectMapper.writeValueAsString(node);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("Bố cục không phải JSON hợp lệ");
        }
    }
}
