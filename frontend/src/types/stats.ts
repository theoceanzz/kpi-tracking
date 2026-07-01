// Matches BE: OverviewStatsResponse
export interface OverviewStats {
  totalUsers: number
  totalOrgUnits: number
  totalKpiCriteria: number
  approvedKpi: number
  pendingKpi: number
  rejectedKpi: number
  draftKpi: number
  totalSubmissions: number
  pendingSubmissions: number
  approvedSubmissions: number
  rejectedSubmissions: number
  totalEvaluations: number
}

// Matches BE: DeptKpiStatsResponse
export interface OrgUnitStats {
  orgUnitId: string
  orgUnitName: string
  parentOrgUnitId?: string
  memberCount: number
  totalKpi: number
  approvedKpi: number
  pendingKpi: number
  rejectedKpi: number
  totalSubmissions: number
  approvedSubmissions: number
  pendingSubmissions: number
  rejectedSubmissions: number
  totalAssignments: number
}

// Matches BE: EmployeeKpiStatsResponse
export interface EmployeeKpiStats {
  userId: string
  employeeCode: string | null
  fullName: string
  email: string
  role: string
  rank: number
  orgUnitName: string
  assignedKpi: number
  totalSubmissions: number
  approvedSubmissions: number
  pendingSubmissions: number
  rejectedSubmissions: number
  lateSubmissions: number
  averageScore: number | null
}

export interface KpiTask {
  id: string
  name: string
  periodName: string
  deadline: string | null
  startDate: string | null
  status: 'NOT_STARTED' | 'PENDING' | 'OVERDUE' | 'APPROVED' | 'REJECTED' | 'EDIT'
  submissionCount: number
  expectedSubmissions: number
  managerScore?: number | null
  managerName?: string | null
}

// Matches BE: MyKpiProgressResponse
export interface MyKpiProgress {
  totalAssignedKpi: number
  totalSubmissions: number
  approvedSubmissions: number
  pendingSubmissions: number
  rejectedSubmissions: number
  lateSubmissions: number
  pendingTaskCount: number
  averageScore: number | null
  tasks: {
    content: KpiTask[]
    page: number
    size: number
    totalElements: number
    totalPages: number
    last: boolean
  }
}

// ============================================================
// Analytics Types
// ============================================================

export interface KpiProgressItem {
  kpiId: string
  kpiName: string
  unit: string | null
  targetValue: number | null
  actualValue: number | null
  completionRate: number
  status: string
  orgUnitName: string
}

export interface EvaluationItem {
  id: string
  kpiName: string
  score: number | null
  comment: string | null
  evaluatorName: string
  createdAt: string
}

export interface AnalyticsMyStats {
  totalAssignedKpi: number
  totalSubmissions: number
  approvedSubmissions: number
  pendingSubmissions: number
  rejectedSubmissions: number
  averageScore: number | null
  kpiItems: KpiProgressItem[]
  evaluationHistory: EvaluationItem[]
}

export interface OrgUnitDrillSummary {
  orgUnitId: string
  orgUnitName: string
  levelName: string
  memberCount: number
  totalKpi: number
  approvedKpi: number
  completionRate: number
  totalSubmissions: number
  approvedSubmissions: number
  pendingSubmissions: number
  rejectedSubmissions: number
  avgScore: number | null
  hasChildren: boolean
}

export interface EmployeeDrillSummary {
  userId: string
  fullName: string
  email: string
  roleName: string
  assignedKpi: number
  totalSubmissions: number
  approvedSubmissions: number
  pendingSubmissions: number
  rejectedSubmissions: number
  avgScore: number | null
}

export interface DrillDownResponse {
  orgUnitId: string | null
  orgUnitName: string | null
  levelName: string | null
  totalKpi: number
  approvedKpi: number
  totalSubmissions: number
  approvedSubmissions: number
  pendingSubmissions: number
  rejectedSubmissions: number
  avgScore: number | null
  memberCount: number
  childUnits: OrgUnitDrillSummary[]
  employees: EmployeeDrillSummary[]
  heatmapData: HeatmapPoint[]
}

export interface AnalyticsDetailRow {
  userId: string
  employeeCode: string | null
  fullName: string
  email: string
  orgUnitName: string | null
  roleName: string
  assignedKpi: number
  completedKpi: number
  completionRate: number
  totalSubmissions: number
  approvedSubmissions: number
  pendingSubmissions: number
  rejectedSubmissions: number
  avgScore: number | null
  lastSubmissionDate: string | null
}

export interface AnalyticsSummary {
  orgUnitId: string;
  orgUnitName: string;
  levelName: string;
  kpiCompletionRate: number;
  avgPerformanceScore: number;
  overdueKpiRate: number;
  totalMembers: number;
  activeKpis: number;
  trendData: {
    period: string;
    kpiCompletion: number;
    performance: number;
  }[];
  topPerformingUnits: UnitComparison[];
  worstPerformingUnits: UnitComparison[];
  unitKpiData: UnitKpiComparison[];
  memberDistribution: { name: string; value: number }[];
  roleDistribution: {
    unitName: string;
    roles: { roleName: string; count: number }[];
  }[];
  unitRisks: RiskInfo[];
  userRisks: RiskInfo[];
  rankings: RankingItem[];
  kpiRankings: RankingItem[];
  rankingOptions: RankingOption[];
}

