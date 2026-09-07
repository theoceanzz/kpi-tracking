package com.kpitracking.service.notification;

import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.service.EmailService;
import com.kpitracking.service.NotificationService;
import com.kpitracking.service.OrgNotificationConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Một cửa duy nhất để phát thông báo: kiểm tra công tắc của tổ chức, đẩy chuông trong hệ
 * thống, rồi định tuyến email.
 *
 * <p>Trước đây mỗi listener tự lặp lại đoạn "hỏi config, gọi NotificationService, gọi
 * EmailService" — ba nơi chép cùng một logic nên sửa cách gửi email phải sửa cả ba, và
 * thực tế mỗi nơi đã lệch nhau một ít.
 *
 * <p>Hai lối gửi email:
 * <ul>
 *   <li>{@link #dispatch} — xếp hàng chờ gộp. Dùng cho mọi thông báo tác nghiệp (nộp
 *       báo cáo, duyệt, giao chỉ tiêu, nhắc hạn): chúng đi thành đợt và nội dung chỉ có
 *       nghĩa khi đọc cùng nhau.</li>
 *   <li>{@link #dispatchImmediate} — gửi ngay. Dành cho việc mà người nhận đang ngồi chờ
 *       kết quả ngay lúc đó (tiền vào ví, quy đổi điểm); chờ gộp mấy phút ở đây bị hiểu
 *       thành giao dịch chưa chạy.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationDispatcher {

    private final NotificationService notificationService;
    private final OrgNotificationConfigService configService;
    private final NotificationEmailDigestService digestService;
    private final EmailService emailService;

    /** Chuông ngay, email xếp hàng chờ gộp theo người nhận. */
    public void dispatch(UUID orgId, String eventCode, User recipient, OrgUnit orgUnit,
                         String title, String message, String type, UUID referenceId) {
        deliver(orgId, eventCode, recipient, orgUnit, title, message, type, referenceId, false);
    }

    /** Chuông ngay, email cũng đi ngay — không gộp. */
    public void dispatchImmediate(UUID orgId, String eventCode, User recipient, OrgUnit orgUnit,
                                  String title, String message, String type, UUID referenceId) {
        deliver(orgId, eventCode, recipient, orgUnit, title, message, type, referenceId, true);
    }

    private void deliver(UUID orgId, String eventCode, User recipient, OrgUnit orgUnit,
                         String title, String message, String type, UUID referenceId, boolean immediate) {
        if (recipient == null) return;
        try {
            if (configService.isSystemEnabled(orgId, eventCode)) {
                notificationService.createNotification(orgUnit, recipient, title, message, type, referenceId);
            }
            if (configService.isEmailEnabled(orgId, eventCode)) {
                if (immediate) {
                    emailService.sendEventNotificationEmail(orgId, eventCode, recipient.getEmail(),
                            recipient.getFullName(), title, message);
                } else {
                    digestService.enqueue(orgId, eventCode, recipient, title, message, referenceId);
                }
            }
        } catch (Exception e) {
            // Việc nghiệp vụ đã commit từ trước, đây chỉ là lớp báo tin — hỏng thì ghi log
            // chứ không được ném ngược lên làm hỏng cả vòng gửi cho những người còn lại.
            log.error("Không phát được thông báo {} cho người dùng {}", eventCode,
                    recipient.getId(), e);
        }
    }
}
