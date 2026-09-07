-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- V4 — DỮ LIỆU MẪU CHO CÁC BIỂU ĐỒ THỐNG KÊ CHUYÊN SÂU
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- ⚠️  TUYỆT ĐỐI KHÔNG SỬA V1/V2/V3.
--     FlywayConfig.java gọi flyway.clean() khi validate() thất bại. Sửa một ký tự trong các file
--     migration đã chạy làm lệch checksum ⇒ validate fail ⇒ XOÁ SẠCH DATABASE ở lần khởi động kế
--     tiếp (và clean-disabled: false ở cả application-prod.yaml). Mọi điều chỉnh dữ liệu đã seed
--     phải viết thành UPDATE trong file mới, không chỉnh tại chỗ.
--
-- ⚠️  Flyway chạy TRƯỚC Hibernate ddl-auto=update, nên file này KHÔNG được tham chiếu những thứ
--     chỉ tồn tại ở tầng entity: kpi_criteria.expected_submissions, kpi_submissions.manager_score,
--     bảng kpi_adjustment_requests. (Riêng cycle_unit_evaluations.manager_score CÓ trong V1.)
--
-- VÌ SAO CẦN FILE NÀY
-- V2 seed đủ để chạy nghiệp vụ nhưng 6 bảng vẫn trống hoàn toàn, làm 6 biểu đồ mới không có gì để
-- vẽ: kpi_cycles, cycle_unit_evaluations, cycle_user_evaluations, key_result_unit_weights,
-- bsc_weight_history, và kpi_criteria.parent_id. Thêm ba lỗ hổng nữa: chỉ có 3 kỳ (T4-T6/2026) nên
-- biểu đồ xu hướng chỉ có 3 mốc; 36 đánh giá của "Demo Education" bỏ trống điểm hành vi và xếp
-- loại ma trận; và không chỉ tiêu nào thuộc viễn cảnh Tài chính nên bong bóng/thác nước BSC luôn
-- thiếu một trong bốn hạng mục.
--
-- KHÁC V2 Ở MỘT ĐIỂM: mọi khối dưới đây ĐỀU idempotent (ON CONFLICT DO NOTHING / WHERE NOT EXISTS).
-- Khối Demo Company của V2 chạy lại sẽ vỡ khoá chính; file này chạy lại bao nhiêu lần cũng được.
--
-- Quy ước UUID mới, không đụng dải nào V2 đã dùng:
--   44444444-…  kỳ và chu kỳ (đuôi mang luôn năm-tháng cho dễ đọc: …000000202507 = T7/2025)
--   55555555-…  chỉ tiêu viết tay (phân rã, vòng đời, tài chính, định tính)
--   Dữ liệu sinh theo lô dùng md5(...)::uuid — tất định, chạy lại ra đúng cùng bộ id, không random().
-- ═══════════════════════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. MỞ RỘNG 3 KỲ THÀNH 12 THÁNG LIÊN TỤC (org "Demo Company")
-- ═══════════════════════════════════════════════════════════════════════════
-- Thêm T7/2025 → T3/2026, nối liền T4-T6/2026 đã có ⇒ 12 tháng liên tục.
-- Chọn LÙI VỀ QUÁ KHỨ thay vì tiến tới tương lai: biểu đồ xu hướng cần dữ liệu đã xảy ra, và một
-- kỳ chưa tới hạn mà đã có điểm đánh giá là thứ không tồn tại trong thực tế.

INSERT INTO kpi_periods (id, organization_id, name, period_type, start_date, end_date, notification_date)
SELECT
    ('44444444-0000-0000-0000-0000' || to_char(d, 'YYYYMM') || '00')::uuid,
    '11111111-1111-1111-1111-111111111111',
    'Tháng ' || to_char(d, 'FMMM') || '/' || to_char(d, 'YYYY'),
    'MONTHLY',
    d,
    (d + INTERVAL '1 month' - INTERVAL '1 second'),
    (d + INTERVAL '14 days')
FROM generate_series(
        '2025-07-01 00:00:00+07'::timestamptz,
        '2026-03-01 00:00:00+07'::timestamptz,
        INTERVAL '1 month') AS d
ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. CHỈ TIÊU CHO 9 KỲ MỚI
-- ═══════════════════════════════════════════════════════════════════════════
-- 6 đơn vị cấp Phòng/Nhóm × 2 chỉ tiêu × 9 kỳ = 108 chỉ tiêu, sinh theo lô để file gọn.
-- id = md5(kỳ ‖ đơn vị ‖ tên) nên tất định: chạy lại không sinh bản trùng, và ảnh chụp màn hình
-- trong tài liệu vẫn khớp dữ liệu.
--
-- Trọng số 50/50 cho mỗi đơn vị (tổng 100) — giữ đúng quy ước V2 để bản đồ trọng số (treemap) đọc
-- được tỉ trọng thật thay vì tổng vượt 100.

INSERT INTO kpi_criteria
    (id, org_unit_id, kpi_period_id, name, description, weight, frequency, status,
     created_by, approved_by, submitted_at, approved_at)
SELECT
    md5(p.id::text || u.unit_id || t.kpi_name)::uuid,
    u.unit_id::uuid,
    p.id,
    t.kpi_name,
    t.descr,
    50,
    'MONTHLY',
    'APPROVED',
    u.head_id::uuid,
    u.head_id::uuid,
    p.start_date,
    p.start_date + INTERVAL '2 days'
FROM kpi_periods p
CROSS JOIN (VALUES
    -- đơn vị,                                  trưởng đơn vị (created_by/approved_by)
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-0000-0000-0000-000000000101'),  -- Phòng IT
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-0000-0000-0000-000000000300'),  -- Team Backend
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-0000-0000-0000-000000000400'),  -- Team Frontend
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-0000-0000-0000-000000000500'),  -- Phòng Truyền Thông
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-0000-0000-0000-000000000600'),  -- Team Content
    ('abcdefab-cdef-cdef-cdef-abcdefabcdef', '22222222-0000-0000-0000-000000000700')   -- Team Design
) AS u(unit_id, head_id)
CROSS JOIN (VALUES
    ('Số task hoàn thành',  'Số lượng công việc đóng trong tháng'),
    ('Chất lượng bàn giao', 'Tỉ lệ hạng mục bàn giao không phải làm lại')
) AS t(kpi_name, descr)
WHERE p.organization_id = '11111111-1111-1111-1111-111111111111'
  AND p.start_date < '2026-04-01 00:00:00+07'   -- chỉ 9 kỳ mới, không đụng T4-T6 đã có chỉ tiêu
ON CONFLICT (id) DO NOTHING;

INSERT INTO quantitative_kpi_details (kpi_criteria_id, target_value, minimum_value, unit)
SELECT k.id,
       CASE WHEN k.name = 'Số task hoàn thành' THEN 50 ELSE 95 END,
       CASE WHEN k.name = 'Số task hoàn thành' THEN 35 ELSE 80 END,
       CASE WHEN k.name = 'Số task hoàn thành' THEN 'task' ELSE '%' END
