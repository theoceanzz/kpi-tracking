export enum OkrStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface UnitWeight {
  orgUnitId: string
  orgUnitName?: string
  weightPercentage: number
}

export interface KeyResultResponse {
  id: string
  code?: string
  name: string
  description?: string
  targetValue: number
  currentValue: number
  unit?: string
  progress: number
  periodName?: string
  unitWeights?: UnitWeight[]
}

export interface ImportOkrResponse {
  totalRows: number
  successfulImports: number
  errors: string[]
}

export interface ObjectiveResponse {
  id: string
  code?: string
  name: string
  description?: string
  startDate?: string
  endDate?: string
  status: OkrStatus
  keyResults: KeyResultResponse[]
  orgUnitIds?: string[]
  orgUnitNames?: string[]
  perspectiveId?: string | null
  perspectiveName?: string | null
  perspectiveColor?: string | null
}

export interface ObjectiveRequest {
  code?: string
  name: string
  description?: string
  startDate?: string
  endDate?: string
  status?: OkrStatus
  orgUnitId?: string
  orgUnitIds?: string[]
  perspectiveId?: string | null
}

export interface KeyResultRequest {
  code?: string
  name: string
  description?: string
  targetValue: number
  currentValue?: number
  unit?: string
  objectiveId: string
  unitWeights?: UnitWeight[]
}
