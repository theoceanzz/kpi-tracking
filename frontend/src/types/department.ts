export type DeptMemberPosition = 'HEAD' | 'DEPUTY' | 'STAFF'

// Matches BE: DepartmentResponse
export interface Department {
  id: string
  name: string
  description: string | null
  headId: string | null
  headName: string | null
  deputyId: string | null
  deputyName: string | null
  memberCount: number
  members: DepartmentMember[] | null
  createdAt: string
  updatedAt: string
}

// Matches BE: DepartmentMemberResponse
export interface DepartmentMember {
  id: string
  userId: string
  userFullName: string
  userEmail: string
  position: DeptMemberPosition
  createdAt: string
}

// Matches BE: CreateDepartmentRequest
export interface CreateDepartmentRequest {
  name: string
  description?: string
  headId?: string
  deputyId?: string
}

// Matches BE: UpdateDepartmentRequest
export interface UpdateDepartmentRequest {
  name?: string
  description?: string
  headId?: string
  deputyId?: string
}

// Matches BE: AddMemberRequest
export interface AddMemberRequest {
  userId: string
  position: DeptMemberPosition
}