FROM kpi_criteria k
JOIN kpi_periods p ON p.id = k.kpi_period_id
WHERE p.organization_id = '11111111-1111-1111-1111-111111111111'
  AND p.start_date < '2026-04-01 00:00:00+07'
  AND k.name IN ('Số task hoàn thành', 'Chất lượng bàn giao')
ON CONFLICT (kpi_criteria_id) DO NOTHING;

-- Giao chỉ tiêu cho toàn bộ nhân sự của đơn vị sở hữu.
INSERT INTO kpi_criteria_assignees (kpi_criteria_id, user_id)
SELECT k.id, uro.user_id
FROM kpi_criteria k
JOIN kpi_periods p ON p.id = k.kpi_period_id
JOIN user_role_org_units uro ON uro.org_unit_id = k.org_unit_id
WHERE p.organization_id = '11111111-1111-1111-1111-111111111111'
  AND p.start_date < '2026-04-01 00:00:00+07'
  AND k.name IN ('Số task hoàn thành', 'Chất lượng bàn giao')
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. CHỈ TIÊU PHÂN RÃ / UỶ QUYỀN 3 TẦNG  → mở khoá Sankey phân rã KPI
-- ═══════════════════════════════════════════════════════════════════════════
-- Chuỗi đi đúng theo cây tổ chức:
--
--   Chi nhánh Hà Nội ──DECOMPOSITION──▶ Phòng IT           ──DELEGATION──▶ Team Backend
--                                                          ──DELEGATION──▶ Team Frontend
--                    ──DECOMPOSITION──▶ Phòng Truyền Thông ──DELEGATION──▶ Team Content
--                                                          ──DELEGATION──▶ Team Design
--
-- Trọng số con cộng lại bằng trọng số cha (60 = 30+30, 40 = 20+20). Nếu để lệch thì độ dày dải
-- Sankey sẽ nói dối về tỉ lệ phân bổ — mà đó chính là thứ duy nhất biểu đồ này dùng để kể chuyện.

INSERT INTO kpi_criteria
    (id, org_unit_id, kpi_period_id, name, description, weight, frequency, status,
     parent_id, parent_relation_type, created_by, approved_by, submitted_at, approved_at)
VALUES
    -- Tầng 1 — mục tiêu của cả chi nhánh
    ('55555555-1000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     '33333333-0000-0000-0000-000000000106', 'Nâng mức hài lòng khách hàng toàn chi nhánh',
     'Chỉ tiêu gốc, phân rã xuống hai phòng', 100, 'MONTHLY', 'APPROVED',
     NULL, NULL, '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100',
     '2026-06-01 08:00:00+07', '2026-06-02 09:00:00+07'),

    -- Tầng 2 — phân rã xuống phòng
    ('55555555-2000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     '33333333-0000-0000-0000-000000000106', 'Giảm thời gian phản hồi sự cố hệ thống',
     'Phần Phòng IT nhận từ chỉ tiêu chi nhánh', 60, 'MONTHLY', 'APPROVED',
     '55555555-1000-0000-0000-000000000001', 'DECOMPOSITION',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100',
     '2026-06-01 08:30:00+07', '2026-06-02 09:00:00+07'),
    ('55555555-2000-0000-0000-000000000002', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
     '33333333-0000-0000-0000-000000000106', 'Tăng tương tác trên kênh chính thức',
     'Phần Phòng Truyền Thông nhận từ chỉ tiêu chi nhánh', 40, 'MONTHLY', 'APPROVED',
     '55555555-1000-0000-0000-000000000001', 'DECOMPOSITION',
     '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100',
     '2026-06-01 08:30:00+07', '2026-06-02 09:00:00+07'),

    -- Tầng 3 — uỷ quyền xuống nhóm
    ('55555555-3000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd',
     '33333333-0000-0000-0000-000000000106', 'Rút ngắn thời gian xử lý lỗi backend',
     'Team Backend nhận uỷ quyền từ Phòng IT', 30, 'MONTHLY', 'APPROVED',
     '55555555-2000-0000-0000-000000000001', 'DELEGATION',
     '22222222-0000-0000-0000-000000000101', '22222222-0000-0000-0000-000000000101',
     '2026-06-01 09:00:00+07', '2026-06-02 10:00:00+07'),
    ('55555555-3000-0000-0000-000000000002', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
     '33333333-0000-0000-0000-000000000106', 'Giảm lỗi hiển thị trên giao diện',
     'Team Frontend nhận uỷ quyền từ Phòng IT', 30, 'MONTHLY', 'APPROVED',
     '55555555-2000-0000-0000-000000000001', 'DELEGATION',
     '22222222-0000-0000-0000-000000000101', '22222222-0000-0000-0000-000000000101',
     '2026-06-01 09:00:00+07', '2026-06-02 10:00:00+07'),
    ('55555555-3000-0000-0000-000000000003', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
     '33333333-0000-0000-0000-000000000106', 'Tăng lượt đọc bài viết chuyên môn',
     'Team Content nhận uỷ quyền từ Phòng Truyền Thông', 20, 'MONTHLY', 'APPROVED',
     '55555555-2000-0000-0000-000000000002', 'DELEGATION',
     '22222222-0000-0000-0000-000000000500', '22222222-0000-0000-0000-000000000500',
     '2026-06-01 09:00:00+07', '2026-06-02 10:00:00+07'),
    ('55555555-3000-0000-0000-000000000004', 'abcdefab-cdef-cdef-cdef-abcdefabcdef',
     '33333333-0000-0000-0000-000000000106', 'Chuẩn hoá bộ nhận diện trên ấn phẩm',
     'Team Design nhận uỷ quyền từ Phòng Truyền Thông', 20, 'MONTHLY', 'APPROVED',
     '55555555-2000-0000-0000-000000000002', 'DELEGATION',
     '22222222-0000-0000-0000-000000000500', '22222222-0000-0000-0000-000000000500',
     '2026-06-01 09:00:00+07', '2026-06-02 10:00:00+07')
ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. CHỈ TIÊU ĐỦ 8 TRẠNG THÁI VÒNG ĐỜI  → mở khoá Sankey vòng đời KPI
-- ═══════════════════════════════════════════════════════════════════════════
-- V2 chỉ có đúng một trạng thái APPROVED, nên Sankey vòng đời hiện ra một dải duy nhất.
-- Số lượng mỗi nhánh dưới đây cố ý KHÁC nhau: có nhánh 3 chỉ tiêu, có nhánh 1 — để nhìn vào là
-- thấy ngay nhánh nào đang là ngõ cụt, thay vì bốn dải bằng nhau chẳng nói lên điều gì.

INSERT INTO kpi_criteria
    (id, org_unit_id, kpi_period_id, name, description, weight, frequency, status,
     reject_reason, replaced_by_id, replacement_reason,
     created_by, approved_by, submitted_at, approved_at)
