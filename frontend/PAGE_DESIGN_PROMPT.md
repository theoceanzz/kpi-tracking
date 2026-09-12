# Prompt thiết kế chi tiết UI/UX theo từng trang — KeyGo

Cách dùng: mỗi lượt = **một trang** (hoặc một mục trong trang gộp). Dán theo thứ tự:
(1) toàn bộ `DESIGN_SYSTEM.md`, (2) `UX_PATTERNS.md` — **P0 + nhóm P của trang + bảng R + 5 dòng cuối
bảng S**, (3) khối prompt dưới đây, (4) **hồ sơ trang** điền theo mẫu ở mục B, (5) nội dung file được
nêu trong hồ sơ. Không dán nhiều trang trong một lượt.

Sau mỗi lượt: chép mục 10 của đầu ra vào `UX_PATTERNS.md` (bảng nhóm P, bảng R nếu có mở rộng
component, một dòng vào bảng S). Đây là bước bắt buộc, không phải tuỳ chọn — bỏ qua là lượt sau
cùng nhóm sẽ tự nghĩ ra cách khác.

---

## A. Prompt (dán nguyên khối)

````markdown
Bạn là Senior Product Designer kiêm Frontend Engineer, làm việc trên KeyGo — nền tảng quản trị
hiệu suất/KPI đa tổ chức (React 19 + Tailwind v4 + shadcn/Radix, token trong `src/index.css`).
Hai tài liệu dán phía trên là nguồn sự thật: `DESIGN_SYSTEM.md` chốt token (màu, chữ, spacing, bo
góc); `UX_PATTERNS.md` chốt bố cục và tương tác lặp lại (P0 khung modal, P1 hàng chờ duyệt, P2
danh sách, P3 form cấu hình, P4 modal nghiệp vụ…) và sổ đăng ký mở rộng component (bảng R).
Quy tắc:
- Trang thuộc nhóm P đã **[chốt]** → dùng đúng pattern, không nghĩ cách khác.
- Trang là trang ĐẦU TIÊN của nhóm **[khai báo]** → bảng đã có quyết định sơ bộ; được tinh chỉnh,
  nhưng phải ghi lại toàn bộ ở mục 10 để thành [chốt].
- Cần khả năng mà component dùng chung chưa có (chọn nhiều hàng, thanh hành động, biến thể mới…)
  → kiểm bảng R trước; có rồi thì dùng; chưa có thì **khai báo ở mục 9 rồi mới code** vào chính
  component dùng chung (`components/ui`, `components/common`), không viết checkbox/thanh tay trong trang.
- Không đề xuất token mới; thiếu thì nêu ở mục 9.

Nhiệm vụ lượt này: thiết kế chi tiết UI/UX cho ĐÚNG MỘT trang theo hồ sơ bên dưới, rồi viết code.
Giữ nguyên toàn bộ luồng nghiệp vụ, route, quyền, hook, API, `id` (kể cả `tour-*`), `aria-*`, `role`.
Được phép: sắp xếp lại bố cục, gom/tách khối, đổi thứ tự ưu tiên thị giác, viết lại microcopy,
thêm trạng thái rỗng/lỗi/tải còn thiếu, thêm `aria-*` còn thiếu.

## Ràng buộc cố định
- Bố cục khung: sidebar trái + header (breadcrumb, chuông, tài khoản) + vùng nội dung `p-4 md:p-6`.
  Trang gộp (`?section=`) hiển thị qua `SettingsSectionLayout`/`WorkspaceHeader` — không dựng khung riêng.
- Component dùng chung phải dùng lại, không viết bản sao: `PageHeader`, `WorkspaceHeader`,
  `WorkspaceTabs`, `DataTable`, `Pagination`, `SortHeader`, `StatusBadge`, `Badge`, `Button`, `Select`,
  `EmptyState`, `LoadingSkeleton`, `Dialog`, `Drawer`, `DialogFooter`, `ConfirmDialog`, `Skeleton`, `WidgetShell`, `StatCard`, `UserAvatar`,
  `PeriodSelector`, `CodeField`, `NumberInput`, `DateTimePicker`, `FileDropzone`.
