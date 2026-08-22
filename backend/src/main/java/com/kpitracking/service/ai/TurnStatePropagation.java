package com.kpitracking.service.ai;

import com.kpitracking.service.ai.form.FormPatchStore;
import com.kpitracking.tool.DisambiguationGuard;
import com.kpitracking.tool.AttachFilesTool;
import com.kpitracking.tool.EscapeHatchTool;
import com.kpitracking.tool.EvidenceRequestTool;
import com.kpitracking.tool.ToolCallTracker;
import io.micrometer.context.ContextRegistry;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import reactor.core.publisher.Hooks;

/**
 * Mang trạng thái theo lượt sang luồng mà Spring AI dùng để chạy vòng gọi tool khi phát chữ dần.
 *
 * <p><b>Vấn đề.</b> Sáu kho trạng thái theo lượt ({@link ToolCallTracker}, {@link FormPatchStore},
 * {@link EscapeHatchTool}, {@link DisambiguationGuard}) đều dựa trên một giả định ghi thẳng trong
 * javadoc của chúng: <i>mọi lời gọi tool của một lượt chạy đồng bộ trên cùng luồng request</i>.
 * Đường {@code .call()} đúng như vậy — đo được: tool chạy trên {@code nio-8081-exec-*}. Nhưng đường
 * {@code .stream()} thì Spring AI chạy vòng gọi tool trên luồng của reactor
 * ({@code boundedElastic-*}), nên mọi thứ tool ghi ra đều VÔ HÌNH với chuỗi công đoạn.
 *
 * <p>Hỏng theo kiểu im lặng, không có ngoại lệ nào: câu trả lời vẫn đúng (dữ liệu tool đi qua model)
 * nhưng bản đề xuất điền form không bao giờ tới người dùng, câu hỏi gợi ý biến mất, cửa thoát hiểm
 * ngừng chạy, và chốt chặn hỏi-lại-khi-trùng-tên không còn tác dụng.
 *
 * <p><b>Cách chữa.</b> Không truyền GIÁ TRỊ mà truyền THAM CHIẾU của hộp chứa: mỗi kho giữ một hộp
 * chứa an toàn nhiều luồng, {@code context-propagation} chụp tham chiếu đó lúc đăng ký luồng dữ
 * liệu (trên luồng chuỗi công đoạn) rồi đặt lại vào ThreadLocal của luồng reactor trong lúc chạy.
 * Hai luồng ghi và đọc cùng một chỗ, nên giả định "cùng một lượt" lại đúng — dù không còn là "cùng
 * một luồng".
 *
 * <p>Đây là chỗ DUY NHẤT trong dự án biết tới Reactor. Các kho chỉ phải mở ra một
 * {@code ThreadLocalAccessor}, không kho nào biết vì sao mình bị mang đi đâu.
 *
 * <p><b>Ảnh hưởng ngoài phạm vi.</b> {@code Hooks.enableAutomaticContextPropagation()} là thiết lập
 * TOÀN CỤC. Đây là ứng dụng Spring MVC, reactor chỉ xuất hiện ở đường streaming của Spring AI, nên
 * phần còn lại không bị chạm tới; giá phải trả là vài thao tác đặt/khôi phục ThreadLocal cho mỗi
 * chặng của luồng dữ liệu.
 */
@Configuration
@RequiredArgsConstructor
@Slf4j
public class TurnStatePropagation {

    private final DisambiguationGuard disambiguationGuard;

    @PostConstruct
    void register() {
        ContextRegistry registry = ContextRegistry.getInstance();
        registry.registerThreadLocalAccessor(new ToolCallTracker.Accessor());
        registry.registerThreadLocalAccessor(new FormPatchStore.Accessor());
        registry.registerThreadLocalAccessor(new EscapeHatchTool.Accessor());
        registry.registerThreadLocalAccessor(new EvidenceRequestTool.Accessor());
        registry.registerThreadLocalAccessor(new AttachFilesTool.Accessor());
        registry.registerThreadLocalAccessor(disambiguationGuard.accessor());

        // Phải bật TRƯỚC khi có lượt streaming đầu tiên; @PostConstruct lúc khởi động là đủ sớm.
        Hooks.enableAutomaticContextPropagation();
        log.info("Đã bật truyền trạng thái theo lượt sang luồng reactor (6 kho)");
    }
}
