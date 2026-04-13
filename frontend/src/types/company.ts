export type CompanyStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED'

// Matches BE: CompanyResponse
export interface Company {
  id: string
  name: string
  taxCode: string | null
  email: string | null
  phone: string | null
  address: string | null
  provinceId: string | null
  provinceName: string | null
  districtId: string | null
  districtName: string | null
  logoUrl: string | null
  status: CompanyStatus
  createdAt: string
  updatedAt: string
}

// Matches BE: UpdateCompanyRequest
export interface UpdateCompanyRequest {
  name?: string
  taxCode?: string
  email?: string
  phone?: string
  address?: string
  provinceId?: string
  districtId?: string
}
