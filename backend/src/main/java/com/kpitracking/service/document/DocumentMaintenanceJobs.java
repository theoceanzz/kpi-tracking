package com.kpitracking.service.document;

import com.kpitracking.entity.Document;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.enums.DocumentScope;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.service.notification.NotificationDispatcher;
import com.kpitracking.service.reward.RewardContext;
import com.kpitracking.entity.DocumentVersion;
import com.kpitracking.repository.DocumentFolderRepository;
import com.kpitracking.repository.DocumentRepository;
import com.kpitracking.repository.DocumentVersionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Dọn dẹp hằng ngày của thư viện tài liệu (docs/DOCUMENTS_DESIGN.md §5.5). Mỗi lượt xử lý theo lô có trần —
 * lô sau để lần chạy sau, không giữ một giao dịch dài.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DocumentMaintenanceJobs {

    private static final int BATCH = 200;

    private final DocumentRepository documents;
    private final DocumentService documentService;
    private final DocumentStorage storage;
    private final DocumentSettings settings;
    private final PlatformTransactionManager txManager;
    private final DocumentVersionRepository versions;
    private final DocumentFolderRepository folders;
    private final DocumentManagers managers;
    private final NotificationDispatcher notifications;
    private final RewardContext context;

    static final String EVENT_REVIEW = "document_review_due";
    static final String TYPE_REVIEW = "DOCUMENT_REVIEW";
    private static final DateTimeFormatter DMY = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    @Scheduled(cron = "${app.documents.maintenance-cron:0 30 3 * * *}")
    public void runDaily() {
        autoDeletePersonalOfDeactivatedUsers();
        purgeDeletedFiles();
        purgeDeletedFolders();
    }

    /** Nhắc rà soát / hết hiệu lực vào giờ làm việc, không phải 3 giờ sáng (§16.3). */
    @Scheduled(cron = "${app.documents.reminder-cron:0 0 8 * * *}", zone = "Asia/Ho_Chi_Minh")
    public void runReminders() {
        remindReviewAndExpiry();
        markExpiredForAi();
    }

    /**
     * Nhắc người quản lý tài liệu (§16.3): tới ngày rà soát, và từ {@value DocumentDates#EXPIRY_WARN_DAYS} ngày trước
     * ngày hết hiệu lực. Mỗi ngày chỉ nhắc MỘT lần ({@code *_notified_for} = ngày đã nhắc); đổi ngày thì nhắc lại.
     * Không tìm được người quản lý nào vẫn đánh dấu đã nhắc — để không quét lại mãi.
     *
     * @return số tài liệu đã xử lý
     */
    public int remindReviewAndExpiry() {
        LocalDate today = DocumentDates.today();
        List<Document> due = documents.findDueForReminder(today, today.plusDays(DocumentDates.EXPIRY_WARN_DAYS), BATCH);
        if (due.isEmpty()) return 0;
        Map<UUID, Map<UUID, OrgUnit>> unitsByOrg = new HashMap<>();
        TransactionTemplate tx = new TransactionTemplate(txManager);
        int n = 0;
        for (Document d : due) {
            try {
                Map<UUID, OrgUnit> units = unitsByOrg.computeIfAbsent(d.getOrganizationId(), managers::unitsOf);
                boolean review = DocumentDates.reviewDue(d, today) && !d.getReviewDate().equals(d.getReviewNotifiedFor());
                boolean expiry = d.getExpiryDate() != null && !d.getExpiryDate().equals(d.getExpiryNotifiedFor())
                        && !d.getExpiryDate().isAfter(today.plusDays(DocumentDates.EXPIRY_WARN_DAYS));
                LocalizedText where = where(d, units);
                for (User u : managers.of(d.getScope(), d.getOrgUnitId(), d.getOwnerUserId(), units)) {
                    if (review) {
                        send(d, u, LocalizedText.of("notif.document.review.title"),
                                LocalizedText.of("notif.document.review.message", d.getTitle(), where, d.getReviewDate().format(DMY)));
                    }
                    if (expiry) {
                        boolean expired = DocumentDates.expired(d, today);
                        send(d, u, LocalizedText.of(expired ? "notif.document.expired.title" : "notif.document.expiring.title"),
                                LocalizedText.of(expired ? "notif.document.expired.message" : "notif.document.expiring.message",
                                        d.getTitle(), where, d.getExpiryDate().format(DMY)));
                    }
                }
                tx.executeWithoutResult(s -> documents.findByIdForUpdate(d.getId()).ifPresent(doc -> {
                    if (review) doc.setReviewNotifiedFor(doc.getReviewDate());
                    if (expiry) doc.setExpiryNotifiedFor(doc.getExpiryDate());
                    documents.save(doc);
                }));
                n++;
            } catch (Exception e) {
                log.warn("Không nhắc được rà soát tài liệu {}: {}", d.getId(), e.getMessage());
            }
        }
        if (n > 0) log.info("Đã nhắc rà soát / hiệu lực cho {} tài liệu", n);
        return n;
    }

    /**
     * Tài liệu vừa hết hiệu lực (trong 7 ngày qua — bù cho ngày job không chạy): gắn ghi chú hiệu lực vào vector để
     * K.AI nói rõ khi trích. Idempotent nên chạy lại không sao.
     */
    public int markExpiredForAi() {
        LocalDate today = DocumentDates.today();
        List<Document> expired = documents.findRecentlyExpired(today, today.minusDays(7));
        expired.forEach(documentService::syncVectorMetadata);
        return expired.size();
    }

    private void send(Document d, User to, LocalizedText title, LocalizedText message) {
        OrgUnit unit;
        try {
            unit = context.getPrimaryOrgUnit(to.getId());
        } catch (ResourceNotFoundException e) {
            return;
        }
        notifications.dispatch(d.getOrganizationId(), EVENT_REVIEW, to, unit, title, message, TYPE_REVIEW, d.getId());
    }

    private static LocalizedText where(Document d, Map<UUID, OrgUnit> units) {
        if (d.getScope() == DocumentScope.COMPANY) return LocalizedText.of("notif.document.target.company");
        if (d.getScope() == DocumentScope.PERSONAL) return LocalizedText.of("notif.document.where.personal");
        OrgUnit u = units.get(d.getOrgUnitId());
        return LocalizedText.of("notif.document.target.unit", u == null ? "—" : u.getName());
    }

    /** Tài liệu cá nhân của người bị vô hiệu hoá quá N ngày (mặc định 90): xoá mềm, vector trước. */
    public int autoDeletePersonalOfDeactivatedUsers() {
        Instant cutoff = Instant.now().minus(Duration.ofDays(settings.getDisabledUserRetentionDays()));
        List<Document> due = documents.findPersonalOfUsersDeactivatedBefore(cutoff, BATCH);
        if (due.isEmpty()) return 0;
        int n = documentService.softDeleteAll(due);
        log.info("Tự xoá {} tài liệu cá nhân của người đã vô hiệu hoá trước {}", n, cutoff);
        return n;
    }

    /** Tài liệu đã xoá mềm quá N ngày (mặc định 30): xoá tệp gốc rồi xoá hẳn bản ghi. */
    public int purgeDeletedFiles() {
        Instant cutoff = Instant.now().minus(Duration.ofDays(settings.getDeletedFileRetentionDays()));
        TransactionTemplate tx = new TransactionTemplate(txManager);
        int n = 0;
        for (Document d : documents.findPurgeable(cutoff, BATCH)) {
            try {
                // Tệp của các phiên bản cũ trước — bản ghi phiên bản tự mất theo (ON DELETE CASCADE).
                for (DocumentVersion ver : versions.findByDocumentIdOrderByVersionDesc(d.getId())) {
                    storage.delete(ver.getStorageKey());
                }
                storage.delete(d.getStorageKey());
                tx.executeWithoutResult(s -> documents.hardDelete(d.getId()));
                n++;
            } catch (Exception e) {
                log.warn("Không dọn được tệp của tài liệu {}: {}", d.getId(), e.getMessage());
            }
        }
        if (n > 0) log.info("Đã xoá hẳn {} tài liệu (và tệp gốc) xoá mềm trước {}", n, cutoff);
        return n;
    }

    /** Thư mục đã xoá quá N ngày, không còn tài liệu (kể cả trong thùng rác) hay thư mục con trỏ tới: xoá hẳn. */
    public int purgeDeletedFolders() {
        Instant cutoff = Instant.now().minus(Duration.ofDays(settings.getDeletedFileRetentionDays()));
        TransactionTemplate tx = new TransactionTemplate(txManager);
        int total = 0;
        // Mỗi lượt gỡ được một tầng lá; cây sâu thì gỡ dần qua vài lượt (có trần để không lặp vô hạn).
        for (int round = 0; round < 32; round++) {
            Integer n = tx.execute(s -> folders.purgeEmptyDeleted(cutoff));
            if (n == null || n == 0) break;
            total += n;
        }
        if (total > 0) log.info("Đã xoá hẳn {} thư mục tài liệu xoá mềm trước {}", total, cutoff);
        return total;
    }
}
