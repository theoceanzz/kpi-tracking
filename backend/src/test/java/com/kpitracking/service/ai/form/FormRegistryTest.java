package com.kpitracking.service.ai.form;

import com.kpitracking.service.ai.form.FormSpec.Descriptor;
import com.kpitracking.service.ai.form.FormSpec.Field;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Test cho bản khai báo form.
 *
 * <p>Việc quan trọng nhất ở đây là <b>chống lệch</b> với schema Zod bên frontend. Hai nơi cùng mô tả
 * một form: {@code FormRegistry} (thứ trợ lý được phép đề xuất) và {@code kpiSchema.ts} (thứ form
 * thật sự nhận). Lệch nhau thì trợ lý đề xuất được một ô mà form không có, người dùng bấm "Điền" và
 * không có gì xảy ra — hỏng âm thầm, đúng loại lỗi khó truy nhất.
 */
class FormRegistryTest {

    private final FormRegistry registry = new FormRegistry();

    /**
     * formId → file Zod tương ứng, đường dẫn tính từ thư mục backend/ khi chạy Maven.
     *
     * <p>Thêm form mới thì thêm một dòng ở đây; quên thêm sẽ bị
     * {@link #everyFormIsCoveredByTheDriftGuard()} bắt, để không có form nào lặng lẽ thoát khỏi
     * phép đối chiếu.
     */
    private static final Map<String, Path> ZOD_SCHEMAS = Map.of(
            FormRegistry.KPI_FORM,
            Path.of("..", "frontend", "src", "features", "kpi", "schemas", "kpiSchema.ts"),
            FormRegistry.SUBMISSION_FORM,
            Path.of("..", "frontend", "src", "features", "submissions", "schemas", "submissionSchema.ts"),
            FormRegistry.EVALUATION_FORM,
            Path.of("..", "frontend", "src", "features", "evaluations", "schemas", "evaluationSchema.ts"),
            // Ba form dưới khai schema NỘI TUYẾN trong chính file component, không có file schema riêng.
            FormRegistry.KPI_ADJUSTMENT_FORM,
            Path.of("..", "frontend", "src", "features", "kpi", "components", "KpiAdjustmentModal.tsx"),
            FormRegistry.ORG_UNIT_FORM,
            Path.of("..", "frontend", "src", "features", "orgunits", "schemas", "orgUnitSchema.ts"),
            FormRegistry.ORG_UNIT_DRAWER_FORM,
            Path.of("..", "frontend", "src", "features", "organization", "components", "OrgUnitDrawer.tsx"));

    @Test
    @DisplayName("MỌI ô khai báo của MỌI form phải CÓ THẬT trong schema Zod tương ứng")
    void everyDeclaredFieldExistsInZodSchema() throws IOException {
        for (Descriptor d : registry.all()) {
            Path schema = ZOD_SCHEMAS.get(d.formId());
            Assumptions.assumeTrue(Files.exists(schema),
                    "Không thấy " + schema + " (chạy ngoài repo đầy đủ) — bỏ qua phép đối chiếu");

            Set<String> zodFields = parseZodFieldNames(Files.readString(schema));
            assertThat(zodFields).as("không bóc được tên trường nào từ %s -> phép so vô nghĩa", schema)
                    .isNotEmpty();

            assertThat(d.fields()).extracting(Field::name)
                    .as("ô khai báo ở FormRegistry cho '%s' nhưng form không có -> "
                            + "người dùng bấm Điền và không có gì xảy ra", d.formId())
                    .allSatisfy(name -> assertThat(zodFields).contains(name));
        }
    }

    @Test
    @DisplayName("mỗi form khai báo đều phải có file Zod để đối chiếu — không form nào thoát chốt chặn")
    void everyFormIsCoveredByTheDriftGuard() {
        assertThat(registry.all()).extracting(Descriptor::formId)
                .allSatisfy(id -> assertThat(ZOD_SCHEMAS).containsKey(id));
    }