- Dropdown là shadcn `Select` (trong modal: `SelectContent className="z-[1100]"`; không `value=""`).
- Biểu đồ: Recharts, theo chuẩn `bieu-do-chuan` (tiêu đề, nhãn trục, chú giải, nhãn số liệu).
- Responsive: desktop ≥ 1280 là chính; ≥ 768 phải dùng được; < 768 không vỡ (bảng → thẻ).
- Cờ tính năng (`enableOkr/Bsc/Reward/CashWallet/Ai/Conduct`) tắt thì trang vẫn đẹp.
- Màu chủ đạo do người dùng chọn (8 màu + tự chọn): mọi thứ qua `var(--color-primary)` và token.

## Đầu ra bắt buộc, theo đúng thứ tự
1. **Chẩn đoán trang hiện tại** (≤ 10 gạch đầu dòng): điểm sai với spec, điểm gây khó cho người dùng
   (thứ tự đọc, mật độ, thiếu trạng thái, nhãn mơ hồ), điểm phải giữ vì tour/ngữ nghĩa.
2. **Thứ tự ưu tiên thị giác**: người dùng của vai trò X vào trang này để làm gì trước, thấy gì trước,
   bấm gì trước — 3 dòng. Đây là căn cứ cho mọi quyết định bố cục bên dưới.
3. **Bản vẽ bố cục** bằng ASCII cho desktop (1280) và một bản cho < 768. Ghi rõ từng vùng: tên,
   component dùng, chiều cao/độ rộng theo lưới 4px, thứ tự tab-key. **Bắt buộc vẽ thêm một biến thể
   với nhãn dài bất thường** — tên đơn vị/vai trò/cấp bậc/nhãn sidebar do tổ chức tự đặt, tên chỉ tiêu
   60–80 ký tự, số tiền 13 chữ số — và nói rõ cột nào `truncate` + `title`, cột nào xuống dòng, cột nào
   có bề rộng tối thiểu. Không giả định nhãn luôn ngắn.
4. **Bảng thành phần**: mỗi vùng → component có sẵn → biến thể/props → token màu → chữ (utility
   `text-*` trong spec). Không có ô "màu tự chọn".
5. **Trạng thái đầy đủ**, mỗi cái một dòng mô tả + microcopy: đang tải (skeleton hình gì), rỗng (vì
   sao trống + hành động kế), lỗi tải (thông điệp + Thử lại), không có quyền, tính năng tắt, đang lưu,
   lưu thành công/thất bại, có thay đổi chưa lưu, quá hạn/đã khoá (nếu có).
6. **Microcopy**: tiêu đề, mô tả, nhãn nút, nhãn cột, placeholder, thông báo — tiếng Việt, ngắn, đúng
   thuật ngữ (chỉ tiêu, đợt/kỳ đánh giá, xếp loại, bài nộp…), không sáo rỗng, không emoji.
7. **Code**: TOÀN BỘ nội dung file đã sửa, mỗi file một khối, đường dẫn ở dòng đầu. Không diff,
   không `// …`. Chỉ sửa file trong hồ sơ; cần tách component con thì đặt trong thư mục feature đó.
8. **Tự kiểm** (đánh dấu từng dòng): không hard-code màu; badge/nút đúng quy tắc đặc–nhạt; giữ `id`,
   `aria-*`, route, hook; dark mode qua token; < 768 không vỡ; nhãn dài không vỡ; đủ 8 trạng thái ở
   mục 5; đúng pattern nhóm P của trang; mọi prop mới đã khai ở mục 9; modal/drawer dùng `Dialog`/
   `Drawer` + `DialogFooter`; dùng lại component chung; không thêm thư viện; không gradient/blur/scale/glow.
9. **Đề nghị bổ sung spec hoặc mở rộng component dùng chung**. Hai loại, tách riêng:
   - *Token/spec mới* (màu, cỡ, bo góc): chỉ nêu, không tự áp — đội sản phẩm quyết.
   - *Mở rộng component dùng chung*: được phép làm trong lượt này, nhưng phải khai báo **trước phần
     code** theo đúng cột của bảng R (`Component · Prop/API · Hành vi · Trang cần`), viết vào chính
     file component (không bản sao trong trang), giữ tương thích ngược cho mọi trang đang dùng, và
     chép dòng đó vào mục 10. Không khai báo = không được thêm prop.
