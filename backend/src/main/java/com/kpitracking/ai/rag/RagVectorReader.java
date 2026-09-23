package com.kpitracking.ai.rag;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.dto.response.ai.RagChunkResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Đọc thẳng bảng vector để người quản trị xem kho đang có gì.
 *
 * <p>Vì sao không qua {@code EmbeddingStore}: giao diện đó chỉ có {@code search} theo vector truy
 * vấn, không có "liệt kê mọi đoạn của tài liệu X". Bảng do langchain4j tạo có ba cột cố định
 * ({@code embedding_id, embedding, text}) cộng cột {@code metadata JSONB} theo cấu hình
 * {@code COMBINED_JSONB} — đủ để đọc bằng SQL thường, và cột {@code embedding} thì không đọc (384
 * số thực không nói gì với mắt người).
 *
 * <p>Không dùng ORM: bảng nằm ngoài Flyway và ngoài DB chính, và chỉ có một câu truy vấn.
 */
@Slf4j
public class RagVectorReader {

    private static final Pattern SAFE_IDENTIFIER = Pattern.compile("[a-zA-Z_][a-zA-Z0-9_]*");
    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {};

    private final JdbcTemplate jdbc;
    private final String table;
    private final ObjectMapper json = new ObjectMapper();

    public RagVectorReader(DataSource dataSource, String table) {
        // Tên bảng đi thẳng vào SQL nên phải là định danh sạch — nó đến từ cấu hình, không từ người dùng,
        // nhưng một dấu chấm phẩy trong yaml không được biến thành một câu lệnh.
        if (!SAFE_IDENTIFIER.matcher(table).matches()) {
            throw new IllegalArgumentException("Tên bảng vector không hợp lệ: " + table);
        }
        this.jdbc = new JdbcTemplate(dataSource);
        this.table = table;
    }

    /** Mọi đoạn của một tài liệu, theo thứ tự mục rồi thứ tự đoạn trong mục. */
    public List<RagChunkResponse> chunks(UUID docId) {
        String sql = "SELECT embedding_id, text, metadata::text AS metadata FROM " + table
                + " WHERE metadata->>'docId' = ? ORDER BY (metadata->>'order')::int, (metadata->>'index')::int";
        return jdbc.query(sql, (rs, i) -> {
            Map<String, Object> meta = parse(rs.getString("metadata"));
            return RagChunkResponse.of(rs.getString("embedding_id"), rs.getString("text"), meta);
        }, docId.toString());
    }

    /** Số đoạn hiện có trong kho theo tài liệu — để đối chiếu với {@code chunkCount} đã ghi lúc nạp. */
    public Map<String, Integer> countsByDocument() {
        String sql = "SELECT metadata->>'docId' AS doc, count(*) AS n FROM " + table + " GROUP BY 1";
        return jdbc.query(sql, rs -> {
            Map<String, Integer> out = new java.util.HashMap<>();
            while (rs.next()) out.put(rs.getString("doc"), rs.getInt("n"));
            return out;
        });
    }

    private Map<String, Object> parse(String metadata) {
        if (metadata == null || metadata.isBlank()) return Map.of();
        try {
            return json.readValue(metadata, MAP);
        } catch (Exception e) {
            log.warn("Metadata đoạn không đọc được ({}): {}", e.getMessage(), metadata);
            return Map.of();
        }
    }
}
