package com.kpitracking.dto.response.task;

import lombok.*;

import java.util.UUID;

/** Một lựa chọn trong ô chọn người (giao việc / theo dõi) hoặc ô chọn KPI của người được giao. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TaskOptionResponse {

    private UUID id;
    private String name;
    /** Người: email; KPI: tên đợt. */
    private String secondary;
    private String avatarUrl;
    /** Người: chức danh · đơn vị; KPI: trạng thái. */
    private String detail;
    /** Nhóm hiển thị trong ô chọn: người ⇒ đơn vị; KPI ⇒ đợt. */
    private UUID groupId;
    private String groupName;
    /** KPI: đợt đang diễn ra (hiện trước; các đợt khác bấm "Hiện thêm"). Người: luôn true. */
    private boolean groupCurrent;
    /** Thứ tự nhóm: KPI ⇒ ngày bắt đầu đợt (ISO, mới trước); người ⇒ đường dẫn đơn vị. */
    private String groupSort;
}
