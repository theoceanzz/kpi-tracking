import { useState, useEffect, useMemo } from 'react'
import { read, write, utils } from 'xlsx'
import { Save, AlertCircle, Trash2, Plus, Loader2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

import { z } from 'zod'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useOrgHierarchyLevels, useOrgUnitTree } from '@/features/organization/hooks/useOrganizationStructure'
import { OrgUnitTreeResponse } from '@/features/organization/types/org-unit'
import { useRoles } from '@/features/organization/hooks/useRoles'
import { usePermission } from '@/hooks/usePermission'

interface ExcelPreviewModalProps {
  open: boolean
  file: File | null
  onClose: () => void
  onImport: (modifiedFile: File) => void
  isImporting: boolean
}

interface UserRow {
  id: string
  Email: string
  FullName: string
  Phone: string
  EmployeeCode: string
  Role: string
  Password?: string
  OrgUnitCode?: string
  _errors?: Record<string, string>
}

const rowSchema = z.object({
  Email: z.string().email('Email không hợp lệ').min(1, 'Bắt buộc'),
  FullName: z.string().min(1, 'Bắt buộc'),
  Phone: z.string().optional().nullable(),
  EmployeeCode: z.string().optional().nullable(),
  Role: z.string().min(1, 'Bắt buộc'),
  Password: z.string().min(6, 'Tối thiểu 6 ký tự').optional().or(z.literal('')),
  OrgUnitCode: z.string().optional().nullable(),
})

