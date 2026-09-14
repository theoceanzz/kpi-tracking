---
name: bieu-do-chuan
description: Tiêu chuẩn bắt buộc cho mọi biểu đồ thống kê trong KeyGo — tiêu đề, nhãn trục, chú giải, nhãn số liệu, chọn đúng loại biểu đồ. Dùng khi thêm mới, sửa, hoặc rà soát bất kỳ biểu đồ nào trong /analytics, dashboard, hoặc báo cáo. Kèm ngưỡng quyết định cụ thể và các bẫy đã gặp trong dự án.
license: MIT
metadata:
  version: "1.0.0"
---

# Biểu đồ chuẩn — KeyGo

Áp cho **mọi** biểu đồ trong `frontend/src/components/charts/` và `frontend/src/features/analytics/`.

## Vì sao có tài liệu này

Có khoảng 25 biểu đồ trong sản phẩm, dựng rải rác qua nhiều đợt. Không có chuẩn thành văn thì mỗi
cái thiếu một thứ khác nhau — cái mất nhãn trục, cái dùng tooltip mặc định của Recharts trông lạc
hẳn, cái vẽ sai loại biểu đồ so với bản chất dữ liệu. Người dùng đọc cả trang chứ không đọc từng
biểu đồ, nên sự thiếu nhất quán đó lộ ra ngay.

## 5 thành phần bắt buộc

### 1. Tiêu đề — LUÔN LUÔN

Nói **cái gì được đo**, không nói tên loại biểu đồ.

- ✅ `Phân bổ trọng số & tiến độ KPI`
- ❌ `Biểu đồ cây` — người đọc cần biết nội dung, không cần biết kỹ thuật vẽ
- ❌ `KPI đơn vị` — quá mơ hồ, không nói đang đo gì về KPI

Dùng prop `title` của `ChartWrapper`. Thẻ tự dựng thì `<h3 className="text-sm font-black">`.

### 2. Nhãn trục X — trừ khi trục là danh mục hiển nhiên

**Bỏ được khi** trục liệt kê tên đơn vị, tên người, tên kỳ — dán chữ "Đơn vị" cạnh một cột tên đơn vị là chú thích thừa.

**Bắt buộc khi** trục là một đại lượng có đơn vị: điểm, %, số ngày, số KPI. Không có nhãn thì `75` là 75 gì?

### 3. Nhãn trục Y — gần như luôn luôn

Trục dọc hầu như luôn là đại lượng đo được, nên hầu như luôn cần nhãn. Ghi kèm đơn vị: `% người`, `điểm/5`, `số KPI`.

**Cảnh báo hai thang đo**: nếu hai chuỗi dùng hai thang khác nhau (ví dụ org bật ma trận thì hiệu suất là điểm 1–5 còn tiến độ là %), phải nói ra đơn vị của **cả hai** — xem `AnalyticsComboChart`.

### 4. Chú giải — khi có từ 2 chuỗi trở lên

**Bỏ được khi** chỉ có một chuỗi và tiêu đề đã nói nó là gì.

**Bắt buộc khi** có nhiều màu. Màu không tự giải thích được.

Ưu tiên chú giải tự dựng bằng HTML (`<div>` + chấm màu) hơn `<Legend>` của Recharts: nó không giành chỗ vẽ và không bị cắt trên màn hẹp.

### 5. Nhãn số liệu — theo ngưỡng, không phải luôn luôn

**IN số lên hình khi cả hai đúng:**
- ≤ 12 mốc trên trục danh mục
- mỗi mốc rộng ≥ 40px ở khổ hẹp nhất mà widget có thể có

**KHÔNG in khi:**
- biểu đồ phân tán (chấm chồng nhau, số sẽ thành một đám mực)
- heatmap ô nhỏ
- đường có > 8 mốc
- treemap ô hẹp hơn ~54×26px

Chỗ không in số thì **tooltip là nơi đọc số** — và tooltip đó phải đủ, không được thiếu đơn vị.

### KHÔNG dùng số hiệu hình

Widget kéo thả và ẩn/hiện được nên mọi số đều lỗi thời ngay khi người dùng sắp lại lưới, và hai người xem cùng một trang có thể thấy hai số khác nhau. Người dán ảnh vào báo cáo tự đánh số theo tài liệu của họ.

---

## Chọn đúng loại biểu đồ

