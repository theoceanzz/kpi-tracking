# Công cụ kiểm tra schema prod

Thư mục này gồm `001_drift_report.sql` — script **chỉ đọc**, xuất schema thật (cột, index,
constraint, thống kê bảng) để so với DB dev chạy sạch từ Flyway. Dùng khi nghi prod lệch
migration, và bắt buộc ở giai đoạn 1 của lộ trình V8+ (docs/DATABASE_SCALING.md).

```bash
docker exec -i <container-db> psql -U postgres -d kpitracking < backend/db/ops/001_drift_report.sql > drift_prod.txt
psql -U postgres -d kpitracking -f backend/db/ops/001_drift_report.sql > drift_local.txt
diff drift_local.txt drift_prod.txt
```

Lịch sử: đợt audit 2026-09-15 từng có `000`, `002`–`006` (index chạy tay cho prod vì quy ước
2 file migration). Đã bỏ khi quyết định chuyển sang V3+ — nội dung các script đó nằm trong
`V1__init_schema.sql` (dev) và đã lên prod bằng `V8__reconcile_prod.sql` (2026-09-15).

`010_fix_orphan_refs_2026-09.sql`: dọn KPI mồ côi (đợt đã xoá mềm) — preview trước, bỏ comment khối APPLY để chạy.