VALUES
    -- Nháp: soạn xong nhưng chưa gửi duyệt (3 chỉ tiêu — nhánh dày nhất)
    ('55555555-4000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd',
     '33333333-0000-0000-0000-000000000106', 'Áp dụng kiểm thử tự động cho module thanh toán',
     'Đang soạn, chưa gửi duyệt', 10, 'MONTHLY', 'DRAFT',
     NULL, NULL, NULL, '22222222-0000-0000-0000-000000000300', NULL, NULL, NULL),
    ('55555555-4000-0000-0000-000000000002', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
     '33333333-0000-0000-0000-000000000106', 'Chuyển sang hệ thống thiết kế dùng chung',
     'Đang soạn, chưa gửi duyệt', 10, 'MONTHLY', 'DRAFT',
     NULL, NULL, NULL, '22222222-0000-0000-0000-000000000400', NULL, NULL, NULL),
    ('55555555-4000-0000-0000-000000000003', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
     '33333333-0000-0000-0000-000000000106', 'Xây dựng thư viện ảnh nội bộ',
     'Đang soạn, chưa gửi duyệt', 10, 'MONTHLY', 'DRAFT',
     NULL, NULL, NULL, '22222222-0000-0000-0000-000000000600', NULL, NULL, NULL),

    -- Chờ duyệt: đã gửi, đang tồn đọng ở cấp trên (2 chỉ tiêu)
    ('55555555-5000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd',
     '33333333-0000-0000-0000-000000000106', 'Giảm thời gian khởi động dịch vụ',
     'Đã gửi duyệt, đang chờ Phòng IT xét', 10, 'MONTHLY', 'PENDING_APPROVAL',
     NULL, NULL, NULL, '22222222-0000-0000-0000-000000000300', NULL,
     '2026-06-10 10:00:00+07', NULL),
    ('55555555-5000-0000-0000-000000000002', 'abcdefab-cdef-cdef-cdef-abcdefabcdef',
     '33333333-0000-0000-0000-000000000106', 'Rút ngắn vòng phản hồi thiết kế',
     'Đã gửi duyệt, đang chờ Phòng Truyền Thông xét', 10, 'MONTHLY', 'PENDING_APPROVAL',
     NULL, NULL, NULL, '22222222-0000-0000-0000-000000000700', NULL,
     '2026-06-11 14:00:00+07', NULL),

    -- Bị từ chối (1 chỉ tiêu) — kèm lý do thật để màn hình chi tiết có nội dung
    ('55555555-6000-0000-0000-000000000001', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
     '33333333-0000-0000-0000-000000000106', 'Viết lại toàn bộ giao diện quản trị',
     'Bị từ chối vì phạm vi quá lớn cho một tháng', 10, 'MONTHLY', 'REJECTED',
     'Phạm vi vượt quá một kỳ tháng. Hãy tách thành các mốc nhỏ theo từng màn hình rồi gửi lại.',
     NULL, NULL, '22222222-0000-0000-0000-000000000400', NULL,
     '2026-06-05 09:00:00+07', NULL),

    -- Đang chỉnh sửa sau khi đã duyệt (1) và đã chỉnh xong (1)
    ('55555555-7000-0000-0000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
     '33333333-0000-0000-0000-000000000106', 'Tăng số bài phỏng vấn chuyên gia',
     'Đang mở lại để chỉnh mục tiêu', 10, 'MONTHLY', 'EDIT',
     NULL, NULL, NULL, '22222222-0000-0000-0000-000000000600',
     '22222222-0000-0000-0000-000000000500', '2026-06-03 09:00:00+07', '2026-06-04 09:00:00+07'),
    ('55555555-7000-0000-0000-000000000002', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
     '33333333-0000-0000-0000-000000000106', 'Tăng số bản tin gửi hàng tuần',
     'Đã chỉnh xong mục tiêu', 10, 'MONTHLY', 'EDITED',
     NULL, NULL, NULL, '22222222-0000-0000-0000-000000000600',
     '22222222-0000-0000-0000-000000000500', '2026-06-03 09:00:00+07', '2026-06-04 09:00:00+07'),

    -- Ngừng theo dõi (1)
    ('55555555-8000-0000-0000-000000000001', 'abcdefab-cdef-cdef-cdef-abcdefabcdef',
     '33333333-0000-0000-0000-000000000106', 'Thiết kế ấn phẩm cho hội chợ đã hoãn',
     'Ngừng theo dõi do sự kiện bị hoãn', 10, 'MONTHLY', 'INACTIVE',
     NULL, NULL, NULL, '22222222-0000-0000-0000-000000000700',
     '22222222-0000-0000-0000-000000000500', '2026-06-02 09:00:00+07', '2026-06-03 09:00:00+07'),

    -- Chuỗi thay thế: bản mới trước (để khoá ngoại của bản cũ trỏ tới được), rồi bản bị thay
    ('55555555-9000-0000-0000-000000000002', 'dddddddd-dddd-dddd-dddd-dddddddddddd',
     '33333333-0000-0000-0000-000000000106', 'Tỉ lệ bao phủ kiểm thử (bản thay thế)',
     'Bản thay thế cho chỉ tiêu đo bằng số dòng code', 10, 'MONTHLY', 'APPROVED',
     NULL, NULL, NULL, '22222222-0000-0000-0000-000000000300',
     '22222222-0000-0000-0000-000000000101', '2026-06-08 09:00:00+07', '2026-06-09 09:00:00+07'),
    ('55555555-9000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd',
     '33333333-0000-0000-0000-000000000106', 'Số dòng code kiểm thử',
     'Đã bị thay thế bằng chỉ tiêu đo bao phủ', 10, 'MONTHLY', 'REPLACED',
     NULL, '55555555-9000-0000-0000-000000000002',
     'Đo bằng số dòng khuyến khích viết dài chứ không khuyến khích kiểm thử đúng chỗ. Chuyển sang đo tỉ lệ bao phủ.',
     '22222222-0000-0000-0000-000000000300', '22222222-0000-0000-0000-000000000101',
     '2026-06-01 09:00:00+07', '2026-06-02 09:00:00+07')
ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. CHỈ TIÊU TÀI CHÍNH, THƯỞNG, NGƯỢC, ĐỊNH TÍNH
-- ═══════════════════════════════════════════════════════════════════════════
-- V2 ghi rõ ở phần 18.5: viễn cảnh Tài chính rỗng vì dữ liệu mẫu không có chỉ tiêu tài chính nào,
-- và chỗ đặt sạch nhất là `Chi nhánh Hà Nội` / `Khoa Công nghệ thông tin` — hai đơn vị chưa có chỉ
-- tiêu nào nên trọng số bắt đầu từ 0, không phá tổng 100 của đơn vị khác. Làm đúng theo hướng đó
-- thay vì nhồi chỉ tiêu năng suất vào Tài chính cho biểu đồ đủ bốn hạng mục.

INSERT INTO kpi_criteria
    (id, org_unit_id, kpi_period_id, name, description, weight, frequency, status, kpi_type,
     is_bonus_kpi, created_by, approved_by, submitted_at, approved_at)
SELECT
    md5('fin' || p.id::text || t.kpi_name)::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    p.id, t.kpi_name, t.descr, t.w, 'MONTHLY', 'APPROVED', 'QUANTITATIVE',
    t.bonus, '22222222-0000-0000-0000-000000000100', '22222222-0000-0000-0000-000000000100',
    p.start_date, p.start_date + INTERVAL '2 days'
