# KeyGo — Sổ pattern UX (nguồn sự thật cho bố cục & tương tác lặp lại)

`DESIGN_SYSTEM.md` chốt **token** (màu, chữ, spacing, bo góc). File này chốt **bố cục và
tương tác** lặp lại giữa nhiều trang — thứ token không cứu được: cách chọn nhiều hàng, thứ tự nút
trong footer, hàng filter dài bao nhiêu, nút "Xem chi tiết" nằm đâu.

**Cơ chế:**
- Mỗi lượt thiết kế trang, dán kèm **phần liên quan** của file này (P0 + nhóm của trang) sau `DESIGN_SYSTEM.md`.
- Trang đầu tiên của một nhóm **chốt** pattern cho nhóm đó: ghi vào đây trước khi đóng lượt (mục 10 của
  prompt trang). Trang sau cùng nhóm **dùng lại**, không được tự nghĩ cách khác; muốn đổi thì sửa ở
  đây và ghi lý do, rồi áp lại cho các trang đã làm.
- Mở rộng component dùng chung (prop/API mới) cũng ghi ở đây, trong bảng §R — để lượt sau biết prop
  đã tồn tại thay vì viết tay.
- Trạng thái: **[chốt]** đã có code, **[khai báo]** đã định API nhưng chưa có code, **[trống]** chưa ai chạm.

---

## P0. Khung modal / drawer — [chốt] `src/components/ui/dialog.tsx`

| Việc | Quyết định |
|---|---|
| Component | `Dialog` (giữa màn) và `Drawer` (trượt phải). Cùng props: `open, onClose, title, description?, headerExtra?, footer?, size, dismissible?, flush?, id?` |
| Khi nào Dialog, khi nào Drawer | Dialog: tạo/sửa một bản ghi, xác nhận, xem trước import. Drawer: xem/sửa một mục **trong khi vẫn cần thấy danh sách** (chi tiết đơn vị, quyền của một vai trò, một nút trên cây BSC) |
| Kích thước | `sm` xác nhận / 1 trường · `md` form 3–6 trường (mặc định) · `lg` form nhiều cột · `xl` xem trước import, ma trận · `full` chỉ khi bảng thật rộng |
| Header | tiêu đề `text-section-title` + mô tả một dòng + nút X góc phải. Không icon to, không nền màu |
| Thân | `p-5`, cuộn riêng; `flush` cho bảng tràn mép. Form dùng `space-y-4`, nhãn `text-label` trên ô nhập |
| Footer `DialogFooter` | thứ tự cố định: `destructive` (trái, cách xa) · `note` (chữ nhỏ trái, vd "Có thay đổi chưa lưu") · `secondary` ("Hủy" — `Button variant="outline"`) · `primary` (phải ngoài cùng). Nút chính là nút đặc **duy nhất** trong footer |
| Nhãn nút | Tạo mới: "Tạo …" · Sửa: "Lưu thay đổi" · Xác nhận nghiệp vụ: động từ cụ thể ("Duyệt", "Trả lại", "Gửi đánh giá") · Huỷ: **"Hủy"** (không "Huỷ", không "Đóng" trừ modal chỉ-xem) |
| Lỗi form | Lỗi từng trường ngay dưới ô (`text-caption text-[var(--color-error)]`); lỗi chung của API hiện thành một khối `bg-[var(--color-error-bg)]` **ngay trên footer**, không toast |
| Đang lưu | `dismissible={false}`, nút chính `disabled` + nhãn "Đang lưu…"; không spinner toàn modal |
| Đóng khi có thay đổi chưa lưu | Hỏi qua `ConfirmDialog` ("Bỏ thay đổi?") — không đóng lặng lẽ |
| Mobile | Dialog dán đáy màn (`items-end`), bo góc trên; Drawer full-width |
| Trong modal | `SelectContent className="z-[1100]"`; không lồng modal trong modal (trừ ConfirmDialog) |
| Ví dụ mẫu | `components/common/ConfirmDialog.tsx` |

Chưa chuyển sang khung này: 64 modal/drawer trong `features/` (danh sách: `grep -rl "z-\[1000\]" src/features`). Chuyển khi chạm tới trang chứa nó.

---

## P1. Hàng chờ duyệt — [chốt] tại Phê duyệt chỉ tiêu (`KpiApprovalPage`)
Trang: Phê duyệt chỉ tiêu (`kpi-criteria-pending`) → Điều chỉnh chỉ tiêu (`kpi-adjustments-pending`) → Đánh giá đợt (`submissions-org-unit`) → hàng chờ thưởng/ví/BSC trong Thiết lập công cụ.

