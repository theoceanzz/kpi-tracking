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
     * <p>JOIN sang bộ tiêu chí là CÓ CHỦ Ý, không thừa: {@code BscScorecard} có
     * {@code @SQLRestriction("deleted_at IS NULL")}, nên phép join tự loại các dòng thuộc bộ tiêu
     * chí đã xoá mềm. Không join thì các dòng đó vẫn trả về, và ngay khi đọc {@code getScorecard()}
     * để dựng response, Hibernate nạp proxy trỏ vào bản ghi đã xoá rồi ném EntityNotFoundException
     * — tức xoá một bộ tiêu chí con làm hỏng luôn màn hình độ phủ của bộ tiêu chí cha.
     */
    @Query("SELECT sp FROM BscScorecardPerspective sp JOIN sp.scorecard s WHERE sp.parentItem.id = :parentItemId")
    List<BscScorecardPerspective> findByParentItemId(@Param("parentItemId") UUID parentItemId);

    @Query("SELECT sp FROM BscScorecardPerspective sp JOIN sp.scorecard s WHERE sp.parentItem.id IN :parentItemIds")
    List<BscScorecardPerspective> findByParentItemIdIn(@Param("parentItemIds") java.util.Collection<UUID> parentItemIds);
}