FROM kpi_periods p
CROSS JOIN (VALUES
    ('Doanh thu dịch vụ trong tháng', 'Tổng doanh thu ghi nhận từ hợp đồng dịch vụ', 40, FALSE),
    ('Chi phí vận hành hạ tầng',      'Chi phí máy chủ và dịch vụ đám mây',           30, FALSE),
    ('Doanh thu vượt kế hoạch',       'Phần doanh thu vượt mức cam kết — chỉ tiêu thưởng', 30, TRUE)
) AS t(kpi_name, descr, w, bonus)
WHERE p.organization_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (id) DO NOTHING;

INSERT INTO quantitative_kpi_details (kpi_criteria_id, target_value, minimum_value, unit, is_reverse_kpi)
SELECT k.id,
       CASE k.name WHEN 'Doanh thu dịch vụ trong tháng' THEN 1200
                   WHEN 'Chi phí vận hành hạ tầng'      THEN 180
                   ELSE 150 END,
       CASE k.name WHEN 'Doanh thu dịch vụ trong tháng' THEN 900
                   WHEN 'Chi phí vận hành hạ tầng'      THEN 260
                   ELSE 0 END,
       'triệu đồng',
       -- Chi phí là chỉ tiêu NGƯỢC: càng thấp càng tốt. Đặt cờ đúng ngay từ đầu, vì Bullet dùng nó
       -- để đảo chiều tỉ lệ đạt — thiếu cờ thì đơn vị tiết kiệm được chi phí lại bị vẽ như đang kém.
       (k.name = 'Chi phí vận hành hạ tầng')
FROM kpi_criteria k
JOIN kpi_periods p ON p.id = k.kpi_period_id
WHERE p.organization_id = '11111111-1111-1111-1111-111111111111'
  AND k.name IN ('Doanh thu dịch vụ trong tháng', 'Chi phí vận hành hạ tầng', 'Doanh thu vượt kế hoạch')
ON CONFLICT (kpi_criteria_id) DO NOTHING;

INSERT INTO kpi_criteria_assignees (kpi_criteria_id, user_id)
SELECT k.id, uro.user_id
FROM kpi_criteria k
JOIN kpi_periods p ON p.id = k.kpi_period_id
JOIN user_role_org_units uro ON uro.org_unit_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
WHERE p.organization_id = '11111111-1111-1111-1111-111111111111'
  AND k.name IN ('Doanh thu dịch vụ trong tháng', 'Chi phí vận hành hạ tầng', 'Doanh thu vượt kế hoạch')
ON CONFLICT DO NOTHING;

-- Chỉ tiêu ĐỊNH TÍNH — bảng qualitative_kpi_details đang 0 dòng, nên biểu đồ phân bố mức định tính
-- trong ba drawer chưa từng có gì để vẽ.
INSERT INTO kpi_criteria
    (id, org_unit_id, kpi_period_id, name, description, weight, frequency, status, kpi_type,
     created_by, approved_by, submitted_at, approved_at)
SELECT
    md5('qual' || p.id::text || u.unit_id)::uuid,
    u.unit_id::uuid, p.id,
    'Tinh thần phối hợp trong nhóm',
    'Đánh giá định tính theo thang mức của tổ chức',
    0, 'MONTHLY', 'APPROVED', 'QUALITATIVE',
    u.head_id::uuid, u.head_id::uuid, p.start_date, p.start_date + INTERVAL '2 days'
FROM kpi_periods p
CROSS JOIN (VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-0000-0000-0000-000000000300'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-0000-0000-0000-000000000400'),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-0000-0000-0000-000000000600')
) AS u(unit_id, head_id)
WHERE p.organization_id = '11111111-1111-1111-1111-111111111111'
  AND p.start_date >= '2026-04-01 00:00:00+07'   -- 3 kỳ gần nhất là đủ để thấy phân bố
ON CONFLICT (id) DO NOTHING;

INSERT INTO qualitative_kpi_details (kpi_criteria_id)
SELECT k.id FROM kpi_criteria k
WHERE k.name = 'Tinh thần phối hợp trong nhóm'
ON CONFLICT (kpi_criteria_id) DO NOTHING;

INSERT INTO kpi_criteria_assignees (kpi_criteria_id, user_id)
SELECT k.id, uro.user_id
FROM kpi_criteria k
JOIN user_role_org_units uro ON uro.org_unit_id = k.org_unit_id
WHERE k.name = 'Tinh thần phối hợp trong nhóm'
ON CONFLICT DO NOTHING;

-- Sửa cờ chỉ tiêu ngược cho chỉ tiêu V2 đã seed: "Tỉ lệ bug" có target 5 < minimum 10, tức đúng
-- nghĩa càng thấp càng tốt, nhưng cờ vẫn để FALSE — làm Bullet tính tỉ lệ đạt sai chiều.
UPDATE quantitative_kpi_details d
SET is_reverse_kpi = TRUE
FROM kpi_criteria k
WHERE k.id = d.kpi_criteria_id
  AND k.name ILIKE '%bug%'
  AND d.target_value < d.minimum_value
  AND d.is_reverse_kpi = FALSE;


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. BÀI NỘP TRẢI 12 THÁNG, ĐỦ 4 TRẠNG THÁI  → mở khoá vùng chồng & cột chồng 100%
-- ═══════════════════════════════════════════════════════════════════════════
-- Tỉ lệ trạng thái ĐỔI THEO THÁNG có chủ đích: phần chờ duyệt phình dần từ T7/2025 đến T11/2025
-- rồi xẹp. Nhờ vậy biểu đồ vùng chồng kể được một đợt tồn đọng thật và việc nó được xử lý, thay vì
-- bốn dải phẳng chẳng có gì để đọc.
--
-- Băm từ (chỉ tiêu, người) để chọn trạng thái — tất định, chạy lại ra đúng cùng bộ dữ liệu.

INSERT INTO kpi_submissions
    (id, org_unit_id, kpi_criteria_id, submitted_by, actual_value, auto_score, note, status,
     reviewed_by, reviewed_at, period_start, period_end, created_at, updated_at)
SELECT
    md5('sub' || k.id::text || a.user_id::text)::uuid,
    k.org_unit_id,
    k.id,
    a.user_id,
    d.target_value * (0.7 + (h.v % 60) / 100.0),               -- đạt 70%–129% mục tiêu
    round((70 + (h.v % 31))::numeric, 1),                      -- điểm tự động 70–100
    'Bài nộp kỳ ' || p.name,
    st.status,
    CASE WHEN st.status IN ('APPROVED', 'REJECTED')
         THEN '22222222-0000-0000-0000-000000000101'::uuid END,
    CASE WHEN st.status IN ('APPROVED', 'REJECTED')
         THEN p.end_date - INTERVAL '2 days' END,
    p.start_date,
    p.end_date,
    p.start_date + INTERVAL '10 days',                         -- rơi đúng trong tháng của kỳ
    p.start_date + INTERVAL '10 days'
