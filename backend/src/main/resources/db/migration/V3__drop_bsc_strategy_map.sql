-- ====================================================
-- GỠ BẢN ĐỒ CHIẾN LƯỢC BSC + DASHBOARD THẺ ĐIỂM
--
-- Hai màn "Dashboard" và "Bản đồ chiến lược" trong Quản lý BSC đã bị bỏ khỏi ứng dụng;
-- toàn bộ code Java và React phục vụ chúng đã xoá. Migration này dọn nốt phần dữ liệu.
--
-- CẢNH BÁO: thao tác này XOÁ VĨNH VIỄN các quan hệ nhân-quả giữa Objective mà người
-- dùng đã vẽ trên bản đồ. Không có đường phục hồi ngoài bản backup DB.
-- ====================================================

-- Quan hệ nhân-quả giữa các Objective — chỉ bản đồ chiến lược đọc/ghi bảng này, không
-- báo cáo hay công thức chấm điểm nào phụ thuộc vào nó.
-- Hai index (idx_bsc_objective_relations_org, uq_bsc_objective_relations) và ràng buộc
-- CHECK bị xoá kèm theo bảng, không cần DROP riêng.
DROP TABLE IF EXISTS bsc_objective_relations;

-- Nhãn sidebar tuỳ chỉnh trỏ tới hai route đã gỡ. Chúng không còn khớp mục nào trong
-- cây nav nên chỉ nằm làm rác — xoá theo khoá, KHÔNG giới hạn theo tổ chức nào, vì mọi
-- tổ chức đều mất hai mục này chứ không riêng dữ liệu mẫu.
DELETE FROM sidebar_settings
WHERE menu_key IN ('/bsc/dashboard', '/bsc/strategy-map');