10. **Ghi nhận pattern** (3–8 dòng, để chép nguyên vào `UX_PATTERNS.md`): với mỗi pattern trang này
   tạo mới hoặc tinh chỉnh — `Nhóm P · Việc · Quyết định · Trang nào khác nên dùng lại`; cộng các dòng
   bảng R nếu có mở rộng; cộng một dòng bảng S `Ngày · Trang · Pattern chạm · Quyết định mới`.
````

---

## B. Hồ sơ trang — mẫu để điền

````markdown
# Hồ sơ trang
- Tên & route: …                       (vd: Phê duyệt chỉ tiêu — /performance?section=kpi-criteria-pending)
- File chính: …                        (+ component con nếu có)
- Vai trò thấy trang: …                (STAFF / DEPUTY / HEAD / DIRECTOR / quản trị / Platform Admin)
- Quyền gác: …                         (vd: KPI:APPROVE_CRITERIA)
- Cờ tính năng liên quan: …            (vd: bscOnly)
- Nhóm pattern (UX_PATTERNS.md): …     (P1 hàng chờ duyệt / P2 danh sách / P3 form cấu hình / P4 modal; ghi [chốt] hay [khai báo])
- Việc chính người dùng làm ở đây: …   (1–2 câu, theo tần suất)
- Dữ liệu hiển thị: …                  (bảng gì, cột gì, số liệu gì, biểu đồ gì)
- Hành động: …                         (chính / phụ / phá huỷ)
- Luồng vào–ra: …                      (từ đâu tới, làm xong đi đâu, có modal/drawer nào)
- `id` phải giữ: …                     (tour-*, nav-*, tour-workspace-*)
- Điểm đau hiện tại (nếu biết): …
- Ngoài phạm vi lượt này: …
````

---

## C. Danh mục trang KeyGo (đường dẫn thật, để chọn)

### C1. Xác thực (`AuthLayout`, không sidebar)
| Trang | Route | File |
|---|---|---|
| Đăng nhập | `/login` | `features/auth/pages/LoginPage.tsx` |
| Đăng ký tổ chức | `/register` | `features/auth/pages/RegisterPage.tsx` |
| Xác minh email | `/verify-email` | `features/auth/pages/VerifyEmailPage.tsx` |
| Quên / đặt lại mật khẩu | `/forgot-password`, `/reset-password` | `features/auth/pages/ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx` |
| Đổi mật khẩu bắt buộc | `/force-password-change` | `features/auth/pages/ForceChangePasswordPage.tsx` |
| Chọn công ty (Lark) | `/auth/lark/select-company` | `features/auth/pages/LarkSelectCompanyPage.tsx` |

### C2. Tổng quan & cá nhân
| Trang | Route | File | Vai trò |
|---|---|---|---|
| Tổng quan (widget kéo-thả theo scope) | `/dashboard` | `features/dashboard/pages/DashboardPage.tsx`, `RoleDashboard.tsx`, `widgets/*` | DIRECTOR / HEAD / DEPUTY / STAFF |
| Hồ sơ cá nhân | `/profile` | `features/profile/pages/ProfilePage.tsx` | tất cả |
| Hiệu suất một nhân sự | `/employees/:userId/performance` | `features/dashboard/pages/EmployeePerformancePage.tsx` | HEAD trở lên |
| Trung tâm thông báo | `/notifications` | `features/notifications/pages/NotificationsPage.tsx` | tất cả |
| K.AI toàn màn hình | `/ai-assistant` | `features/analytics/pages/AiAssistantPage.tsx` | `aiOnly` |
| Luồng KPI | `/kpi-workflow` | `features/kpi/workflow/pages/KpiWorkflowPage.tsx` | tất cả (chỉ-xem nếu thiếu WORKFLOW:MANAGE) |
| Thiết lập nhanh KPI | `/kpi-setup` | `features/kpi/setup/*` (`FlowPicker`, `StepRouter`) | quản trị |

