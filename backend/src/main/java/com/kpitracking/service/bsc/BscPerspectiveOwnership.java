package com.kpitracking.service.bsc;

import com.kpitracking.entity.bsc.BscScorecard;
import com.kpitracking.entity.bsc.BscScorecardPerspective;
import com.kpitracking.enums.bsc.BscItemOrigin;

import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.Objects;
import java.util.UUID;

/**
 * Hạng mục BSC THUỘC bộ tiêu chí nào — MỘT luật cho cả nút Sửa / Xoá trên giao diện lẫn backend.
 *
 * <p>Hạng mục là danh mục dùng chung: tên, lĩnh vực, mô tả, màu hiện ở mọi bộ đang dùng nó. Bộ tiêu chí
 * ĐẦU TIÊN tự thêm hạng mục (dòng tự lập, không phải dòng nhận từ phân rã / gắn cây) là CHỦ: chỉ từ bộ đó
 * mới sửa được hạng mục, và sửa xong các bộ nhận phân rã đồng bộ theo. Bộ khác chỉ dùng lại — không thì
 * phòng B đổi tên hạng mục mà bộ công ty đang chấm theo.
 *
 * <p>Xoá thì chặt hơn: hạng mục còn nằm trong BẤT KỲ bộ nào là không xoá (xoá mềm hạng mục mà dòng của
 * bộ vẫn trỏ vào). Muốn bỏ khỏi một bộ thì bỏ tick ở bộ đó.
 */
public final class BscPerspectiveOwnership {

    private BscPerspectiveOwnership() {}

    /** Dòng có được từ bộ khác (phân rã từng chỉ tiêu, giao cả bộ, gắn vào cây) — không làm chủ hạng mục. */
    public static boolean derived(BscScorecardPerspective row) {
        return row.getOrigin() == BscItemOrigin.ASSIGNED
                || row.getParentItem() != null
                || row.getWholeSharePercent() != null;
    }

    /** Bộ chủ của hạng mục trong các dòng còn sống của nó; null = chưa bộ nào tự thêm. */
    public static BscScorecard ownerOf(Collection<BscScorecardPerspective> liveRows) {
        return liveRows.stream()
                .filter(r -> !derived(r))
                .min(Comparator.comparing((BscScorecardPerspective r) -> r.getCreatedAt() != null ? r.getCreatedAt() : Instant.MAX)
                        .thenComparing(r -> r.getScorecard().getId()))
                .map(BscScorecardPerspective::getScorecard)
                .orElse(null);
    }

    /** Sửa hạng mục từ bộ {@code scorecardId} (null = bộ đang tạo, chưa lưu) được không. */
    public static boolean canEditFrom(Collection<BscScorecardPerspective> liveRows, UUID scorecardId) {
        BscScorecard owner = ownerOf(liveRows);
        return owner == null || Objects.equals(owner.getId(), scorecardId);
    }

    public static boolean canDelete(Collection<BscScorecardPerspective> liveRows) {
        return liveRows.isEmpty();
    }
}