    @Test
    @DisplayName("các ô nhạy cảm / quan hệ nội bộ cố ý KHÔNG được khai báo")
    void sensitiveAndRelationalFieldsAreNotFillable() {
        Descriptor kpi = registry.find(FormRegistry.KPI_FORM);
        assertThat(kpi.fields()).extracting(Field::name)
                .as("các ô này chỉ có nghĩa trong luồng thao tác bằng chuột, đề xuất bằng lời gần như luôn sai")
                .doesNotContain("parentId", "parentRelationType", "keyResultId", "perspectiveId");
    }

    @Test
    @DisplayName("form đánh giá KHÔNG khai người bị đánh giá — ô đó ẩn hoàn toàn")
    void evaluationFormCannotRetargetThePerson() {
        // userId là <input type="hidden"> đặt sẵn bằng chính người đang đăng nhập, KHÔNG BAO GIỜ
        // hiện ra màn hình. Khai nó ra là một câu tiếng Việt chuyển được bài đánh giá sang người
        // khác, mà onSubmit thì đẩy thẳng data đi — người dùng không có chỗ nào để phát hiện.
        Descriptor evaluation = registry.find(FormRegistry.EVALUATION_FORM);
        assertThat(evaluation.fields()).extracting(Field::name)
                .as("điểm đánh giá của ai là thứ người dùng phải tự quyết bằng chuột")
                .doesNotContain("userId");
    }

    @Test
    @DisplayName("form báo cáo KHÔNG khai hai ô ngày — schema Zod có nhưng màn hình không vẽ ô nào")
    void submissionFormDoesNotDeclareDeadDateFields() {
        // Phép đối chiếu ở trên chỉ so MỘT CHIỀU (ô khai ⊆ schema Zod) nên nó không bắt được ca
        // này: periodStart/periodEnd nằm trong submissionSchema.ts nhưng NewSubmissionPage chưa bao
        // giờ vẽ ô nhập cho chúng. Khai ở FormRegistry thì TurnPromptBuilder.formBlock liệt kê
        // "Từ ngày, Đến ngày" vào danh sách ô điền được, và trợ lý đi hỏi người dùng hai cái ngày
        // họ không có chỗ nào để nhập.
        Descriptor submission = registry.find(FormRegistry.SUBMISSION_FORM);
        assertThat(submission.fields()).extracting(Field::name)
                .as("không có ô nhập nào trên màn hình cho hai trường này")
                .doesNotContain("periodStart", "periodEnd");
    }

    @Test
    @DisplayName("ô ENUM phải nêu đủ giá trị hợp lệ, nếu không phép kiểm sẽ chặn nhầm giá trị đúng")
    void enumFieldsDeclareTheirValues() {
        Descriptor kpi = registry.find(FormRegistry.KPI_FORM);
        assertThat(kpi.field("kpiType").allowedValues())
                .containsExactlyInAnyOrder("QUANTITATIVE", "QUALITATIVE");
        assertThat(kpi.field("frequency").allowedValues())
                .containsExactlyInAnyOrder("DAILY", "WEEKLY", "MONTHLY", "QUARTERLY",
                        "SEMI_ANNUALLY", "YEARLY", "UNLIMITED");
    }

    @Test
    @DisplayName("formId lạ trả null chứ không ném — client cũ gửi tên form đã bỏ vẫn phải chat được")
    void unknownFormIdIsNull() {
        assertThat(registry.find("form_khong_co_that")).isNull();
        assertThat(registry.find(null)).isNull();
        assertThat(registry.toolNameFor("form_khong_co_that")).isNull();
    }

    @Test
    @DisplayName("mỗi form trỏ tới đúng một tool và mọi tên ô là duy nhất")
    void descriptorsAreWellFormed() {
        for (Descriptor d : registry.all()) {
            assertThat(d.toolName()).isNotBlank();
            List<String> names = d.fields().stream().map(Field::name).toList();
            assertThat(new LinkedHashSet<>(names)).as("trùng tên ô trong %s", d.formId()).hasSize(names.size());
        }
    }

    /** Bóc tên trường ở cấp một của {@code z.object({...})}. */
    private Set<String> parseZodFieldNames(String source) {
        Set<String> names = new LinkedHashSet<>();
        Matcher m = Pattern.compile("^\\s{2}([a-zA-Z][a-zA-Z0-9_]*):\\s*z\\.", Pattern.MULTILINE).matcher(source);
        while (m.find()) names.add(m.group(1));
        return names;
    }
}