FROM kpi_criteria k
JOIN kpi_periods p ON p.id = k.kpi_period_id
JOIN kpi_criteria_assignees a ON a.kpi_criteria_id = k.id
JOIN quantitative_kpi_details d ON d.kpi_criteria_id = k.id
CROSS JOIN LATERAL (
    SELECT abs(('x' || substr(md5(k.id::text || a.user_id::text), 1, 8))::bit(32)::int) AS v
) AS h
CROSS JOIN LATERAL (
    SELECT CASE
        -- Giai đoạn tồn đọng: T7–T11/2025 giữ lại nhiều bài ở trạng thái chờ duyệt
        WHEN p.start_date <  '2025-12-01 00:00:00+07' AND (h.v % 10) < 4 THEN 'PENDING'
        WHEN (h.v % 10) < 1 THEN 'DRAFT'
        WHEN (h.v % 10) < 2 THEN 'REJECTED'
        ELSE 'APPROVED'
    END AS status
) AS st
WHERE p.organization_id = '11111111-1111-1111-1111-111111111111'
  AND p.start_date < '2026-04-01 00:00:00+07'
  AND k.name IN ('Số task hoàn thành', 'Chất lượng bàn giao')
ON CONFLICT (id) DO NOTHING;

-- Bài nộp cho chỉ tiêu định tính: kết quả là MỨC, không phải con số.
INSERT INTO kpi_submissions
    (id, org_unit_id, kpi_criteria_id, submitted_by, qualitative_level_id, note, status,
     reviewed_by, reviewed_at, period_start, period_end, created_at, updated_at)
SELECT
    md5('qsub' || k.id::text || a.user_id::text)::uuid,
    k.org_unit_id, k.id, a.user_id,
    lv.id,
    'Tự đánh giá mức phối hợp kỳ ' || p.name,
    'APPROVED',
    '22222222-0000-0000-0000-000000000101',
    p.end_date - INTERVAL '2 days',
    p.start_date, p.end_date,
    p.start_date + INTERVAL '12 days', p.start_date + INTERVAL '12 days'
FROM kpi_criteria k
JOIN kpi_periods p ON p.id = k.kpi_period_id
JOIN kpi_criteria_assignees a ON a.kpi_criteria_id = k.id
JOIN org_units ou ON ou.id = k.org_unit_id
JOIN org_hierarchy_levels l ON l.id = ou.org_hierarchy_id
CROSS JOIN LATERAL (
    -- Chọn mức theo băm, nhưng lệch về nhóm giữa để phân bố trông như thật chứ không phẳng đều.
    SELECT q.id
    FROM qualitative_levels q
    WHERE q.organization_id = l.organization_id
    ORDER BY abs(q.position_index
                 - (3 + (abs(('x' || substr(md5(a.user_id::text || k.id::text), 1, 8))::bit(32)::int) % 3) - 1)),
             q.position_index
    LIMIT 1
) AS lv
WHERE k.name = 'Tinh thần phối hợp trong nhóm'
ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. ĐÁNH GIÁ CHO 9 KỲ MỚI
-- ═══════════════════════════════════════════════════════════════════════════
-- Một đánh giá cho mỗi (người, kỳ). Điểm đi lên nhẹ theo thời gian và xê dịch theo người, tất cả
-- băm tất định — để biểu đồ xu hướng có độ dốc thật thay vì một đường phẳng.

INSERT INTO evaluations
    (id, org_unit_id, user_id, kpi_period_id, evaluator_id, score, comment, system_score,
     period_start, period_end, created_at)
SELECT
    md5('eval' || uro.user_id::text || p.id::text)::uuid,
    uro.org_unit_id,
    uro.user_id,
    p.id,
    '22222222-0000-0000-0000-000000000100',
    sc.score,
    'Đánh giá kỳ ' || p.name,
    sc.score,
    p.start_date,
    p.end_date,
    p.end_date
FROM kpi_periods p
JOIN user_role_org_units uro ON TRUE
JOIN org_units ou ON ou.id = uro.org_unit_id
JOIN org_hierarchy_levels l ON l.id = ou.org_hierarchy_id
CROSS JOIN LATERAL (
    SELECT round((
        58
        -- đi lên ~1,4 điểm mỗi tháng kể từ T7/2025
        + 1.4 * (EXTRACT(YEAR FROM p.start_date) * 12 + EXTRACT(MONTH FROM p.start_date)
                 - (2025 * 12 + 7))
        -- xê dịch riêng từng người, giữ nguyên qua các kỳ nên "ai giỏi hơn ai" vẫn nhất quán
        + (abs(('x' || substr(md5(uro.user_id::text), 1, 8))::bit(32)::int) % 25) - 12
    )::numeric, 1) AS score
) AS sc
WHERE p.organization_id = '11111111-1111-1111-1111-111111111111'
  AND p.start_date < '2026-04-01 00:00:00+07'
  AND l.organization_id = '11111111-1111-1111-1111-111111111111'
  AND NOT EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.user_id = uro.user_id AND e.kpi_period_id = p.id AND e.deleted_at IS NULL)
ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 8. ĐIỀN ĐIỂM HÀNH VI / %HOÀN THÀNH / XẾP LOẠI MA TRẬN CHO MỌI ĐÁNH GIÁ CÒN TRỐNG
-- ═══════════════════════════════════════════════════════════════════════════
-- V2 chỉ chạy khối này cho org "Demo Company", nên 36 đánh giá của "Demo Education" bỏ trống cả ba
-- cột — làm biểu đồ phân tán và heatmap ma trận chỉ có dữ liệu ở một tổ chức. Các đánh giá vừa
-- thêm ở phần 7 cũng đang trống.
--
-- Điểm hành vi và %hoàn thành suy TỪ điểm tổng để ba cột không mâu thuẫn nhau, nhưng CỘNG THÊM xê
-- dịch riêng cho mỗi trục: nếu cả hai trục là hàm thuần của cùng một biến thì biểu đồ phân tán ra
-- một đường thẳng hoàn hảo — trông như lỗi, và không còn là biểu đồ tương quan nữa.
--
-- Xếp loại tra LẠI từ chính hai giá trị đã xê dịch (không lấy từ điểm tổng), nên màu của mỗi chấm
-- luôn khớp đúng ô ma trận mà nó rơi vào.

