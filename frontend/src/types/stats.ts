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
}

export interface UnitComparison {
  unitName: string;
  performance: number;
  completionRate: number;
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
  kpiCount: number;
  subText: string;
}

export interface HeatmapPoint {
  x: string;
  y: string;
  value: number;
}
