package com.kpitracking.repository;

import com.kpitracking.entity.EvaluationPerspectiveScore;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface EvaluationPerspectiveScoreRepository extends JpaRepository<EvaluationPerspectiveScore, UUID> {

    List<EvaluationPerspectiveScore> findByEvaluationId(UUID evaluationId);

    void deleteByEvaluationId(UUID evaluationId);

    // ============================================================
    // Truy vấn GỘP cho thống kê BSC (tab "Viễn cảnh" ở trang Thống kê).
    // Đọc điểm ĐÃ LƯU (không tính lại) — nhất quán với "hiệu suất theo đánh giá".
    // Evaluation có @SQLRestriction(deleted_at IS NULL) nên JOIN tự loại bản xoá mềm.
    // AVG(rawScore) tự bỏ NULL (viễn cảnh rỗng); COUNT(rawScore) = số đánh giá có điểm ở viễn cảnh.
    // ============================================================

    /** Gộp theo VIỄN CẢNH — dùng cho radar & thẻ cân bằng.
     *  → [perspectiveId, code, name, color, displayOrder, avgRaw, sumWeighted, sumKpi, avgWeight, scoredCount] */
    @Query("SELECT p.id, p.code, p.name, p.color, p.displayOrder, " +
           "AVG(eps.rawScore), SUM(eps.weightedScore), SUM(eps.kpiCount), AVG(eps.weightPercentage), COUNT(eps.rawScore) " +
           "FROM EvaluationPerspectiveScore eps JOIN eps.evaluation e JOIN eps.perspective p " +
           "WHERE e.orgUnit.id IN :unitIds AND e.kpiPeriod.id IN :periodIds " +
           "GROUP BY p.id, p.code, p.name, p.color, p.displayOrder " +
           "ORDER BY p.displayOrder")
    List<Object[]> aggregateByPerspective(@Param("unitIds") Collection<UUID> unitIds,
                                          @Param("periodIds") Collection<UUID> periodIds);

    /** Gộp theo KỲ × VIỄN CẢNH — dùng cho xu hướng (groupBy=PERIOD).
     *  → [periodId, periodName, periodStart, perspectiveId, perspectiveName, color, displayOrder, avgRaw] */
    @Query("SELECT kp.id, kp.name, kp.startDate, p.id, p.name, p.color, p.displayOrder, AVG(eps.rawScore) " +
           "FROM EvaluationPerspectiveScore eps JOIN eps.evaluation e JOIN e.kpiPeriod kp JOIN eps.perspective p " +
           "WHERE e.orgUnit.id IN :unitIds AND e.kpiPeriod.id IN :periodIds " +
           "GROUP BY kp.id, kp.name, kp.startDate, p.id, p.name, p.color, p.displayOrder " +
           "ORDER BY kp.startDate, p.displayOrder")
    List<Object[]> aggregateByPeriodAndPerspective(@Param("unitIds") Collection<UUID> unitIds,
                                                    @Param("periodIds") Collection<UUID> periodIds);

    /** Gộp theo ĐƠN VỊ × VIỄN CẢNH — dùng cho so sánh giữa đơn vị.
     *  → [orgUnitId, orgUnitName, perspectiveId, perspectiveName, color, displayOrder, avgRaw] */
    @Query("SELECT ou.id, ou.name, p.id, p.name, p.color, p.displayOrder, AVG(eps.rawScore) " +
           "FROM EvaluationPerspectiveScore eps JOIN eps.evaluation e JOIN e.orgUnit ou JOIN eps.perspective p " +
           "WHERE e.orgUnit.id IN :unitIds AND e.kpiPeriod.id IN :periodIds " +
           "GROUP BY ou.id, ou.name, p.id, p.name, p.color, p.displayOrder " +
           "ORDER BY ou.name, p.displayOrder")
    List<Object[]> aggregateByUnitAndPerspective(@Param("unitIds") Collection<UUID> unitIds,
                                                 @Param("periodIds") Collection<UUID> periodIds);

    /** Gộp theo NHÂN SỰ × VIỄN CẢNH — breakdown cho bảng xếp hạng.
     *  → [userId, perspectiveId, perspectiveName, color, displayOrder, avgRaw] */
    @Query("SELECT u.id, p.id, p.name, p.color, p.displayOrder, AVG(eps.rawScore) " +
           "FROM EvaluationPerspectiveScore eps JOIN eps.evaluation e JOIN e.user u JOIN eps.perspective p " +
           "WHERE e.orgUnit.id IN :unitIds AND e.kpiPeriod.id IN :periodIds " +
           "GROUP BY u.id, p.id, p.name, p.color, p.displayOrder")
    List<Object[]> aggregateByUserAndPerspective(@Param("unitIds") Collection<UUID> unitIds,
                                                 @Param("periodIds") Collection<UUID> periodIds);
}
