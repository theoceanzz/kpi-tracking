package com.kpitracking.service.ai.agent;

import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.tool.ToolRegistry.Group;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Test cho khối "ngoài quyền của người dùng này" trong prompt hệ thống.
 *
 * <p><b>Ca hỏng có thật (D08).</b> Trưởng phòng không có {@code BSC:MANAGE} hỏi "cho tôi xem thẻ
 * điểm cân bằng BSC của đơn vị tôi". Phép chặn quyền chạy ĐÚNG — {@code get_bsc} không hề được gửi
 * cho model — nhưng model chỉ thấy mình thiếu công cụ chứ không biết vì sao, nên nó gọi
 * {@code get_okr}, lấy dữ liệu mục tiêu ra và đặt tiêu đề <i>"Thẻ điểm cân bằng BSC của đơn vị
 * bạn"</i>. Không con số nào bị bịa; cái sai là <b>gọi tập dữ liệu này bằng tên của tập kia</b>.
 *
 * <p>Đáng chú ý: ca này chỉ lộ ra SAU khi thêm dữ liệu OKR mẫu. Trước đó đơn vị không có mục tiêu
 * nào nên model đành trả lời "không có" và bộ đo tưởng là đạt — tức phép đo từng xanh vì dữ liệu
 * rỗng chứ không vì hành vi đúng.
 *
 * <p>Hai điều phải giữ, và điều thứ hai quan trọng ngang điều thứ nhất: khối nói đúng việc cần nói
 * khi có nhóm bị chặn, và <b>rỗng tuyệt đối ở lượt bình thường</b> — prompt của mọi lượt khác không
 * được dài thêm một ký tự nào.
 */
class DeniedCapabilityBlockTest {

    /** Khối này thuần ghép chuỗi nên hai phụ thuộc của lớp để null được. */
    private final TurnPromptBuilder builder = new TurnPromptBuilder(null, null);

    private AiTurn turnDenying(Set<Group> denied) {
        AiTurn turn = new AiTurn("Cho tôi xem thẻ điểm cân bằng BSC của đơn vị tôi", null, null);
        turn.setDeniedGroups(denied);
        return turn;
    }

    @Test
    @DisplayName("không nhóm nào bị chặn -> khối RỖNG, prompt giữ nguyên từng ký tự")
    void emptyWhenNothingDenied() {
        assertThat(builder.deniedBlock(turnDenying(null))).isEmpty();
        assertThat(builder.deniedBlock(turnDenying(Set.of()))).isEmpty();
    }

    @Test
    @DisplayName("chặn BSC -> nêu đích danh khả năng thiếu, bằng lời người dùng hiểu được")
    void namesTheMissingCapability() {
        String block = builder.deniedBlock(turnDenying(Set.of(Group.BSC)));

        // Nêu tên nhóm bằng chữ, không phải bằng mã quyền: model đọc để nói lại cho người dùng, mà
        // "BSC:MANAGE" thì người dùng cuối không hiểu.
        assertThat(block).contains("thẻ điểm cân bằng").contains("viễn cảnh");
        assertThat(block).doesNotContain("BSC:MANAGE");
    }

    @Test
    @DisplayName("cấm ĐÚNG hành vi đã hỏng: lấy dữ liệu khác thế vào rồi gọi bằng tên cũ")
    void forbidsTheSubstitutionThatActuallyHappened()  {
        String block = builder.deniedBlock(turnDenying(Set.of(Group.BSC)));

        // Đây mới là phần chữa ca D08. Chỉ bảo "bạn không có quyền" thì model vẫn đi tìm thứ gần
        // giống — nó đã làm đúng như vậy với get_okr.
        assertThat(block).contains("không lấy dữ liệu khác ra thay thế");
        assertThat(block).contains("OKR");
        assertThat(block).contains("NÓI THẲNG");
    }

    @Test
    @DisplayName("chặn nhiều nhóm -> liệt kê đủ, không nuốt bớt")
    void listsEveryDeniedGroup() {
        String block = builder.deniedBlock(turnDenying(Set.of(Group.BSC, Group.OKR)));

        assertThat(block).contains("thẻ điểm cân bằng").contains("kết quả then chốt");
    }

    @Test
    @DisplayName("nhóm không có nhãn (vd CORE) -> khối vẫn RỖNG, không in ra 'null'")
    void ignoresGroupsWithoutALabel() {
        // CORE/LOOKUP/KPI/INSIGHT không đòi quyền riêng nên không bao giờ nằm trong danh sách bị
        // chặn; nhưng lọt vào thì phải im lặng bỏ qua chứ đừng ghép chữ "null" vào prompt hệ thống.
        assertThat(builder.deniedBlock(turnDenying(Set.of(Group.CORE)))).isEmpty();
    }
}
