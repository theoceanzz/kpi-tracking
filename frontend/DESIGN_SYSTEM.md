# KeyGo — Hệ thống thiết kế (spec lượt 1)

Tài liệu này là "mục 6A" đã chốt. Khi mở lượt áp dụng ở cuộc trò chuyện mới, dán lại
toàn bộ file này trước file cần sửa. Nguồn sự thật của mọi giá trị là
`src/index.css` và `src/store/themeStore.ts`; file này chỉ giải thích *vì sao*.

## 1. Màu

### 1.1 Màu chủ đạo — do người dùng chọn, 8 màu, mỗi màu hai bộ

Chữ trắng trên tông 500 của Tailwind **không** đạt AA ở 7/8 màu (indigo-500 4.47:1,
amber-500 2.15:1, sky-500 2.77:1…). Vì vậy bản sáng dùng tông 600–700, bản tối dùng
tông 300–400 với chữ slate-900. `themeStore.applyTheme()` ghi ba biến lên `<html>`:
`--color-primary`, `--color-primary-hover`, `--color-primary-foreground`.

| Màu | Sáng: nền nút | Tương phản chữ trắng | Tối: nền nút | Tương phản chữ #0f172a | Trùng tông với | Cách tách |
|---|---|---|---|---|---|---|
| Indigo | `#4f46e5` | 6.3 | `#818cf8` | 6.0 | — | — |
| Blue | `#2563eb` | 5.2 | `#60a5fa` | 7.1 | info (badge "Đã chỉnh sửa") | badge = nền nhạt + viền, nút = nền đặc |
| Sky | `#0369a1` | 5.9 | `#38bdf8` | 8.4 | — | — |
| Emerald | `#047857` | 5.5 | `#34d399` | 9.4 | **success** ("Đã duyệt") | badge nền nhạt + chấm + viền; nút nền đặc, không viền |
| Rose | `#e11d48` | 4.7 | `#fb7185` | 6.4 | **error** ("Từ chối"), nút xoá | nút xoá luôn có icon/nhãn phá huỷ, đứng riêng bên trái; badge nền nhạt |
| Amber | `#b45309` | 5.0 | `#fbbf24` | 10.8 | **warning** ("Chờ duyệt") | như trên |
| Violet | `#7c3aed` | 4.9 | `#a78bfa` | 6.6 | **K.AI** | `data-theme-color="violet"` → K.AI chuyển sang cyan; AI luôn có icon `Bot` + nhãn |
| Slate | `#475569` | 7.6 | `#94a3b8` | 7.0 | trung tính | nút chính vẫn là ô đặc duy nhất trên màn |

Màu tự chọn (ô color picker): foreground = trắng nếu ≥ 4.5:1, ngược lại slate-900;
hover = pha 12 % đen (sáng) / trắng (tối). Hạn chế đã biết: các file cũ còn hard-code
`text-white` trên nền primary — với màu tự chọn quá nhạt sẽ khó đọc cho tới khi file
đó được sửa.

Dẫn xuất tự động (không cần JS): `--color-primary-soft` = 9 % primary pha card (nền
mục đang chọn), `--color-primary-deep` (tông sâu cho `indigo-800/900`).

### 1.2 Trung tính (slate)

| Token | Sáng | Tối | Dùng cho |
|---|---|---|---|
| `--color-background` | `#f8fafc` | `#0f172a` | nền trang |
| `--color-card` | `#ffffff` | `#1e293b` | card, sidebar, header, popover |
| `--color-muted` | `#f1f5f9` | `#1e293b` | đầu bảng, hover hàng, nút secondary |
| `--color-accent` | `#f1f5f9` | `#273449` | active của nút ghost |
| `--color-border` | `#e2e8f0` | `#334155` | viền mặc định |
| `--color-border-strong` | `#cbd5e1` | `#475569` | viền hover / checkbox |
| `--color-foreground` | `#0f172a` | `#f8fafc` | chữ chính |
| `--color-muted-foreground` | `#64748b` | `#94a3b8` | chữ phụ, nhãn (4.8:1 trên trắng) |
| `--color-subtle-foreground` | `#94a3b8` | `#64748b` | icon trang trí, dấu "…" |

### 1.3 Ngữ nghĩa — chữ đậm trên nền nhạt, có viền mờ

| | Chữ (sáng) | Nền (sáng) | Tỷ lệ | Chữ (tối) | Nền (tối) |
|---|---|---|---|---|---|
| success | `#047857` | `#ecfdf5` | 5.2 | `#6ee7b7` | 14 % emerald pha card |
| warning | `#b45309` | `#fffbeb` | 4.8 | `#fcd34d` | 14 % amber pha card |
| error | `#b91c1c` | `#fef2f2` | 5.9 | `#fca5a5` | 14 % red pha card |
| info | `#1d4ed8` | `#eff6ff` | 6.3 | `#93c5fd` | 14 % blue pha card |
| destructive (nút) | trắng | `#dc2626` | 4.8 | trắng | `#ef4444` |

