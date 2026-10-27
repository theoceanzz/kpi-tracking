package com.kpitracking.service.bsc;

import com.kpitracking.entity.bsc.BscScorecard;
import com.kpitracking.enums.bsc.BscEmptyPerspectivePolicy;
import com.kpitracking.repository.bsc.BscScorecardRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * "Khi một hạng mục chưa có KPI nào" là luật của CẢ cây BSC, không phải của từng phòng — MỘT chỗ đồng bộ.
 *
 * <p>Thẻ con (có thẻ cha trong cây) luôn theo thẻ cha: form khoá ô này, backend bỏ qua giá trị gửi lên.
 * Thẻ cha đổi ⇒ áp xuống toàn bộ cây con; thẻ được nhận nuôi / gắn vào cây ⇒ đổi về theo thẻ cha. Không
 * thì trưởng phòng đổi sang "Bỏ qua" để nhân viên khỏi bị tính 0 ở hạng mục cấp trên giao mà phòng chưa
 * gắn KPI, và điểm BSC nhân viên hai phòng cùng công ty chấm theo hai luật khác nhau.
 */
@Component
@RequiredArgsConstructor
public class BscEmptyPolicySync {

    private final BscScorecardRepository scorecardRepository;

    /** Thẻ con có bị khoá ô chính sách không (đi theo thẻ cha). */
    public static boolean followsParent(BscScorecard scorecard) {
        return scorecard.getParentScorecard() != null;
    }

    /** Vừa gắn {@code child} vào cây (phân rã, nhận nuôi, gắn tay): lấy luật của thẻ cha, áp xuống cây con của nó. */
    public void inheritFromParent(BscScorecard child) {
        BscScorecard parent = child.getParentScorecard();
        if (parent == null || parent.getEmptyPerspectivePolicy() == null) return;
        if (parent.getEmptyPerspectivePolicy() != child.getEmptyPerspectivePolicy()) {
            child.setEmptyPerspectivePolicy(parent.getEmptyPerspectivePolicy());
            scorecardRepository.save(child);
        }
        propagateDown(child);
    }

    /** Áp luật của {@code root} cho mọi thẻ con, cháu trong cây. */
    public void propagateDown(BscScorecard root) {
        BscEmptyPerspectivePolicy policy = root.getEmptyPerspectivePolicy();
        if (policy == null) return;
        Set<UUID> seen = new HashSet<>();
        seen.add(root.getId());
        Deque<BscScorecard> queue = new ArrayDeque<>();
        queue.add(root);
        while (!queue.isEmpty()) {
            for (BscScorecard child : scorecardRepository.findByParentScorecardId(queue.poll().getId())) {
                if (!seen.add(child.getId())) continue; // dữ liệu lỗi vòng thì dừng, không treo request
                if (child.getEmptyPerspectivePolicy() != policy) {
                    child.setEmptyPerspectivePolicy(policy);
                    scorecardRepository.save(child);
                }
                queue.add(child);
            }
        }
    }
}
