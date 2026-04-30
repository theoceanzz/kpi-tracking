// ============================================================
// Datasource Types
// ============================================================

export type DatasourceStatus = 'ACTIVE' | 'ARCHIVED'

export type ColumnDataType =
  | 'TEXT' | 'NUMBER' | 'DATE'
  | 'SELECT_ONE' | 'SELECT_MULTI' | 'USER'
  | 'URL' | 'ATTACHMENT' | 'FORMULA'

export interface DsColumn {
  id: string
  name: string
  dataType: ColumnDataType
  columnOrder: number
  isRequired: boolean
  config: string // JSON
}

export interface CellValue {
  valueText: string | null
  valueNumber: number | null
  valueBoolean: boolean | null
  valueDate: string | null
  valueJson: string | null
}

export interface DsRow {
  id: string
  rowOrder: number
  cells: Record<string, CellValue> // columnId -> CellValue
  createdAt: string
}

export interface Datasource {
  id: string
  name: string
  description: string | null
  icon: string | null
  status: DatasourceStatus
  orgUnitId: string
  orgUnitName: string
  createdById: string
  createdByName: string
  columns: DsColumn[]
  rowCount: number
  createdAt: string
  updatedAt: string
}

export interface CreateDatasourceRequest {
  name: string
  description?: string
  icon?: string
  orgUnitId?: string
}

export interface UpdateDatasourceRequest {
  name?: string
  description?: string
  icon?: string
}

export interface UpsertColumnRequest {
  id?: string
  name: string
  dataType: ColumnDataType
  columnOrder?: number
  isRequired?: boolean
  config?: string
}

export interface CellValueRequest {
  valueText?: string
  valueNumber?: number
  valueBoolean?: boolean
  valueDate?: string
  valueJson?: string
}

export interface UpsertRowRequest {
  id?: string
  cells?: Record<string, CellValueRequest>
}

// ============================================================
// Report Types
// ============================================================

export type ReportStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export type WidgetType =
  | 'BAR' | 'LINE' | 'PIE' | 'DONUT' | 'AREA'
  | 'SCATTER' | 'TABLE' | 'NUMBER_CARD' | 'HEATMAP' | 'TOP_STATS_GRID'
  | 'OVERVIEW_CARDS' | 'TREND_CHART' | 'TOP_UNITS' | 'UNIT_PERFORMANCE' | 'UNIT_KPI'
  | 'MEMBER_DIST' | 'ROLE_DIST' | 'UNIT_RISK' | 'WARNING_LIST' | 'KPI_PODIUM' | 'RANKING_TABLE'

export interface ReportDatasource {
  id: string
  datasourceId: string
  datasourceName: string
  alias: string | null
}

export interface ReportWidget {
  id: string
  reportDatasourceId: string
  datasourceName: string
  widgetType: WidgetType
  title: string
  description: string | null
  chartConfig: string // JSON
  position: string // JSON {x, y, w, h}
  widgetOrder: number
}

export interface Report {
  id: string
  name: string
  description: string | null
  status: ReportStatus
  orgUnitId: string
  orgUnitName: string
  createdById: string
  createdByName: string
  datasources: ReportDatasource[]
  widgets: ReportWidget[]
  createdAt: string
  updatedAt: string
}

export interface CreateReportRequest {
  name: string
  description?: string
  orgUnitId?: string
}

export interface UpdateReportRequest {
  name?: string
  description?: string
  status?: ReportStatus
  widgets?: UpsertWidgetRequest[]
}

export interface AddReportDatasourceRequest {
  datasourceId: string
  alias?: string
}

export interface UpsertWidgetRequest {
  id?: string
  reportDatasourceId?: string
  widgetType: WidgetType
  title: string
  description?: string
  chartConfig: string
  position?: string
  widgetOrder?: number
}