| Việc | Quyết định (chốt ở trang đầu tiên, sửa bảng này nếu khác) |
|---|---|
| Khung | `WorkspaceHeader` (stats: Chờ duyệt / Đã duyệt / Trả lại **trong đợt đang chọn**) → hàng filter → `DataTable` → `Pagination` |
| Hàng filter | `FilterBar` (§R3), **một hàng**: [Đợt `Select w-52`] [Sắp xếp `Select w-44`] [Mục tiêu OKR `w-56`] [KR `w-56`] … [Tìm kiếm `w-64`] [mở/đóng nhóm] [dạng bảng/thẻ `SegmentedControl`]. Trạng thái KHÔNG nằm trong hàng filter mà là hàng tab riêng bên dưới (xem dòng kế) |
| Chọn nhiều | `DataTable selectable` (§R1) cho bảng phẳng; bảng gom nhóm (đơn vị → người) tự dựng `<table>` nhưng dùng đúng checkbox 16px + `BulkActionBar` (§R2). Checkbox đầu bảng = chọn mọi hàng **chờ duyệt** đang hiển thị, nửa chọn khi chọn một phần; hàng chọn nền `primary-soft`. Thanh dính đáy: "Đã chọn N chỉ tiêu" · [Bỏ chọn] … [Duyệt N chỉ tiêu] (một nút đặc). Trả lại/từ chối hàng loạt chỉ khi nghiệp vụ cho phép **một lý do chung** (điều chỉnh chỉ tiêu có; phê duyệt chỉ tiêu không): nút `outline` màu error "Từ chối…" trên thanh mở `Dialog size=sm` nhập lý do, KHÔNG nhét ô nhập vào thanh dính đáy |
| Tab trạng thái | `SegmentedControl` ngay dưới filter: Chờ duyệt · Đã duyệt · Đã trả lại · Tất cả, mỗi tab kèm **số đếm** (tabular). Mặc định "Chờ duyệt". Lưu ở `?tab=` |
| Hành động từng hàng | cột cuối `Hành động`, `Button variant=ghost size=icon-sm`: Xem (Eye) · Duyệt (CheckCircle, màu success) · Trả lại (XCircle, màu error) — hai nút sau chỉ hiện khi chờ duyệt. Không menu "…" |
| Tên chỉ tiêu | cột đầu, `max-w-[360px] truncate` + `title`; bấm tên mở chi tiết; dưới tên là hàng tag: tần suất (caption) · `Badge secondary` "N KPI con" · `outline` Định tính · `warning` KPI ngược · `success` KPI thưởng · `info` Chia nhỏ/Phân rã · `outline` + chấm màu cho hạng mục BSC |
| Cột số | Mục tiêu và Trọng số căn phải, tabular; trọng số thật hiện "x% / y%" (thật / form) với `title` giải thích |
| Trả lại | bắt buộc lý do — mở `KpiReviewModal` ở `initialMode="reject"`: cùng một hộp thoại chi tiết, thân hiện thêm khối textarea viền error, footer đổi thành [Quay lại] [Trả lại `destructive`] + note "Người tạo sẽ nhận thông báo kèm lý do." Không mở hộp thoại thứ hai |
| Duyệt nhanh theo người | trên header nhóm người: `Button outline size=sm` "Duyệt N" |
| Hàng cần thêm dữ liệu khi duyệt | (vd duyệt ngưng KPI cần % bù trừ) nút Duyệt trên hàng mở modal ở `initialMode="approve"` thay vì duyệt thẳng |
| Cột "Thay đổi" (điều chỉnh) | một dòng `Mục tiêu 120 → 100 · Trọng số 20% → 15%`, giá trị mới in đậm; ngưng KPI → chữ error "Ngưng KPI · bù x%" |
| Hạn xử lý | chữ caption "Còn 5 giờ 12 phút" cập nhật mỗi phút; quá hạn → "Quá hạn" màu error. Không đếm giây, không nhấp nháy |
| Sau khi duyệt | ở lại trang, hàng biến khỏi hàng chờ, toast "Đã duyệt N chỉ tiêu"; con số trên sidebar giảm |
| Sắp xếp | bảng **gom nhóm** (đơn vị → người) → `Select` "Sắp xếp" trong FilterBar (sort ở đầu cột không có nghĩa khi hàng bị chen header nhóm); bảng **phẳng** → `SortHeader` trên cột, mặc định việc-đang-chờ lên đầu |
| Trang không có chiều trạng thái | (Đánh giá đợt: danh sách NHÂN SỰ của một đơn vị/đợt) bỏ hàng tab, bỏ chọn nhiều; hành động chính của hàng là nút `outline size=sm` có chữ ("Chấm điểm") vì đó là việc phải làm, còn "Xem" vẫn là icon |
| Điểm & xếp loại | một ô: điểm tabular + xếp loại, màu theo `getScoringFunctions(org)` (ngưỡng do tổ chức cấu hình); chưa có: `Badge warning` "Chưa chấm" / `destructive` "Chưa nộp" (đợt đã hết) / `secondary` "Chưa đánh giá" |
| Cột | [☐] · Chỉ tiêu · [Mục tiêu / KR — khi bật OKR] · [Đơn vị · Nhân sự — ẩn khi đã gom nhóm theo đơn vị] · Mục tiêu (phải) · Trọng số (phải) · Trạng thái (`StatusBadge`) · Hành động. Người nộp/đơn vị nằm ở **header nhóm** (`PersonGroupHeaderRow`/`UnitGroupHeaderRow`) khi có ≥ 2 nhóm |
| Rỗng | `EmptyState icon={Inbox}`, tiêu đề theo tab ("Không có chỉ tiêu nào chờ duyệt" / "Chưa có chỉ tiêu nào được duyệt"…), mô tả theo bộ lọc ("Khi cấp dưới gửi chỉ tiêu lên, chúng sẽ hiện ở đây." hoặc "Thử chọn đợt khác hoặc bỏ bộ lọc.") |
| Quá trần tải | banner `warning-bg` một dòng trên bảng khi chạm 1.000 mục |
| Mobile | dưới `md` luôn dạng thẻ (desktop có thể chọn thẻ): checkbox · tên (line-clamp-2) · tag · `StatusBadge` góc phải · dòng đơn vị/nhân sự caption · footer: số liệu trái, `RowActions` phải |

