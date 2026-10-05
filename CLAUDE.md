# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KeyGo is a multi-tenant SaaS KPI tracking platform. Organizations manage hierarchical units, define KPI criteria, collect employee submissions, and run manager/HR evaluation workflows. The system also supports OKR management, customizable dashboards, and AI-assisted suggestions.

## Commands

### Frontend (`/frontend`)

```bash
npm run dev       # Dev server at http://localhost:3000
npm run build     # TypeScript check + Vite bundle
npm run lint      # ESLint
npm run preview   # Preview production build
```

### Backend (`/backend`)

```bash
mvn clean package           # Full build with tests
mvn clean package -DskipTests  # Build without tests (used in Docker)
mvn flyway:migrate          # Run pending DB migrations
```

### Full Stack (Docker)

```bash
docker-compose up           # Starts frontend (nginx:80), backend (:8081), PostgreSQL (:5432)
```

## Architecture

### Backend (Spring Boot 3.3.5, Java 17)

Standard layered architecture: `Controller → Service → Repository → Entity`.

- **Package root**: `com.kpitracking`
- **DTOs** live separately from entities; **MapStruct** mappers convert between them (never map manually in services)
- **Multi-tenancy**: Every data query is scoped to an `Organization`. Org units form a tree with configurable `OrgHierarchyLevels`
- **Auth**: Stateless JWT via `JwtAuthenticationFilter`. Access tokens (~150min) + refresh tokens (7 days). `PermissionChecker` enforces fine-grained RBAC on top of role checks
- **Database migrations**: Flyway in `src/main/resources/db/migration/`. **`V1__init_schema.sql` and `V2__seed_data.sql` are frozen (baseline, 2026-09-15) — never edit them.** Prod's `flyway_schema_history` still holds rows for versions 3–7 (old files merged into V1/V2), so numbering restarts at **V8** (`V8__reconcile_prod.sql`) and `spring.flyway.ignore-migration-patterns=*:missing` is set; every schema/seed change is a new file `V{n}__mo_ta.sql` with n ≥ 9 that Flyway runs identically on dev and prod. `spring.jpa.hibernate.ddl-auto` is `validate`: Hibernate no longer creates tables/columns, so a new entity field without a migration fails app startup by design. Rules for new migrations: plain SQL, idempotent where cheap (`IF NOT EXISTS`); an index on a large table (`notifications`, `security_audit_logs`, `kpi_submissions`, `refresh_tokens`, wallet transactions) must use `CREATE INDEX CONCURRENTLY` **and** ship a sibling `V{n}__mo_ta.sql.conf` containing `executeInTransaction=false` (see `V8__reconcile_prod.sql`); never edit a file that has run on prod. Dev DB validate failure is fatal (`app.flyway.on-validation-error=fail`); rebuild local DB deliberately with `./mvnw flyway:clean flyway:migrate`. Prod uses `repair` (one-time checksum fix for the frozen V1/V2). Background and prod rollout plan: `docs/DATABASE_SCALING.md`
- **Soft deletes**: Entities use `deleted_at`; repositories filter by `deleted_at IS NULL`
- **AI integration**: Spring AI 1.1.5 supports Ollama (default), OpenAI, and Gemini. Prompt templates are in `src/main/resources/promptTemplates/`
- **File uploads**: Cloudinary SDK. Excel/CSV import/export via Apache POI
- **Async**: Spring events (`@EventListener`) for notifications and email dispatch

Key service file sizes reflect complexity — `KpiCriteriaService` (~53KB) and `KpiSubmissionService` (~36KB) are the most complex; approach changes to them carefully.

### Frontend (React 19, TypeScript, Vite)

Feature-based module structure under `src/features/`. Each feature owns its own components, hooks, API calls, and types.

