export enum OkrStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
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
  orgUnitId?: string
  orgUnitName?: string
}

export interface ObjectiveRequest {
  code?: string
  name: string
  description?: string
  startDate?: string
  endDate?: string
  status?: OkrStatus
  orgUnitId?: string
}

export interface KeyResultRequest {
  code?: string
  name: string
  description?: string
  targetValue: number
  currentValue?: number
  unit?: string
  objectiveId: string
}