WITH jitter AS (
    SELECT e.id,
           -- Điểm hành vi 0..5, neo theo điểm tổng rồi xê dịch ±0,4
           least(5.0, greatest(0.5, round((
               e.score / 100.0 * 4.5
               + ((abs(('x' || substr(md5('bhv' || e.id::text), 1, 8))::bit(32)::int) % 9) - 4) * 0.1
           )::numeric, 1)))::double precision AS behavior,
           -- %hoàn thành 40..150, neo theo điểm tổng rồi xê dịch ±10
           least(150.0, greatest(40.0, round((
               55 + e.score * 0.75
               + ((abs(('x' || substr(md5('cmp' || e.id::text), 1, 8))::bit(32)::int) % 21) - 10)
           )::numeric, 1)))::double precision AS completion
    FROM evaluations e
    WHERE e.deleted_at IS NULL
      AND e.score IS NOT NULL
      AND e.matrix_rating IS NULL          -- chỉ điền chỗ trống, không ghi đè phân bố V2 đã nắn
),
placed AS (
    SELECT j.id, j.behavior, j.completion,
           -- Dải hàng (điểm hành vi) và dải cột (%hoàn thành) theo ma trận mặc định của tổ chức
           CASE WHEN j.behavior <  2.0 THEN 1
                WHEN j.behavior <  3.0 THEN 2
                WHEN j.behavior <  3.5 THEN 3
                WHEN j.behavior <  4.5 THEN 4
                ELSE 5 END AS row_idx,
           CASE WHEN j.completion <  70  THEN 1
                WHEN j.completion <  90  THEN 2
                WHEN j.completion < 110  THEN 3
                WHEN j.completion < 120  THEN 4
                ELSE 5 END AS col_idx
    FROM jitter j
)
UPDATE evaluations e
SET behavior_score         = pl.behavior,
    kpi_completion_percent = pl.completion,
    matrix_rating          = cells.rating
FROM placed pl
JOIN (VALUES
    -- Đúng ma trận mặc định trong V2: hàng = dải điểm hành vi, cột = dải %hoàn thành
    (1,1,1),(1,2,1),(1,3,1),(1,4,2),(1,5,2),
    (2,1,1),(2,2,2),(2,3,2),(2,4,3),(2,5,3),
    (3,1,2),(3,2,2),(3,3,3),(3,4,4),(3,5,4),
    (4,1,2),(4,2,3),(4,3,3),(4,4,4),(4,5,5),
    (5,1,2),(5,2,3),(5,3,4),(5,4,4),(5,5,5)
) AS cells(row_idx, col_idx, rating)
  ON cells.row_idx = pl.row_idx AND cells.col_idx = pl.col_idx
WHERE e.id = pl.id;


-- ═══════════════════════════════════════════════════════════════════════════
-- 9. CHU KỲ KPI + GẮN KỲ VÀO CHU KỲ  → mở khoá tự-vs-quản-lý và biến động thứ hạng
-- ═══════════════════════════════════════════════════════════════════════════
-- Bảng kpi_cycles đang 0 dòng, nên toàn bộ màn hình "Kỳ KPI" và hai biểu đồ dựa trên đánh giá chốt
-- kỳ đều trống. Bốn chu kỳ quý cho org1 (đủ để thấy cả thăng và tụt hạng — hai chu kỳ chỉ cho thấy
-- một lần thay đổi), hai chu kỳ cho org2.

INSERT INTO kpi_cycles (id, organization_id, name, cycle_type, start_date, end_date, description, evaluation_mode)
VALUES
    ('44444444-1111-0000-0000-000020250003', '11111111-1111-1111-1111-111111111111',
     'Quý 3/2025', 'QUARTERLY', '2025-07-01 00:00:00+07', '2025-09-30 23:59:59+07',
     'Chu kỳ đánh giá quý 3 năm 2025', 'BOTH'),
    ('44444444-1111-0000-0000-000020250004', '11111111-1111-1111-1111-111111111111',
     'Quý 4/2025', 'QUARTERLY', '2025-10-01 00:00:00+07', '2025-12-31 23:59:59+07',
     'Chu kỳ đánh giá quý 4 năm 2025', 'BOTH'),
    ('44444444-1111-0000-0000-000020260001', '11111111-1111-1111-1111-111111111111',
     'Quý 1/2026', 'QUARTERLY', '2026-01-01 00:00:00+07', '2026-03-31 23:59:59+07',
     'Chu kỳ đánh giá quý 1 năm 2026', 'BOTH'),
    ('44444444-1111-0000-0000-000020260002', '11111111-1111-1111-1111-111111111111',
     'Quý 2/2026', 'QUARTERLY', '2026-04-01 00:00:00+07', '2026-06-30 23:59:59+07',
     'Chu kỳ đánh giá quý 2 năm 2026', 'BOTH'),
    ('44444444-2222-0000-0000-000020260001', '22222222-2222-2222-2222-222222222222',
     'Học kỳ 1/2026', 'SEMI_ANNUALLY', '2026-01-01 00:00:00+07', '2026-06-30 23:59:59+07',
     'Chu kỳ đánh giá học kỳ 1 năm 2026', 'BOTH'),
    ('44444444-2222-0000-0000-000020260002', '22222222-2222-2222-2222-222222222222',
     'Học kỳ 2/2026', 'SEMI_ANNUALLY', '2026-07-01 00:00:00+07', '2026-12-31 23:59:59+07',
     'Chu kỳ đánh giá học kỳ 2 năm 2026', 'BOTH')
ON CONFLICT (id) DO NOTHING;

-- Gắn từng kỳ vào chu kỳ chứa nó, theo mốc thời gian chứ không theo danh sách cứng.
UPDATE kpi_periods p
SET kpi_cycle_id = c.id
FROM kpi_cycles c
WHERE c.organization_id = p.organization_id
  AND p.start_date >= c.start_date
  AND p.start_date <= c.end_date
  AND p.kpi_cycle_id IS NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- 10. ĐÁNH GIÁ CHỐT KỲ THEO ĐƠN VỊ VÀ THEO NGƯỜI
-- ═══════════════════════════════════════════════════════════════════════════
-- Điểm tự chấm CỐ Ý lệch điểm quản lý theo ba kiểu khác nhau — đơn vị tự chấm cao hơn hẳn, đơn vị
-- sát nhau, đơn vị bị quản lý chấm cao hơn. Nếu để hai cột bằng nhau thì biểu đồ "Tự đánh giá vs
-- Quản lý đánh giá" chẳng có gì để nói, mà đúng cái độ lệch đó mới là thứ nó tồn tại để chỉ ra.

INSERT INTO cycle_unit_evaluations
    (kpi_cycle_id, org_unit_id, evaluation_mode, self_score, manager_score, qual_score,
     matrix_rating, member_count, comment, status, finalized_by, finalized_at)
SELECT
    c.id,
    b.org_unit_id,
    'BOTH',
    round((g.base + g.gap)::numeric, 1),
    round(g.base::numeric, 1),
    round((g.base / 100.0 * 5)::numeric, 1),
    round((g.base / 100.0 * 4 + 1)::numeric, 1),
    b.members,
    CASE WHEN g.gap >= 8  THEN 'Đơn vị tự chấm cao hơn quản lý khá nhiều, cần rà lại tiêu chí.'
         WHEN g.gap <= -4 THEN 'Quản lý chấm cao hơn mức đơn vị tự nhận.'
         ELSE 'Hai bên chấm sát nhau.' END,
    'FINALIZED',
    '22222222-0000-0000-0000-000000000100',
    c.end_date