export default function ExcelPreviewModal({ open, file, onClose, onImport, isImporting }: ExcelPreviewModalProps) {
  const [data, setData] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const user = useAuthStore(state => state.user)
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: hierarchyLevels } = useOrgHierarchyLevels(organizationId)
  const { data: orgTree } = useOrgUnitTree(organizationId)
  const { data: rolesData } = useRoles()
  const { hasPermission } = usePermission()

  const { currentUserLevel, currentUserRank } = useMemo(() => {
    if (!user) return { currentUserLevel: 999, currentUserRank: 999 }
    
    // Use the values directly from the user memberships instead of looking up by name in rolesData
    const levels = user.memberships?.map(m => m.roleLevel ?? 999) || []
    const level = levels.length > 0 ? Math.min(...levels) : 999
    
    const ranks = user.memberships?.filter(m => (m.roleLevel ?? 999) === level).map(m => m.roleRank ?? 999) || []
    const rank = ranks.length > 0 ? Math.min(...ranks) : 999
    
    return { currentUserLevel: level, currentUserRank: rank }
  }, [user])

  const isAdmin = useMemo(() => {
    return hasPermission('ROLE:CREATE') || hasPermission('COMPANY:UPDATE') || 
           user?.memberships?.some(m => m.roleName === 'ADMIN' || m.roleName === 'DIRECTOR_SYSTEM') || false
  }, [user, hasPermission])

  const assignableRoles = useMemo(() => {
    if (!rolesData) return []
    const levelCount = hierarchyLevels?.length || 0

    return rolesData.filter((r: any) => {
      if (r.name === 'DIRECTOR_SYSTEM' && !user?.memberships?.some(m => m.roleName === 'DIRECTOR_SYSTEM')) return false

      const isDirectorSystem = user?.memberships?.some(m => m.roleName === 'DIRECTOR_SYSTEM')
      if (!isDirectorSystem) {
        if (r.level !== undefined && r.level < currentUserLevel) return false
        if (r.level === currentUserLevel && r.rank !== undefined && r.rank <= currentUserRank) return false
      }

      if (isAdmin) return true

      // 2. Hierarchy structural filters
      if (r.rank === 2) return true // Staff always allowed
      if (r.level === 0 && r.rank === 0) return levelCount >= 1
      if (r.level === 1) return levelCount > 2
      if (r.level === 2 && (r.rank === 0 || r.rank === 1)) return true
      
      return true
    })
  }, [rolesData, currentUserLevel, currentUserRank, isAdmin, user, hierarchyLevels])


  // Flatten tree to get all valid unit codes
  const validUnitCodes = useMemo(() => {
    const codes = new Set<string>()
    const traverse = (nodes: OrgUnitTreeResponse[]) => {
      nodes.forEach(node => {
        if (node.code) codes.add(node.code)
        if (node.children) traverse(node.children)
      })
    }
    if (orgTree) traverse(orgTree)
    return codes
  }, [orgTree])

  const unitInfoMap = useMemo(() => {
    const map = new Map<string, { level: number; allowedRoles?: any[] }>()
    const traverse = (nodes: OrgUnitTreeResponse[]) => {
      nodes.forEach(node => {
        const info = { level: node.level, allowedRoles: node.allowedRoles }
        if (node.code) map.set(node.code, info)
        map.set(node.id, info)
        if (node.children) traverse(node.children)
      })
    }
    if (orgTree) traverse(orgTree)
    return map
  }, [orgTree])


  useEffect(() => {
    if (open && file) {
      parseFile(file)
    } else {
      setData([])
    }
  }, [open, file])

  const parseFile = async (f: File) => {
    setLoading(true)
    try {
      const buffer = await f.arrayBuffer()
      const wb = read(buffer)
      const sheetName = wb.SheetNames[0]
      if (!sheetName) throw new Error('Excel file has no sheets')
      const ws = wb.Sheets[sheetName]
      if (!ws) throw new Error('Worksheet not found')
      const rawData = utils.sheet_to_json<any>(ws)

      const parsed: UserRow[] = rawData.map((row, index) => {
        const rawOrg = (row['OrgUnitCode'] || row['OrgUnit'] || '').toString().trim()
        
        return {
          id: `row-${index}`,
          Email: (row['Email'] || '').toString().trim(),
          FullName: (row['FullName'] || '').toString().trim(),
          Phone: (row['Phone'] || '').toString().trim(),
          EmployeeCode: (row['EmployeeCode'] || '').toString().trim(),
          Role: (row['Role'] || 'NHAN_VIEN').toString().trim(),
          Password: (row['Password'] || '').toString().trim(),
          OrgUnitCode: rawOrg,
        }
      })

      const validated = validateAllRows(parsed)

      if (parsed.length === 0) {
        toast.error('File không có dữ liệu hoặc sai định dạng.')
        onClose()
        return
      }

      setData(validated)
    } catch {
      toast.error('Lỗi khi đọc file Excel')
      onClose()
    } finally {
      setLoading(false)
    }
  }
  const validateRow = (row: UserRow): UserRow => {
    const result = rowSchema.safeParse(row)
    const errors: Record<string, string> = {}
    
    if (!result.success) {
      result.error.issues.forEach(issue => {
        const path = issue.path[0]
        if (typeof path === 'string') {
          errors[path] = issue.message
        }
      })
    }

    // Kiểm tra Mã đơn vị tồn tại và lấy thông tin đơn vị
    let selectedNode: OrgUnitTreeResponse | undefined
    if (row.OrgUnitCode && !validUnitCodes.has(row.OrgUnitCode)) {
      // Try matching by name
      const findByName = (nodes: OrgUnitTreeResponse[]): string | null => {
        for (const n of nodes) {
          if (n.name.toLowerCase().trim() === row.OrgUnitCode?.toLowerCase().trim()) return n.code
          if (n.children) {
            const res = findByName(n.children)
            if (res) return res
          }
        }
        return null
      }
      const matchedCode = orgTree ? findByName(orgTree) : null
      if (matchedCode) {
        row.OrgUnitCode = matchedCode
      }
    }

    if (!row.OrgUnitCode || !validUnitCodes.has(row.OrgUnitCode)) {
      const oldCode = row.OrgUnitCode || 'Trống'
      // Fallback to root unit if not matched or missing
      if (orgTree && orgTree.length > 0) {
        row.OrgUnitCode = orgTree[0]?.code
        errors['OrgUnitCode'] = `Mã đơn vị '${oldCode}' không tồn tại, đã tự động gán vào '${orgTree[0]?.name}'`
      } else {
        errors['OrgUnitCode'] = `Mã đơn vị '${oldCode}' không tồn tại trong hệ thống`
      }
    }
    
    if (row.OrgUnitCode && validUnitCodes.has(row.OrgUnitCode)) {
        // Tìm node tương ứng để lấy allowedRoles
        const findNode = (nodes: OrgUnitTreeResponse[]) => {
          for (const node of nodes) {
            if (node.code === row.OrgUnitCode) {
              selectedNode = node
              return
            }
            if (node.children) findNode(node.children)
          }
        }
      if (orgTree) findNode(orgTree)
    }

    let roleObj = rolesData?.find(r => 
      r.id === row.Role || 
      r.name.toLowerCase() === row.Role.toLowerCase() || 
      r.name.toLowerCase() === row.Role.toLowerCase()
    )

    // Fallback: Partial matching for renamed roles (e.g., "Trưởng phòng" matches "Trưởng phòng 1")
    if (!roleObj && rolesData && row.Role) {
      const excelRole = row.Role.toLowerCase().trim()
      roleObj = rolesData.find(r => {
        const dbRole = r.name.toLowerCase().trim()
        const mappedRole = r.name.toLowerCase().trim()
        return dbRole.includes(excelRole) || excelRole.includes(dbRole) || 
               mappedRole.includes(excelRole) || excelRole.includes(mappedRole)
      })
    }

    if (!roleObj) {
      const oldRole = row.Role || 'Trống'
      // Fallback to the lowest role in hierarchy if not found
      if (rolesData && rolesData.length > 0) {
        const sortedRoles = [...rolesData].sort((a, b) => {
          const levelA = a.level ?? 0;
          const levelB = b.level ?? 0;
          if (levelB !== levelA) return levelB - levelA;
          return (b.rank ?? 0) - (a.rank ?? 0);
        });
        roleObj = sortedRoles[0];
        if (roleObj) {
          errors['Role'] = `Chức danh '${oldRole}' không tồn tại, đã tự động gán vai trò '${roleObj.name}'`
        }
      } else {
        errors['Role'] = `Chức danh '${oldRole}' không tồn tại trong hệ thống`
      }
    }

    if (roleObj && roleObj.level !== undefined) {
      const isDirectorSystem = user?.memberships?.some(m => m.roleName === 'DIRECTOR_SYSTEM')
      if (!isDirectorSystem) {
        if (roleObj.level < currentUserLevel || (roleObj.level === currentUserLevel && roleObj.rank !== undefined && roleObj.rank <= currentUserRank)) {
          errors['Role'] = `Bạn không có quyền gán vai trò ngang hoặc cao hơn mình (${roleObj.name})`
        }
      }
    }

    // Kiểm tra phạm vi vai trò của Đơn vị (allowedRoles)
    let finalRole = row.Role
    if (roleObj) {
      finalRole = roleObj.id // Use ID internally
    }

    if (selectedNode && selectedNode.allowedRoles && selectedNode.allowedRoles.length > 0) {
      const allowedIds = new Set(selectedNode.allowedRoles.map((r: any) => r.id))
      const isRoleAllowed = roleObj ? allowedIds.has(roleObj.id) : false
      
      if (!isRoleAllowed) {
        errors['Role'] = `Vai trò ${roleObj ? roleObj.name : row.Role} không được phép gán trong đơn vị ${selectedNode.name}`
      }
    }

    if (Object.keys(errors).length > 0) {
      return { ...row, Role: finalRole, _errors: errors }
    }
    
    return { ...row, Role: finalRole, _errors: undefined }
  }

  const validateAllRows = (rows: UserRow[]): UserRow[] => {
    // 1. First pass: validate individual rows and resolve role IDs/unit codes
    const validatedRows = rows.map(row => validateRow(row))

    // 2. Second pass: collect statistics for cross-row validation
    const managerCounts = new Map<string, number>()
    const codeCounts = new Map<string, number>()
    const unitsWithManager = new Set<string>()

    validatedRows.forEach(row => {
      // At this point, row.Role is expected to be an ID if found by validateRow
      const roleObj = rolesData?.find((r: any) => r.id === row.Role)

      if (row.OrgUnitCode) {
        if (roleObj && (roleObj.rank === 0 || roleObj.rank === 1)) {
          const key = `${row.OrgUnitCode}-${roleObj.rank}`
          managerCounts.set(key, (managerCounts.get(key) || 0) + 1)
        }
        if (roleObj && roleObj.rank === 0) {
          unitsWithManager.add(row.OrgUnitCode)
        }
      }

      if (row.EmployeeCode && row.EmployeeCode.trim()) {
        const code = row.EmployeeCode.trim().toLowerCase()
        codeCounts.set(code, (codeCounts.get(code) || 0) + 1)
      }
    })

    // 3. Third pass: apply cross-row errors
    return validatedRows.map(row => {
      const errors = { ...(row._errors || {}) }
      const roleObj = rolesData?.find((r: any) => r.id === row.Role)

      if (row.OrgUnitCode && roleObj) {
        if (roleObj.rank === 0 || roleObj.rank === 1) {
          const key = `${row.OrgUnitCode}-${roleObj.rank}`
          if ((managerCounts.get(key) || 0) > 1) {
            const rankName = roleObj.rank === 0 ? 'Trưởng đơn vị' : 'Phó đơn vị'
            errors['Role'] = `Đơn vị này đang được gán nhiều hơn một ${rankName} trong tệp tin`
          }
        }

        if (roleObj.rank === 1 || roleObj.rank === 2) {
          const rootCode = orgTree && orgTree.length > 0 ? orgTree[0]?.code : null
          if (!unitsWithManager.has(row.OrgUnitCode) && row.OrgUnitCode !== rootCode) {
            errors['OrgUnitCode'] = 'Đơn vị cần có 1 Trưởng đơn vị đảm nhiệm (Rank 0) trong danh sách import'
          }
        }
      }

      // Duplicate employee code check in file
      if (row.EmployeeCode && row.EmployeeCode.trim()) {
        const code = row.EmployeeCode.trim().toLowerCase()
        if ((codeCounts.get(code) || 0) > 1) {
          errors['EmployeeCode'] = 'Mã nhân viên bị trùng lặp trong tệp tin'
        }
      }

      return { ...row, _errors: Object.keys(errors).length > 0 ? errors : undefined }
    })
  }

  const handleCellChange = (id: string, field: keyof UserRow, value: string) => {
    setData((prev: any[]) => {
      const updatedRows = prev.map((row: any) => row.id === id ? { ...row, [field]: value } : row);
      return validateAllRows(updatedRows);
    })
  }

  const handleRemoveRow = (id: string) => {
    setData((prev: any[]) => validateAllRows(prev.filter((r: any) => r.id !== id)))
  }

  const handleAddRow = () => {
    const newRow = {
      id: `new-${Date.now()}`,
      Email: '',
      FullName: '',
      Phone: '',
      EmployeeCode: '',
      Role: 'STAFF',
      Password: '',
      OrgUnitCode: '',
    }
    setData((prev: any[]) => validateAllRows([...prev, newRow]))
  }

  const handleSave = () => {
    const hasErrors = data.some((r: UserRow) => r._errors && Object.keys(r._errors).length > 0)
    if (hasErrors) {
      toast.error('Vui lòng sửa các lỗi trong bảng trước khi import')
      return
    }

    if (data.length === 0) {
      toast.error('Không có dữ liệu để import')
      return
    }

    // Generate new Excel file
    try {
      const exportData = data.map(({ Email, FullName, Phone, EmployeeCode, Role, Password, OrgUnitCode }: UserRow) => ({
        Email, FullName, Phone, EmployeeCode, Role, Password, OrgUnitCode
      }))
      
      const ws = utils.json_to_sheet(exportData)
      const wb = utils.book_new()
      utils.book_append_sheet(wb, ws, 'Users')
      
      const wbout = write(wb, { type: 'array', bookType: 'xlsx' })
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const newFile = new File([blob], file?.name || 'import_users.xlsx', { type: blob.type })
      
      onImport(newFile)
    } catch {
      toast.error('Lỗi khi tạo file import')
    }
  }

  if (!open) return null

  const criticalErrorFields = ['Email', 'FullName']
  const hasCriticalErrors = data.some((r: UserRow) => {
    if (!r._errors) return false
    return Object.keys(r._errors).some(field => criticalErrorFields.includes(field))
  })
  const hasAnyErrors = data.some((r: UserRow) => r._errors && Object.keys(r._errors).length > 0)

  return (
    <Dialog
      open
      onClose={onClose}
      size="full"
      dismissible={!isImporting}
      title="Xem trước & Kiểm tra dữ liệu"
      description={`File: ${file?.name ?? ''}`}
      footer={
        <DialogFooter
          note={<>Tổng cộng: <span className="font-medium text-[var(--color-foreground)] tabular-nums">{data.length}</span> dòng hợp lệ</>}
          secondary={<Button variant="outline" onClick={onClose} disabled={isImporting}>Hủy bỏ</Button>}
          primary={
            <Button onClick={handleSave} disabled={isImporting || hasCriticalErrors || data.length === 0}>
              {isImporting ? <><Loader2 className="animate-spin" aria-hidden="true" /> Đang Import...</> : <><Save aria-hidden="true" /> Xác nhận Import</>}
            </Button>
          }
        />
      }
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 text-[var(--color-subtle-foreground)]">
          <div className="w-8 h-8 border-4 border-[var(--color-info-border)] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="font-medium text-sm">Đang đọc file...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {hasAnyErrors && (
            <div className="p-4 bg-[var(--color-error-bg)] text-[var(--color-error)] rounded-card flex items-start gap-3 border border-[var(--color-error-border)]">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Phát hiện dữ liệu không hợp lệ</p>
                <p className="text-xs mt-1">Vui lòng kiểm tra và sửa các ô được tô đỏ trước khi tiến hành Import.</p>
              </div>
            </div>
          )}

          <div className="border border-[var(--color-border)] rounded-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-eyebrow bg-[var(--color-muted)] border-b border-[var(--color-border)] text-[var(--color-muted-foreground)] sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center bg-[var(--color-muted)]">STT</th>
                    <th className="px-4 py-3 min-w-[250px] bg-[var(--color-muted)]">Email <span className="text-[var(--color-error)]">*</span></th>
                    <th className="px-4 py-3 min-w-[220px] bg-[var(--color-muted)]">Họ Tên <span className="text-[var(--color-error)]">*</span></th>
                    <th className="px-4 py-3 min-w-[150px] bg-[var(--color-muted)]">Số điện thoại</th>
                    <th className="px-4 py-3 min-w-[150px] bg-[var(--color-muted)]">Mã NV</th>
                    <th className="px-4 py-3 min-w-[200px] bg-[var(--color-muted)]">Chức danh <span className="text-[var(--color-error)]">*</span></th>
                    <th className="px-4 py-3 min-w-[200px] bg-[var(--color-muted)]">Mật khẩu</th>
                    <th className="px-4 py-3 min-w-[300px] bg-[var(--color-muted)]">Phòng ban / Đơn vị</th>
                    <th className="px-4 py-3 w-16 text-center bg-[var(--color-muted)]">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {data.map((row, index) => (
                    <tr key={row.id} className="hover:bg-[var(--color-muted)] transition-colors">
                      <td className="px-4 py-3 text-center text-[var(--color-subtle-foreground)] font-medium">
                        {index + 1}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={row.Email}
                          onChange={e => handleCellChange(row.id, 'Email', e.target.value)}
                          className={cn(
                            "w-full px-3 py-1.5 rounded-control border text-sm transition-colors",
                            row._errors?.Email 
                              ? "border-[var(--color-error-border)] bg-[var(--color-error-bg)] focus:border-[var(--color-error-border)] focus:ring-1 focus:ring-[var(--color-error-solid)]" 
                              : "border-transparent hover:border-[var(--color-border-strong)] focus:border-[var(--color-info-border)] focus:ring-1 focus:ring-[var(--color-info-solid)] bg-transparent hover:bg-[var(--color-card)] focus:bg-[var(--color-card)]"
                          )}
                          placeholder="Nhập email..."
                        />
                        {row._errors?.Email && <p className="text-xs text-[var(--color-error)] mt-1 font-medium px-1">{row._errors.Email}</p>}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={row.FullName}
                          onChange={e => handleCellChange(row.id, 'FullName', e.target.value)}
                          className={cn(
                            "w-full px-3 py-1.5 rounded-control border text-sm transition-colors",
                            row._errors?.FullName 
                              ? "border-[var(--color-error-border)] bg-[var(--color-error-bg)] focus:border-[var(--color-error-border)] focus:ring-1 focus:ring-[var(--color-error-solid)]" 
                              : "border-transparent hover:border-[var(--color-border-strong)] focus:border-[var(--color-info-border)] focus:ring-1 focus:ring-[var(--color-info-solid)] bg-transparent hover:bg-[var(--color-card)] focus:bg-[var(--color-card)]"
                          )}
                          placeholder="Nhập họ tên..."
                        />
                        {row._errors?.FullName && <p className="text-xs text-[var(--color-error)] mt-1 font-medium px-1">{row._errors.FullName}</p>}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={row.Phone}
                          onChange={e => handleCellChange(row.id, 'Phone', e.target.value)}
                          className="w-full px-3 py-1.5 rounded-control border border-transparent hover:border-[var(--color-border-strong)] focus:border-[var(--color-info-border)] focus:ring-1 focus:ring-[var(--color-info-solid)] bg-transparent hover:bg-[var(--color-card)] focus:bg-[var(--color-card)] text-sm transition-colors"
                          placeholder="Trống..."
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={row.EmployeeCode}
                          onChange={e => handleCellChange(row.id, 'EmployeeCode', e.target.value)}
                          className={cn(
                            "w-full px-3 py-1.5 rounded-control border text-sm transition-colors",
                            row._errors?.EmployeeCode 
                              ? "border-[var(--color-error-border)] bg-[var(--color-error-bg)] focus:border-[var(--color-error-border)] focus:ring-1 focus:ring-[var(--color-error-solid)]" 
                              : "border-transparent hover:border-[var(--color-border-strong)] focus:border-[var(--color-info-border)] focus:ring-1 focus:ring-[var(--color-info-solid)] bg-transparent hover:bg-[var(--color-card)] focus:bg-[var(--color-card)]"
                          )}
                          placeholder="Trống..."
                        />
                        {row._errors?.EmployeeCode && <p className="text-xs text-[var(--color-error)] mt-1 font-medium px-1">{row._errors.EmployeeCode}</p>}
                      </td>
                      <td className="px-4 py-2">
                        {(() => {
                          const unitInfo = unitInfoMap.get(row.OrgUnitCode || '')
                          const filteredRoles = assignableRoles.filter(role => {
                            if (!unitInfo) return true // Show all if unit not selected yet
                            
                            // 1. If explicit allowedRoles exists on unit, use it
                            if (unitInfo.allowedRoles) {
                              if (unitInfo.allowedRoles.length === 0) return false
                              return unitInfo.allowedRoles.some(ar => ar.id === role.id)
                            }

                            return true
                          })

                          const isCurrentRoleMissing = !filteredRoles.some(r => r.id === row.Role);
                          return (
                            <select
                              value={row.Role}
                              onChange={e => handleCellChange(row.id, 'Role', e.target.value)}
                              className={cn(
                                "w-full px-4 py-3 rounded-card border text-sm font-medium transition-all bg-[var(--color-card)] shadow-sm",
                                row._errors?.Role 
                                  ? "border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error)]" 
                                  : "border-[var(--color-border)] hover:border-[var(--color-info-border)] focus:border-[var(--color-info-border)] focus:ring-4 focus:ring-[var(--color-info-solid)]"
                              )}
                            >
                              {isCurrentRoleMissing && (
                                <option value={row.Role} className="hidden">
                                  {(() => {
                                    const r = rolesData?.find((x: any) => x.id === row.Role || x.name === row.Role);
                                    return r ? r.name : 'Chọn chức danh...';
                                  })()}
                                </option>
                              )}
                              {filteredRoles.map(role => (
                                <option key={role.id} value={role.id}>{role.name}</option>
                              ))}
                            </select>
                          )
                        })()}
                        {row._errors?.Role && <p className="text-xs text-[var(--color-error)] mt-1 font-medium px-1">{row._errors.Role}</p>}
                        {(() => {
                          const unitInfo = unitInfoMap.get(row.OrgUnitCode || '')
                          const hasNoRoles = unitInfo?.allowedRoles && unitInfo.allowedRoles.length === 0
                          if (hasNoRoles) {
                            return (
                              <p className="text-xs text-[var(--color-error)] mt-1 font-medium italic px-1 flex items-center gap-1">
                                <AlertCircle size={10} /> Đơn vị này chưa được thiết lập phạm vi vai trò. Hãy cấu hình ở mục "Sơ đồ tổ chức".
                              </p>
                            )
                          }
                          return null
                        })()}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={row.Password}
                          onChange={e => handleCellChange(row.id, 'Password', e.target.value)}
                          className={cn(
                            "w-full px-4 py-3 rounded-card border text-sm font-medium transition-all bg-[var(--color-card)] shadow-sm",
                            row._errors?.Password 
                              ? "border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error)]" 
                              : "border-[var(--color-border)] hover:border-[var(--color-info-border)] focus:border-[var(--color-info-border)] focus:ring-4 focus:ring-[var(--color-info-solid)]"
                          )}
                          placeholder="Tự động sinh..."
                        />
                        {row._errors?.Password && <p className="text-xs text-[var(--color-error)] mt-1 font-medium px-1">{row._errors.Password}</p>}
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={row.OrgUnitCode || ''}
                          onChange={e => handleCellChange(row.id, 'OrgUnitCode', e.target.value)}
                          className={cn(
                            "w-full px-3 py-1.5 rounded-control border text-sm transition-colors bg-transparent hover:bg-[var(--color-card)] focus:bg-[var(--color-card)]",
                            row._errors?.OrgUnitCode ? "border-[var(--color-error-border)] bg-[var(--color-error-bg)]" : "border-transparent hover:border-[var(--color-border-strong)]"
                          )}
                        >
                          {Array.from(validUnitCodes).map(code => {
                            // Try to find the name for this code from orgTree
                            let name = code
                            const findName = (nodes: any[]) => {
                              for (const n of nodes) {
                                if (n.code === code) { name = n.name; return }
                                if (n.children) findName(n.children)
                              }
                            }
                            if (orgTree) findName(orgTree)
                            return <option key={code} value={code}>{name} ({code})</option>
                          })}
                        </select>
                        {row._errors?.OrgUnitCode && <p className="text-xs text-[var(--color-error)] mt-1 font-medium px-1">{row._errors.OrgUnitCode}</p>}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => handleRemoveRow(row.id)}
                          className="p-1.5 text-[var(--color-subtle-foreground)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)] rounded-control transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.length === 0 && (
              <div className="text-center py-12 text-[var(--color-muted-foreground)] text-sm">
                Không có dòng dữ liệu nào
              </div>
            )}
            <div className="bg-[var(--color-muted)] border-t border-[var(--color-border)] p-3 flex justify-center">
              <Button variant="ghost" onClick={handleAddRow}>
                <Plus aria-hidden="true" /> Thêm dòng mới
              </Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  )
}