Quy tắc bất biến: **badge trạng thái không bao giờ nền đặc; nút hành động không bao
giờ nền nhạt.** Đây là cách phân biệt hành động và trạng thái khi màu trùng tông.

### 1.4 K.AI

`--color-ai #7c3aed` / `--color-ai-accent #0891b2` / `--color-ai-soft` / `--color-ai-line`.
Chỉ ở rãnh dọc, icon, nhãn, viền của khu vực trợ lý. Khi primary thuộc dải tím
(hue 250–290, bão hoà > 0.35) → toàn bộ chuyển sang cyan (`#0e7490` trên sáng, 5.4:1).

## 2. Khoảng cách (lưới 4 px)

| Việc | Giá trị |
|---|---|
| Padding card / widget | 16 px (`p-4`), 20 px ở widget rộng (`sm:p-5`) |
| Gap giữa card trong lưới | 16 px |
| Padding vùng nội dung | 16 px mobile / 24 px desktop (`p-4 md:p-6`) |
| Chiều cao hàng bảng | 44 px (`py-3` + chữ 14/20); đầu bảng 36 px |
| Padding ô bảng | 16 px ngang |
| Chiều cao control | 32 / 36 / 40 px (`sm` / mặc định / `lg`) |
| Chiều cao header, đầu sidebar | 56 px (`h-14`) |
| Chiều cao dòng sidebar | 36 px cấp 1, 32 px cấp 2–3 |
| Khoảng cách tiêu đề trang → nội dung | 24 px |

## 3. Chữ

Inter giữ lại có chủ đích: đủ dấu tiếng Việt ở mọi độ đậm, có số tabular, đang chạy
nên không rủi ro vỡ layout. Phân cấp đến từ **cỡ + đậm + màu**, không từ đổi font.
Thang đậm chỉ còn 400 / 500 / 600 / 700 (`font-black`, `font-extrabold` bị ép về 700
vì Inter chỉ nạp tới 700 — trước giờ trình duyệt vẫn giả lập).

| Utility | Cỡ / dòng | Đậm | Ghi chú |
|---|---|---|---|
| `text-page-title` | 22 / 28 | 600 | h1, `PageHeader`, `WorkspaceHeader`; tracking −0.01em |
| `text-section-title` | 16 / 24 | 600 | h3 card, tiêu đề widget, hộp thoại |
| `text-label` | 13 / 16 | 500 | nhãn form |
| body | 14 / 20 | 400 | mặc định trên `body` |
| `text-caption` | 12 / 16 | 400 | phụ chú, màu muted |
| `text-eyebrow` | 11 / 16 | 500 | nhãn chữ hoa nhỏ (đầu cột, nhãn thẻ số liệu); thay cho `text-[10px] font-black uppercase tracking-widest` |
| `text-stat` | 28 / 32 | 600 | số liệu lớn; tabular; tracking −0.02em |

`<table>` và `<dd>` bật `tabular-nums` toàn cục.

## 4. Icon

lucide-react, stroke mặc định (2) — 1.75 cho icon lớn ≥ 22 px ở empty state.
Cỡ: sidebar cấp 1 = 20, mục trong trang & sidebar cấp 2 = 18 (ép về 16 trong dòng
32 px), inline trong nút/bảng = 16, trong nút `sm` = 14. Icon trang trí luôn
`aria-hidden="true"`.

