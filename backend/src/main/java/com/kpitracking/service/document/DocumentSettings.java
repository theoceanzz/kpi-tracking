package com.kpitracking.service.document;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Cấu hình thư viện tài liệu (docs/DOCUMENTS_DESIGN.md §5.5, §9). Mọi khoá có default ở đây và trong
 * {@code application.yaml}; muốn đổi ở prod thì thêm env var vào {@code docker-compose.yml}.
 */
@Component
@Getter
public class DocumentSettings {

    private static final long MB = 1024L * 1024;

    @Value("${app.documents.quota.personal-mb:200}") private long personalQuotaMb;
    @Value("${app.documents.quota.unit-mb:1024}") private long unitQuotaMb;
    @Value("${app.documents.quota.company-mb:5120}") private long companyQuotaMb;
    /** Trần số đoạn vector của một tổ chức — ≈ 1.300 tài liệu 50 trang; cũng là mốc đã đo độ trễ (§6.6). */
    @Value("${app.documents.quota.org-max-chunks:200000}") private long orgMaxChunks;

    /** Tài liệu cá nhân của người bị vô hiệu hoá tự xoá mềm sau bấy nhiêu ngày. */
    @Value("${app.documents.disabled-user-retention-days:90}") private int disabledUserRetentionDays;
    /** Tệp gốc của tài liệu đã xoá mềm được giữ thêm bấy nhiêu ngày rồi mới xoá hẳn. */
    @Value("${app.documents.deleted-file-retention-days:30}") private int deletedFileRetentionDays;

    /** Số luồng nạp song song. Model E5 chạy CPU ngay trên server app — để thấp. */
    @Value("${app.documents.index.concurrency:1}") private int indexConcurrency;

    public long personalQuotaBytes() { return personalQuotaMb * MB; }
    public long unitQuotaBytes() { return unitQuotaMb * MB; }
    public long companyQuotaBytes() { return companyQuotaMb * MB; }
}
