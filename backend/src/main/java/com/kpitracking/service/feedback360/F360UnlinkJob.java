package com.kpitracking.service.feedback360;

import com.kpitracking.entity.F360Campaign;
import com.kpitracking.enums.F360Relationship;
import com.kpitracking.repository.F360AnswerRepository;
import com.kpitracking.repository.F360AssignmentRepository;
import com.kpitracking.repository.F360CampaignRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * Ẩn danh nghiêm ngặt (§6.3): sau khi đã tính và chụp kết quả, cắt liên kết giữa người chấm và câu
 * trả lời của các phiếu ẩn danh đã nộp, và làm mờ dấu thời gian để không nối lại được qua thời điểm.
 *
 * <ul>
 *   <li>Chạy trong transaction CỦA lượt đóng chiến dịch ({@code MANDATORY}): lỗi giữa chừng thì cả
 *       lượt đóng rollback, không bao giờ còn trạng thái nửa vời.</li>
 *   <li>Chạy ở MỌI lần đóng. Idempotent nhờ điều kiện chọn dòng ({@code assignment_id IS NOT NULL}),
 *       không nhờ {@code unlinked_at} — cờ đó chỉ ghi nhận lần chạy gần nhất. Nhờ vậy phiếu nộp sau
 *       khi mở lại chiến dịch cũng được tách ở lần đóng kế tiếp.</li>
 *   <li>Chỉ dùng câu lệnh native: sửa qua entity thì auditing ghi {@code updated_at = now()}.</li>
 * </ul>
 *
 * Phạm vi lời hứa: dữ liệu HIỆN HÀNH, với nhóm ≥ k phiếu. Backup/WAL tạo trước lúc tách vẫn còn
 * liên kết cũ; nhóm chỉ 1 người nộp thì vẫn suy ra được qua phiếu (xem tài liệu).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class F360UnlinkJob {

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final F360AnswerRepository answerRepository;
    private final F360AssignmentRepository assignmentRepository;
    private final F360CampaignRepository campaignRepository;

    /** @return số câu trả lời vừa được tách */
    @Transactional(propagation = Propagation.MANDATORY)
    public int run(F360Campaign campaign) {
        if (!Boolean.TRUE.equals(campaign.getStrictAnonymity())) return 0;
        Instant closedAt = campaign.getClosedAt() != null ? campaign.getClosedAt() : Instant.now();
        Instant day = closedAt.atZone(ZONE).truncatedTo(ChronoUnit.DAYS).toInstant();
        List<String> relationships = anonymousRelationships(Boolean.TRUE.equals(campaign.getManagerAnonymous()));

        int answers = answerRepository.unlinkSubmitted(campaign.getId(), closedAt, relationships);
        assignmentRepository.blurSubmittedTimestamps(campaign.getId(), day, closedAt, relationships);

        // Hai câu bulk ở trên đã clear persistence context — nạp lại để ghi cờ, không dùng entity cũ.
        campaignRepository.findById(campaign.getId()).ifPresent(c -> {
            c.setUnlinkedAt(Instant.now());
            campaignRepository.save(c);
        });
        log.info("Tách liên kết ẩn danh chiến dịch 360 {}: {} câu trả lời", campaign.getId(), answers);
        return answers;
    }

    static List<String> anonymousRelationships(boolean managerAnonymous) {
        List<String> out = new ArrayList<>();
        for (F360Relationship r : F360Relationship.values()) {
            if (F360AnonymityGuard.isAnonymousRelationship(r, managerAnonymous)) out.add(r.name());
        }
        return out;
    }
}
