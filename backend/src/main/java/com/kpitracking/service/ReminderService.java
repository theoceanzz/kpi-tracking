package com.kpitracking.service;

import com.kpitracking.dto.request.notification.SendKpiReminderRequest;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiReminder;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiReminderRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.email.EmailLayout;
import com.kpitracking.service.notification.NotificationDispatcher;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReminderService {

    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final KpiReminderRepository kpiReminderRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final PermissionChecker permissionChecker;
    private final NotificationService notificationService;
    private final EmailService emailService;
    private final NotificationDispatcher dispatcher;

    @Transactional
    public void sendReminder(UUID kpiCriteriaId, UUID userId) {
        KpiCriteria criteria = kpiCriteriaRepository.findById(kpiCriteriaId)
                .orElseThrow(() -> new ResourceNotFoundException("KPI", "id", kpiCriteriaId));

        User employee = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Nhân viên", "id", userId));

        // Chuông hiện ngay, email xếp hàng chờ gộp: quản lý thường bấm nhắc lần lượt cho
        // vài chỉ tiêu của cùng một người, gửi rời thì nhân viên nhận liền mấy lá thư
        // trong một phút.
        String title = "Nhắc nhở nộp báo cáo KPI";
        String message = String.format(
                "Bạn nhận được lời nhắc nộp báo cáo cho chỉ tiêu KPI: %s thuộc đợt %s. " +
                "Vui lòng đăng nhập hệ thống để cập nhật kết quả thực hiện.",
                criteria.getName(), criteria.getKpiPeriod().getName());
        java.util.UUID orgId = criteria.getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
        dispatcher.dispatch(orgId, "reminder_deadline", employee, criteria.getOrgUnit(),
                title, message, "KPI_REMINDER", kpiCriteriaId);

        // 3. Log Reminder
        KpiReminder reminder = KpiReminder.builder()
                .kpiCriteria(criteria)
                .user(employee)
                .batchNumber(criteria.getSubmissions().size() + 1)
                .build();
        kpiReminderRepository.save(reminder);
    }

    /**
     * Gửi thư nhắc tiến độ KPI mà quản lý đã tự soạn/chỉnh trên dashboard.
     *
     * <p>Chạy đồng bộ để người bấm "Gửi" biết ngay thư đã đi hay chưa. Người nhận cũng
     * nhận được thông báo trong ứng dụng để không phụ thuộc hoàn toàn vào email.
     */
    @Transactional
    public void sendProgressReminder(SendKpiReminderRequest request) {
        User sender = getCurrentUser();
        User recipient = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Nhân viên", "id", request.getUserId()));

        if (recipient.getEmail() == null || recipient.getEmail().isBlank()) {
            throw new BusinessException("Nhân sự này chưa có email nên không gửi được");
        }

        OrgUnit recipientUnit = requireManageable(sender, recipient);

        emailService.sendDirect(
                recipient.getEmail(),
                request.getSubject(),
                EmailLayout.wrap("Nhắc tiến độ KPI", toHtmlParagraphs(request.getBody())),
                sender.getEmail(),
                sender.getFullName());

        notificationService.createNotification(recipientUnit, recipient, request.getSubject(),
                String.format("%s vừa gửi cho bạn một lời nhắc về tiến độ KPI qua email.", sender.getFullName()),
                "KPI_REMINDER", null);
    }

    /**
     * Người nhận phải nằm trong nhánh đơn vị mà người gửi có quyền xem dashboard.
     * Trả về đơn vị khớp để gắn vào thông báo trong ứng dụng.
     */
    private OrgUnit requireManageable(User sender, User recipient) {
        List<UUID> rootIds = permissionChecker.getOrgUnitsWithPermission(sender.getId(), "DASHBOARD:VIEW");
        UUID orgId = organizationIdOf(sender);
        if (rootIds.isEmpty() || orgId == null) {
            throw new ForbiddenException("Bạn không có quyền gửi nhắc nhở cho nhân sự này");
        }

        Set<UUID> allowedUnitIds = orgUnitRepository.findAllInSubtrees(rootIds, orgId).stream()
                .map(OrgUnit::getId)
                .collect(Collectors.toSet());

        return userRoleOrgUnitRepository.findByUserId(recipient.getId()).stream()
                .map(UserRoleOrgUnit::getOrgUnit)
                .filter(unit -> allowedUnitIds.contains(unit.getId()))
                .findFirst()
                .orElseThrow(() -> new ForbiddenException("Bạn không có quyền gửi nhắc nhở cho nhân sự này"));
    }

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    private UUID organizationIdOf(User user) {
        return userRoleOrgUnitRepository.findByUserId(user.getId()).stream()
                .findFirst()
                .map(a -> a.getOrgUnit().getOrgHierarchyLevel().getOrganization().getId())
                .orElse(null);
    }

    /** Nội dung do người dùng gõ nên phải escape trước khi nhét vào khung HTML của mail. */
    private static String toHtmlParagraphs(String text) {
        String escaped = HtmlUtils.htmlEscape(text.trim());
        return Arrays.stream(escaped.split("\\R\\s*\\R"))
                .filter(block -> !block.isBlank())
                .map(block -> "<p>" + block.replaceAll("\\R", "<br/>") + "</p>")
                .collect(Collectors.joining());
    }
}