### C3. "Của tôi" — trang gộp `/me?section=` (`features/profile/pages/MySpacePage.tsx`)
| Mục | section | Component | Quyền / cờ |
|---|---|---|---|
| KPI của tôi | `my-kpi` | `features/kpi/pages/MyKpiPage.tsx` | KPI:VIEW_MY |
| Báo cáo của tôi | `my-submissions` | `features/submissions/pages/MySubmissionsPage.tsx` | SUBMISSION:VIEW_MY |
| Đánh giá của tôi | `evaluations` | `features/evaluations/pages/EvaluationsPage.tsx` | EVALUATION:VIEW_MY |
| Điều chỉnh của tôi | `my-adjustments` | `features/kpi/pages/MyAdjustmentsPage.tsx` | KPI:VIEW_MY |
| Hạnh kiểm của tôi | `my-conduct` | `features/conduct/pages/MyConductPage.tsx` | conductOnly |
| Điểm của tôi | `my-rewards` | `features/rewards/pages/MyRewardsPage.tsx` | rewardOnly |
| Ví của tôi | `my-cash-wallet` | `features/wallet/pages/MyWalletPage.tsx` | walletOnly |
| Nộp / sửa báo cáo | `/submissions/new`, `/submissions/edit/:id` | `features/submissions/pages/NewSubmissionPage.tsx` | STAFF |
| Chi tiết bài nộp | `/submissions/:id` | `features/submissions/pages/SubmissionDetailPage.tsx` | STAFF + người chấm |

### C4. Quản lý hiệu suất — trang gộp `/performance?section=` (`features/kpi/pages/PerformancePage.tsx`)
| Mục | section | Component | Quyền |
|---|---|---|---|
| Thiết lập chỉ tiêu | `kpi-criteria` | `features/kpi/pages/KpiCriteriaPage.tsx` (+ `KpiFormModal`, `KpiCriteriaTable`, `KpiDetailModal`) | KPI:VIEW |
| Phê duyệt chỉ tiêu | `kpi-criteria-pending` | `features/kpi/pages/KpiApprovalPage.tsx` (+ `KpiReviewModal`) | KPI:APPROVE_CRITERIA |
| Điều chỉnh chỉ tiêu | `kpi-adjustments-pending` | `features/kpi/pages/KpiAdjustmentApprovalPage.tsx` | KPI:APPROVE_ADJUSTMENT |
| Đánh giá đợt | `submissions-org-unit` | `features/submissions/pages/OrgUnitSubmissionsPage.tsx` (+ `StaffEvaluationModal`, `StaffPerformanceDetailModal`) | SUBMISSION:REVIEW |
| Đánh giá kỳ | `cycle-evaluation` | `features/evaluations/pages/CycleEvaluationPage.tsx` | CYCLE_EVAL:VIEW |

### C5. Phân tích — `/analytics?section=` (`features/analytics/pages/AnalyticsPage.tsx`)
| Mục | section | Component | Điều kiện |
|---|---|---|---|
| Mục tiêu của tôi | `my-objectives` | `features/analytics/pages/MyObjectivesTab.tsx` | okrOnly |
| Mục tiêu đơn vị | `subordinate` | `features/analytics/pages/SubordinateManagementTab.tsx` | okrOnly, KPI:VIEW hoặc SUBMISSION:REVIEW |
| KPI của tôi | `my` | `features/analytics/pages/MyStatsTab.tsx` | OKR tắt |
| KPI đơn vị | `summary` | `features/analytics/pages/SummaryTab.tsx` | OKR tắt |
| Phân cấp | `drilldown` | `features/analytics/pages/DrillDownTab.tsx` | — |
| Hạng mục (BSC) | `bsc` | `features/analytics/pages/BscAnalyticsTab.tsx` | bscOnly, BSC:MANAGE |
| Nguồn dữ liệu / Báo cáo | `/datasources`, `/reports` (+ `/:id`) | `features/datasources/pages/*`, `features/reports/pages/*` | — |

