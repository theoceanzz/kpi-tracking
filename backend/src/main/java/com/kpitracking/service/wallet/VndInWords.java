package com.kpitracking.service.wallet;

/**
 * Đọc số tiền VNĐ thành chữ.
 *
 * <p>"Số tiền viết bằng chữ" là một trong các nội dung BẮT BUỘC của chứng từ thu tiền theo Điều 10
 * Nghị định 123/2020/NĐ-CP. Nó tồn tại để chống sửa chữ số sau khi lập, nên phải sinh từ đúng con
 * số đã ghi trên chứng từ chứ không nhập tay.
 *
 * <p>Quy ước đọc theo cách phổ biến ở chứng từ kế toán Việt Nam:
 * <ul>
 *   <li>Hàng chục là 0 nhưng còn hàng đơn vị ⇒ "lẻ" (105 = "một trăm lẻ năm").</li>
 *   <li>Hàng đơn vị là 1 sau hàng chục từ 2 trở lên ⇒ "mốt" (21 = "hai mươi mốt").</li>
 *   <li>Hàng đơn vị là 5 sau hàng chục từ 1 trở lên ⇒ "lăm" (15 = "mười lăm").</li>
 *   <li>Hàng chục là 1 ⇒ "mười", không phải "một mươi".</li>
 *   <li>Nhóm ba chữ số ở GIỮA mà bằng 0 vẫn phải đọc "không trăm" (1.000.500 = "một triệu không
 *       trăm nghìn năm trăm") — bỏ đi thì "một triệu năm trăm" đọc thành 1.000.500 hay 1.500.000
 *       đều được, đúng thứ mà chữ viết sinh ra để loại trừ.</li>
 * </ul>
 */
public final class VndInWords {

    private VndInWords() {}

    private static final String[] DIGITS = {
            "không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"
    };

    /** Tên các nhóm ba chữ số, từ nhóm thấp nhất lên. Đủ tới nghìn tỉ — quá tầm mọi khoản nạp ví. */
    private static final String[] SCALES = {"", " nghìn", " triệu", " tỉ", " nghìn tỉ", " triệu tỉ"};

    /**
     * @return ví dụ {@code "Một triệu hai trăm nghìn đồng"}. Số âm được đọc kèm chữ "Âm" ở đầu —
     *         biên nhận không dùng tới, nhưng trả về chuỗi rỗng cho một con số hợp lệ thì tệ hơn.
     */
    public static String convert(long amount) {
        if (amount == 0) return "Không đồng";

        String sign = amount < 0 ? "Âm " : "";
        long value = Math.abs(amount);

        // Cắt thành các nhóm ba chữ số, nhóm thấp nhất đứng đầu mảng.
        java.util.List<Integer> groups = new java.util.ArrayList<>();
        while (value > 0) {
            groups.add((int) (value % 1000));
            value /= 1000;
        }

        StringBuilder sb = new StringBuilder();
        for (int i = groups.size() - 1; i >= 0; i--) {
            int group = groups.get(i);
            // Nhóm 0 ở giữa vẫn đọc "không trăm"; nhóm 0 ở cuối cùng thì bỏ hẳn.
            if (group == 0 && i != groups.size() - 1) {
                boolean anyLower = false;
                for (int j = i - 1; j >= 0; j--) {
                    if (groups.get(j) != 0) { anyLower = true; break; }
                }
                if (!anyLower) continue;
            }
            if (!sb.isEmpty()) sb.append(' ');
            sb.append(readGroup(group, i != groups.size() - 1)).append(SCALES[i]);
        }

        String text = sign + sb;
        return Character.toUpperCase(text.charAt(0)) + text.substring(1) + " đồng";
    }

    /**
     * Đọc một nhóm ba chữ số.
     *
     * @param full nhóm này KHÔNG phải nhóm cao nhất ⇒ phải đọc đủ cả "không trăm" khi trăm bằng 0
     */
    private static String readGroup(int group, boolean full) {
        int hundreds = group / 100;
        int tens = (group / 10) % 10;
        int units = group % 10;

        StringBuilder sb = new StringBuilder();

        if (hundreds > 0 || full) {
            sb.append(DIGITS[hundreds]).append(" trăm");
        }

        if (tens == 0) {
            if (units > 0 && !sb.isEmpty()) sb.append(" lẻ");
            if (units > 0) sb.append(sb.isEmpty() ? "" : " ").append(DIGITS[units]);
        } else if (tens == 1) {
            sb.append(sb.isEmpty() ? "" : " ").append("mười");
            if (units == 5) sb.append(" lăm");
            else if (units > 0) sb.append(' ').append(DIGITS[units]);
        } else {
            sb.append(sb.isEmpty() ? "" : " ").append(DIGITS[tens]).append(" mươi");
            if (units == 1) sb.append(" mốt");
            else if (units == 4) sb.append(" tư");
            else if (units == 5) sb.append(" lăm");
            else if (units > 0) sb.append(' ').append(DIGITS[units]);
        }

        return sb.toString();
    }
}
