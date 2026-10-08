package com.kpitracking.service.approvalprocess;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;

/** Đọc / ghi {@link ProcessGraph} ở dạng JSON lưu trong {@code approval_processes.definition}. */
@Component
@RequiredArgsConstructor
public class ProcessGraphCodec {

    private final ObjectMapper objectMapper;

    /** Sơ đồ hỏng trong DB không được làm hỏng việc gửi duyệt: phía gọi lui về chuỗi mặc định. */
    public Optional<ProcessGraph> tryRead(String json) {
        if (json == null || json.isBlank()) return Optional.empty();
        try {
            return Optional.ofNullable(objectMapper.readValue(json, ProcessGraph.class));
        } catch (JsonProcessingException e) {
            return Optional.empty();
        }
    }

    public String write(ProcessGraph graph) {
        try {
            return objectMapper.writeValueAsString(graph);
        } catch (JsonProcessingException e) {
            throw new BusinessException(ErrorCode.APPROVAL_PROCESS_INVALID, e.getOriginalMessage());
        }
    }

    public Map<String, Object> toMap(ProcessGraph graph) {
        return objectMapper.convertValue(graph, new TypeReference<>() {});
    }

    public ProcessGraph fromMap(Object raw) {
        if (raw == null) return null;
        try {
            return objectMapper.convertValue(raw, ProcessGraph.class);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