## P2. Danh sách có filter + bảng (không duyệt) — [chốt] tại KPI của tôi (`MyKpiPage`)
Trang: KPI của tôi, Báo cáo của tôi, Đánh giá của tôi, Điều chỉnh của tôi, Quản lý nhân viên, Quản lý kỳ/đợt, các tab Phân tích có bảng.

| Việc | Quyết định |
|---|---|
| Khung | `WorkspaceHeader` (title = nhãn sidebar tuỳ chỉnh qua `usePageTitle`, description 1 dòng, stats ≤ 3) → `FilterBar` (đợt `w-52` → OKR `w-56`×2 … tìm kiếm, `SegmentedControl` bảng/thẻ) → nội dung → `Pagination` (chỉ hiện khi > 1 trang) |
| Gom theo đợt | danh sách cá nhân gom thành **một card mỗi đợt**: header `bg-muted` (tên đợt · "dd/mm – dd/mm · N chỉ tiêu" caption; nút hành động của đợt bên phải, vd "Tự đánh giá đợt này" `Button size=sm` / `Badge success` "Đã tự đánh giá") → bảng bên trong card, `thead` không nền |
| Nhãn chỉ tiêu | `KpiTagChips` (`features/kpi/components`) — cùng một component ở mọi bảng KPI |
| Nút tạo mới | duy nhất một nút đặc, góc phải header, nhãn "Thêm …"/"Nộp báo cáo". Import/Xuất là `outline` cạnh nó |
| Số liệu tóm tắt | `stats` của `WorkspaceHeader` (không dùng `StatCard` rời): Tổng · Cần nộp · Quá hạn — chỉ những con số đổi hành vi |
| Hành động hàng | cột cuối: icon phụ (`ghost icon-sm`: Điều chỉnh, Giao việc) đứng TRƯỚC, rồi tới **một** nhãn/nút chính: `Button size=sm` "Nộp bài" khi là việc phải làm, còn lại là `Badge` trạng thái (Đã xong `success` · Chưa mở `secondary` · Quá hạn `destructive` · Đang theo dõi `info` · Đã chia KPI con `success`) |
| Tiến độ & hạn | Tiến độ "n/N lần" tabular, xanh khi đủ; Hạn nộp dd/mm/yyyy, đỏ đậm khi quá hạn và chưa đủ lần |
| Mở chi tiết | bấm **tên** (truncate + title) mở modal chi tiết; không bấm cả hàng vì hàng có nhiều nút; hover nền muted |
| Cột số | căn phải, `tabular-nums`, đơn vị trong tiêu đề cột ("Trọng số (%)") không lặp ở từng ô |
| Sắp xếp | `SortHeader` ở cột có nghĩa (ngày, số); mặc định mới nhất trước |
| Mobile | `renderMobileCard` tự viết khi > 5 cột; ngược lại để DataTable tự sinh |

## P3. Form cấu hình nhiều bước — [khai báo]
Trang: Thang điểm, Ma trận đánh giá, Xếp loại đơn vị, Quy tắc sinh mã, Cấp bậc công ty, Cơ cấu tổ chức, Phân quyền, Module & tính năng.

| Việc | Quyết định |
|---|---|
| Khung | `SettingsSectionLayout` (đã chốt) → mỗi mục là **một card** `rounded-card` có header (tiêu đề `text-section-title` + mô tả 1 dòng + nút Lưu bên phải) |
| Nhiều phần trong một mục | chia card theo chủ đề, **không** wizard bước 1-2-3 (cấu hình làm một lần, người dùng cần thấy toàn cảnh) |
| Lưu | nút "Lưu thay đổi" **dính đáy card** khi form dài hơn màn; disabled khi chưa đổi; hiện `note` "Có thay đổi chưa lưu" |
| Rời trang khi chưa lưu | `ConfirmDialog` |
| Bảng chỉnh trực tiếp (ma trận, mức xếp loại) | ô nhập trong bảng cao 32px (`size="sm"`), viền chỉ hiện khi hover/focus; thêm hàng bằng nút `outline` dưới bảng |
| Nhãn động dài | tên cấp bậc/đơn vị/vai trò do tổ chức đặt — cột tên tối thiểu 240px, `truncate` + `title` |
| Quyền chỉ-xem | toàn form `disabled`, banner `info` đầu card "Bạn chỉ có quyền xem" |

**Bề ngang (quy tắc thêm 12/09):** khối cấu hình chỉ có vài trường / một danh sách ngắn thì tự ràng `mx-auto max-w-3xl` (form) hoặc `mx-auto max-w-4xl` (hồ sơ có ảnh bìa), **căn giữa** vùng nội dung — không để card kéo hết 1600px rồi ràng phần trong, vì phần trống bên phải đọc như thiếu nội dung. Chỉ bảng dữ liệu, ma trận, sơ đồ mới dùng full bề ngang.

## P4. Modal / drawer sửa dữ liệu nghiệp vụ — [khai báo, dùng P0] · modal CHI TIẾT-CÓ-HÀNH-ĐỘNG đã [chốt] tại `KpiReviewModal`
Trang: `KpiFormModal`, `OrgUnitDrawer`, `RolePermissionDrawer`, `PerspectiveFormModal`, `CascadePolicyModal`, `OrgUnitFormModal`, `KeyResultFormModal`…

