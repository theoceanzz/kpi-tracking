package com.kpitracking.service.ai.form;

import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Mô tả một form mà trợ lý được phép đề xuất giá trị điền vào.
 *
 * <p>Đây là bản khai báo phía MÁY CHỦ, không phải thứ client gửi lên. Client chỉ nói "form nào đang
 * mở" và "các ô hiện đang có gì"; còn form đó gồm những trường nào, kiểu gì, giá trị nào hợp lệ thì
 * do đây quyết định. Nếu tin client khai thì một client bị sửa có thể tự bịa ra trường
 * {@code role=ADMIN} rồi nhờ trợ lý điền hộ.
 */
public final class FormSpec {

    private FormSpec() {}

    /** Kiểu của một ô, quyết định cách kiểm giá trị model đề xuất. */
    public enum Kind {
        TEXT,
        NUMBER,
        BOOLEAN,
        /** Chỉ nhận đúng một trong {@code allowedValues}. */
        ENUM,
        /** Ngày, nhận dd/MM/yyyy hoặc yyyy-MM-dd. */
        DATE,
        /** Ô nhận ID thực thể — model nêu TÊN, máy chủ tự tra ra ID và kiểm quyền. */
        ENTITY,
        /** Như ENTITY nhưng nhận nhiều. */
        ENTITY_LIST
    }

    /**
     * @param name         tên ô, phải trùng đúng tên trường trong schema Zod của form
     * @param kind         kiểu, quyết định phép kiểm
     * @param label        nhãn tiếng Việt để hiện trong bản xem trước
     * @param allowedValues với {@link Kind#ENUM}: tập giá trị hợp lệ; các kiểu khác để rỗng
     * @param min          với {@link Kind#NUMBER}: cận dưới, {@code null} là không giới hạn
     * @param max          với {@link Kind#NUMBER}: cận trên
     */
    public record Field(
            String name,
            Kind kind,
            String label,
            List<String> allowedValues,
            /**
             * Nhãn tiếng Việt -> hằng số, đã bỏ dấu và về chữ thường.
             *
             * <p>Đo được: model trả {@code frequency="Hàng tháng"} chứ không phải {@code MONTHLY},
             * bị chặn đúng nhưng rồi KHÔNG tự sửa lại mà bỏ cuộc. Nhận luôn nhãn người dùng nhìn
             * thấy trên giao diện là cách chữa xác định, không phải dặn thêm model.
             */
            Map<String, String> aliases,
            Double min,
            Double max) {

        public static Field text(String name, String label) {
            return new Field(name, Kind.TEXT, label, List.of(), Map.of(), null, null);
        }

        /**
         * Ô chữ có độ dài tối thiểu (vd "lý do" phải từ 10 ký tự).
         *
         * <p>Dùng lại thành phần {@code min} — với {@link Kind#TEXT} nó mang nghĩa SỐ KÝ TỰ, còn với
         * {@link Kind#NUMBER} là cận dưới của giá trị. Không khai ràng buộc này thì một lý do quá
         * ngắn lọt qua backend rồi mới bị form từ chối — đúng cái cảnh "bấm Điền xong mới thấy báo
         * đỏ" mà tính năng này sinh ra để tránh.
         */
        public static Field text(String name, String label, int minLength) {
            return new Field(name, Kind.TEXT, label, List.of(), Map.of(), (double) minLength, null);
        }

        public static Field number(String name, String label, Double min, Double max) {
            return new Field(name, Kind.NUMBER, label, List.of(), Map.of(), min, max);
        }

        public static Field bool(String name, String label) {
            return new Field(name, Kind.BOOLEAN, label, List.of(), Map.of(), null, null);
        }

        /**
         * @param valueToLabel hằng số -> nhãn tiếng Việt hiện trên giao diện. Khai cả hai ở một chỗ
         *                     để danh sách giá trị hợp lệ và bảng nhãn không thể lệch nhau.
         */
        public static Field enumOf(String name, String label, Map<String, String> valueToLabel) {
            Map<String, String> aliases = new LinkedHashMap<>();
            valueToLabel.forEach((value, vi) -> aliases.put(normalize(vi), value));
            return new Field(name, Kind.ENUM, label,
                    List.copyOf(valueToLabel.keySet()), Map.copyOf(aliases), null, null);
        }

        public static Field date(String name, String label) {
            return new Field(name, Kind.DATE, label, List.of(), Map.of(), null, null);
        }

        public static Field entity(String name, String label) {
            return new Field(name, Kind.ENTITY, label, List.of(), Map.of(), null, null);
        }

        public static Field entityList(String name, String label) {
            return new Field(name, Kind.ENTITY_LIST, label, List.of(), Map.of(), null, null);
        }

        /** Hằng số khớp với giá trị model gửi, hoặc {@code null} nếu không nhận ra. */
        public String matchEnum(String raw) {
            if (raw == null) return null;
            String s = raw.trim();
            for (String allowed : allowedValues) {
                if (allowed.equalsIgnoreCase(s)) return allowed;
            }
            return aliases.get(normalize(s));
        }

        /** Bỏ dấu, về chữ thường, gộp khoảng trắng — "Hàng Tháng" và "hang thang" cùng khớp. */
        static String normalize(String s) {
            String noMark = Normalizer.normalize(s, Normalizer.Form.NFD)
                    .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                    .replace('đ', 'd').replace('Đ', 'D');
            return noMark.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        }
    }

    /**
     * @param formId   khớp với id client gửi lên khi form đang mở
     * @param label    tên form, dùng trong prompt và thông báo
     * @param toolName tên {@code @Tool} chuyên trách form này — chỉ tool NÀY được gửi cho model khi
     *                 form đang mở, nên thêm form mới không làm phình bộ tool của các lượt khác
     * @param fields   các ô trợ lý được phép đề xuất; ô không có ở đây thì đề xuất bị từ chối
     */
    public record Descriptor(String formId, String label, String toolName, List<Field> fields) {

        public Field field(String name) {
            if (name == null) return null;
            for (Field f : fields) {
                if (f.name().equals(name)) return f;
            }
            return null;
        }
    }
}
