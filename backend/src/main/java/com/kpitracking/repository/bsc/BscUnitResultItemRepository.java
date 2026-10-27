package com.kpitracking.repository.bsc;

import com.kpitracking.entity.bsc.BscUnitResultItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface BscUnitResultItemRepository extends JpaRepository<BscUnitResultItem, UUID> {

    List<BscUnitResultItem> findByUnitResultId(UUID unitResultId);

    void deleteByUnitResultId(UUID unitResultId);

    /**
     * Kết quả ĐÃ TÍNH của một tập dòng chỉ tiêu trong một đợt — nguồn số liệu khi cấp trên cộng
     * kết quả từ các đơn vị con đã nhận phân rã.
     */
    @Query("SELECT i FROM BscUnitResultItem i JOIN i.unitResult r JOIN i.scorecardPerspective sp "
            + "WHERE r.kpiPeriod.id = :periodId AND sp.id IN :rowIds")
    List<BscUnitResultItem> findByPeriodAndRowIds(@Param("periodId") UUID periodId,
                                                  @Param("rowIds") Collection<UUID> rowIds);

    /** Mọi dòng kết quả (mọi đợt) của một dòng chỉ tiêu — dùng khi thu hồi phân rã. */
    @Query("SELECT i FROM BscUnitResultItem i JOIN FETCH i.unitResult WHERE i.scorecardPerspective.id = :rowId")
    List<BscUnitResultItem> findByScorecardPerspectiveId(@Param("rowId") UUID rowId);
}
