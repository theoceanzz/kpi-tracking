-- Đề xuất đi kèm một lần gửi duyệt, cho các đối tượng mà CHƯA có bản ghi thật cho tới khi duyệt xong:
-- đánh giá đợt của quản lý (điểm, nhận xét) và yêu cầu chốt kỳ của một đơn vị (nhận xét, cách xử lý
-- đợt dở khi khoá kỳ). Bước cuối duyệt xong mới chạy đúng thao tác cũ với nội dung này, nên mọi chỗ
-- đọc bảng evaluations / cycle_unit_evaluations không phải biết tới trạng thái "chờ duyệt".

ALTER TABLE kpi_approval_flows ADD COLUMN IF NOT EXISTS payload JSONB;

COMMENT ON COLUMN kpi_approval_flows.payload IS 'Nội dung đề xuất chờ duyệt (EVALUATION, CYCLE_FINALIZE); áp vào lúc duyệt cuối.';
COMMENT ON COLUMN kpi_approval_flows.subject_type IS 'CRITERIA | ADJUSTMENT | SUBMISSION | EVALUATION | CYCLE_FINALIZE';
