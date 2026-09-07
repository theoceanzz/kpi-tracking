package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Một lần điểm danh của một người trong một ngày.
 *
 * <p>Bảng CHỈ GHI THÊM — không {@code updated_at}, không {@code deleted_at}, giống
 * {@link RewardTransaction}. Điểm danh nhầm thì ghi bút toán bù trừ ở sổ cái chứ không
 * xoá dòng ở đây: chuỗi của những ngày sau được tính từ dòng liền trước, xoá một dòng
 * giữa chừng sẽ khiến chuỗi tính lại ra kết quả khác với số điểm đã thực sự phát.
 *
 * <p>Các cột {@code streak*} và {@code *Points} là ẢNH CHỤP cấu hình tại thời điểm
 * điểm danh, cố ý không suy lại lúc đọc — sếp đổi mức điểm hôm nay không được làm đổi
 * con số đã hiện trong lịch sử của hôm qua.
 *
 * <p>Chỉ {@code RewardCheckinService.checkin} được phép tạo bản ghi ở đây.
 */
@Entity
@Table(name = "reward_checkins")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RewardCheckin {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Ngày theo múi giờ Asia/Ho_Chi_Minh, không phải theo UTC của server. */
    @Column(name = "checkin_date", nullable = false)
    private LocalDate checkinDate;

    /** Tổng số ngày liên tiếp đã điểm danh, đếm thẳng không reset theo chu kỳ. */
    @Column(name = "streak_length", nullable = false)
    private Integer streakLength;

    /** Vị trí trong chu kỳ (1..streakCycleDays). Bằng {@link #streakLength} khi không đặt chu kỳ. */
    @Column(name = "streak_day", nullable = false)
    private Integer streakDay;

    @Column(name = "base_points", nullable = false)
    private Integer basePoints;

    /** Thưởng thêm do chạm mốc chuỗi. 0 khi ngày đó không trúng mốc nào. */
    @Column(name = "bonus_points", nullable = false)
    @Builder.Default
    private Integer bonusPoints = 0;

    /** Luôn bằng {@code basePoints + bonusPoints} — có CHECK ở tầng DB giữ đúng. */
    @Column(name = "total_points", nullable = false)
    private Integer totalPoints;

    /** Bút toán EARN tương ứng ở sổ cái. Cho phép dò ngược từ nhật ký sang ví. */
    @Column(name = "transaction_id")
    private UUID transactionId;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
