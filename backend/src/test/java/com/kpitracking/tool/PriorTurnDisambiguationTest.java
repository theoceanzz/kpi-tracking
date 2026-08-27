package com.kpitracking.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.entity.ConversationMessage;
import com.kpitracking.repository.ConversationMessageRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.OrgUnitStatisticService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Test cho phép nhận diện "lượt trước đã nói tới bản nào".
 *
 * <p><b>Ca hỏng có thật.</b> Người dùng hỏi chi tiết KPI {@code a} ngay sau khi trợ lý vừa liệt kê
 * các KPI chờ duyệt — trong đó {@code a} thuộc kỳ <b>test2</b>. Trợ lý trả về {@code a} của kỳ
 * <b>test1</b>: một KPI khác, đã duyệt, không liên quan.
 *
 * <p>Chốt chặn trùng tên KHÔNG hỏng — nó <b>tự tắt</b>, vì bản trước kết luận nhầm rằng lượt trước
 * đã đưa lựa chọn cho người dùng rồi. Hai nguyên nhân cộng lại, và lớp này chốt cả hai:
 * <ul>
 *   <li>nhãn DÙNG CHUNG (cả hai bản đều ở "Team Backend") bị tính là nhãn phân biệt;</li>
 *   <li>tên một ký tự ({@code a}) khớp chuỗi con với chữ {@code a} nằm trong "Backend".</li>
 * </ul>
 *
 * <p>Ca cuối quan trọng không kém: cơ chế này sinh ra để phục vụ tình huống trợ lý HỎI rồi người
 * dùng TRẢ LỜI. Siết chặt mà làm hỏng chính tình huống đó thì lợi bất cập hại.
 */
class PriorTurnDisambiguationTest {

    private static final String CONV = UUID.randomUUID().toString();

    private ConversationMessageRepository messageRepository;
    private ToolSupport support;

    /** Hai KPI cùng tên "a": khác KỲ, nhưng CÙNG đơn vị — đúng hình dạng của ca hỏng thật. */
    private final Map<String, Object> aTest1 =
            Map.of("id", UUID.randomUUID().toString(), "name", "a",
                    "orgUnitName", "Team Backend", "periodName", "test1");
    private final Map<String, Object> aTest2 =
            Map.of("id", UUID.randomUUID().toString(), "name", "a",
                    "orgUnitName", "Team Backend", "periodName", "test2");

    private final List<Map<String, Object>> candidates = List.of(aTest1, aTest2);
    private static final String[] LABELS = {"orgUnitName", "periodName"};

    @BeforeEach
    void setUp() {
        messageRepository = mock(ConversationMessageRepository.class);
        support = new ToolSupport(
                mock(OrgUnitRepository.class), mock(UserRoleOrgUnitRepository.class),
                mock(UserRepository.class), mock(KpiCriteriaRepository.class),
                messageRepository, mock(OrgUnitStatisticService.class),
                mock(FollowupContextStore.class), new ObjectMapper());
        support.initToolMapper();
    }

    /** Câu trả lời gần nhất của trợ lý trong hội thoại. */
    private void lastAssistantSaid(String content) {
        when(messageRepository.findByConversationIdOrderByMsgIndex(any())).thenReturn(List.of(
                ConversationMessage.builder().role("user").content("câu hỏi trước").msgIndex(0).build(),
                ConversationMessage.builder().role("assistant").content(content).msgIndex(1).build()));
    }

    private List<Map<String, Object>> named() {
        return support.namedInPriorTurn(CONV, "a", candidates, LABELS);
    }

    // ════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("lượt trước chỉ nhắc kỳ test2 -> nhận diện ĐÚNG một bản, không phải cả hai")
    void mentionsOnlyOnePeriod() {
        // Đây là câu trả lời thật đã gây ra lỗi: có "a", có "Team Backend", có "test2" — nhưng
        // TUYỆT ĐỐI không có "test1", nên người dùng chưa hề được cho thấy lựa chọn đó.
        lastAssistantSaid("| Kỳ | KPI | Đơn vị |\n| test2 | a | Team Backend |\n| test2 | bcd | Team Backend |");

        assertThat(named()).containsExactly(aTest2);
    }

    @Test
    @DisplayName("nhãn DÙNG CHUNG không nhận diện được ai — đây chính là lỗi cũ")
    void sharedLabelIdentifiesNobody() {
        // Chỉ nhắc đơn vị, không nhắc kỳ nào. Bản trước tính CẢ HAI ứng viên là "đã nêu" rồi kết
        // luận đã đưa lựa chọn, nên tắt chốt chặn và để model tự chọn.
        lastAssistantSaid("KPI a thuộc Team Backend, bạn xem thêm nhé.");

        assertThat(named())
                .as("một nhãn mà mọi ứng viên đều có thì không chứng minh được lượt trước nói về ai")
                .isEmpty();
    }

    @Test
    @DisplayName("lượt trước nêu CẢ HAI kỳ -> nhận diện cả hai, đường cho qua giữ nguyên")
    void mentionsBothPeriods() {
        // Chính là ca mà cơ chế sinh ra để phục vụ: trợ lý hỏi, người dùng trả lời, tool phải chạy
        // tiếp. Siết chặt mà làm hỏng ca này thì mất nhiều hơn được.
        lastAssistantSaid("KPI \"a\" có 2 bản: kỳ test1 và kỳ test2. Bạn muốn xem bản nào?");

        assertThat(named()).containsExactlyInAnyOrder(aTest1, aTest2);
    }

