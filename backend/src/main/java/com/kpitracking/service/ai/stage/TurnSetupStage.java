package com.kpitracking.service.ai.stage;

import com.kpitracking.entity.OrgUnit;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.service.ManagerContextResolver.ManagerContext;
import com.kpitracking.service.ai.AiStage;
import com.kpitracking.service.ai.AiStageChain;
import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.tool.FollowupContextStore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Dựng ngữ cảnh cho lượt: mở lượt mới trong kho dữ liệu tool, chốt đơn vị "hiện tại", và bơm thời
 * gian thật vào prompt.
 */
@Component
@Order(400)
@RequiredArgsConstructor
@Slf4j
public class TurnSetupStage implements AiStage {

    private final OrgUnitRepository orgUnitRepository;
    private final FollowupContextStore followupContextStore;

    @Override
    public String handle(AiTurn turn, AiStageChain next) {
        ManagerContext ctx = turn.getManager();

        // Xoá kho kết quả tool của hội thoại ngay đầu lượt, để phần sinh câu hỏi gợi ý chỉ bám vào
        // dữ liệu tool của CHÍNH lượt này — lượt hỏi lại không được thừa hưởng dữ liệu lượt trước,
        // vì như thế sẽ sinh ra gợi ý sai.
        if (turn.isHasMemory()) {
            followupContextStore.startTurn(turn.getConversationId());
        }

        log.info("Xử lý lượt hỏi cho orgUnitId={}, conversationId={}",
                ctx.orgUnitId(), turn.isHasMemory() ? turn.getConversationId() : "không");

        turn.setEffectiveUnitId(resolveEffectiveUnit(turn, ctx));

        Map<String, Object> toolCtx = new HashMap<>();
        toolCtx.put("orgUnitId", turn.getEffectiveUnitId());
        toolCtx.put("orgUnitPath", ctx.orgUnitPath());
        toolCtx.put("organizationId", ctx.orgId());
        toolCtx.put("userEmail", ctx.email());
        if (turn.isHasMemory()) {
            toolCtx.put("conversationId", turn.getConversationId());
        }
        turn.setToolCtx(toolCtx);

        // Thời gian thật (Việt Nam, UTC+7) bơm vào prompt hệ thống để model không tự đoán "bây giờ".
        // Dạng hiển thị dd/MM/yyyy; kèm bản ISO cho việc tính tham số ngày.
        ZonedDateTime now = ZonedDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        turn.setCurrentDateTime(now.format(DateTimeFormatter
                        .ofPattern("dd/MM/yyyy HH:mm 'ICT', EEEE", new Locale("vi")))
                + " (ISO: " + now.toLocalDate() + ")");

        return next.proceed(turn);
    }

    /**
     * Đơn vị "hiện tại" của lượt = đơn vị thẻ Insight (focusUnitId) nếu client gửi VÀ nó nằm TRONG
     * subtree của quản lý (chống client giả mạo id); ngược lại là đơn vị của chính quản lý.
     *
     * <p>Chỉ override orgUnitId — GIỮ orgUnitPath của quản lý để không thu hẹp quyền, vì
     * {@code validateSubtreeAccess} kiểm theo orgUnitPath.
     */
    private UUID resolveEffectiveUnit(AiTurn turn, ManagerContext ctx) {
        String focusUnitId = turn.getFocusUnitId();
        if (focusUnitId == null || focusUnitId.isBlank()) return ctx.orgUnitId();
        try {
            UUID fid = UUID.fromString(focusUnitId.trim());
            OrgUnit fu = orgUnitRepository.findById(fid).orElse(null);
            if (fu != null && fu.getPath() != null && ctx.orgUnitPath() != null
                    && fu.getPath().startsWith(ctx.orgUnitPath())) {
                return fid;
            }
        } catch (IllegalArgumentException ignored) {
            // focusUnitId không phải UUID -> bỏ qua, dùng đơn vị của quản lý
        }
        return ctx.orgUnitId();
    }

    @Override
    public int getOrder() { return 400; }
}