- **API layer**: Axios instance with centralized config. All calls go through `/api/v1` (proxied to `localhost:8081` in dev via `vite.config.ts`)
- **Server state**: TanStack React Query v5 — don't use local state for server data
- **Global state**: Zustand stores in `src/store/` (auth, theme, sidebar, uploads)
- **Routing**: React Router v7 in `src/router/`. Protected routes via `ProtectedRoute` and `PermissionRoute` wrappers
- **UI components**: Shadcn + Radix UI headless components in `src/components/ui/`. Use these before introducing new component libraries
- **Forms**: React Hook Form + Zod schemas for validation
- **Charts**: Recharts for standard charts; XY Flow for OKR/hierarchy diagrams; React Grid Layout for draggable dashboard widgets

### Data Flow for KPI Workflow

```
KpiCriteria (definition) → KpiCriteriaAssignee (assigned to user/org unit)
  → KpiSubmission (employee submits with attachments)
  → Evaluation (manager evaluates)
```

`kpi_periods` define time cycles that scope all KPI activity.

## Environment

Backend config comes from `application.yaml` (default profile) and `application-prod.yaml` in production (set via `SPRING_PROFILES_ACTIVE=prod`). Every key uses the `${ENV_VAR:default}` form, and the defaults committed in `application.yaml` are what actually runs locally.

`backend/.env` is **not** loaded automatically by anything in this repo — there is no `spring-dotenv` dependency, no IDE EnvFile config, and Docker Compose only reads a `.env` next to `docker-compose.yml` (repo root, where none exists). Treat it as a reference file. So: when adding a new setting, put a working default in `application.yaml`, then wire the env var into `docker-compose.yml` for deployment. Changing only `backend/.env` has no effect.

Frontend reads `frontend/.env`; `VITE_API_BASE_URL` defaults to `/api/v1`.

Database defaults: PostgreSQL on `localhost:5432`, user `postgres`, password `123456` (local dev only).

## Key Conventions

