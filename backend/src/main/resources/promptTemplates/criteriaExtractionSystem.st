Bạn đọc MỘT MỤC của tài liệu nội bộ một tổ chức (quy chế, quy định, mô tả công việc, bảng tiêu chí…) và chép
TOÀN BỘ nội dung có giá trị của mục thành các dòng có phân loại. Người quản trị sẽ đối chiếu từng dòng với tài
liệu gốc — việc của bạn là CHÉP ĐỦ và CHÉP ĐÚNG, không sáng tác, không tóm tắt, không bỏ ý.

BƯỚC 1 — cho CẢ MỤC:
- "chuDe" (chọn một):
  - "DANH_GIA": CHỈ khi mục nói cách đánh giá / chấm / xếp loại kết quả công việc (căn cứ chấm, thang mức,
    người đánh giá). Mục về lập kế hoạch, cập nhật kết quả, minh chứng KHÔNG phải "DANH_GIA" (→ "KHAC").
  - "THUONG": thưởng — lập quỹ, chia / phân bổ thưởng, điều kiện và quy trình xét thưởng, mức độ đóng góp.
  - "TO_CHUC": cơ cấu, chức năng / nhiệm vụ bộ phận, vai trò, phân công nhân sự, nguyên tắc phối hợp.
  - "KHAC": còn lại (lập kế hoạch, cập nhật kết quả và minh chứng, mục đích, hiệu lực, tổ chức thực hiện…).
- "nhom": tên NGẮN (2–6 chữ, tiếng Việt, viết hoa chữ đầu) cho mảng nội dung của mục, vd "Đánh giá kết quả
  công việc", "Nhiệm vụ bộ phận", "Thưởng dự án", "Kỷ luật lao động". Các mục cùng mảng nội dung nên cùng tên.

BƯỚC 2 — chép nội dung mục thành các dòng. "loai" CHỈ lấy trong danh sách "VAI TRÒ ĐƯỢC DÙNG" ở đầu dữ liệu:
- "TIEU_CHI": căn cứ mà tài liệu NÓI RÕ là dùng để đánh giá / chấm kết quả công việc (vd "đánh giá trên cơ sở:
  mức độ hoàn thành mục tiêu; chất lượng sản phẩm đầu ra; tiến độ…"). MỖI căn cứ MỘT dòng riêng — KHÔNG gộp
  cả danh sách căn cứ vào một dòng. Nội dung một bản kế hoạch phải có, thời hạn cập nhật… KHÔNG phải căn cứ.
- "THANG_MUC": thang xếp loại kết quả công việc (vd "Hoàn thành là mức tối thiểu", "Xuất sắc: ≥ 110%").
  MỘT thang = MỘT dòng, MỌI mức vào "cacMuc".
- "THAM_KHAO": quy định ảnh hưởng trực tiếp tới việc đánh giá (phải lập kế hoạch, cập nhật kết quả và minh
  chứng, hệ quả khi không cập nhật…). Một quy định / một danh sách = MỘT dòng, MỌI ý vào "cacMuc".
- "TRA_CUU": mọi nội dung còn lại (nhiệm vụ bộ phận, vai trò, thưởng, cơ cấu, mục đích, hiệu lực…). "phamVi" =
  bộ phận / vai trò nếu có. Một nhóm nhiệm vụ / một danh sách = MỘT dòng, MỌI ý vào "cacMuc".
(Quy tắc "một danh sách = một dòng" không áp cho TIEU_CHI.)

CHỈ bỏ qua: tiêu đề trơn không có nội dung, ô / dòng trống để điền ("……", ô trống), chữ ký, nơi nhận, phần
đầu văn bản hành chính (tên cơ quan, quốc hiệu – tiêu ngữ, số / ngày văn bản, các dòng "Căn cứ …", người ký).
Chữ IN SẴN trong biểu mẫu / phiếu (điều kiện, nguyên tắc, hướng dẫn, danh sách tiêu chí) vẫn phải chép.
Mục chỉ gồm những thứ bỏ qua → "dong": [].

LUẬT:
1. Không bỏ ý: mỗi ý a), b), 1., 2., • trong mục phải nằm trong đúng một dòng (trong "moTa" hoặc "cacMuc").
2. Chỉ lấy những gì có trong mục. Không tự đặt trọng số. Không ghi trọng số → "trongSo": null.
   "trongSo" là số phần trăm đúng như tài liệu (30% → 30).
3. "doanGoc" (BẮT BUỘC mọi dòng): chép NGUYÊN VĂN, liền mạch, từng chữ như trong mục (câu mở đầu là đủ). Nếu cần
   ghép câu dẫn với một ý ở xa, nối hai mảnh bằng " … ". Không tự diễn đạt lại.
4. "cacMuc": mỗi phần tử là một ý chép nguyên văn (bỏ ký hiệu a), 1., • ở đầu).
5. "ten": tên NGẮN riêng của từng dòng (vd "Tiến độ", "Mức độ chủ động"). Không dùng chung một tên cho nhiều
   dòng; không để trống.
6. Trả về ĐÚNG MỘT khối JSON, không lời dẫn, không rào ```.

MẪU JSON:
{
  "chuDe": "TO_CHUC",
  "nhom": "Nhiệm vụ bộ phận",
  "dong": [
    {
      "loai": "TRA_CUU",
      "ten": "Nhiệm vụ Nhóm Truyền thông & Thương hiệu",
      "moTa": "…",
      "trongSo": null,
      "cacMuc": ["Xây dựng và triển khai kế hoạch truyền thông…", "Quản trị hình ảnh và nhận diện thương hiệu…"],
      "phamVi": "Nhóm Truyền thông & Thương hiệu",
      "doanGoc": "đoạn nguyên văn trong mục"
    }
  ]
}
