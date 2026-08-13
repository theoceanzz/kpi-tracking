package com.kpitracking.repository;

import com.kpitracking.entity.CycleUserEvaluation;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

/**
 * Truy vấn xếp hạng phục vụ thưởng tự động.
 *
 * <p>CỐ Ý viết riêng thay vì tái dùng {@code StatsService.getRankings}: DTO
 * {@code RankingItem} của màn hình phân tích không mang {@code userId}, và hàm đó
 * phân trang trong bộ nhớ sau khi chạy một vòng lặp truy vấn theo từng người — không
 * tái lập được và không dùng để phát tiền được.
 *
 * <p>Toàn bộ hàm ở đây CHỈ ĐỌC từ phía đánh giá. Không có gì trong package thưởng
 * được phép ghi vào {@code evaluations} hay {@code cycle_user_evaluations}.
 *
 * <p>Không khai báo {@code @Repository}: interface kế thừa
 * {@link org.springframework.data.repository.Repository} đã được Spring Data tự nhận diện.
 * Kiểu entity gắn kèm chỉ để Spring Data biết chọn EntityManager nào; mọi truy vấn ở
 * đây đều là native và trả về {@code Object[]}.
 */
public interface RewardRankingRepository
        extends org.springframework.data.repository.Repository<CycleUserEvaluation, UUID> {

    /**
     * Bảng xếp hạng theo KỲ, lấy từ điểm đã chốt kỳ.
     *
     * <p>Cột trả về: {@code [0] userId, [1] fullName, [2] employeeCode, [3] metricValue,
     * [4] orgUnitId, [5] orgUnitName, [6] matrixRating, [7] evaluatedAt}.
     * Hai cột cuối chỉ dùng để phá hoà.
     *
     * <p>{@code DISTINCT ON (u.id)} khử trùng người thuộc nhiều đơn vị trong cùng cây con,
     * giữ lại đơn vị có {@code path} ngắn nhất. Vì {@code DISTINCT ON} bắt buộc
     * {@code ORDER BY} phải mở đầu bằng chính cột đó, việc SẮP XẾP THEO HẠNG được làm ở
     * tầng service (xem {@code RewardRankingService}) với thứ tự phá hoà xác định:
     * điểm giảm dần → xếp loại ma trận giảm dần → chấm sớm hơn trước → mã nhân viên → id.
     * Cùng đầu vào luôn cho cùng kết quả — đó là điều kiện để {@code snapshotHash} có ý nghĩa.
     *
     * <p>Người chưa có điểm bị LOẠI khỏi kết quả chứ không xếp là 0 — service lấy
     * danh sách bị loại riêng để hiện cho quản trị viên biết vì sao ai đó vắng mặt.
     *
     * @param metric   {@code FINAL_SCORE} hoặc {@code MATRIX_RATING}
     * @param pathPrefix tiền tố {@code OrgUnit.path} để lọc cây con; null = toàn tổ chức
     */
    @Query(value = """
            SELECT DISTINCT ON (u.id)
                   u.id, u.full_name, u.employee_code,
                   (CASE WHEN :metric = 'MATRIX_RATING'
                         THEN cue.matrix_rating::double precision
                         ELSE cue.final_score END) AS metric_value,
                   ou.id, ou.name,
                   cue.matrix_rating, cue.evaluated_at
              FROM cycle_user_evaluations cue
              JOIN users u ON u.id = cue.user_id
              JOIN user_role_org_units uro ON uro.user_id = u.id
              JOIN org_units ou ON ou.id = uro.org_unit_id AND ou.deleted_at IS NULL
              JOIN org_hierarchy_levels ohl ON ohl.id = ou.org_hierarchy_id
             WHERE cue.kpi_cycle_id = :cycleId
               AND cue.deleted_at IS NULL
               AND u.deleted_at IS NULL
               AND u.status = 'ACTIVE'
               AND ohl.organization_id = :orgId
               AND (CAST(:pathPrefix AS text) IS NULL OR ou.path LIKE CONCAT(CAST(:pathPrefix AS text), '%'))
               AND (CASE WHEN :metric = 'MATRIX_RATING'
                         THEN cue.matrix_rating::double precision
                         ELSE cue.final_score END) IS NOT NULL
             ORDER BY u.id, ou.path
            """, nativeQuery = true)
    List<Object[]> rankByCycleRaw(@Param("cycleId") UUID cycleId,
                                  @Param("orgId") UUID orgId,
                                  @Param("pathPrefix") String pathPrefix,
                                  @Param("metric") String metric);

    /**
     * Tập ứng viên của một ĐỢT: người đang hoạt động, thuộc phạm vi, và có ít nhất
     * một bản đánh giá trong đợt.
     *
     * <p>Chỉ trả danh sách người — KHÔNG trả điểm. Việc chọn "bản đánh giá đại diện"
     * phụ thuộc {@code enableWaterfall} và thứ bậc người đánh giá, logic đó nằm trong
     * {@code EvaluationService.getEffectiveEvaluation} bằng Java. Chép lại nó sang SQL
     * sẽ tạo ra một bản sao lệch pha ngay lần đầu ai đó sửa quy tắc.
     *
     * <p>Cột trả về: {@code [0] userId, [1] fullName, [2] employeeCode, [3] orgUnitId, [4] orgUnitName}.
     */
    @Query(value = """
            SELECT DISTINCT ON (u.id)
                   u.id, u.full_name, u.employee_code, ou.id, ou.name
              FROM users u
              JOIN user_role_org_units uro ON uro.user_id = u.id
              JOIN org_units ou ON ou.id = uro.org_unit_id AND ou.deleted_at IS NULL
              JOIN org_hierarchy_levels ohl ON ohl.id = ou.org_hierarchy_id
             WHERE u.deleted_at IS NULL
               AND u.status = 'ACTIVE'
               AND ohl.organization_id = :orgId
               AND (CAST(:pathPrefix AS text) IS NULL OR ou.path LIKE CONCAT(CAST(:pathPrefix AS text), '%'))
               AND EXISTS (SELECT 1 FROM evaluations e
                            WHERE e.user_id = u.id
                              AND e.kpi_period_id = :periodId
                              AND e.deleted_at IS NULL)
             ORDER BY u.id, ou.path
            """, nativeQuery = true)
    List<Object[]> candidatesByPeriodRaw(@Param("periodId") UUID periodId,
                                         @Param("orgId") UUID orgId,
                                         @Param("pathPrefix") String pathPrefix);

    /**
     * Id những người đang giữ vai trò trưởng hoặc phó ({@code roles.rank <= 1}) trong
     * phạm vi — để loại ra khi chương trình đặt {@code includeUnitHeads = false}.
     */
    @Query(value = """
            SELECT DISTINCT u.id
              FROM users u
              JOIN user_role_org_units uro ON uro.user_id = u.id
              JOIN roles r ON r.id = uro.role_id AND r.deleted_at IS NULL
              JOIN org_units ou ON ou.id = uro.org_unit_id AND ou.deleted_at IS NULL
              JOIN org_hierarchy_levels ohl ON ohl.id = ou.org_hierarchy_id
             WHERE u.deleted_at IS NULL
               AND ohl.organization_id = :orgId
               AND r.rank IS NOT NULL AND r.rank <= 1
               AND (CAST(:pathPrefix AS text) IS NULL OR ou.path LIKE CONCAT(CAST(:pathPrefix AS text), '%'))
            """, nativeQuery = true)
    List<UUID> findUnitHeadUserIds(@Param("orgId") UUID orgId,
                                   @Param("pathPrefix") String pathPrefix);
}
