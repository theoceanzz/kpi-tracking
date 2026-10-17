-- V51 — Bật module BSC cho tổ chức demo.
--
-- V44 đã gieo đủ thẻ điểm, chỉ tiêu và kết quả đơn vị cho Demo Company, nhưng không bật cờ
-- `enable_bsc`, nên toàn bộ dữ liệu đó không hiện ở đâu cả: tab BSC, các ô "Bản đồ chiến lược" /
-- "Luồng mục tiêu theo nhánh" biến mất khỏi thư viện biểu đồ, và cột "Đóng góp BSC" của bảng xếp
-- hạng đơn vị để trống. Gieo dữ liệu mà không bật tính năng thì coi như chưa gieo.
--
-- Chỉ bật khi tổ chức đó THẬT SỰ có thẻ điểm — chạy trên một CSDL không có dữ liệu demo thì câu
-- lệnh này không đổi gì.

UPDATE organizations o
   SET enable_bsc = true
 WHERE o.id = '11111111-1111-1111-1111-111111111111'
   AND EXISTS (SELECT 1 FROM bsc_scorecards s WHERE s.organization_id = o.id AND s.deleted_at IS NULL);
