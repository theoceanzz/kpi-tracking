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
- **Database migrations**: Flyway in `src/main/resources/db/migration/` — always add new migrations, never edit existing ones
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
- New REST endpoints follow `/api/v1/{resource}` naming and return standard response wrappers
- Frontend feature folders follow the pattern: `features/{name}/{Name}Page.tsx` as entry point, with co-located API hooks and types