| Việc | Quyết định |
|---|---|
| Khung | P0. Form dài (KpiFormModal) → `Dialog size="lg"` chia **2 cột** trên desktop: trái = thông tin chính, phải = cấu hình phụ (đợt, trọng số, hạng mục BSC); mobile xếp dọc |
| Modal chi tiết có duyệt/trả lại (đã chốt) | `Dialog size="lg"`: `title` = tên bản ghi, `description` = "Đơn vị · Đợt", `headerExtra` = `StatusBadge` + nút ghost "Sửa". Thân: hàng tag → mô tả → `<dl>` lưới số liệu 3 cột (ô `bg-card`, kẻ 1px bằng nền border) → các section `text-eyebrow` (Người thực hiện, OKR, BSC, Lý do trả lại lần trước) → dòng audit caption. Footer: [Trả lại outline-error, trái] [Đóng] [Duyệt]; sau khi duyệt: [Hoàn duyệt, trái] [Đóng] |
| Nhóm trường | tiêu đề nhóm `text-eyebrow`, cách nhau `space-y-6`; không card lồng trong modal |
| Trường bắt buộc | dấu `*` màu error sau nhãn; không "(bắt buộc)" bằng chữ |
| Trợ giúp | `text-caption` dưới ô; không tooltip cho thông tin cần đọc |
| Gợi ý AI trong form | khối riêng có rãnh trái `--color-ai-line` (như `FormPatchPreview`), nút áp dụng `bg-[var(--color-ai-solid)]` |

## P8. Trang chi tiết (đọc là chính) — [chốt] tại Chi tiết bài nộp (`SubmissionDetailPage`)
| Việc | Quyết định |
|---|---|
| Header | `Button outline size=icon` ← Quay lại · `text-page-title` (truncate + title) + `StatusBadge` cùng hàng · dòng phụ caption (đợt · khoảng ngày). Hành động duy nhất (vd "Sửa bản nháp") là `Button` đặc góc phải, chỉ hiện khi làm được |
| Bố cục | lưới 12 cột: trái `lg:col-span-8` nội dung theo thứ tự đọc (số liệu → giải trình → minh chứng → phản hồi), phải `lg:col-span-4` thông tin phụ (`<dl>` nhãn–giá trị) + "Tiếp theo" (≤ 2 nút outline/ghost) |
| Số liệu | `<dl>` lưới 3 ô kẻ 1px (`gap-px bg-border`), mỗi ô `text-eyebrow` + `text-stat`; tỷ lệ đạt tô màu success/warning/error theo ngưỡng 100/70 |
| Section | mỗi khối một card `rounded-card p-4`, tiêu đề `text-section-title`; nội dung trống ghi caption ("Không có ghi chú giải trình.") chứ không ẩn khối |
| Phản hồi quản lý | card đổi sang `error-bg` khi bị trả lại; chờ duyệt → "Đang chờ quản lý xem xét." |
| Minh chứng | lưới 2/3/4 cột, ô `aspect-[4/3]` ảnh hoặc icon tệp, dưới là tên (truncate) + hai nút icon Xem/Tải; mở `MediaPreviewModal` |
| Không tìm thấy | `EmptyState` trong card viền đứt + nút quay về danh sách |

## P9. Form dạng trang (nộp/sửa một bản ghi) — [chốt] tại Nộp báo cáo (`NewSubmissionPage`)
| Việc | Quyết định |
|---|---|
| Header | như P8 (nút quay lại + tiêu đề động "Nộp báo cáo"/"Sửa báo cáo" + mô tả 1 dòng nói rõ có lưu nháp được) |
| Bố cục | trái `col-span-8` **một** card form, các trường xếp dọc `space-y-5`, nhãn `text-label` trên ô, `*` error cho bắt buộc, gợi ý `text-caption` dưới ô; phải `col-span-4` card tham chiếu (bản ghi liên quan: mục tiêu, trọng số, đã nộp n/N) + card "Lưu ý" ≤ 3 gạch đầu dòng |
| Ô nhập số | `h-11 text-lg tabular-nums`, đơn vị đặt trong ô bên phải (caption), mục tiêu/tối thiểu hiện dưới ô — không dùng ô khổng lồ 3xl |
| Chọn một trong N mức | nút `role=radio` cao 44px, chọn = viền primary + nền primary-soft; không dùng màu riêng của từng mức làm nền |
| Footer form | trong card, `border-t pt-4`: [Hủy `ghost`] … [Lưu nháp `outline`] [Gửi `default`]; mobile xếp ngược để nút chính ở dưới cùng |
| Xác nhận gửi | `Dialog size=sm` (P0), nút chính là hành động (không phải phá huỷ); thành công cuối đợt → `Dialog sm` mời tự đánh giá |
| Trợ lý AI điền form | giữ nguyên đăng ký `formAssistStore` và tên field (`kpiCriteriaId`, `actualValue`, `note`, `qualitativeLevelId`) — đổi giao diện không được đổi tên field |
| Không sửa được | `EmptyState icon={AlertCircle}` + nút quay lại, thay vì trang lỗi riêng |

## P5. Dashboard widget — [chốt] `WidgetShell`, `StatCard`
Đã chốt ở lượt refresh. Widget = mức bo góc 12px duy nhất; tiêu đề `text-section-title` + icon muted; skeleton/lỗi/rỗng do `WidgetShell` lo. Bổ sung khi làm 4 scope: thứ tự widget mặc định theo vai trò, kích thước lưới tối thiểu từng loại.

## P6. Trung tâm thông báo — [chốt] `NotificationDropdown`, `NotificationsPage`
Màu icon theo **nhóm nghiệp vụ** (KPI = primary, duyệt/kết quả = success, cần xử lý = warning, tiền/thưởng = info); chưa đọc = rãnh trái primary + nền primary-soft; nhóm Chưa đọc / Hôm nay / Trước đó.