FROM kpi_cycles c
CROSS JOIN (VALUES
    -- đơn vị,                                 điểm nền, độ lệch tự-chấm, số thành viên
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 82.0,   0.0, 2),  -- Chi nhánh HN — sát nhau
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 79.0,   2.0, 2),  -- Phòng IT     — sát nhau
    ('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 74.0,  11.0, 3),  -- Team Backend — tự chấm cao hơn hẳn
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid, 81.0,   1.0, 3),  -- Team Frontend— sát nhau
    ('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 76.0,   5.0, 2),  -- Phòng TT     — tự chấm cao hơn
    ('ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid, 85.0,  -6.0, 3),  -- Team Content — quản lý chấm cao hơn
    ('abcdefab-cdef-cdef-cdef-abcdefabcdef'::uuid, 70.0,   8.0, 3)   -- Team Design  — tự chấm cao hơn
) AS b(org_unit_id, base0, gap0, members)
CROSS JOIN LATERAL (
    -- Điểm nền dịch theo chu kỳ để thứ hạng có thay đổi giữa các quý: Team Design đi lên nhanh,
    -- Team Content đi xuống — đúng thứ biểu đồ biến động thứ hạng cần để có mũi tên.
    SELECT b.base0
         + CASE WHEN b.org_unit_id = 'abcdefab-cdef-cdef-cdef-abcdefabcdef'::uuid THEN  4.0
                WHEN b.org_unit_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid THEN -3.0
                ELSE 1.0 END
           * (EXTRACT(YEAR FROM c.start_date) * 4 + FLOOR((EXTRACT(MONTH FROM c.start_date) - 1) / 3)
              - (2025 * 4 + 2)) AS base,
           b.gap0 AS gap
) AS g(base, gap)
WHERE c.organization_id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (kpi_cycle_id, org_unit_id) DO NOTHING;

-- Điểm chốt kỳ của từng người SUY TỪ chính các đánh giá theo kỳ thuộc chu kỳ đó — hai nguồn phải
-- khớp nhau, nếu không màn hình chốt kỳ và màn hình thống kê sẽ báo hai con số khác nhau về cùng
-- một người.
INSERT INTO cycle_user_evaluations
    (kpi_cycle_id, user_id, final_score, qual_score, matrix_rating, comment, evaluated_by, evaluated_at)
SELECT c.id,
       e.user_id,
       round(AVG(e.score)::numeric, 1),
       round((AVG(e.score) / 100.0 * 5)::numeric, 1),
       round(AVG(e.matrix_rating))::int,
       'Chốt kỳ ' || c.name,
       '22222222-0000-0000-0000-000000000100',
       c.end_date
FROM kpi_cycles c
JOIN kpi_periods p ON p.kpi_cycle_id = c.id AND p.deleted_at IS NULL
JOIN evaluations e ON e.kpi_period_id = p.id AND e.deleted_at IS NULL
GROUP BY c.id, c.name, c.end_date, e.user_id
ON CONFLICT (kpi_cycle_id, user_id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 11. TRỌNG SỐ KEY RESULT THEO ĐƠN VỊ  → mở khoá Sankey OKR
-- ═══════════════════════════════════════════════════════════════════════════
-- Mỗi Key Result chia cho 2 đơn vị, tổng đúng 100% — Sankey lấy trọng số làm độ dày dải nên tổng
-- lệch 100 là vẽ sai tỉ lệ phân bổ. Chia theo thứ tự KR (chẵn/lẻ) để một số đơn vị nhận nhiều KR
-- hơn hẳn, nhờ đó nhìn vào là thấy đơn vị nào đang gánh nhiều nhất.

INSERT INTO key_result_unit_weights (key_result_id, org_unit_id, weight_percentage)
SELECT kr.id, w.unit_id::uuid, w.weight
FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY code) AS rn
    FROM key_results
    WHERE deleted_at IS NULL
) kr
CROSS JOIN LATERAL (VALUES
    (CASE WHEN kr.rn % 2 = 1 THEN 'dddddddd-dddd-dddd-dddd-dddddddddddd'
                             ELSE 'ffffffff-ffff-ffff-ffff-ffffffffffff' END, 60.0),
    (CASE WHEN kr.rn % 2 = 1 THEN 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
                             ELSE 'abcdefab-cdef-cdef-cdef-abcdefabcdef' END, 40.0)
) AS w(unit_id, weight)
WHERE NOT EXISTS (
    SELECT 1 FROM key_result_unit_weights x
    WHERE x.key_result_id = kr.id AND x.org_unit_id = w.unit_id::uuid);


-- ═══════════════════════════════════════════════════════════════════════════
-- 12. THẺ ĐIỂM BSC CHO CÁC KỲ MỚI
-- ═══════════════════════════════════════════════════════════════════════════
-- Ba khối dưới đây là bản chạy lại y nguyên của phần 18 trong V2. Chúng vốn đã idempotent
-- (WHERE NOT EXISTS / ON CONFLICT DO NOTHING) nên chạy lại chỉ bổ sung cho 9 kỳ và các đánh giá
-- mới, không đụng gì tới dữ liệu cũ.

INSERT INTO bsc_scorecards
    (organization_id, kpi_period_id, name, vision, status, scoring_mode, empty_perspective_policy)
SELECT p.organization_id, p.id,
       'Thẻ điểm cân bằng — ' || p.name,
       'Cân bằng bốn viễn cảnh: tài chính, khách hàng, quy trình nội bộ, học hỏi và phát triển.',
       'ACTIVE', 'SHADOW', 'RENORMALIZE'
FROM kpi_periods p
WHERE p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM bsc_scorecards s
    WHERE s.organization_id = p.organization_id AND s.kpi_period_id = p.id AND s.deleted_at IS NULL);

INSERT INTO bsc_scorecard_perspectives (scorecard_id, perspective_id, weight_percentage, display_order)
SELECT s.id, p.id, w.weight, p.display_order
FROM bsc_scorecards s
JOIN bsc_perspectives p ON p.organization_id = s.organization_id AND p.deleted_at IS NULL
JOIN (VALUES
    ('FINANCIAL', 30.0), ('CUSTOMER', 25.0), ('INTERNAL_PROCESS', 30.0), ('LEARNING_GROWTH', 15.0)
) AS w(code, weight) ON w.code = p.code
WHERE s.deleted_at IS NULL
ON CONFLICT (scorecard_id, perspective_id) DO NOTHING;

-- Gán viễn cảnh cho các chỉ tiêu mới. Chỉ tiêu tài chính vào FINANCIAL — đây là chỗ khoả lấp ô
-- trống mà V2 đã chỉ ra: trước đó không chỉ tiêu nào thuộc viễn cảnh này nên bong bóng hạng mục và
-- thác nước BSC luôn thiếu một trong bốn hạng mục.
UPDATE kpi_criteria k
SET perspective_id = p.id
FROM org_units ou
JOIN org_hierarchy_levels l ON l.id = ou.org_hierarchy_id
JOIN bsc_perspectives p ON p.organization_id = l.organization_id AND p.deleted_at IS NULL
WHERE ou.id = k.org_unit_id
  AND k.perspective_id IS NULL
  AND k.deleted_at IS NULL
  AND p.code = CASE
        WHEN k.name IN ('Doanh thu dịch vụ trong tháng', 'Chi phí vận hành hạ tầng',
                        'Doanh thu vượt kế hoạch')                        THEN 'FINANCIAL'
        WHEN k.name IN ('Tinh thần phối hợp trong nhóm')                  THEN 'LEARNING_GROWTH'
        WHEN k.name LIKE 'Tăng %' OR k.name LIKE 'Nâng %'
          OR k.name LIKE '%hài lòng%' OR k.name LIKE '%tương tác%'        THEN 'CUSTOMER'
        ELSE 'INTERNAL_PROCESS'
      END;