Trước khi lo trang trí, kiểm tra biểu đồ có **nói đúng** không.

| Muốn trả lời | Dùng | Đừng dùng |
|---|---|---|
| Tỉ trọng các phần trong một tổng | 100% stacked, treemap, tròn | đường |
| Mức độ thay đổi theo thời gian | đường, cột | tròn |
| Hình dạng phân bố | đường cong mật độ, histogram, boxplot | cột theo mức |
| Quan hệ giữa hai đại lượng | phân tán | hai đường trên hai trục |
| So sánh giữa các nhóm | cột, lollipop | tròn nhiều lát |

### Ba lỗi ngữ nghĩa đã từng mắc trong dự án này

**1. Ép 100% stacked lên dữ liệu không cộng thành tổng.** Chỉ chuẩn hoá được khi các chuỗi thật sự là các phần của một tổng thể. Điểm BSC thô của 4 hạng mục là bốn thang độc lập — một đơn vị đạt 80 cả bốn mà hiện thành "mỗi hạng mục 25%" là đọc ngược sự thật. Muốn 100% thì phải dùng **điểm đã nhân trọng số**.

**2. Hai trục Y cho hai đại lượng khác loại.** Cột là số lượng đọc theo trục phải, đường là tỉ lệ đọc theo trục trái — mắt người không có cách nào biết, nên tự so chiều cao cột với chiều cao đường, một phép so vô nghĩa. Nếu buộc phải đặt hai đại lượng cạnh nhau, cho đại lượng phụ thành **kích thước chấm** hoặc tách ra khung riêng.

**3. Phân trang một biểu đồ phần-trên-tổng-thể.** Phân trang là cách đọc của **bảng**. Treemap hay 100% stacked mà chỉ hiện 5/107 mục thì phần được vẽ không còn là một tổng thể nào cả.

---

## Chỗ dùng lại — đừng viết lại

| Cần gì | Dùng |
|---|---|
| Khung thẻ + tiêu đề + nút ghim/sao chép | `components/common/dashboard/ChartWrapper.tsx` |
| Nhãn trục | `components/charts/axisLabel.ts` — `xAxisLabel()`, `yAxisLabel()` |
| Tooltip | `components/charts/ChartTooltip.tsx` — `ChartTooltip` (tự dựng dòng) hoặc `SeriesTooltip` (một chuỗi một dòng) |
| Màu | `components/charts/chartPalette.ts` — `seriesColor()`, `ratingColor()`, `AXIS_COLORS` |
| Nút chuyển biểu đồ ↔ bảng | `useChartTableView` + `ViewToggleButtons` |
| Nút chuyển xu hướng ↔ cơ cấu % | `useTrendMode` + `TrendModeToggle` |

**KHÔNG dùng tooltip mặc định của Recharts** (`<Tooltip />` trần hoặc chỉ có `formatter`). Nó có dáng khác hẳn phần còn lại của hệ thống.

Primitive dựng sẵn ở `components/charts/primitives/`: `Boxplot`, `BulletChart`, `DumbbellDotPlot`, `FlowSankey`, `HierarchicalTreemap`, `Histogram`, `Lollipop`, `StackedComposition`, `WeightTreemap`. Xem qua trước khi viết biểu đồ mới. (`BubbleChart`, `DensityCurve`, `DivergingBar`, `Waterfall`, `PerspectiveRadar` đã xoá đợt 09/2026 vì trùng câu hỏi với hình khác; đừng dựng lại mà không có lý do mới.)

## Vỏ ngoài biểu đồ (từ 09/2026)

- Lưới `CartesianGrid`: nét **liền**, `stroke="var(--color-border)"`, thường chỉ đường ngang. Nét đứt chỉ dành cho ngưỡng/tham chiếu (`ReferenceLine`, đường "tổng nhóm").
- Chữ: không `font-black` (Inter/Be Vietnam Pro không nạp 900), không cỡ dưới 12px (`text-xs` là sàn), không nhãn `uppercase tracking-*` ngoài tiêu đề mục trong bảng cấu hình và tiêu đề nhóm trong thư viện.
- Bo góc: thẻ/ô lưới/drawer `rounded-2xl`; nút/input/select/tooltip `rounded-lg`; chip/badge `rounded-full`. Không dùng `rounded-[Npx]`.
- Icon cạnh tiêu đề ô: `text-slate-400`. Màu chỉ dành cho dữ liệu; chrome dùng `var(--color-primary)`, không hard-code `indigo-600`/`violet-*`.
- Không gạch ngang dài "—"/"–" trong chuỗi hiển thị (ô trống dùng "-", câu thì viết lại bằng dấu phẩy/chấm).

