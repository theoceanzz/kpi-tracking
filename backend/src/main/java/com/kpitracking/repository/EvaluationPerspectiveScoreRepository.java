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
    // Truy vấn GỘP cho thống kê BSC (tab "Lĩnh vực" ở trang Thống kê).
    // Đọc điểm ĐÃ LƯU (không tính lại) — nhất quán với "hiệu suất theo đánh giá".
    // Evaluation có @SQLRestriction(deleted_at IS NULL) nên JOIN tự loại bản xoá mềm.
    // AVG(rawScore) tự bỏ NULL (lĩnh vực rỗng); COUNT(rawScore) = số đánh giá có điểm ở lĩnh vực.
    // ============================================================

    /** Gộp theo NHÂN SỰ × LĨNH VỰC — breakdown cho bảng xếp hạng.
     *  → [userId, perspectiveId, perspectiveName, color, displayOrder, avgRaw] */
    @Query("SELECT u.id, p.id, p.name, p.color, p.displayOrder, AVG(eps.rawScore) " +
           "FROM EvaluationPerspectiveScore eps JOIN eps.evaluation e JOIN e.user u JOIN eps.perspective p " +
           "WHERE e.orgUnit.id IN :unitIds AND e.kpiPeriod.id IN :periodIds " +
           "GROUP BY u.id, p.id, p.name, p.color, p.displayOrder")
    List<Object[]> aggregateByUserAndPerspective(@Param("unitIds") Collection<UUID> unitIds,
                                                 @Param("periodIds") Collection<UUID> periodIds);
}
