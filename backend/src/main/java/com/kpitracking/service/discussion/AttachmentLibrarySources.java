package com.kpitracking.service.discussion;

import com.kpitracking.entity.Document;
import com.kpitracking.repository.DocumentRepository;
import com.kpitracking.service.document.DocumentAccess;
import com.kpitracking.service.document.DocumentAccessResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Tệp đính kèm (bình luận, công việc) chọn từ thư viện tài liệu: tệp vẫn là BẢN SAO, chỉ ghi thêm tài liệu gốc.
 * <ul>
 *   <li>Lúc đính kèm ({@link #link}): chỉ nhận id tài liệu mà người đính kèm XEM ĐƯỢC theo luật phần Tài liệu
 *       ({@link DocumentAccess#canView}); id lạ / không xem được thì coi như tệp tải từ máy (không lỗi).</li>
 *   <li>Lúc đọc ({@link #viewer}): link "Mở bản mới nhất" chỉ hiện khi tài liệu gốc còn (chưa vào thùng rác — Document
 *       có {@code @SQLRestriction("deleted_at IS NULL")}) VÀ người đang xem xem được nó. Nhãn tên luôn hiện (tên chụp lúc
 *       đính kèm; người xem được tài liệu gốc thấy tên hiện tại) — nội dung bản sao vốn đã chia sẻ trong cuộc trao đổi.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
public class AttachmentLibrarySources {

    private static final int TITLE_MAX = 500;

    private final DocumentRepository documents;
    private final DocumentAccessResolver accessResolver;

    /** Tài liệu gốc đã kiểm quyền của một tệp. */
    public record Source(UUID documentId, String title) {}

    /**
     * Ghép từng tệp với tài liệu gốc theo thứ tự gửi lên ({@code sourceDocumentIds[i]} ứng với {@code files[i]}; chuỗi
     * rỗng / "-" = tệp từ máy). Trả theo identity của MultipartFile vì danh sách tệp có thể bị lọc bớt sau đó.
     */
    public Map<MultipartFile, Source> link(MultipartFile[] files, List<String> sourceDocumentIds, UUID userId, UUID orgId) {
        Map<MultipartFile, Source> out = new IdentityHashMap<>();
        if (files == null || sourceDocumentIds == null || sourceDocumentIds.isEmpty()) return out;
        Map<MultipartFile, UUID> wanted = new IdentityHashMap<>();
        for (int i = 0; i < files.length && i < sourceDocumentIds.size(); i++) {
            UUID id = parse(sourceDocumentIds.get(i));
            if (files[i] != null && id != null) wanted.put(files[i], id);
        }
        if (wanted.isEmpty()) return out;
        DocumentAccess access = accessResolver.resolve(userId, orgId);
        Map<UUID, Document> docs = load(new HashSet<>(wanted.values()));
        wanted.forEach((file, id) -> {
            Document d = docs.get(id);
            if (d != null && access.canView(d)) out.put(file, new Source(id, truncate(d.getTitle())));
        });
        return out;
    }

    /**
     * Người xem cho một lượt dựng phản hồi: nạp một lần các tài liệu gốc được nhắc tới + quyền tài liệu của người xem
     * (chỉ khi thật sự có tệp từ thư viện — tránh tính quyền tài liệu cho mọi lần mở công việc).
     */
    public Viewer viewer(Collection<UUID> sourceDocumentIds, UUID userId, UUID orgId) {
        Set<UUID> ids = sourceDocumentIds.stream().filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) return new Viewer(Map.of(), null);
        return new Viewer(load(ids), accessResolver.resolve(userId, orgId));
    }

    public static final class Viewer {
        private final Map<UUID, Document> docs;
        private final DocumentAccess access;

        private Viewer(Map<UUID, Document> docs, DocumentAccess access) {
            this.docs = docs;
            this.access = access;
        }

        /** Tài liệu gốc người này mở được; null = không có / đã xoá / không có quyền → ẩn link. */
        public Document openable(UUID sourceDocumentId) {
            if (sourceDocumentId == null || access == null) return null;
            Document d = docs.get(sourceDocumentId);
            return d != null && access.canView(d) ? d : null;
        }
    }

    private Map<UUID, Document> load(Set<UUID> ids) {
        return documents.findAllById(ids).stream().collect(Collectors.toMap(Document::getId, Function.identity()));
    }

    private static UUID parse(String raw) {
        if (raw == null || raw.isBlank() || "-".equals(raw.trim())) return null;
        try {
            return UUID.fromString(raw.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static String truncate(String s) {
        return s == null || s.length() <= TITLE_MAX ? s : s.substring(0, TITLE_MAX);
    }
}
