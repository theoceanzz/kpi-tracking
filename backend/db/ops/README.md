# Công cụ kiểm tra schema prod

Thư mục này chỉ còn `001_drift_report.sql` — script **chỉ đọc**, xuất schema thật (cột, index,
constraint, thống kê bảng) để so với DB dev chạy sạch từ Flyway. Dùng khi nghi prod lệch
migration, và bắt buộc ở giai đoạn 1 của lộ trình V3+ (docs/DATABASE_SCALING.md).

```bash
docker exec -i <container-db> psql -U postgres -d kpitracking < backend/db/ops/001_drift_report.sql > drift_prod.txt
psql -U postgres -d kpitracking -f backend/db/ops/001_drift_report.sql > drift_local.txt
diff drift_local.txt drift_prod.txt
```

Lịch sử: đợt audit 2026-09-15 từng có `000`, `002`–`006` (index chạy tay cho prod vì quy ước
2 file migration). Đã bỏ khi quyết định chuyển sang V3+ — nội dung các script đó nằm trong
`V1__init_schema.sql` (dev) và sẽ được đưa lên prod bằng `V3__reconcile_prod.sql`.
