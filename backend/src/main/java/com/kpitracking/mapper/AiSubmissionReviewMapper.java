package com.kpitracking.mapper;

import com.kpitracking.dto.response.ai.AiSubmissionReviewItemResponse;
import com.kpitracking.dto.response.ai.AiSubmissionReviewResponse;
import com.kpitracking.entity.AiSubmissionReview;
import com.kpitracking.entity.AiSubmissionReviewItem;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.Arrays;
import java.util.List;

/**
 * Entity kết quả AI -> DTO. Các cột chữ nhiều ý lưu mỗi ý một dòng; ở đây tách lại thành danh sách.
 * Tên chỉ tiêu và trọng số do service điền (cần tra {@code KpiCriteria}).
 */
@Mapper(componentModel = "spring")
public interface AiSubmissionReviewMapper {

    @Mapping(target = "missingData", source = "missingData")
    @Mapping(target = "unreadableFiles", source = "unreadableFiles")
    @Mapping(target = "items", ignore = true)
    @Mapping(target = "disclaimer", ignore = true)
    AiSubmissionReviewResponse toResponse(AiSubmissionReview review);

    @Mapping(target = "kpiCriteriaName", ignore = true)
    @Mapping(target = "weight", ignore = true)
    AiSubmissionReviewItemResponse toItemResponse(AiSubmissionReviewItem item);

    /** Cột chữ "mỗi ý một dòng" -> danh sách; rỗng -> danh sách rỗng. */
    default List<String> lines(String text) {
        if (text == null || text.isBlank()) return List.of();
        return Arrays.stream(text.split("\n")).map(String::strip).filter(s -> !s.isEmpty()).toList();
    }

    /** Danh sách -> cột chữ "mỗi ý một dòng". */
    static String join(List<String> items) {
        if (items == null || items.isEmpty()) return null;
        return String.join("\n", items.stream().map(s -> s.replace('\n', ' ').strip()).toList());
    }
}
