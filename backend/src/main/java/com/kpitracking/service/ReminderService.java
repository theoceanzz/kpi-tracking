package com.kpitracking.service;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiReminder;
import com.kpitracking.entity.User;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiReminderRepository;
import com.kpitracking.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReminderService {

    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final KpiReminderRepository kpiReminderRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final EmailService emailService;

    @Transactional
    public void sendReminder(UUID kpiCriteriaId, UUID userId) {
        KpiCriteria criteria = kpiCriteriaRepository.findById(kpiCriteriaId)
                .orElseThrow(() -> new ResourceNotFoundException("KPI", "id", kpiCriteriaId));

        User employee = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Nhân viên", "id", userId));

        // 1. Create In-app Notification
        String title = "Nhắc nhở nộp báo cáo KPI";
        String message = String.format("Bạn có lời nhắc nộp báo cáo cho KPI: %s. Vui lòng hoàn thành sớm.", criteria.getName());
        notificationService.createNotification(criteria.getOrgUnit(), employee, title, message, "KPI_REMINDER", kpiCriteriaId);

        // 2. Send Email
        String emailSubject = "[KeyGo] Nhắc nhở nộp báo cáo KPI: " + criteria.getName();
        String emailContent = String.format(
                "<p>Xin chào <b>%s</b>,</p>" +
                "<p>Bạn nhận được lời nhắc nộp báo cáo cho chỉ tiêu KPI: <b>%s</b> thuộc đợt <b>%s</b>.</p>" +
                "<p>Vui lòng đăng nhập hệ thống để cập nhật kết quả thực hiện.</p>" +
                "<p>Trân trọng,<br>Ban Quản lý KPI</p>",
                employee.getFullName(), criteria.getName(), criteria.getKpiPeriod().getName()
        );
        emailService.sendNotificationEmail(employee.getEmail(), emailSubject, emailContent);

        // 3. Log Reminder
        KpiReminder reminder = KpiReminder.builder()
                .kpiCriteria(criteria)
                .user(employee)
                .batchNumber(criteria.getSubmissions().size() + 1)
                .build();
        kpiReminderRepository.save(reminder);
    }
}
