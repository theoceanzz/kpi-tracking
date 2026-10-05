package com.kpitracking.repository;

import com.kpitracking.entity.BscScorecardPerspective;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BscScorecardPerspectiveRepository extends JpaRepository<BscScorecardPerspective, UUID> {

    List<BscScorecardPerspective> findByScorecardIdOrderByDisplayOrderAsc(UUID scorecardId);

    /**
     * Các dòng con đã nhận phân rã từ một dòng chỉ tiêu — dùng để đo độ phủ (coverage).
     *
     * <p>Phải lọc {@code s.deletedAt IS NULL} TƯỜNG MINH: {@code @SQLRestriction} của
     * {@code BscScorecard} KHÔNG được Hibernate áp vào phép JOIN trong JPQL (đã kiểm trên DB thật).
     * Thiếu điều kiện này thì dòng của bộ tiêu chí đã xoá mềm vẫn trả về, và ngay khi đọc
     * {@code getScorecard()} Hibernate ném EntityNotFoundException — xoá một bộ tiêu chí con làm
     * hỏng luôn màn hình độ phủ (và việc xoá) của bộ tiêu chí cha.
     */
    @Query("SELECT sp FROM BscScorecardPerspective sp JOIN sp.scorecard s "
            + "WHERE sp.parentItem.id = :parentItemId AND s.deletedAt IS NULL")
    List<BscScorecardPerspective> findByParentItemId(@Param("parentItemId") UUID parentItemId);

    @Query("SELECT sp FROM BscScorecardPerspective sp JOIN sp.scorecard s "
            + "WHERE sp.parentItem.id IN :parentItemIds AND s.deletedAt IS NULL")
    List<BscScorecardPerspective> findByParentItemIdIn(@Param("parentItemIds") java.util.Collection<UUID> parentItemIds);

    /**
     * Các dòng "Kết quả cấp trên" đang lấy điểm từ một thẻ nguồn (phân rã cả bộ). Lọc thẻ đã xoá
     * mềm tường minh, cùng lý do như {@link #findByParentItemId}.
     */
    /** Các dòng của bộ tiêu chí CÒN SỐNG đang dùng một hạng mục — để gác quyền sửa/xoá hạng mục. */
    @Query("SELECT sp FROM BscScorecardPerspective sp JOIN sp.scorecard s "
            + "WHERE sp.perspective.id = :perspectiveId AND s.deletedAt IS NULL")
    List<BscScorecardPerspective> findLiveByPerspectiveId(@Param("perspectiveId") UUID perspectiveId);

    @Query("SELECT sp FROM BscScorecardPerspective sp JOIN sp.scorecard s JOIN sp.perspective p "
            + "WHERE p.sourceScorecard.id = :sourceId AND s.deletedAt IS NULL")
    List<BscScorecardPerspective> findBySourceScorecardId(@Param("sourceId") UUID sourceId);
}