### C6. Thiết lập công ty — `/company?section=` (`features/orgunits/pages/CompanySettingsPage.tsx`, quản trị)
| Mục | section | Component |
|---|---|---|
| Thông tin công ty | `info` | `features/orgunits/components/CompanySections.tsx` → `CompanyInfoSection` |
| Cấp bậc công ty | `ranks` | `CompanySections.tsx` → `CompanyHierarchySection` |
| Phân quyền vai trò | `roles` | `features/organization/pages/RoleManagementPage.tsx` (+ `RolePermissionDrawer`, `HierarchyPermissionModal`) |
| Cơ cấu tổ chức | `org-structure` | `features/organization/pages/OrganizationStructurePage.tsx` (+ `OrgListView`, `OrgMindmapView`, `OrgUnitDrawer`) |
| Chi tiết đơn vị | `/org-units/:id` | `features/organization/pages/OrgUnitDetailPage.tsx` |
| Quản lý nhân viên | `users` | `features/users/pages/UsersPage.tsx` |
| Uỷ quyền chéo đơn vị | `delegations` | `features/organization/components/DelegationSettingsTab.tsx` |
| Quản lý Sidebar | `sidebar` | `features/organization/components/SystemSettingsTabs.tsx` → `SidebarSettingsTab` |
| Thiết lập thông báo | `notifications` | `SystemSettingsTabs.tsx` → `NotificationSettingsTab` |
| Thiết lập email | `email` | `features/organization/components/EmailTemplateSettingsTab.tsx` (+ `EmailEditor`) |
| Thiết lập API | `api` | `features/organization/components/LarkSettingsTab.tsx` |

### C7. Thiết lập công cụ — `/settings/tools?section=` (`features/orgunits/pages/ToolSettingsPage.tsx`, quản trị)
| Mục | section | Component |
|---|---|---|
| Module & tính năng | `modules` | `features/orgunits/components/ModuleSections.tsx` |
| Thang điểm | `scoring` | `features/orgunits/pages/ScoringSettingsPage.tsx` → `ScoringSections.tsx` (+ `BellCurveEditor`) |
| Ma trận đánh giá | `matrix` | `PerformanceMatrixSection` (trong `ScoringSections.tsx`) |
| Xếp loại đơn vị | `unit-class` | `features/orgunits/components/UnitClassificationConfigSection.tsx` |
| Quy tắc sinh mã | `code-rules` | `features/orgunits/components/CodeRuleSection.tsx` |
| Quản lý kỳ/đợt đánh giá | `kpi-cycles` | `features/kpi/pages/KpiCyclePeriodPage.tsx` |
| Quản lý OKR | `okr` | `features/okr/pages/OkrManagementPage.tsx` |
| Quản lý BSC | `bsc` | `features/bsc/pages/BscManagementPage.tsx` (+ `BscScorecardTree`, `PerspectiveFormModal`, `CascadePolicyModal`) |
| Quản lý thưởng | `rewards` | `features/rewards/pages/RewardManagementPage.tsx` (+ `GiftsTab`, `EmployeePicker`) |
| Quản lý ví | `wallet` | `features/wallet/pages/WalletAdminPage.tsx` |
| Quản lý token AI | `ai-quota` | `features/organization/pages/AiQuotaPage.tsx` (+ `AiQuotaPanel`) |

### C8. Nền tảng & hệ thống
| Trang | Route | File |
|---|---|---|
| Quản trị nền tảng | `/admin` | `features/platformAdmin/pages/PlatformAdminPage.tsx` |
| Trang lỗi | `*` | `features/errors/pages/ErrorPage.tsx` |

---

## D. Thứ tự đề xuất (theo tần suất dùng × số vai trò chạm tới)

0. **Đã chốt sẵn, không cần lượt riêng**: khung modal/drawer (`ui/dialog.tsx`, P0), widget (P5),
   thông báo (P6), K.AI (P7). Lượt đầu tiên chạm modal nghiệp vụ = `KpiFormModal` (mục 4) sẽ chốt P4.