export interface RiskInfo {
  name: string;
  type: 'UNIT' | 'USER';
  performance: number;
  overdueCount: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface RankingOption {
  id: string;
  name: string;
  depth?: number;
}

export interface UnitComparison {
  unitName: string;
  performance: number;
  completionRate: number;
  lateCount: number;
  missedCount: number;
  totalExpected: number;
}

export interface UnitKpiComparison {
  unitName: string;
  totalKpi: number;
  approvedKpi: number;
}

export interface RankingItem {
  name: string;
  avatar: string | null;
  score: number;
  performance: number;
  avgProgress: number;
  kpiCount: number;
  subText: string;
}

export interface HeatmapPoint {
  x: string;
  y: string;
  value: number;
}

export interface MetricValueResponse {
  value: number;
}

export interface CompletedCountResponse {
  completed: number;
  total: number;
}

export interface CountResponse {
  count: number;
}

export interface ComboChartPoint {
  label: string;
  oldItems: number;
  newItems: number;
  completionTrend: number;
  performanceTrend: number;
}

export interface ComboChartResponse {
  points: ComboChartPoint[];
}

export interface KpiSubmissionDto {
  id: string;
  actualValue: number;
  note: string | null;
  status: string;
  createdAt: string;
  submittedByName: string | null;
  submittedByCode: string | null;
}

export interface KpiParticipantDto {
  userId: string;
  avatarUrl: string | null;
  fullName: string;
  employeeCode: string | null;
  roleName: string;
  orgUnitName: string;
  progress: number;
  performance: number;
  actualValue: number;
  submissions?: KpiSubmissionDto[];
}

export type KpiParentRelationType = 'DELEGATION' | 'DECOMPOSITION'

export interface KpiDetailedDto {
  id: string;
  name: string;
  status: string;
  progress: number | null;
  performance: number | null;
  targetValue: number;
  unit: string | null;
  unitName: string | null;
  unitCode: string | null;
  startDate: string | null;
  endDate: string | null;
  periodName?: string | null;
  weight?: number | null;
  assigneeName?: string | null;
  participants?: KpiParticipantDto[];
  // Nhận diện loại KPI + KPI con (cho tag & expand)
  isReverseKpi?: boolean;
  isBonusKpi?: boolean;
  parentId?: string | null;
  parentRelationType?: KpiParentRelationType | null;
  childRelationType?: KpiParentRelationType | null;
  children?: KpiDetailedDto[] | null;
}

export interface KrAssignedUnit {
  orgUnitId: string;
  orgUnitName: string;
  orgUnitCode: string | null;
  weightPercentage: number | null;
}

export interface KeyResultDetailedDto {
  id: string;
  name: string;
  code: string;
  progress: number;
  performance: number;
  unitName: string | null;
  unitCode: string | null;
  assignedUnits?: KrAssignedUnit[];
  startDate: string | null;
  endDate: string | null;
  periodCount?: number;
  periodNames?: string[];
  kpis: KpiDetailedDto[];
}

export interface ObjectiveDetailedDto {
  id: string;
  name: string;
  code: string;
  unitId: string | null;
  unitName: string;
  unitCode: string;
  startDate: string | null;
  endDate: string | null;
  progress: number;
  performance: number;
  completedKeyResults: number;
  totalKeyResults: number;
  periodCount?: number;
  periodNames?: string[];
  keyResults: KeyResultDetailedDto[];
}

export interface PagedObjectiveDetailedResponse {
  content: ObjectiveDetailedDto[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface OrgUnitFilterDto {
  id: string;
  name: string;
  code: string;
  depth: number;
  children: OrgUnitFilterDto[];
}

export interface ScopedMetrics {
  completionRate: number;
  performanceRate: number;
  completedCount: number;
  totalCount: number;
  atRiskCount: number;
}

export interface TopItem {
  id: string;
  name: string;
  code: string;
  completionRate: number;
  performanceRate: number;
}

export interface TopUnit {
  unitId: string;
  unitName: string;
  unitCode: string;
  completionRate: number;
  performanceRate: number;
}

export interface ScopedDashboardResponse {
  metrics: ScopedMetrics;
  comboChart: ComboChartResponse;
  topItems: TopItem[];
  topUnits: TopUnit[];
}

export interface TopScopedEntitiesResponse {
  topItems: TopItem[];
  topUnits: TopUnit[];
}

export interface TopObjectiveDto {
  id: string;
  name: string;
  code: string;
  completionRate: number;
  performanceRate: number;
}

export interface TopUnitDto {
  unitName: string;
  completionRate: number;
  performanceRate: number;
}

export interface TopEntitiesDashboardResponse {
  topObjectives: TopObjectiveDto[];
  topUnits: TopUnitDto[];
}

export interface KpiDetailRow {
  kpiName: string;
  weight: number | null;
  unit: string | null;
  targetValue: number | null;
  actualValue: number | null;
  completionRate: number;
  managerScore: number | null;
  objectiveName?: string | null;
  keyResultName?: string | null;
}

export interface ExportDetailedPerformanceResponse {
  userId: string;
  employeeCode: string | null;
  fullName: string;
  email: string;
  role: string;
  orgUnitName: string;
  kpis: KpiDetailRow[];
  teamLeaderScore: number | null;
  deptHeadScore: number | null;
  directorScore: number | null;
}
