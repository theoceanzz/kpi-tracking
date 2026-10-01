package com.kpitracking.service.document;

import com.kpitracking.entity.Document;
import com.kpitracking.repository.DocumentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

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

    @Scheduled(cron = "${app.documents.maintenance-cron:0 30 3 * * *}")
    public void runDaily() {
        autoDeletePersonalOfDeactivatedUsers();
        purgeDeletedFiles();
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
}
