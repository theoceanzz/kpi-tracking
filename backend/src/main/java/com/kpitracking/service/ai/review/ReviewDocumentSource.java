package com.kpitracking.service.ai.review;

import com.kpitracking.ai.document.retrieve.DocumentRetrieverFactory;
import com.kpitracking.ai.document.retrieve.DocumentSearchService;
import com.kpitracking.ai.document.retrieve.RetrievalProfile;

import com.kpitracking.dto.response.ai.RagSearchHitResponse;
import dev.langchain4j.rag.content.retriever.ContentRetriever;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Trích đoạn QUY CHẾ và MÔ TẢ CÔNG VIỆC tổ chức đã tải lên, liên quan tới các chỉ tiêu đang chấm (GĐ2).
 *
 * <p>Dùng lại kho tìm kiếm lai sẵn có (pgvector HYBRID) — tài liệu phân tích mục 8.4 cách B: văn bản tự do
 * lấy bằng tìm kiếm; dữ liệu có cấu trúc (chỉ tiêu, trọng số) vẫn lấy thẳng từ CSDL. Lọc bắt buộc theo tổ
 * chức; không bao giờ đọc bộ hướng dẫn KeyGo. Kho trống / lỗi thì trả rỗng — trích đoạn là phần thêm.
 */
@Component
@Slf4j
public class ReviewDocumentSource {

    static final int MAX_TEXT = 700;

    private final ContentRetriever retriever;
    private final DocumentSearchService search;
    private final AiReviewSettingsResolver settingsResolver;
    private final int maxExcerpts;

    public ReviewDocumentSource(DocumentRetrieverFactory retrievers, DocumentSearchService search,
                                AiReviewSettingsResolver settingsResolver,
                                @Value("${app.ai.review.max-excerpts:5}") int maxExcerpts) {
        this.maxExcerpts = maxExcerpts;
        this.search = search;
        this.settingsResolver = settingsResolver;
        // Lọc bắt buộc theo tổ chức + chỉ quy chế / mô tả công việc (hồ sơ SUBMISSION_REVIEW).
        this.retriever = retrievers.retriever(RetrievalProfile.SUBMISSION_REVIEW, 3, 0.0);
    }

    /**
     * Tối đa {@code app.ai.review.max-excerpts} đoạn, khác nhau, cho danh sách câu tra (thường là tên + mô
     * tả từng chỉ tiêu, cộng một câu về cách chấm điểm).
     */
    public List<ReviewContext.Excerpt> excerpts(UUID organizationId, List<String> queries) {
        return excerpts(organizationId, queries, null);
    }

    /**
     * Trích cho bài của MỘT người: chỉ quy chế của bộ {@code chosenSetId} đã chọn cho người đó (mỗi đơn vị một quy
     * chế) và tài liệu nạp tay dùng chung — xem {@link AiReviewSettingsResolver#regulationDocsFor}.
     */
    public List<ReviewContext.Excerpt> excerptsFor(UUID organizationId, List<String> queries, UUID chosenSetId) {
        return excerpts(organizationId, queries, settingsResolver.regulationDocsFor(organizationId, chosenSetId));
    }

    /**
     * @param onlyDocIds tài liệu kho DUY NHẤT được trích ({@code null} = mọi tài liệu của tổ chức, rỗng = không trích)
     */
    public List<ReviewContext.Excerpt> excerpts(UUID organizationId, List<String> queries, List<String> onlyDocIds) {
        List<ReviewContext.Excerpt> out = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (String q : queries) {
            if (q == null || q.isBlank() || out.size() >= maxExcerpts) continue;
            try {
                for (RagSearchHitResponse h : search.search(retriever, q, organizationId, onlyDocIds)) {
                    String text = h.text() == null ? "" : h.text().strip();
                    if (text.isEmpty() || !seen.add(text)) continue;
                    String section = h.parent() != null && !h.parent().isBlank() ? h.parent() + " › " + h.title() : h.title();
                    out.add(new ReviewContext.Excerpt(h.docTitle(), section,
                            text.length() > MAX_TEXT ? text.substring(0, MAX_TEXT) + "…" : text));
                    if (out.size() >= maxExcerpts) break;
                }
            } catch (Exception e) {
                log.warn("Không lấy được trích đoạn quy chế ({}): {}", q, e.toString());
            }
        }
        return out;
    }
}