## P7. K.AI — [chốt]
Nhận diện: icon `Bot` + nhãn "K.AI" + rãnh trái `--color-ai-line`; nền chỉ `--color-ai-soft`; nút gửi `--color-ai-solid`. Khi primary tím → tự chuyển cyan.

---

## R. Mở rộng component dùng chung — sổ đăng ký

Ghi **trước khi** code. Cột "Trạng thái": khai báo / đã có.

| # | Component | Prop / API mới | Hành vi | Trang cần | Trạng thái |
|---|---|---|---|---|---|
| R1 | `DataTable` | `selectable?: boolean`, `selectedKeys?: Set<string>`, `onSelectionChange?(keys: Set<string>)`, `isRowSelectable?(row): boolean` | cột checkbox đầu bảng (checkbox đầu = chọn tất cả trang hiện tại, trạng thái indeterminate); hàng chọn nền `primary-soft`; phím Space trên hàng focus để chọn | P1 | đã có |
| R2 | `BulkActionBar` (mới, `components/common`) | `count: number`, `onClear()`, `children` (nút) | thanh dính đáy vùng nội dung, cao 56px, nền card + viền trên + shadow-2; hiện khi `count > 0`; "Đã chọn N" trái, nút phải, nút chính đặc duy nhất; portal ra body, `z-40` | P1 | đã có |
| R3 | `FilterBar` (mới, `components/common`) | `children`, `search?: {value, onChange, placeholder}`, `overflow?: ReactNode` (bộ lọc phụ trong popover) | một hàng, gap 8px, ô tìm kiếm luôn ở phải, xuống dòng ở < 768; kèm `SegmentedControl` cho dạng xem / tab trạng thái | P1, P2 | đã có |
| R4 | `Dialog`, `Drawer`, `DialogFooter` | như P0 | — | P0, P4 | đã có |
| R5 | `Badge` | `variant="warning" \| "info"` | đã thêm ở lượt refresh | — | đã có |
| R6 | `KpiReviewModal` | `initialMode?: 'view' \| 'reject'` | mở thẳng ở chế độ nhập lý do trả lại | P1 | đã có |
| R7 | `Button` | `size="icon-sm"` (32px) | nút icon trong hàng bảng | P1, P2 | đã có |
| R9 | `KpiTagChips` (mới, `features/kpi/components`) | `kpi, childCount?, isChildRow?, showFrequency?` | hàng nhãn phân loại chỉ tiêu, dùng ở Phê duyệt / KPI của tôi / mọi bảng KPI | P1, P2 | đã có |
| R8 | `KpiAdjustmentReviewModal` | `initialMode?: 'view' \| 'approve' \| 'reject'`; trang truyền `key={request.id}` để form nhận defaultValues mới | mở thẳng ở bước duyệt/từ chối | P1 | đã có |

---

### R10. `BalanceHero` — `src/components/common/BalanceHero.tsx` [chốt 12/09]
Khối số dư cho ví điểm/ví tiền: con số chính 32px trong card cùng nền với các ô phụ (`tiles`), không tô nền primary/success. Dùng ở Điểm thưởng của tôi, Ví của tôi. Props: `label, value, unit, hint, negative, tiles[{label,value,hint,icon,tone}], loading`.

### R11. `EntityCard` — `src/components/common/EntityCard.tsx` [chốt 12/09]
Thẻ một bản ghi trong lưới (nguồn dữ liệu, báo cáo, kỳ/đợt dạng thẻ): icon · tên · mô tả · dòng meta · footer trái/phải · menu "…" popover (mục phá huỷ tách bằng đường kẻ). Cả thẻ bấm được (`onOpen`), menu dừng nổi bọt.

### R12. `AnalyticsTabHeader` — `src/features/analytics/components/AnalyticsTabHeader.tsx` [chốt 12/09]
Đầu tab Phân tích = `WorkspaceHeader` (tiêu đề, mô tả, nút Tuỳ chỉnh) + hàng lọc dính chỉ chứa ô lọc. Thay cho hai khối cũ (tiêu đề + "Bộ lọc …" có icon vuông) ở 6 tab.

### R13. `cn()` biết các utility chữ [chốt 12/09]
`src/lib/utils.ts` dùng `extendTailwindMerge` khai `text-page-title/section-title/label/caption/eyebrow/stat` là nhóm cỡ chữ — trước đó tailwind-merge coi chúng là màu và `cn('text-stat', 'text-[var(--color-error)]')` vứt mất cỡ chữ (lỗi phát hiện qua ảnh chụp StatCard highlight).

### R14. `ChoiceChip` — `src/components/ui/choice-chip.tsx` [chốt 12/09]
Nút chọn một trong nhiều (tab nhỏ, chip lọc, nút toolbar bật/tắt): `selected`, `variant="soft" | "solid" | "segment"`, `size="sm" | "default"`, tự đặt `aria-pressed`. `soft` = viền + nền primary-soft khi chọn; `solid` = nền primary; `segment` = nền card + bóng nhẹ trong khay `bg-muted p-1`. Nút icon-only trong toolbar thêm `className="w-8 px-0"` + `aria-label`. Thay cho mọi `<button className={cn(…, active ? … : …)}>` tự vẽ.

### R15. `Switch` — `src/components/ui/switch.tsx` [chốt 12/09]
Công tắc bật/tắt: `checked`, `onCheckedChange`, `size`, `role="switch"`, nền primary khi bật, viền `border-strong` khi tắt. Dùng ở luồng phê duyệt, quy tắc mã, module, AI nền tảng. File có `Switch` cục bộ trùng tên thì `import { Switch as SwitchControl }`.