- Backend entities use Lombok (`@Data`, `@Builder`, `@NoArgsConstructor`) — don't write boilerplate manually
- Permission checks use `@PreAuthorize` or explicit `PermissionChecker` calls — don't bypass these in new endpoints
- **Cycle lock (khoá kỳ)**: any new service method that writes to a period, KPI, submission, attachment or period evaluation must call `CycleStatusGuard.assertWritable(...)` (inside a write transaction) before writing. It re-reads `kpi_cycles.status` with `FOR SHARE` so writes race-safely against `KpiCycleLockService.lock` (`FOR UPDATE`); never check `cycle.getStatus()` on an already-loaded entity instead. Scoring of `CLOSED_BY_LOCK` KPIs is decided only by `KpiAchievementCalculator.CLOSED_BY_LOCK_SCORING`. A cycle is locked in exactly **one** place: finalizing the cycle evaluation of the **root** org unit (no parent) locks it in the same transaction (`KpiCycleLockService.lockForRootFinalize`), and reopening that result reopens the cycle. There is deliberately no `/lock` or `/reopen` endpoint or button on the cycles page — don't add one; child-unit finalize/reopen never touches the cycle
- **KPI approval chain (chuỗi duyệt)**: with the default `approverMode = CHAIN` (option of the `CRITERIA_APPROVAL` workflow stage; `UNIT_HEAD` is the one-level fallback, switchable in config), KPI criteria and adjustment requests are approved along a snapshot of unit heads (rank-0 role at each unit) from the KPI's unit up to the root, stored in `kpi_approval_flows/steps/events`. The KPI stays `PENDING_APPROVAL` (or `EDIT`) for the whole chain. The chain is only for people **without** `KPI:APPROVE_OWN`: holders of that permission still get their KPIs `APPROVED` on creation (and on submit), exactly as before the chain existed; adjustment requests always go through the chain. Any new code that approves/rejects must go through `KpiApprovalChainService.authorize(...)` → `approve/reject` (only the current step holder may act; admins may only `reassign`) — never flip the status directly. `KPI:APPROVE_FINAL` is checked explicitly per role at click time via `PermissionChecker.hasRolePermissionInOrgUnit` (no delegation, no SYSTEM:ADMIN shortcut). "Chờ tôi duyệt" = `KpiApprovalViewService` inbox, not `status = PENDING_APPROVAL`
- **BSC phân rã cả bộ (dòng "Kết quả cấp trên")**: ngoài giao từng chỉ tiêu, một thẻ có thể giao CẢ BỘ xuống đơn vị con (`BscTreeService.cascadeWhole`, `POST /bsc/scorecards/{id}/whole-cascade`). Đơn vị nhận MỘT dòng `ASSIGNED + locked`, chỉ có trọng số, trỏ tới hạng mục hệ thống có `bsc_perspectives.source_scorecard_id` (mỗi thẻ nguồn một hạng mục; bị lọc khỏi `getPerspectives` để KPI không gắn vào). Điểm dòng = `bsc_unit_results.achievement_percent` của thẻ nguồn cùng đợt, đọc qua `BscSourceScores` — chỉ ĐỌC kết quả đã lưu, không tính lại thẻ nguồn (nên không đệ quy). Dòng đó chỉ sinh/sửa/thu hồi qua `cascadeWhole` (form sửa thẻ không thêm/xoá được); xoá thẻ nguồn bị chặn khi còn đơn vị nhận. Chốt kết quả đơn vị / chốt đánh giá (chính thức) bị chặn khi thẻ nguồn chưa chốt, trừ quản trị `BSC:MANAGE` chốt theo số tạm (`provisional_source` / `bsc_provisional`). Giao cả bộ yêu cầu đợt của thẻ con ⊆ đợt của thẻ nguồn và không được trùng với chỉ tiêu đã giao riêng từ cùng thẻ nguồn
- **BSC chấm điểm theo đúng đơn vị**: `BscScoringService.resolveScorecard` chỉ trả bộ gắn ĐÚNG đơn vị của người/KPI cho đợt — không đi lên đơn vị cha, không dùng bộ không gắn đơn vị. Đơn vị chưa có bộ riêng = chưa áp dụng BSC (không điểm BSC, KPI không bị bắt gắn hạng mục; luật chặn KPI dùng chính hàm này). Muốn đơn vị theo mục tiêu công ty thì phân rã xuống. Trang "BSC của tôi" vẫn hiện bộ cấp trên nhưng gắn nhãn "Chỉ để tham khảo"
- **BSC xoá bộ tiêu chí**: xoá được ở mọi trạng thái (kể cả đang áp dụng) sau khi hỏi lại, nhưng bị chặn khi thẻ có kết quả đợt đã chốt, còn thẻ con gắn vào, hoặc đang là nguồn của dòng "Kết quả cấp trên" — luật nằm DUY NHẤT ở `BscService.deleteBlocker`, dùng chung cho xoá và `GET /bsc/scorecards/{id}/delete-check` (hộp xác nhận hiện lý do). Không có thao tác "Đóng" (đã thử rồi bỏ). Thẻ `CLOSED`/`ARCHIVED` cũ (`BscScorecardStatus.isRetired()`) không chấm điểm, không chiếm chỗ đơn vị/đợt, không được nhận nuôi khi phân rã. Xoá dòng khỏi thẻ phải gỡ khỏi `scorecard.getScorecardPerspectives()` trước (collection có cascade ALL, không gỡ thì Hibernate ghi lại dòng vừa xoá)
- New REST endpoints follow `/api/v1/{resource}` naming and return standard response wrappers
- **Đa ngôn ngữ (i18n)** — thiết kế `docs/I18N_DESIGN.md`, thuật ngữ tiếng Anh bắt buộc theo `docs/i18n/GLOSSARY.md`. Lỗi mới ở backend: `new BusinessException(ErrorCode.X, args...)` + câu trong `resources/i18n/messages.properties` (vi, bản gốc) và `messages_en.properties`, không viết câu tiếng Việt vào exception; test assert theo `getErrorCode()`, không theo message. Frontend hiển thị nguyên văn `message` lỗi API, không tự dịch lỗi API. Hiển thị số/tiền/ngày qua `src/i18n/format.ts` / `useFormat()` (không `toLocaleString('vi-VN')`, không import locale `vi` của date-fns); parse số/ngày người dùng gõ qua `src/i18n/parse.ts`. Ngôn ngữ người nhận (email, thông báo chạy nền) lấy qua `UserLanguageResolver`. Chữ hệ thống sinh ra rồi lưu lại (thông báo, lý do bỏ qua bước duyệt, lịch sử khoá kỳ) lưu dạng `LocalizedText` (key + tham số, cột `*_i18n`) và dịch lúc đọc — không lưu câu tiếng Việt dựng sẵn; nhãn/câu trả về trong request dùng `ErrorMessages.text(key, …)`. Chạy `npm run i18n:check` khi sửa `src/locales/`.
- Frontend feature folders follow the pattern: `features/{name}/{Name}Page.tsx` as entry point, with co-located API hooks and types
- **Dropdowns use the shadcn `Select` from `src/components/ui/select.tsx`, never a native `<select>`.** The native element can't be styled consistently across browsers and ignores the theme tokens, so a page mixing both looks broken in dark mode. Compose it as `Select > SelectTrigger > SelectValue` + `SelectContent > SelectItem`; group with `SelectGroup` + `SelectLabel` instead of `<optgroup>`.
  - `SelectItem` **cannot** take `value=""` — Radix reserves the empty string for "no selection". For an "all"/"default" choice use a sentinel constant (e.g. `'__default__'`) and map it back to `null` when submitting.
  - `SelectContent`, `PopoverContent` and `TooltipContent` render in a portal and default to `z-[1100]` so they sit above the app's `Dialog`/`Drawer` (`z-[1000]`). Do not lower that with a `z-50` override — the dropdown would open *behind* the modal and look like it "doesn't open".
