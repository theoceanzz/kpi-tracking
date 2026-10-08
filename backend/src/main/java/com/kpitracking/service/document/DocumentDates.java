package com.kpitracking.service.document;

import com.kpitracking.entity.Document;

import java.time.LocalDate;
import java.time.ZoneId;

/** Ngày rà soát / hết hiệu lực (docs/DOCUMENTS_DESIGN.md §16.3), tính theo giờ Việt Nam — không theo UTC của server. */
public final class DocumentDates {

    public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    /** Nhắc trước ngày hết hiệu lực bấy nhiêu ngày. */
    public static final int EXPIRY_WARN_DAYS = 7;

    private DocumentDates() {}

    public static LocalDate today() {
        return LocalDate.now(ZONE);
    }

    /** Đã tới (hoặc quá) ngày rà soát. */
    public static boolean reviewDue(Document d, LocalDate today) {
        return d.getReviewDate() != null && !d.getReviewDate().isAfter(today);
    }

    /** Từ ngày hết hiệu lực trở đi. */
    public static boolean expired(Document d, LocalDate today) {
        return d.getExpiryDate() != null && !today.isBefore(d.getExpiryDate());
    }
}
