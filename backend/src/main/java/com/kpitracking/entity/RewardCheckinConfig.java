package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Luật điểm danh hàng ngày của một tổ chức: mỗi ngày bấm điểm danh được bao nhiêu điểm.
 *
 * <p>Mỗi tổ chức có TỐI ĐA MỘT bản ghi (partial unique index ở tầng DB). Tổ chức chưa
 * cấu hình thì coi như tắt — service trả về bản mặc định chỉ để dựng form, không tự
 * ghi xuống DB.
 *
 * <p>Đây chỉ là CẤU HÌNH HIỆN HÀNH. Mọi con số thực sự đã phát được chụp lại vào
 * {@link RewardCheckin} tại thời điểm điểm danh, nên sửa cấu hình ở đây không bao giờ
 * làm sai lịch sử — đúng theo tiền lệ tỉ giá quy đổi của ví tiền.
 */
@Entity
@Table(name = "reward_checkin_configs")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RewardCheckinConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    /** Mặc định TẮT — bật lên mới hiện thẻ điểm danh ở màn hình nhân viên. */
    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private Boolean enabled = false;

    /** Điểm cơ bản mỗi lần điểm danh, chưa tính thưởng chuỗi. Luôn > 0. */
    @Column(name = "points_per_day", nullable = false)
    @Builder.Default
    private Integer pointsPerDay = 10;

    /**
     * Chuỗi đếm 1..{@code streakCycleDays} rồi quay về 1, nhờ vậy các mốc thưởng lặp
     * lại đều đặn. Null = chuỗi đếm thẳng, mốc chỉ trúng đúng một lần trong đời.
     */
    @Column(name = "streak_cycle_days")
    private Integer streakCycleDays;

    /**
     * T7/CN không tính vào chuỗi: nghỉ cuối tuần KHÔNG làm đứt chuỗi, và cũng không
     * điểm danh được vào hai ngày đó. Đặt {@code false} nếu tổ chức làm cả tuần.
     */
    @Column(name = "skip_weekends", nullable = false)
    @Builder.Default
    private Boolean skipWeekends = true;

    /**
     * {@code [{"day":3,"points":20},{"day":7,"points":100}]} — thưởng thêm khi chuỗi
     * chạm ĐÚNG ngày đó. Mảng rỗng nghĩa là chỉ có điểm cơ bản.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "streak_bonuses", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private String streakBonuses = "[]";

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