- **Text fields use `Input` / `Textarea` from `src/components/ui/input.tsx` and `textarea.tsx`** (same 32/36/40 height scale and focus ring as `Button`/`SelectTrigger`). Put a unit, clear button or password-eye in `suffix` and an icon in `prefix` instead of wrapping the field in `relative` + absolutely positioned children; pass `invalid={!!errors.field}` for the red border. A local `const inputCls = "…"` is the legacy pattern — don't add new ones. Inline table-cell editors and chat composers are the deliberate exceptions that stay raw `<input>`.
- **Modal forms keep an unsaved draft** (`src/hooks/useFormDraft.ts`): react-hook-form → `useFormDraft(form, { key, enabled: open })`, `useState` forms → `useStateDraft(value, setValue, { key, enabled })`, plus `<DraftNotice draft={draft} />` at the top of the modal body. `key` must separate create vs. each edited record (`gift:new` / `gift:${id}`). Drafts live in localStorage per user (7-day TTL, wiped on logout; passwords and files are never stored) and are dropped automatically when a React Query mutation succeeds while the modal is open and it then closes — call `draft.clear()` yourself only when saving goes through a plain API call or the modal stays open after saving. New modals with input fields must use it.
- **Text inputs show an "editable" pencil hint** via a global rule in `frontend/src/index.css` (background-image on `<input>`/`<textarea>`, hidden on focus/disabled/readOnly, skipped for search/date/file types). It sits outside `@layer` and forces `padding-right`, so any input that places a button or unit suffix at its right edge (password eye, `%`, KPI unit, clear button) must carry `no-edit-hint`, otherwise the pencil overlaps it and the input's `pr-*` is overridden.
- **Dashboard grids** (`DashboardCustomizeChrome`) use `StableGridLayout` (own width measurement that ignores 0px) and pass react-grid-layout only plain `{i,x,y,w,h}` items via `buildGridLayouts` — never widget objects carrying React elements. Both were needed to stop a resize-triggered `Maximum update depth exceeded` (React #185) that blanked the whole page; each widget is also wrapped in `WidgetErrorBoundary`.
