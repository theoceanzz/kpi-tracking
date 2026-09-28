package com.kpitracking.dto.request.kpi.lock;

import com.kpitracking.enums.PeriodLockAction;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class LockCycleRequest {

    /** Mỗi đợt CHƯA HOÀN THÀNH phải có đúng một quyết định. Kỳ đã hoàn thành hết thì để rỗng. */
    @Valid
    @Builder.Default
    private List<PeriodDecision> decisions = new ArrayList<>();

    /**
     * Token của lần xem trước (GET /lock-preview). Dữ liệu đổi kể từ lúc đó (có người vừa nộp,
     * vừa duyệt) thì từ chối để người dùng xem lại, thay vì khoá theo một bức tranh đã cũ.
     */
    @NotNull(message = "{validation.previewTokenMissing}")
    private String previewToken;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PeriodDecision {
        @NotNull(message = "{validation.periodMissing}")
        private UUID periodId;

        @NotNull(message = "{validation.noHandlingOptionChosenPeriod}")
        private PeriodLockAction action;

        /** Bắt buộc khi TRANSFER. */
        private UUID targetCycleId;

        /** Ngày mới của đợt khi chuyển — bắt buộc nếu thời gian đợt nằm ngoài kỳ đích. */
        private Instant newStartDate;
        private Instant newEndDate;
    }
}