    @Test
    @DisplayName("tên MỘT ký tự không được khớp với chữ nằm trong từ khác")
    void shortNameDoesNotMatchInsideAnotherWord() {
        // "a" nằm trong "Backend", "Staff", "hoàn thành"... Khớp chuỗi con làm cổng kiểm tra này
        // vô nghĩa với mọi tên ngắn.
        lastAssistantSaid("Team Backend có 3 nhân sự, tiến độ đạt yêu cầu.");

        assertThat(named())
                .as("không có chữ 'a' đứng riêng thì coi như lượt trước không nói về KPI này")
                .isEmpty();
    }

    @Test
    @DisplayName("lượt trước nói chuyện KHÁC -> không nhận diện ai, dù nhãn tình cờ trùng")
    void unrelatedPriorTurnIdentifiesNobody() {
        lastAssistantSaid("Kỳ test1 và kỳ test2 đều đã kết thúc.");

        assertThat(named())
                .as("không nhắc tên đang trùng thì mọi trùng lặp nhãn đều là ngẫu nhiên")
                .isEmpty();
    }

    @Test
    @DisplayName("hội thoại chưa có câu trả lời nào -> không nhận diện ai")
    void noAssistantMessageYet() {
        when(messageRepository.findByConversationIdOrderByMsgIndex(any())).thenReturn(List.of(
                ConversationMessage.builder().role("user").content("cho tôi chi tiết kpi a").msgIndex(0).build()));

        assertThat(named()).isEmpty();
    }

    @Test
    @DisplayName("không có hội thoại (lượt không nhớ) -> không nhận diện ai")
    void noConversationMeansNoContext() {
        assertThat(support.namedInPriorTurn(null, "a", candidates, LABELS)).isEmpty();
    }

    // ── gom nhóm theo TÊN ────────────────────────────────────────────────────
    //
    // Tìm kiếm khớp mờ nên một từ khoá ngắn kéo về nhiều vụ trùng tên khác nhau cùng lúc. Bản trước
    // gộp tất cả thành một danh sách phẳng, và đó là lý do chốt chặn arm nhầm nhóm: tìm KPI với từ
    // khoá "a" trả về a(×2) VÀ "API hoàn thành"(×3) VÀ "Số task hoàn thành"(×2).

    /** Kết quả tìm kiếm thật của từ khoá "a" trên dữ liệu mẫu, rút gọn. */
    private static List<Map<String, Object>> fuzzyResultsForLetterA() {
        return List.of(
                Map.of("id", UUID.randomUUID().toString(), "name", "a",
                        "orgUnitName", "Team Backend", "periodName", "test1"),
                Map.of("id", UUID.randomUUID().toString(), "name", "a",
                        "orgUnitName", "Team Backend", "periodName", "test2"),
                Map.of("id", UUID.randomUUID().toString(), "name", "API hoàn thành",
                        "orgUnitName", "Team Backend", "periodName", "Tháng 4/2026"),
                Map.of("id", UUID.randomUUID().toString(), "name", "API hoàn thành",
                        "orgUnitName", "Team Backend", "periodName", "Tháng 5/2026"),
                Map.of("id", UUID.randomUUID().toString(), "name", "Số task hoàn thành",
                        "orgUnitName", "Phòng IT", "periodName", "Tháng 4/2026"),
                Map.of("id", UUID.randomUUID().toString(), "name", "Số task hoàn thành",
                        "orgUnitName", "Phòng IT", "periodName", "Tháng 6/2026"));
    }

    @Test
    @DisplayName("tách ĐÚNG từng vụ trùng tên, không gộp thành một khối")
    void groupsEachCollisionSeparately() {
        List<List<Map<String, Object>>> groups =
                support.duplicateNameGroups(fuzzyResultsForLetterA(), "name");

        assertThat(groups).hasSize(3);
        assertThat(groups).allSatisfy(g -> assertThat(g).hasSizeGreaterThanOrEqualTo(2));
    }

    @Test
    @DisplayName("từ khoá khớp HẲN một tên -> chỉ xét nhóm đó, bỏ qua nhiễu khớp mờ")
    void focusesOnTheExactlyMatchingName() {
        // Không có phép lọc này thì trợ lý sẽ hỏi lại về "API hoàn thành" và "Số task hoàn thành"
        // trong khi người dùng chỉ hỏi về KPI tên "a".
        List<List<Map<String, Object>>> focus = support.focusGroups(
                support.duplicateNameGroups(fuzzyResultsForLetterA(), "name"), "a", "name");

        assertThat(focus).hasSize(1);
        assertThat(focus.get(0)).allSatisfy(c -> assertThat(c.get("name")).isEqualTo("a"));
    }

    @Test
    @DisplayName("không tên nào khớp hẳn -> giữ tất cả, lùi về hành vi cũ (thà hỏi thừa)")
    void keepsAllGroupsWhenNothingMatchesExactly() {
        List<List<Map<String, Object>>> groups =
                support.duplicateNameGroups(fuzzyResultsForLetterA(), "name");

        assertThat(support.focusGroups(groups, "hoàn thành", "name")).hasSize(3);
    }

    @Test
    @DisplayName("kho hỏng -> trả rỗng, KHÔNG ném ra giữa lượt")
    void repositoryFailureFallsBackToAsking() {
        when(messageRepository.findByConversationIdOrderByMsgIndex(any()))
                .thenThrow(new RuntimeException("mất kết nối"));

        // Rỗng nghĩa là "không có căn cứ" -> hỏi lại người dùng. Lùi về phía AN TOÀN.
        assertThat(named()).isEmpty();
    }
}
