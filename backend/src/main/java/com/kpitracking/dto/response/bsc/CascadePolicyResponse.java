package com.kpitracking.dto.response.bsc;

import com.kpitracking.enums.BscLinkedWeightEnforce;
import com.kpitracking.enums.BscPolicyStatus;
import lombok.*;

import java.util.List;
import java.util.UUID;

/** Chính sách điểm BSC — xem {@link com.kpitracking.dto.request.bsc.CascadePolicyRequest}. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CascadePolicyResponse {
    private UUID id;
    private String name;
    private UUID kpiCycleId;
    private String kpiCycleName;
    /** Các đợt gắn riêng (rỗng khi chính sách gắn theo kỳ hoặc là bản mặc định). */
    private List<ScorecardPeriodResponse> periods;
    /** Nhãn gộp để hiển thị: tên kỳ, danh sách tên đợt, hoặc "Mặc định". */
    private String scopeLabel;
    private Double recognizedCapPercent;
    private Double minBscLinkedWeight;
    private BscLinkedWeightEnforce linkedWeightEnforce;
    private BscPolicyStatus status;
    private Integer version;
}
