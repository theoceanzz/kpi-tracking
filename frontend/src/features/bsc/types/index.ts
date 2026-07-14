export enum BscPerspectiveStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export interface PerspectiveResponse {
  id: string
  code: string
  name: string
  description?: string
  color?: string
  icon?: string
  displayOrder: number
  status: BscPerspectiveStatus
}

export interface PerspectiveRequest {
  code: string
  name: string
  description?: string
  color?: string
  icon?: string
  displayOrder?: number
  status?: BscPerspectiveStatus
}

export interface ImportBscResponse {
  totalRows: number
  successfulImports: number
  errors: string[]
}