INSERT INTO evaluation_perspective_scores
    (evaluation_id, perspective_id, weight_percentage, raw_score, weighted_score, kpi_count)
SELECT e.id, p.id, w.weight, calc.raw,
       CASE WHEN calc.raw IS NULL THEN NULL
            ELSE round((w.weight / 100.0 * calc.raw)::numeric, 2) END,
       calc.kpi_count
FROM evaluations e
JOIN org_units ou ON ou.id = e.org_unit_id
JOIN org_hierarchy_levels l ON l.id = ou.org_hierarchy_id
JOIN bsc_perspectives p ON p.organization_id = l.organization_id AND p.deleted_at IS NULL
JOIN (VALUES
    ('FINANCIAL', 30.0, 5), ('CUSTOMER', 25.0, -3),
    ('INTERNAL_PROCESS', 30.0, 2), ('LEARNING_GROWTH', 15.0, -6)
) AS w(code, weight, offset_pt) ON w.code = p.code
CROSS JOIN LATERAL (
    SELECT n.cnt AS kpi_count,
           CASE WHEN n.cnt = 0 OR e.system_score IS NULL THEN NULL
                ELSE round(least(150.0, greatest(0.0,
                        e.system_score + w.offset_pt
                        + (abs(('x' || substr(md5(e.user_id::text || p.code), 1, 8))::bit(32)::int) % 7) - 3
                     ))::numeric, 1)
           END AS raw
    FROM (SELECT count(*) AS cnt
          FROM kpi_criteria_assignees a
          JOIN kpi_criteria k ON k.id = a.kpi_criteria_id
          WHERE a.user_id = e.user_id
            AND k.kpi_period_id = e.kpi_period_id
            AND k.perspective_id = p.id
            AND k.deleted_at IS NULL) n
) AS calc
WHERE e.deleted_at IS NULL
ON CONFLICT (evaluation_id, perspective_id) DO NOTHING;

-- Điểm BSC tổng, công thức khớp BscScoringService với chính sách RENORMALIZE: chia cho tổng trọng
-- số của các viễn cảnh CÓ điểm, không phải cho 100.
UPDATE evaluations e
SET bsc_score = agg.bsc
FROM (
    SELECT eps.evaluation_id,
           round((SUM(eps.weight_percentage * eps.raw_score)
                  / NULLIF(SUM(eps.weight_percentage), 0))::numeric, 1) AS bsc
    FROM evaluation_perspective_scores eps
    WHERE eps.raw_score IS NOT NULL
    GROUP BY eps.evaluation_id
) AS agg
WHERE agg.evaluation_id = e.id
  AND e.bsc_score IS NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- 13. LỊCH SỬ THAY ĐỔI TRỌNG SỐ HẠNG MỤC  → mở khoá đường bậc thang lịch sử
-- ═══════════════════════════════════════════════════════════════════════════
-- bsc_weight_history là chỗ DUY NHẤT trong toàn hệ thống giữ lại giá trị CŨ của một cấu hình. Mọi
-- bảng khác chỉ có created_at/updated_at nên không tái lập được quá khứ. Vì vậy đây cũng là biểu đồ
-- duy nhất trả lời được "trọng số này từng là bao nhiêu, ai đổi, vì sao".
--
-- Bốn lần điều chỉnh rải qua các tháng. Phải dùng INSERT ... SELECT join theo `code` vì V2 để
-- bsc_scorecards và bsc_perspectives tự sinh UUID — hard-code id ở đây là chắc chắn sai.

INSERT INTO bsc_weight_history
    (scorecard_id, perspective_id, old_weight, new_weight, changed_by, reason, changed_at)
SELECT s.id, p.id, ch.old_w, ch.new_w,
       '22222222-0000-0000-0000-000000000100',
       ch.reason,
       ch.at::timestamptz
FROM bsc_scorecards s
JOIN kpi_periods kp ON kp.id = s.kpi_period_id
JOIN bsc_perspectives p ON p.organization_id = s.organization_id AND p.deleted_at IS NULL
JOIN (VALUES
    -- Bốn mốc điều chỉnh, mỗi mốc đổi hai hạng mục sao cho tổng luôn giữ đúng 100.
    -- Bốn mốc RIÊNG BIỆT chứ không dồn vào hai: đường bậc thang chỉ kể được câu chuyện điều chỉnh
    -- khi có đủ bậc để nhìn thấy hướng đi, hai điểm thì chỉ là một đoạn thẳng.
    -- hạng mục,          cũ,   mới,  thời điểm,                   lý do
    ('CUSTOMER',          25.0, 30.0, '2025-08-12 09:00:00+07',
     'Tăng trọng số Khách hàng: quý 3 ưu tiên giữ chân khách hàng hiện hữu hơn mở rộng.'),
    ('INTERNAL_PROCESS',  30.0, 25.0, '2025-08-12 09:00:00+07',
     'Giảm tương ứng phần Quy trình nội bộ để tổng vẫn bằng 100.'),

    ('FINANCIAL',         30.0, 35.0, '2025-11-06 09:00:00+07',
     'Cuối năm dồn trọng tâm vào chỉ tiêu doanh thu nên nâng trọng số Tài chính.'),
    ('LEARNING_GROWTH',   15.0, 10.0, '2025-11-06 09:00:00+07',
     'Hoãn kế hoạch đào tạo sang năm sau, hạ trọng số Học hỏi & phát triển tương ứng.'),

    ('LEARNING_GROWTH',   10.0, 20.0, '2026-02-10 09:00:00+07',
     'Khởi động chương trình đào tạo nội bộ đầu năm, trả lại trọng số cho Học hỏi & phát triển.'),
    ('FINANCIAL',         35.0, 25.0, '2026-02-10 09:00:00+07',
     'Hạ trọng số Tài chính trong quý đầu năm vì doanh thu có tính mùa vụ.'),

    ('INTERNAL_PROCESS',  25.0, 30.0, '2026-05-14 09:00:00+07',
     'Nâng trọng số Quy trình nội bộ sau đợt rà soát chất lượng bàn giao.'),
    ('CUSTOMER',          30.0, 25.0, '2026-05-14 09:00:00+07',
     'Giảm tương ứng phần Khách hàng để tổng vẫn bằng 100.')
) AS ch(code, old_w, new_w, at, reason) ON ch.code = p.code
WHERE s.deleted_at IS NULL
  AND kp.start_date <= ch.at::timestamptz
  AND kp.end_date   >= ch.at::timestamptz
  AND NOT EXISTS (
    SELECT 1 FROM bsc_weight_history h
    WHERE h.scorecard_id = s.id AND h.perspective_id = p.id
      AND h.changed_at = ch.at::timestamptz);