---

## Bẫy kỹ thuật đã gặp

**`ResponsiveContainer height="100%"` trong div chỉ có `min-h` → không vẽ gì.**
`min-height` không phải chiều cao xác định, phần trăm rơi về `auto`, container đo ra 0. Triệu chứng đặc trưng: **chỗ trống đúng bằng `min-h` nhưng không có cả trục lẫn lưới**. Sửa: đưa số cụ thể (`height={fillHeight ? '100%' : 380}`) hoặc cho vật chứa `h-[…]`/`h-full` thật.

**Đừng so tổng lint toàn repo.** `npx eslint src` trả về số khác nhau mỗi lần chạy. Kiểm theo **từng file** với mốc trước khi sửa.

**`npm run build` đang hỏng vì việc khác** (`SystemSettingsPage` → `WorkflowSettingsTab`). Dùng `npx tsc --noEmit && npx vite build`.

**Lề trái ÂM cắt cụt nhãn trục dọc.** `margin={{ left: -8 }}` là mẹo quen để kéo biểu đồ sát mép,
nhưng nhãn `insideLeft` bị đẩy ra ngoài vùng vẽ và biến mất. Triệu chứng đặc trưng: **một vệt mờ
dựng đứng sát mép trái** thay vì chữ. `left: 0` thì vẫn ổn — trục dọc có `width` riêng để chứa nhãn.

**Nhãn trục ngang đè lên chú giải nằm dưới.** `xAxisLabel` đặt chữ ở `insideBottom`, đúng chỗ
`<Legend>` mặc định chiếm. Hai dòng chữ chồng lên nhau thành một đám không đọc được. Cách xử lý
trong dự án này: đưa chú giải lên trên — `<Legend verticalAlign="top" align="right" />`. Nhớ kèm
`margin.bottom` ≥ 30 cho biểu đồ có nhãn trục ngang, không thì nhãn bị khung cắt.

**Ô treemap được vẽ cha trước con sau**, nên nhãn nhóm luôn bị ô con đè. Muốn nhãn nhóm thì tách mỗi nhóm một treemap với tiêu đề HTML riêng.

**Trục danh mục thì ĐỪNG gắn nhãn — kể cả khi bộ dò báo thiếu.** Biểu đồ nằm ngang có
`<YAxis type="category" dataKey="name">` liệt kê tên người/đơn vị: dán chữ "Nhân sự" cạnh đó là
chú thích thừa. Quét bằng regex sẽ báo "thiếu nhãn" hàng loạt ở đây — phải xem `type=` rồi mới kết
luận. Cũng nhớ Recharts cho gắn nhãn bằng **cả hai** cách: prop `label=` và `<Label>` lồng bên
trong; bộ dò chỉ tìm `label=` sẽ báo nhầm những chỗ đã có nhãn.

**Biểu đồ bấm được phải nói ra là bấm được.** Con trỏ đổi hình là chưa đủ — cần cả hiệu ứng khi rê chuột, dấu hiệu trên hình, và một dòng chỉ dẫn.

---

## Checklist trước khi coi là xong

- [ ] Tiêu đề nói **cái được đo**, không nói tên loại biểu đồ
- [ ] Trục X có nhãn, hoặc là danh mục hiển nhiên
- [ ] Trục Y có nhãn **kèm đơn vị**
- [ ] Hai thang đo khác nhau thì nói rõ cả hai
- [ ] ≥ 2 chuỗi thì có chú giải
- [ ] Nhãn số liệu đúng ngưỡng — không in bừa, không bỏ sót chỗ đọc được
- [ ] Tooltip dùng `ChartTooltip`/`SeriesTooltip`, có đơn vị
- [ ] Loại biểu đồ **nói đúng** bản chất dữ liệu (đọc lại 3 lỗi ngữ nghĩa ở trên)
- [ ] `ResponsiveContainer` có chiều cao quy chiếu được
- [ ] `npx tsc --noEmit` sạch, `npx vite build` sạch, lint từng file không tăng
