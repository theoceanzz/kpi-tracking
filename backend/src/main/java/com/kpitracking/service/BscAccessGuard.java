package com.kpitracking.service;

import com.kpitracking.entity.BscScorecard;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.security.PermissionChecker;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * Một chỗ duy nhất trả lời câu hỏi "người này có được đụng vào bộ tiêu chí đó không".
 *
 * <p><b>Vì sao là component riêng.</b> {@code @PreAuthorize} chỉ biết người dùng CÓ quyền gì, không
 * biết quyền đó áp cho ĐƠN VỊ NÀO. Ba service khác nhau cùng cần đúng một phép kiểm này — sửa bộ
 * tiêu chí ({@link BscService}), trình duyệt ({@link BscTreeService}), tính lại kết quả đơn vị
 * ({@link BscCascadeService}). Để mỗi nơi tự viết thì sớm muộn có nơi quên, mà quên ở đây nghĩa là
 * trưởng đơn vị này thao tác được lên bộ tiêu chí của đơn vị khác.
 */
@Component
@RequiredArgsConstructor
public class BscAccessGuard {

    private final UserRepository userRepository;
    private final PermissionChecker permissionChecker;

    /**
     * Quản trị BSC toàn tổ chức (giám đốc / HR trưởng). Người này đụng được mọi bộ tiêu chí, kể cả
     * các dòng chỉ tiêu đã khoá — vì họ chính là người đặt ra những chỉ tiêu đó.
     */
    public boolean canManageAll() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            return auth != null && auth.getAuthorities().stream()
                    .anyMatch(a -> "BSC:MANAGE".equals(a.getAuthority()));
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Người duyệt BSC. Chỉ họ mới đặt được trạng thái trực tiếp — người khác phải đi qua luồng
     * trình duyệt, nếu không "trình – duyệt" chỉ còn là hình thức: ai cũng tự chuyển thẳng bộ tiêu
     * chí của mình sang ĐANG ÁP DỤNG mà không cần ai xem qua.
     */
    public boolean canApprove() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            return auth != null && auth.getAuthorities().stream()
                    .anyMatch(a -> "BSC:APPROVE".equals(a.getAuthority()));
        } catch (Exception e) {
            return false;
        }
    }

    /** Chặn thao tác lên một bộ tiêu chí nằm ngoài phạm vi phụ trách. */
    public void assertCanEdit(BscScorecard scorecard) {
        assertCanEdit(scorecard.getOrgUnits());
    }

    /**
     * Chặn SỬA NỘI DUNG / XOÁ bộ tiêu chí đã rời trạng thái nháp, với người không phải quản trị BSC.
     *
     * <p>Đã trình thì người duyệt đang xem đúng nội dung đó; đã duyệt thì thẻ đang chấm điểm. Để trưởng
     * đơn vị tự đổi trọng số/mục tiêu lúc này là biến bước duyệt thành hình thức (người duyệt duyệt
     * một bản, đơn vị chạy một bản khác). Muốn đổi thì cấp trên trả lại về nháp, hoặc quản trị BSC sửa.
     * Không chặn tính kết quả / nhập số tay — đó là cập nhật số liệu, không phải sửa bộ tiêu chí.
     */
    public void assertCanEditContent(BscScorecard scorecard) {
        assertCanEdit(scorecard);
        if (canManageAll()) return;
        if (scorecard.getStatus() != null && scorecard.getStatus() != com.kpitracking.enums.BscScorecardStatus.DRAFT) {
            throw new BusinessException(ErrorCode.SCORECARD_LOCKED_FOR_UNIT, scorecard.getName());
        }
    }

    /**
     * Chặn theo danh sách đơn vị của bộ tiêu chí.
     *
     * <p>Bộ tiêu chí KHÔNG gắn đơn vị nào là bộ tiêu chí toàn tổ chức: chỉ người quản trị BSC lập
     * và sửa được, vì nó là gốc của cây và chi phối điểm của mọi phòng.
     */
    public void assertCanEdit(List<OrgUnit> orgUnits) {
        if (canManageAll()) return;

        User me = currentUserOrNull();
        if (me == null) {
            throw new BusinessException(ErrorCode.COULD_NOT_IDENTIFY_CURRENT_USER_2);
        }
        if (orgUnits == null || orgUnits.isEmpty()) {
            throw new BusinessException(ErrorCode.ONLY_BSC_ADMINISTRATORS_CAN_WORK_ORGANIZATION_WIDE);
        }
        // Chỉ các đơn vị người này ĐƯỢC GÁN trực tiếp. Muốn quản BSC của đơn vị con thì phải được
        // gán vai trò ở đúng đơn vị đó — suy diễn theo cây sẽ âm thầm nới quyền rộng hơn dự tính.
        List<UUID> mine = permissionChecker.getEffectiveOrgUnitsWithPermission(me.getId(), "BSC:MANAGE_UNIT");
        for (OrgUnit unit : orgUnits) {
            if (!mine.contains(unit.getId())) {
                throw new BusinessException(ErrorCode.CAN_ONLY_WORK_SCORECARDS_UNITS_MANAGE, unit.getName());
            }
        }
    }

    private User currentUserOrNull() {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            return userRepository.findByEmail(email).orElse(null);
        } catch (Exception e) {
            return null;
        }
    }
}
