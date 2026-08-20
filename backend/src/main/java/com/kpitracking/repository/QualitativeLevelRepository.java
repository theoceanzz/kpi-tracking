package com.kpitracking.repository;

import com.kpitracking.entity.QualitativeLevel;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface QualitativeLevelRepository extends JpaRepository<QualitativeLevel, UUID> {
    void deleteByOrganizationId(UUID organizationId);

    /**
     * Các mức định tính của một tổ chức, xếp theo thứ tự hiển thị.
     *
     * <p>Mỗi tổ chức chỉ có vài mức ("Xuất sắc", "Tốt", "Khá"…) nên lấy hết rồi lọc theo tên trong
     * bộ nhớ là đủ — không cần truy vấn khớp tên riêng.
     */
    List<QualitativeLevel> findByOrganizationIdOrderByPositionAsc(UUID organizationId);
}