## 5. Bo góc & bóng

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--radius-control` (`rounded-control`) | 6 px | button, input, select, badge, tab, dòng sidebar |
| `--radius-card` (`rounded-card`) | 8 px | card, panel, popover, dialog, bảng |
| `--radius-widget` (`rounded-widget`) | 12 px | **chỉ** widget dashboard và `react-grid-placeholder` |
| `--radius` | alias của control | giữ cho `rounded` trần |

Bóng: 3 mức `--shadow-1/2/3`, đều nhẹ. Phân tầng chủ yếu bằng **viền**; bóng chỉ cho
thứ nổi lên (popover, dropdown, drawer mobile). Không bóng màu, không glassmorphism.

Lớp cầu nối trong `@theme` (chỉ để code cũ tự đúng, không viết code mới dựa vào):
`rounded-lg`→6, `rounded-xl/2xl`→8, `rounded-3xl/4xl`→12; `shadow-sm`→1, `shadow-md`→2,
`shadow-lg/xl/2xl`→3; `*-indigo-*`, `*-violet-*`, `*-purple-*` → các mức của `--color-primary`;
`tracking-widest`→0.06em.

## 6. Trạng thái tương tác (đã viết thành `cva` ở `src/components/ui/`)

| Component | default | hover | active | focus-visible | disabled |
|---|---|---|---|---|---|
| Button `default` | primary / primary-fg | primary-hover | primary-hover | ring 2 px primary, offset 2 | opacity 50, no events |
| Button `destructive` | destructive / trắng | destructive-hover | — | như trên | như trên |
| Button `outline` | card + viền border | muted + viền strong | accent | như trên | như trên |
| Button `secondary` | muted | accent | border | như trên | như trên |
| Button `ghost` | trong suốt | muted | accent | như trên | như trên |
| Badge / StatusBadge | nền nhạt + chữ đậm + viền mờ | — | — | — | — |
| Select trigger | card + viền input, 36 px | viền strong | — | ring + viền primary | opacity 50 |
| Select item | — | nền muted | — | (= hover) | opacity 50 |
| Hàng bảng (click được) | card | muted | — | — | — |
| Tab (`WorkspaceHeader`) | chữ muted, gạch trong suốt | chữ fg, gạch border-strong | — | ring inset | — |
| Dòng sidebar | chữ muted | nền muted, chữ fg | — | outline toàn cục | — |
| Dòng sidebar active | nền primary-soft, chữ primary | — | — | — | — |

Focus toàn cục: `:focus-visible` outline 2 px màu ring, offset 2 px, cho mọi phần tử
tương tác (kể cả `<button>` thô chưa dùng `Button`).

## 7. Tình trạng áp dụng

Đã xong toàn bộ 8 bước của lộ trình:

| Bước | Cách làm |
|---|---|
| (1) token, `ui/*`, `StatusBadge`, `themeStore` | viết tay |
| (2) sidebar, header, breadcrumb, chuông, `ThemeCustomizer` | viết tay |
| (3) `DataTable`, `Pagination`, `SortHeader` | viết tay |
| (4) `WidgetShell`, `StatCard` | viết tay |
| (5) `SettingsSectionLayout` (khung form cấu hình) | viết tay; nội dung từng mục qua codemod |
| (6) `EmptyState`, `LoadingSkeleton`, `ConfirmDialog`, `PageHeader` | viết tay |
| (7) `NotificationBell`, `NotificationDropdown`, `NotificationsPage` | viết tay |
| (8) `AiAssistantWidget`, `AiAssistantPage`, `InsightCards`, `FormPatchPreview` | viết tay (chuyển sang token `--color-ai`) |
| ~220 file feature còn lại | codemod theo quy tắc §8 |

Ngoài phạm vi (cố ý giữ nguyên): `features/landing` (trang giới thiệu, ngoài app) và
`features/rewards/components/certificate` (thiết kế in).

## 8. Quy tắc codemod đã áp cho file feature

Áp một lần, có thể chạy lại khi merge code cũ. Mọi quy tắc đều là thay thế thuần class,
không đổi JSX/logic, không đổi `id`/`aria-*`.

| # | Từ | Thành | Lý do |
|---|---|---|---|
| 1 | `rounded-[Npx]`, `rounded-[Nrem]` (cả `-t/-b/…`) | ≤ 6px → `rounded-control`; còn lại → `rounded-card` | §5 |
| 2 | `text-[8px]`, `text-[9px]`, `text-[10px]` | `text-[11px]` | sàn đọc được |
| 3 | `shadow-<màu>-N/N`, `shadow-[var(--color-primary)]/N`, `shadow-[0_0_…]` | bỏ | không bóng màu |
| 4 | `hover:scale-*`, `active:scale-*`, `group-hover:scale-*`, `hover:-translate-y-*` | bỏ | không hiệu ứng phóng/nhấc |
| 5 | `bg-gradient-to-* from-A to-B` | nền đặc theo tông của A: indigo/blue/violet → `--color-primary`; emerald → `--color-success-solid`; rose/red → `--color-error-solid`; amber → `--color-warning-solid`; tông ≤ 200 → `--color-primary-soft` / `--color-muted`; slate đậm → `--color-foreground` | không gradient ngoài K.AI |
| 5b | gradient chữ (`bg-clip-text text-transparent`) | `text-[var(--color-primary)]` | — |
| 6 | `backdrop-blur-*`; `bg-white/60…100`, `bg-slate-900/60…100` | bỏ blur; nền đặc | không glassmorphism |
| 7 | `animate-pulse` trên chấm/huy hiệu màu; `animate-ping`; `animate-in fade-in duration-*` ở gốc trang; các `<div absolute rounded-full blur-2xl/3xl>` trang trí | bỏ | animation không phục vụ mục đích |
| 8 | `text-white` đứng cùng `bg-indigo-*`/`bg-[var(--color-primary)]` (kể cả `hover:`) | `text-[var(--color-primary-foreground)]` | đúng với cả 8 màu + bản tối |
| 9 | cặp `bg-white dark:bg-slate-900`, `border-slate-200 dark:border-slate-800`, `text-slate-900 dark:text-white`, `text-slate-500 dark:text-slate-400`, `bg-slate-50 dark:bg-slate-800`, `divide-slate-100 dark:divide-slate-800`… | token tương ứng (`card`, `border`, `foreground`, `muted-foreground`, `muted`) | một nguồn màu |
| 10 | `text-[11px] … uppercase tracking-widest` (+ `font-black`, `text-slate-400`) | `text-eyebrow`; nếu là `<label>` → `text-label` | thang chữ §3 |

Lớp cầu nối trong `@theme` xử lý phần còn lại (`rounded-xl`, `shadow-2xl`, `font-black`,
`*-indigo-*`, `*-violet-*`, `*-purple-*`) nên không cần codemod cho các class đó.

Pass 3 (bổ sung sau rà soát):
- `text/bg/border-slate-*` **đứng lẻ** (không có `dark:` cùng nhóm trong cùng chuỗi) → token theo tông
  (900–800 → foreground, 700–500 → muted-foreground, 400–300 → subtle-foreground; bg 50–100 → muted;
  border 100–200 → border, 300 → border-strong). Còn **0** chỗ text-slate lẻ ngoài `features/landing`.
- Độ đậm theo ngữ cảnh thẻ: `<label>` → `text-label`; `<h1>` → `text-page-title`; `<h2>/<h3>` →
  `text-section-title`; `<button>/<a>/<th>` → `font-medium`; còn lại `font-black/extrabold` → `font-semibold`.
  Còn **0** `font-black` trong code (chỉ còn trong comment).
- `rounded-md/lg/xl/2xl/3xl` → `rounded-control/card/widget`. Còn 29 chỗ, toàn bộ trong
  `rewards/components/certificate` (thư mục cố ý bỏ qua); lớp cầu nối vẫn đỡ.
- `text-page-title` / `text-section-title` **không đặt màu** — kế thừa từ khối chứa, nên tiêu đề trên nền
  màu (panel đăng nhập, banner) không bị đổi sang chữ tối.
- Thêm `--color-ai-solid` và `--color-*-solid`: nền đặc giữ tông 700 ở cả hai chế độ, vì token chữ ở bản tối
  là tông sáng.

## 9. Kiểm thử trực quan đã làm

Không có Java nên không chạy được backend/đăng nhập. Đã kiểm bằng Chrome headless trên:
- **Styleguide 8 màu × sáng/tối** (`dist/sg/*.html`, sinh bởi script trong scratchpad, dùng đúng CSS build ra):
  sidebar + dòng active, header + chuông, 5 loại nút, 4 thẻ số liệu, tab, bảng với 5 trạng thái badge,
  form, khối K.AI, và khối "lớp cầu nối" (`bg-indigo-600`, `bg-violet-600`, `rounded-2xl`, `shadow-2xl`).
  Đã soi: amber-sáng, emerald-sáng, violet-sáng, indigo-tối, emerald-tối. Lỗi tìm được và đã sửa:
  nút "Gửi" K.AI mất tương phản ở bản tối (→ `--color-ai-solid`); `text-white` cạnh nền primary ở dòng khác.
- **Đăng nhập thật** (`vite preview`) ở 1440px và 390px (iframe, vì Chrome headless ép viewport ≥ 504px).
  Lỗi tìm được và đã sửa: tiêu đề hero bị ép màu tối; "Go Smarter." thành màu primary trên nền primary;
  hai "quả cầu mờ" và nền radial trang trí.
- **Khung modal/drawer** qua một trang thử tạm (đã xoá sau khi kiểm, không nằm trong repo):
  tiêu đề dài bị cắt `…` mà badge vẫn còn; footer [Xoá]…[Quay lại][Chính]; drawer cuộn trong thân, footer dính đáy;
  ở 504px dialog thành bottom-sheet, ba nút vẫn vừa một hàng. Đã soi violet sáng/tối, emerald sáng.
- **Thẻ số liệu / thẻ bản ghi** (cùng trang thử tạm): `BalanceHero`, `StatCard` (kể cả highlight), `EntityCard` với tên dài — sáng/tối.
  Lỗi tìm được và đã sửa: `StatCard highlight` mất cỡ chữ vì tailwind-merge coi `text-stat` là màu → `extendTailwindMerge` (R13).
- Chưa kiểm được (cần đăng nhập): dashboard widget kéo-thả, `DataTable` dạng thẻ dưới 768px, tour.

Đã làm thêm ở pass 9: `text-[11px]` → `text-caption`/`text-eyebrow`/`text-xs` (0 còn lại ngoài `landing/`, `charts/`).
Pass 13 đã hạ `font-bold` về `font-medium`/`font-semibold` (còn ~45, chỉ ở landing/biểu đồ).
