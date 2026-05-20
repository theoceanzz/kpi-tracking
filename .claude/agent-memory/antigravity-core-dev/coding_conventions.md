---
name: coding-conventions
description: Frontend and backend coding conventions specific to KPI Tracking project
metadata:
  type: project
---

# Coding Conventions

## Frontend (React/TypeScript)

### Component structure
- File-level sub-components defined as plain functions above the default export
- Props interface always defined inline near the component
- `useCallback` + `useRef` pattern for hover-state perf in recharts (avoids re-renders on mouse move)

### Naming
- Components: PascalCase, files match component name
- API functions in `statsApi` object: camelCase, `get` prefix (e.g. `getScopedObjectiveDashboard`)
- Query keys: array form `['scoped-dashboard', type, id, from, to]`

### Styling
- Tailwind CSS only — no custom CSS files
- Dark mode: `dark:` prefix on every color utility
- Color palette: indigo for primary actions, emerald for completion/progress, blue for performance, rose for alerts/risk, amber for warnings
- Chart colors: completion = `#10b981` (emerald), performance = `#3b82f6` (blue)
- Dim/hover-out: append `40` to hex color (e.g. `#10b98140`)

### Charts (Recharts)
- Always `isAnimationActive={false}` for bar charts inside drawers/tables (prevents jank)
- Horizontal bar charts use `layout="vertical"` with `dataKey="displayName"` or `dataKey="unitName"` on YAxis
- Always provide `onMouseLeave` on `BarChart` to reset hover state

### Data patterns
- Truncate long strings before passing to chart: `name.length > N ? name.substring(0, N) + '…' : name`
- `topItems` sorted client-side (BEST = desc performanceRate, WORST = asc)
- Empty state: render placeholder div with same height as chart

## Backend (Java/Spring)

### Service pattern
- `calculateObjectiveMetrics(obj, from, to)` returns `double[]{completion, performance}`
- Time-weighted calculation: `timeRatio = validFilterTime / totalKpiTime`
- Completion = cumulative from KPI start to B; Performance = strict within [A, B]

### Permission check
- `getSubordinateOrgUnitIds()` uses `permissionChecker.getOrgUnitsWithPermission(userId, "DASHBOARD:VIEW")`
- Always call `allowedOrgUnits.contains(entity.getOrgUnit().getId())` before returning scoped data

### DTOs
- Lombok `@Data @Builder @NoArgsConstructor @AllArgsConstructor` on all DTOs
- Static inner classes for nested DTOs (see `ScopedDashboardResponse.ScopedMetrics`)

## How to apply
Follow these patterns for any new chart/widget to maintain visual and code consistency.
