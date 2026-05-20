---
name: project-architecture
description: Core architecture of the KPI Tracking project — module layout, tech stack, key patterns
metadata:
  type: project
---

# KPI Tracking Project Architecture

**Why:** Full-stack OKR/KPI management system for organizations. Tracks Objectives → Key Results → KPI Criteria → Submissions hierarchy.

## Tech Stack
- **Backend:** Spring Boot (Java), Spring Security (JWT + Permission-based), Flyway migrations, JPA/Hibernate
- **Frontend:** React + TypeScript, TanStack Query (React Query), Tailwind CSS, Recharts, Lucide icons
- **API pattern:** `ApiResponse<T>` wrapper for all endpoints; frontend `.then(r => r.data.data)` unwrap

## Domain Hierarchy
Objective → KeyResult → KpiCriteria → KpiSubmission

## Key Module Locations

### Backend
- `controller/SubordinateAnalyticsController.java` — REST endpoints at `/api/v1/stats/subordinates/**`
- `service/SubordinateAnalyticsService.java` — business logic for subordinate analytics
- `dto/response/stats/ScopedDashboardResponse.java` — scoped metrics DTO
- `dto/response/stats/SubordinateDetailsResponses.java` — detailed objective/KR DTOs
- `dto/response/stats/SubordinateStatsResponses.java` — metric response types
- `repository/ObjectiveRepository.java` — JPA repository for Objective entity

### Frontend
- `frontend/src/features/analytics/pages/SubordinateManagementTab.tsx` — main tab with date filter + all widgets
- `frontend/src/features/analytics/components/ObjectiveDetailsWidget.tsx` — table/chart toggle + Drawer wiring
- `frontend/src/features/analytics/components/ObjectiveDrawer.tsx` — animated side drawer (60vw, slides from right)
- `frontend/src/features/analytics/components/ScopedDashboardWidget.tsx` — full analytics inside drawer (4 cards + combo chart + dual bar charts)
- `frontend/src/features/analytics/components/ObjectiveComboChart.tsx` — combo chart (stacked bars + 2 trend lines)
- `frontend/src/features/analytics/components/ObjectiveMetricCard.tsx` — single metric card
- `frontend/src/features/dashboard/api/statsApi.ts` — all API calls
- `frontend/src/types/stats.ts` — all TypeScript types

## Analytics Drawer Flow
1. User clicks row in `ObjectiveDetailedTable` or bar in `ObjectiveDetailedChart`
2. `ObjectiveDetailsWidget` sets `drawerState = { isOpen, type, data }`
3. `ObjectiveDrawer` renders as slide-in panel (translate-x transition, 300ms)
4. Inside drawer: `ScopedDashboardWidget` fetches `/objectives/{id}/dashboard` or `/key-results/{id}/dashboard`
5. Response type: `ScopedDashboardResponse` with `metrics`, `comboChart`, `topItems`, `topUnits`

## How to apply
When adding new analytics features, follow the pattern: independent React Query hook per metric, `ScopedDashboardResponse` shape for scoped data, dual horizontal bar charts (completion + performance side-by-side).