1. Tổng quan (4 scope — làm 4 lượt, mỗi scope một lượt)
2. KPI của tôi → Nộp báo cáo → Chi tiết bài nộp (chuỗi của nhân viên)
3. Đánh giá đợt → Phê duyệt chỉ tiêu → Điều chỉnh chỉ tiêu (chuỗi của trưởng đơn vị)
4. Thiết lập chỉ tiêu (trang nặng nhất: `KpiCriteriaPage` + `KpiFormModal`)
5. Đánh giá kỳ, Đánh giá của tôi
6. Phân tích: KPI đơn vị, Phân cấp
7. Thiết lập công cụ: Thang điểm, Ma trận, Kỳ/đợt
8. Thiết lập công ty: Cơ cấu tổ chức, Phân quyền, Nhân viên
9. Đăng nhập / Đăng ký
10. Còn lại

**Điểm khớp lại** — bắt buộc sau mỗi 5 trang, hoặc ngay khi xong trang cuối của một nhóm P:
mở lại **mọi trang đã làm trong cùng nhóm**, đặt cạnh nhau (chụp màn hình cùng độ rộng), rà theo
danh sách: hàng filter cùng thứ tự và cùng chiều cao? nút chính cùng vị trí? cột hành động cùng
kiểu? empty state cùng giọng? footer modal cùng thứ tự? Lệch → sửa các trang cũ theo `UX_PATTERNS.md`
(không sửa sổ pattern theo trang mới, trừ khi có lý do ghi vào bảng S). Prompt cho lượt khớp lại:
"Dán DESIGN_SYSTEM.md + UX_PATTERNS.md + code các trang [A, B, C] cùng nhóm P[n]. Không thiết kế mới.
Liệt kê mọi khác biệt về bố cục/tương tác giữa chúng, đối chiếu với P[n], trả về code đã đồng bộ."


---

## E. Ví dụ hồ sơ đã điền — Phê duyệt chỉ tiêu

````markdown
# Hồ sơ trang
- Tên & route: Phê duyệt chỉ tiêu — /performance?section=kpi-criteria-pending
- File chính: src/features/kpi/pages/KpiApprovalPage.tsx; modal: src/features/kpi/components/KpiReviewModal.tsx
- Vai trò thấy trang: HEAD, DEPUTY (được uỷ quyền), DIRECTOR
- Quyền gác: KPI:APPROVE_CRITERIA
- Cờ tính năng liên quan: không
- Nhóm pattern: P1 hàng chờ duyệt [khai báo] — trang ĐẦU TIÊN của nhóm, phải chốt P1 + R1/R2/R3 ở mục 10
- Việc chính: mỗi đầu đợt, trưởng đơn vị duyệt hàng loạt chỉ tiêu cấp dưới gửi lên; số đỏ trên
  sidebar đếm đúng hàng chờ này. Làm theo lô, nhanh, ít đọc kỹ; trả lại kèm lý do khi cần.
- Dữ liệu hiển thị: bảng hàng chờ (người nộp, đơn vị, tên chỉ tiêu, loại định lượng/định tính,
  trọng số, mục tiêu, đợt, ngày gửi, trạng thái); bộ lọc đợt/đơn vị/trạng thái; số liệu đầu trang:
  chờ duyệt / đã duyệt / trả lại trong đợt.
- Hành động: chính = Duyệt (một / chọn nhiều); phụ = Xem chi tiết (modal), Lọc, Tìm; phá huỷ = Trả lại
  (bắt buộc lý do, ConfirmDialog).
- Luồng vào–ra: vào từ sidebar (badge) hoặc thông báo; duyệt xong ở lại trang, hàng biến khỏi hàng chờ,
  toast xác nhận; trả lại → người nộp nhận thông báo.
- id phải giữ: tour-workspace-card, tour-workspace-tabs, tour-workspace-stats, tour-section-root
- Điểm đau hiện tại: không chọn nhiều để duyệt hàng loạt; trạng thái trả lại không thấy lý do ngay
  trong bảng; bộ lọc chiếm hai hàng.
- Ngoài phạm vi: logic duyệt/uỷ quyền ở backend; KpiFormModal.
````
