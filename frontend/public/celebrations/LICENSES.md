# Giấy phép tài nguyên hiệu ứng ăn mừng

Mọi tệp trong `public/celebrations/` được app tự host (không tải từ CDN). Thêm / thay tệp nào thì PHẢI cập
nhật bảng dưới: nguồn, tác giả, giấy phép, ngày tải, link trang gốc để kiểm lại, và mọi sửa đổi đã làm. Không còn tệp
TẠM nào; `tools/celebration-lottie/generate.mjs` chỉ dùng khi thêm vật thể mới chờ duyệt.

## Lottie (`lottie/`)

| Tệp | Dùng cho | Tên trên nguồn | Tác giả | Trang gốc | Giấy phép | Tải ngày | Sửa đổi |
|---|---|---|---|---|---|---|---|
| `gift.json` | Thưởng 50–499 điểm (banner + vật thể nhỏ), toast đổi quà, hộp mã quà | Gift Box Opening Animation | Goodeisgn | https://lottiefiles.com/free-animation/gift-box-opening-animation-unvQpnOiEv | Lottie Simple License | 2026-10-19 | Không — lấy nguyên `animations/12345.json` trong tệp dotLottie (https://assets-v2.lottiefiles.com/a/749eae30-117b-11ee-b817-339b21bf6ffe/f0FS6PJgii.lottie) |
| `chest.json` | Thưởng ≥ 500 điểm gộp nhiều lượt (cả màn hình), toast điểm danh chạm mốc chuỗi | treasure box | dDara | https://lottiefiles.com/free-animation/treasure-box-cRZQIXoKdP | Lottie Simple License | 2026-10-19 | Không sửa tệp — lấy nguyên `animations/*.json` trong tệp dotLottie (https://assets-v2.lottiefiles.com/a/7189d76a-2ba6-11ef-ac7f-1f9162e1cfd6/nZMOEgl6Zc.lottie). Cách HIỂN THỊ chỉnh ở `SPEC` trong `LottieObject.tsx`: thu nhỏ 75% trong khung (tệp vẽ kín mép, đè lên chữ), và cả bản đầy đủ lẫn bản nhẹ chỉ chạy / dừng tới khung 49/89 (~55%, nắp đang mở) vì từ ~85% rương tự đóng lại. Thay cho rương "Chinese treasure chest open and shine" (Jerome Chang, có ký hiệu ¥) dùng tạm trước đó — đã xoá |
| `medal.json` | Thưởng kèm giấy khen (cả màn hình) | Gold medal | Lucas Mauricio Silva | https://lottiefiles.com/free-animation/gold-medal-81wCGh1NBV | Lottie Simple License | 2026-10-19 | Không — lấy nguyên JSON trong tệp dotLottie (https://assets-v2.lottiefiles.com/a/6a699ac6-1188-11ee-beb2-7f5defcba99c/X7ZH1E789C.lottie). Ghi chú: cuối animation huy chương thu nhỏ rồi biến mất; bản nhẹ dừng ở 50% (`SPEC.stillAt` trong `LottieObject.tsx`) |
| `trophy.json` | Thưởng ≥ 500 điểm một lượt (cả màn hình) | Trophy | Lucas Nemo | https://lottiefiles.com/free-animation/trophy-OJxKdZoIJh | Lottie Simple License | 2026-10-19 | Không sửa — lấy nguyên JSON trong tệp dotLottie (https://assets-v2.lottiefiles.com/a/a4e9145c-1150-11ee-a111-5f0b42c20def/YPsJNCW4Nv.lottie). Thay cho cúp TẠM tự sinh (đã xoá). Không dùng "Trophy" của LottieFiles (trophy-DGYbPcob3I): cúp đen trên nền trắng đặc, tự xoá ở cuối |

### Lottie Simple License (tóm tắt — bản đầy đủ: https://lottiefiles.com/page/license)

- Được dùng (kể cả thương mại), sửa, phân phối và hiển thị công khai; tệp sửa đổi là tác phẩm phái sinh, cùng giấy phép.
- Không bắt buộc ghi tên tác giả (khuyến khích ghi — bảng trên ghi đủ).
- Không được đặt thêm điều kiện khác lên tệp, không được dùng biện pháp kỹ thuật hạn chế quyền đã cấp, không được
  gom tệp từ LottieFiles để dựng dịch vụ tương tự / cạnh tranh.
- Cung cấp "AS IS", không bảo hành.

## Âm thanh

Không có tệp âm thanh: mọi tiếng chúc mừng được tổng hợp bằng Web Audio trong
`src/features/notifications/notificationAlert.ts` (`CUE_SOURCES`), là mã nguồn của dự án. Nếu sau này
thay bằng mp3 trong `public/sounds/` thì thêm một bảng "Âm thanh" như trên.

## Thư viện chạy

- `lottie-web` 5.13.0 (bản `lottie_light`, SVG renderer) — MIT, Airbnb.
- `canvas-confetti` 1.9.4 — ISC, Kiril Vatev.
