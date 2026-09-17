package com.kpitracking.service;

import com.kpitracking.entity.AiTokenUsage;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.repository.AiTokenUsageRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Ghi một dòng sổ cái cho mỗi lượt gọi LLM.
 *
 * <p>Danh tính lấy từ {@link SecurityContextHolder} ngay tại chỗ: mọi lượt gọi AI đều chạy đồng bộ
 * trên luồng request (không có {@code @Async}, không streaming), đây cũng là cách
 * {@code ManagerContextResolver} đang dùng.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiTokenUsageRecorder {

    private final AiTokenUsageRepository usageRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;

    /**
     * Loại tính năng của lượt gọi hiện tại. Advisor nằm sâu trong Spring AI nên không tự biết
     * mình đang phục vụ luồng nào — controller đặt giá trị này trước khi gọi và xoá sau khi xong.
     */
    private static final ThreadLocal<AiTokenUsage.AiFeature> CURRENT_FEATURE = new ThreadLocal<>();

    public static void setFeature(AiTokenUsage.AiFeature feature) {
        CURRENT_FEATURE.set(feature);
    }

    public static void clearFeature() {
        CURRENT_FEATURE.remove();
    }

    /**
     * Tính năng đang được ghi nhận, hoặc {@code null} nếu chưa đặt.
     *
     * <p>Dùng khi một công đoạn cần đổi tính năng cho ĐÚNG một lời gọi model rồi trả lại như cũ —
     * vd {@code FollowupStage} nằm trong lượt CHAT nhưng lời gọi sinh gợi ý phải tính là FOLLOWUP.
     * Đọc rồi khôi phục thay vì đoán "chắc là CHAT", để chỗ gọi khác không âm thầm bị ghi sai.
     */
    public static AiTokenUsage.AiFeature currentFeature() {
        return CURRENT_FEATURE.get();
    }


    /**
     * Bản không phụ thuộc framework, nhận người dùng và tính năng TƯỜNG MINH.
     *
     * <p>Cần vì callback của model streaming chạy trên luồng HTTP client, nơi không có
     * {@code SecurityContextHolder} lẫn {@code CURRENT_FEATURE}. Người gọi bắt hai thứ đó ở luồng
     * yêu cầu (lúc gửi request) rồi truyền vào đây — xem {@code TokenUsageListener}.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String userEmail, AiTokenUsage.AiFeature feature, String model,
                       int promptTokens, int completionTokens, int totalTokens) {
        if (userEmail == null || userEmail.isBlank()) {
            log.warn("Bỏ qua ghi tiêu thụ token: không xác định được người dùng");
            return;
        }
        User user = userRepository.findByEmail(userEmail).orElse(null);
        if (user == null) return;

        UUID organizationId = resolveOrganizationId(user.getId());
        if (organizationId == null) {
            log.warn("Bỏ qua ghi tiêu thụ token: {} không thuộc tổ chức nào", userEmail);
            return;
        }

        usageRepository.save(AiTokenUsage.builder()
                .userId(user.getId())
                .organizationId(organizationId)
                .feature(feature != null ? feature : AiTokenUsage.AiFeature.CHAT)
                .model(model)
                .promptTokens(promptTokens)
                .completionTokens(completionTokens)
                .totalTokens(totalTokens)
                .periodMonth(AiTokenUsage.currentPeriod())
                .build());
    }

    private UUID resolveOrganizationId(UUID userId) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        if (assignments.isEmpty()) return null;
        return assignments.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
    }

    private static int safe(Integer value) {
        return value != null ? value : 0;
    }
}