## S. Nhật ký quyết định theo lượt

| Ngày | Trang | Pattern chạm | Quyết định mới / thay đổi |
|---|---|---|---|
| 2026-09-11 | (lượt refresh toàn hệ thống) | P0, P5, P6, P7 | Chốt khung Dialog/Drawer, WidgetShell/StatCard, thông báo, K.AI |
| 2026-09-11 | Phê duyệt chỉ tiêu (`kpi-criteria-pending`) | P1 (chốt), P0, P4 (modal chi tiết), R1–R3, R6, R7 | Hàng filter một hàng + tab trạng thái có số đếm; chọn nhiều + thanh dính đáy chỉ có "Duyệt N"; Trả lại đi qua modal chi tiết ở chế độ reject; cột hành động 3 icon; giữ gom nhóm đơn vị→người và cây KPI cha/con |
| 2026-09-11 | Điều chỉnh chỉ tiêu (`kpi-adjustments-pending`) | P1 (dùng lại), P4 (modal chi tiết), R8 | Dùng lại nguyên khung P1; thêm cột Thay đổi/Hạn xử lý/Phản hồi; từ chối hàng loạt có lý do chung qua Dialog sm; modal đổi bảng "hiện tại → đề xuất" 3 cột |
| 2026-09-11 | Đánh giá đợt (`submissions-org-unit`) | P1 (dùng lại, biến thể không trạng thái) | Bỏ tab/chọn nhiều vì là danh sách nhân sự; SortHeader 3 cột; ô Điểm·Xếp loại + 3 badge trạng thái chưa chấm; nút "Chấm điểm" outline có chữ |
| 2026-09-11 | **Khớp lại nhóm P1** (3 trang) | P1 | Cả 3 dùng WorkspaceHeader + FilterBar + EmptyState(Inbox) + Pagination + LoadingSkeleton table, 0 màu hard-code. Khác biệt có lý do đã ghi thành quy tắc: cách sắp xếp theo loại bảng; trang không có chiều trạng thái |
| 2026-09-11 | KPI của tôi (`my-kpi`) | P2 (chốt), R9 | Card mỗi đợt với header muted + nút tự đánh giá; stats Tổng/Cần nộp/Quá hạn; cột hành động = icon phụ + một nhãn/nút chính; `KpiTagChips` dùng chung |
| 2026-09-11 | Báo cáo của tôi (`my-submissions`) | P2 (dùng lại), P0 | Tab trạng thái có số đếm + link tắt "N bản nháp chưa gửi"; ô Kết quả = số + thanh % 64px; hành động: Nháp → [Sửa icon][Gửi duyệt sm], còn lại → Xem icon; 2 modal xác nhận/hoàn tất chuyển sang Dialog sm; nút "Nộp báo cáo" ở `actions` của WorkspaceHeader |
| 2026-09-11 | Chi tiết bài nộp (`/submissions/:id`) | P8 (chốt) | 2 cột 8/4; lưới số liệu 3 ô; card phản hồi đổi màu theo trạng thái; minh chứng lưới ảnh |
| 2026-09-11 | Nộp báo cáo (`/submissions/new`, `/edit/:id`) | P9 (chốt), P0 | Form một card + tham chiếu bên phải; footer [Hủy]…[Lưu nháp][Gửi]; 2 modal → Dialog sm; giữ nguyên field và đăng ký trợ lý AI |
| 2026-09-11 | **Khớp lại nhóm P2 + chuỗi nhân viên** (KPI của tôi → Nộp → Chi tiết → Báo cáo của tôi) | P2, P8, P9 | Cùng WorkspaceHeader/FilterBar/StatusBadge/Badge/Dialog; nút quay lại + tiêu đề cùng khuôn ở 2 trang con; microcopy "Gửi duyệt"/"Lưu nháp"/"Tự đánh giá" thống nhất; 0 màu hard-code |
| 2026-09-11 | Đánh giá của tôi / Đánh giá (`evaluations`) | P2 (dùng lại), P1 (gom nhóm) | WorkspaceHeader stats Lượt/Điểm TB + nút "Tự đánh giá" ở actions; banner nhắc hạn `warning-bg` một dòng thay hero; ô Điểm·Xếp loại và badge người chấm (Tự đánh giá `info` / Quản lý `success` / Lãnh đạo chốt `warning`); bấm cả hàng mở chi tiết + icon Xem |
| 2026-09-11 | Tổng quan (`DashboardCustomizeChrome`, `ChartWrapper`, widget shared) | P5 (chốt lại), P0 | Toolbar tuỳ chỉnh = `Button` ghost/outline/default trong khung viền; drawer Ẩn/Hiện → `Drawer sm`; thư viện widget → `Dialog xl` (thẻ chọn = viền primary + nền soft); nút CTA đen → primary; PriorityParts tab active = primary-soft; ChartWrapper là card `rounded-widget p-4/5` |
| 2026-09-11 | Thiết lập chỉ tiêu (`KpiCriteriaPage`) + `KpiFormModal` | P1/P2 (dùng lại), P4 (chốt form), R1–R3 | WorkspaceHeader 3 stats + 4 nút hành động (Nhập Excel · Việc khẩn · Từ hạng mục BSC · Tạo chỉ tiêu); FilterBar: đợt · loại · sắp xếp · **Bộ lọc phụ (popover: ngày, BSC, OKR)**; tab trạng thái SegmentedControl; menu "…" cho hàng có > 3 hành động (Xem · Phân rã · Thêm KPI con · Gửi duyệt · Sửa · Xoá); BulkActionBar [Xoá outline-error][Gửi duyệt N]; `KpiFormModal` → `Dialog lg` với footer [Hủy][Tạo chỉ tiêu / Lưu thay đổi] qua `form="kpi-form"`, biến thể inline giữ nút riêng |
| 2026-09-11 | Đánh giá kỳ, Phân quyền vai trò (header) | P1 | Hero → `WorkspaceHeader` (stats + actions); xếp loại đơn vị đặt ở `actions` |
| 2026-09-11 | **Codemod pass 4–6** (140 + 171 + 39 file) | — | Bỏ `shadow-lg/xl/2xl`/`shadow-inner` trên phần tử trong luồng; `h-11/13` trigger → 36px; màu ngữ nghĩa emerald/amber/red/rose/blue/sky/teal/cyan/orange → token success/warning/error/info (bg/border/text/solid); bảng màu `gray-*` → token trung tính; `bg-white` + viền → `card` |
| 2026-09-11 | **Codemod pass 7–8** (indigo/violet/purple → primary; mọi cặp `slate` → token trung tính; palette sót có `/opacity`, tour, tint on-primary) | — | `text-indigo-100/50` trên card primary → `text-[var(--color-primary-foreground)]/50`; lớp phủ modal `bg-slate-950/50` giữ nguyên (đã chuẩn); 36 lớp phủ bị pass 7 đổi nhầm thành `bg-foreground` đục → sửa lại; CTA `bg-foreground text-white` → primary |
| 2026-09-11 | **Chuyển 59 modal/drawer tự dựng sang `Dialog`/`Drawer`** (toàn bộ `features/`) | P0, P4 | Quy tắc áp cho tất cả: header = tiêu đề + mô tả (tên bản ghi, đợt, tệp) + `headerExtra` (badge trạng thái / toggle); footer = `DialogFooter` với `note` (tổng dòng, cảnh báo ngắn), `secondary` Hủy/Đóng outline, `primary` một nút; form dùng `id` + nút `type="submit" form="…"`; nút phá huỷ (Xoá chính sách) qua `destructive`; modal nhiều trạng thái (Nạp tiền, Xét duyệt bài nộp, Tự đánh giá) đổi footer theo trạng thái thay vì đổi khung; 2 modal xác nhận trong `MemberManagement` → `ConfirmDialog`; `RolePermissionDrawer`, `OrgUnitDrawer`, `ObjectiveDrawer` → `Drawer` (hết `bg-white` cứng ở dark mode); bảng xem trước Excel/danh mục UrBox dùng `size="full" flush`; `overlayClassName`/`z-[60]` chồng lớp bỏ vì portal ra body tự đúng thứ tự |
| 2026-09-11 | Thay `<select>` gốc còn sót (Kho quà UrBox, Tự đánh giá) | R (Select) | Sentinel `__all__` cho "tất cả"; `SelectContent z-[1100]` trong modal |
| 2026-09-11 | **Codemod pass 9** (chữ nhỏ) | — | `text-[11px]` + màu phụ → `text-caption`; `text-[11px] uppercase tracking-*` → `text-eyebrow`; `text-[11px]` còn lại → `text-xs` (12px là sàn); bỏ `tracking-[0.2em]/[2px]/[3px]` ngoài eyebrow; thông báo lỗi/cảnh báo bỏ viết hoa, `font-bold` → `font-medium` |
| 2026-09-12 | Thiết lập công ty — Thông tin & Cấp bậc (`CompanySections`) | P3, P8 | Bỏ tiêu đề viết hoa + icon vuông; header khối = `text-section-title` + mô tả + nút `outline` "Chỉnh sửa"; chế độ xem cấp bậc = danh sách kẻ dòng (số thứ tự soft · tên · badge chức danh); chế độ sửa = lưới 4 cột có tiêu đề cột, nút lên/xuống/xoá `ghost icon-sm` (xoá khoá khi còn 2 cấp), footer [Hủy][Lưu cấu trúc]; hồ sơ: tên = `text-page-title`, trạng thái = `Badge success` "Đang hoạt động", ô nhập 36px chữ thường, thanh lưu dính đáy có "Có thay đổi chưa lưu" |
| 2026-09-12 | Của tôi: Điều chỉnh · Hạnh kiểm · Điểm thưởng · Ví | P2, R10 | Điều chỉnh: WorkspaceHeader stats + `DataTable` + cột "Thay đổi" (hiện tại → đề xuất) + đếm ngược 24h; Điểm thưởng & Ví: tab cấp 2 qua `WorkspaceTabsProvider` (bỏ hàng tab tự vẽ), số dư qua `BalanceHero` (bỏ card nền primary/success chữ token không đọc được) |
| 2026-09-12 | Đánh giá kỳ (phần bảng) | P1, R (SortHeader) | Toolbar → `FilterBar` (tìm · đơn vị · kỳ · nút Xuất/Gửi/Chốt ở `trailing`); dòng trạng thái chốt = dãy `Badge`; bảng chuẩn 44px, ô điểm = số + nhãn xếp loại, cờ "Đã chỉnh tay"/"Đã khoá" là Badge; thẻ mobile |
| 2026-09-12 | Phân tích (6 tab) + Nguồn dữ liệu/Báo cáo (list + chi tiết) | R12, R11, StatCard | Mọi tab dùng `AnalyticsTabHeader`; thẻ số liệu tự vẽ → `StatCard` (highlight cho rủi ro); banner đơn vị DrillDown bỏ nền primary; bỏ pill eyebrow viết hoa ở 5 trang hub; list Nguồn dữ liệu/Báo cáo = WorkspaceHeader + FilterBar + `EntityCard` + `ConfirmDialog` (bỏ `confirm()`); chi tiết: header quay-lại chuẩn, menu khối = Popover, 8 `<select>` gốc → `Select`, xác nhận xoá cột/hàng/khối/gỡ nguồn |
| 2026-09-12 | Thiết lập công cụ (11 mục) | P3 | Pass 10: tiêu đề khối viết hoa → section-title + mô tả; vỏ `rounded-card` không bóng, đệm 20/16; nhãn form không viết hoa; Kỳ/Đợt: FilterBar (lọc ngày trong "Bộ lọc phụ"), bảng chuẩn, dạng thẻ = `EntityCard`, `Pagination` chung; OKR: nút `Button`, EmptyState chuẩn; Quy tắc mã/Module: khối `max-w-4xl` |
| 2026-09-12 | **Codemod pass 11** (AST TypeScript) | R (Button) | 361 `<button className="…tĩnh…">` → `<Button variant size>` theo lớp (primary/outline/ghost/destructive, error-tone), icon bỏ `size=`, tự thêm `aria-hidden`; 51 nút "cấu trúc" (có khối con / `text-left`) trả về `<button>` với 3 kiểu chuẩn: hàng, mục menu, liên kết. Nút không nhãn/không title bỏ qua để sửa tay |
| 2026-09-12 | Thiết lập công ty: Cơ cấu · Chi tiết đơn vị · Nhân viên · Uỷ quyền/Sidebar/Thông báo | P2, P8 | Chi tiết đơn vị viết lại theo P8 (bỏ hero 224px, "Global Governance", "Premium Security Card"); Cơ cấu: WorkspaceHeader + SegmentedControl sơ đồ/danh sách; Nhân viên: WorkspaceHeader stats + FilterBar 3 select, bảng chuẩn; bỏ icon vuông trang trí ở header các khối |
| 2026-09-12 | **Codemod pass 12–13** (AST + regex) | R14, R15 | 72 nút className tam phân → `ChoiceChip` (tab nhỏ = `segment`, chip lọc = `soft`, nút nổi = `solid`); 6 nút icon có nhãn nhưng className động → `Button ghost icon-sm`; 4 toggle tự vẽ → `Switch`; `font-bold` trên chữ ≤ 14px → `font-medium`, còn lại → `font-semibold` (700 chỉ giữ ở landing/biểu đồ) |
| 2026-09-12 | 6 khối lớn "chuẩn vỏ chưa chuẩn ruột": Thang điểm (3 khối) · Xếp loại đơn vị · Kho quà UrBox · BSC cây thẻ · Email editor | P3, R14 | Thang điểm: đọc = danh sách `<ol>`/bảng có chấm màu, sửa = lưới cột có tiêu đề, footer phải, `max-w-3xl`; Xếp loại: header section-title + mô tả, Đặt lại `outline`/Lưu primary; UrBox: ô tìm 36px, đếm "N món", thẻ quà `aria-pressed` + primary-soft, Badge chuẩn; BSC cây: EmptyState trong khung nét đứt, nút hàng = khối (tên + mô tả xếp dọc), `IconAction` → `Button ghost icon-sm` màu nhấn theo việc, Badge/`text-stat`/tabular cho số, bỏ `dark:` trùng token; Email editor: nút toolbar 32px vuông có `aria-label`, popover `bg-popover shadow-lg`, mục menu 2 dòng, ô màu có focus ring, ô link 36px, `role=toolbar/menu` |
| 2026-09-12 | Hồ sơ · Hiệu suất nhân sự · Trang lỗi · Quản trị nền tảng · Xác thực (5) · Luồng KPI · Wizard | P8, StatCard | Hồ sơ: bỏ banner primary, avatar 80px + badge; tab trái = nút chọn có viền primary; ô đọc = `dl`; Hiệu suất nhân sự: 5 StatCard + danh sách chỉ tiêu có thanh tiến độ + nút Nhắc; Trang lỗi gọn 1 cột; Quản trị nền tảng: StatCard chung, Badge trạng thái, Pagination chung; Xác thực: tiêu đề page-title, ô nhập 40px, microcopy thường (không "Trở lại trình Đăng nhập") |

## T. Nợ còn lại (ghi rõ để không thành "chấp nhận ngầm")

| Việc | Số lượng | Cách xử lý |
|---|---|---|
| `<button>` thô còn lại | ~254 | đều là nút "cấu trúc" (hàng danh sách, mục menu, tab gạch chân, ô mở rộng, ô màu) — đã theo 3 kiểu chuẩn hàng/mục menu/liên kết; đổi tiếp khi chạm file; quy tắc: nút icon phải có `aria-label` |
| Modal/drawer tự dựng `fixed inset-0` | 3 (cố ý) | lightbox, sheet cây mobile (trái), backdrop sidebar mobile |
| `font-bold` | ~45 | chỉ còn ở landing, biểu đồ và số liệu hero (700 hợp lệ trong thang) |
| Trang chưa qua lượt thiết kế riêng | 0 | tất cả 60 trang/mục trong §C đã qua ít nhất một lượt (12/09); 6 khối lớn cũng đã sửa ruột (12/09) |
| Variant nút do codemod 11 gán theo lớp cũ | chưa đếm | chỉ nhìn ra khi chạy app: nút phụ thành primary hoặc ngược lại — sửa theo ảnh chụp từng trang |
