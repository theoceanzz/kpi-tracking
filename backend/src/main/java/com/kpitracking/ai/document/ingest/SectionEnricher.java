package com.kpitracking.ai.document.ingest;

import com.kpitracking.ai.document.model.DocumentSection;
import com.kpitracking.ai.document.profile.DocumentProfile;
import com.kpitracking.entity.RagDocument;

import java.util.Map;
import java.util.UUID;

/**
 * Một mắt xích làm giàu metadata của mục trước khi nạp kho (Chain of Responsibility): tải ảnh, gắn màn hình
 * KeyGo tương ứng… Mọi bean cài interface này tự vào chuỗi, theo {@code @Order}; mắt xích nào không hợp với
 * loại tài liệu thì trả {@code false} ở {@link #appliesTo}.
 */
public interface SectionEnricher {

    default boolean appliesTo(DocumentProfile profile) {
        return true;
    }

    void enrich(Context ctx, DocumentSection section, Map<String, Object> metadata) throws Exception;

    /** Trạng thái của một lần nạp, dùng chung giữa các mắt xích. */
    final class Context {
        private final RagDocument document;
        private final DocumentProfile profile;
        private int images;

        public Context(RagDocument document, DocumentProfile profile) {
            this.document = document;
            this.profile = profile;
        }

        public RagDocument document() { return document; }
        public UUID documentId() { return document.getId(); }
        public DocumentProfile profile() { return profile; }
        public int images() { return images; }
        public void addImages(int n) { images += n; }
    }
}
