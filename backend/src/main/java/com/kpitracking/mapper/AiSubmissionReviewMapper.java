package com.kpitracking.mapper;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.dto.response.ai.AiReviewBasisResponse;
import com.kpitracking.dto.response.ai.AiSubmissionReviewItemResponse;
import com.kpitracking.dto.response.ai.AiSubmissionReviewResponse;
import com.kpitracking.entity.AiSubmissionReview;
import com.kpitracking.entity.AiSubmissionReviewItem;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

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
    @Mapping(target = "basis", source = "basisCitations", qualifiedByName = "basis")
    AiSubmissionReviewItemResponse toItemResponse(AiSubmissionReviewItem item);

    ObjectMapper JSON = new ObjectMapper();

    @Named("basis")
    default List<AiReviewBasisResponse> basis(String json) {
        return basisOf(json);
    }

    /** Cột JSON căn cứ -> danh sách; trống / hỏng -> rỗng (lời giải thích là phần thêm, không làm hỏng kết quả). */
    static List<AiReviewBasisResponse> basisOf(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return JSON.readValue(json, new TypeReference<List<AiReviewBasisResponse>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

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
