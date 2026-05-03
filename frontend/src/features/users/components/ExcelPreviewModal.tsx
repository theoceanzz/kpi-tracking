import { useState, useEffect, useMemo } from 'react'
import { read, write, utils } from 'xlsx'
import { X, Save, AlertCircle, Trash2, Plus, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { ROLE_MAP } from '@/constants/roles'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useOrgHierarchyLevels, useOrgUnitTree } from '@/features/organization/hooks/useOrganizationStructure'
import { OrgUnitTreeResponse } from '@/features/organization/types/org-unit'
import { useRoles } from '@/features/organization/hooks/useRoles'

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

  // Find the highest rank (lowest level number) of the current user
  const currentUserLevel = useMemo(() => {
    if (!user || !rolesData) return 999
    const userRoleNames = user.memberships?.map(m => m.roleName) || []
    const levels = rolesData
      .filter(r => userRoleNames.includes(r.name))
      .map(r => r.level ?? 999)
    return levels.length > 0 ? Math.min(...levels) : 999
  }, [user, rolesData])

  const assignableRoles = useMemo(() => {
    if (!rolesData) return []
    
    const filtered = rolesData.filter(r => {
      // Rule: Cannot assign a role of equal or higher level
      if (r.level !== undefined && r.level <= currentUserLevel) {
        return false
      }

      // Filter by rank instead of name
      if (hierarchyLevels && hierarchyLevels.length > 0) {
        const levelCount = hierarchyLevels.length
        
        // Staff roles (rank 2) are always allowed
        if (r.rank === 2) return true
        
        // Director-level roles (level 0, rank 0)
        if (r.level === 0 && r.rank === 0) return levelCount >= 1
        
        // Mid-level roles (level 1) only shown when hierarchy has 3+ levels
        if (r.level === 1) return levelCount > 2
        
        // Team-level roles (level 2, rank 0 or 1) always shown
        if (r.level === 2 && (r.rank === 0 || r.rank === 1)) return true
      }
      return true
    })

    // Remove duplicates by display label
    const seen = new Set<string>()
    return filtered.filter(r => {
      const label = ROLE_MAP[r.name] || r.name
      if (seen.has(label)) return false
      seen.add(label)
      return true
    })
  }, [rolesData, currentUserLevel, hierarchyLevels])

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
    } catch (error) {
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
    if (row.OrgUnitCode) {
      // Try matching by code first
      if (validUnitCodes.has(row.OrgUnitCode)) {
        // Already a valid code
      } else {
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

      if (!validUnitCodes.has(row.OrgUnitCode)) {
        errors['OrgUnitCode'] = 'Đơn vị không hợp lệ'
      } else {
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
    }

    // Kiểm tra quyền hạn gán vai trò (theo rank)
    let roleObj = rolesData?.find(r => 
      r.id === row.Role || 
      r.name.toLowerCase() === row.Role.toLowerCase() || 
      (ROLE_MAP[r.name] || r.name).toLowerCase() === row.Role.toLowerCase()
    )

    // Fallback to the lowest role in hierarchy if not found
    if (!roleObj && rolesData && rolesData.length > 0) {
      // Find role with highest level, then highest rank
      const sortedRoles = [...rolesData].sort((a, b) => {
        const levelA = a.level ?? 0;
        const levelB = b.level ?? 0;
        if (levelB !== levelA) return levelB - levelA;
        return (b.rank ?? 0) - (a.rank ?? 0);
      });
      roleObj = sortedRoles[0];
    }

    if (roleObj && roleObj.level !== undefined && roleObj.level <= currentUserLevel) {
      errors['Role'] = `Bạn không có quyền gán vai trò ngang hoặc cao hơn mình (${ROLE_MAP[roleObj.name] || roleObj.name})`
    }

    // Kiểm tra phạm vi vai trò của Đơn vị (allowedRoles)
    let finalRole = row.Role
    if (roleObj) {
      finalRole = roleObj.id // Use ID internally
    }

    if (selectedNode && selectedNode.allowedRoles && selectedNode.allowedRoles.length > 0) {
      const allowedIds = new Set(selectedNode.allowedRoles.map(r => r.id))
      // Nhân viên (Rank 2) luôn được phép ở mọi đơn vị
      const isStaffRole = roleObj?.rank === 2
      
      const isRoleAllowed = roleObj ? allowedIds.has(roleObj.id) : false
      
      if (!isRoleAllowed && !isStaffRole) {
        errors['Role'] = `Vai trò ${roleObj ? (ROLE_MAP[roleObj.name] || roleObj.name) : row.Role} không được phép gán trong đơn vị ${selectedNode.name}`
      }
    }

    if (Object.keys(errors).length > 0) {
      return { ...row, Role: finalRole, _errors: errors }
    }
    
    return { ...row, Role: finalRole, _errors: undefined }
  }

  const validateAllRows = (rows: UserRow[]): UserRow[] => {
    // Group by (OrgUnitCode, Rank) for manager/deputy roles
    const managerCounts = new Map<string, number>();
    rows.forEach(row => {
      const roleObj = rolesData?.find(r => r.name.toLowerCase() === row.Role.toLowerCase());
      if (row.OrgUnitCode && roleObj && (roleObj.rank === 0 || roleObj.rank === 1)) {
        const key = `${row.OrgUnitCode}-${roleObj.rank}`;
        managerCounts.set(key, (managerCounts.get(key) || 0) + 1);
      }
    });

    return rows.map(row => {
      const validated = validateRow(row);
      const errors = { ...(validated._errors || {}) };

      const roleObj = rolesData?.find(r => r.id === validated.Role);
      if (row.OrgUnitCode && roleObj && (roleObj.rank === 0 || roleObj.rank === 1)) {
        const key = `${row.OrgUnitCode}-${roleObj.rank}`;
        if ((managerCounts.get(key) || 0) > 1) {
          const rankName = roleObj.rank === 0 ? 'Trưởng' : 'Phó';
          errors['Role'] = `Đơn vị này đang được gán nhiều hơn một ${rankName.toLowerCase()} trong tệp tin`;
        }
      }

      return { ...validated, _errors: Object.keys(errors).length > 0 ? errors : undefined };
    });
  }

  const handleCellChange = (id: string, field: keyof UserRow, value: string) => {
    setData(prev => {
      const updatedRows = prev.map(row => row.id === id ? { ...row, [field]: value } : row);
      return validateAllRows(updatedRows);
    })
  }

  const handleRemoveRow = (id: string) => {
    setData(prev => validateAllRows(prev.filter(r => r.id !== id)))
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
    setData(prev => validateAllRows([...prev, newRow]))
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
    } catch (e) {
      toast.error('Lỗi khi tạo file import')
    }
  }

  if (!open) return null

  const hasAnyErrors = data.some((r: UserRow) => r._errors && Object.keys(r._errors).length > 0)

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[95vw] lg:max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Xem trước & Kiểm tra dữ liệu</h2>
              <p className="text-xs text-gray-500">File: {file?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-200 transition-colors text-gray-500">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 p-6 scrollbar-thin scrollbar-thumb-gray-200">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="font-medium text-sm">Đang đọc file...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {hasAnyErrors && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-start gap-3 border border-red-100">
                  <AlertCircle size={20} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold">Phát hiện dữ liệu không hợp lệ</p>
                    <p className="text-xs mt-1">Vui lòng kiểm tra và sửa các ô được tô đỏ trước khi tiến hành Import.</p>
                  </div>
                </div>
              )}

              <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 w-12 text-center bg-gray-50">STT</th>
                        <th className="px-4 py-3 min-w-[250px] bg-gray-50">Email <span className="text-red-500">*</span></th>
                        <th className="px-4 py-3 min-w-[220px] bg-gray-50">Họ Tên <span className="text-red-500">*</span></th>
                        <th className="px-4 py-3 min-w-[150px] bg-gray-50">Số điện thoại</th>
                        <th className="px-4 py-3 min-w-[150px] bg-gray-50">Mã NV</th>
                        <th className="px-4 py-3 min-w-[160px] bg-gray-50">Chức danh <span className="text-red-500">*</span></th>
                        <th className="px-4 py-3 min-w-[160px] bg-gray-50">Mật khẩu</th>
                        <th className="px-4 py-3 min-w-[300px] bg-gray-50">Phòng ban / Đơn vị</th>
                        <th className="px-4 py-3 w-16 text-center bg-gray-50">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.map((row, index) => (
                        <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 text-center text-gray-400 font-medium">
                            {index + 1}
                          </td>
                          <td className="px-4 py-2">
                            <input
                              value={row.Email}
                              onChange={e => handleCellChange(row.id, 'Email', e.target.value)}
                              className={cn(
                                "w-full px-3 py-1.5 rounded-lg border text-sm transition-colors",
                                row._errors?.Email 
                                  ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-1 focus:ring-red-500" 
                                  : "border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-transparent hover:bg-white focus:bg-white"
                              )}
                              placeholder="Nhập email..."
                            />
                            {row._errors?.Email && <p className="text-[10px] text-red-500 mt-1 font-medium px-1">{row._errors.Email}</p>}
                          </td>
                          <td className="px-4 py-2">
                            <input
                              value={row.FullName}
                              onChange={e => handleCellChange(row.id, 'FullName', e.target.value)}
                              className={cn(
                                "w-full px-3 py-1.5 rounded-lg border text-sm transition-colors",
                                row._errors?.FullName 
                                  ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-1 focus:ring-red-500" 
                                  : "border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-transparent hover:bg-white focus:bg-white"
                              )}
                              placeholder="Nhập họ tên..."
                            />
                            {row._errors?.FullName && <p className="text-[10px] text-red-500 mt-1 font-medium px-1">{row._errors.FullName}</p>}
                          </td>
                          <td className="px-4 py-2">
                            <input
                              value={row.Phone}
                              onChange={e => handleCellChange(row.id, 'Phone', e.target.value)}
                              className="w-full px-3 py-1.5 rounded-lg border border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-transparent hover:bg-white focus:bg-white text-sm transition-colors"
                              placeholder="Trống..."
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              value={row.EmployeeCode}
                              onChange={e => handleCellChange(row.id, 'EmployeeCode', e.target.value)}
                              className="w-full px-3 py-1.5 rounded-lg border border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-transparent hover:bg-white focus:bg-white text-sm transition-colors"
                              placeholder="Trống..."
                            />
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={row.Role}
                              onChange={e => handleCellChange(row.id, 'Role', e.target.value)}
                              className={cn(
                                "w-full px-3 py-1.5 rounded-lg border text-sm transition-colors bg-transparent hover:bg-white focus:bg-white",
                                row._errors?.Role ? "border-red-300 bg-red-50" : "border-transparent hover:border-gray-300"
                              )}
                            >
                              {(() => {
                                // Filter assignableRoles by the unit's allowedRoles if specified
                                let unitAllowedRoles = assignableRoles
                                if (row.OrgUnitCode && orgTree) {
                                  let node: OrgUnitTreeResponse | undefined
                                  const findNode = (nodes: OrgUnitTreeResponse[]) => {
                                    for (const n of nodes) {
                                      if (n.code === row.OrgUnitCode) { node = n; return }
                                      if (n.children) findNode(n.children)
                                    }
                                  }
                                  findNode(orgTree)
                                  if (node && node.allowedRoles && node.allowedRoles.length > 0) {
                                    const allowedNames = node.allowedRoles.map(r => r.name.toLowerCase())
                                    unitAllowedRoles = assignableRoles.filter(r => allowedNames.includes(r.name.toLowerCase()) || r.rank === 2)
                                  }
                                }

                                return (
                                  <>
                                    {unitAllowedRoles.map(role => (
                                      <option key={role.id} value={role.id}>{ROLE_MAP[role.name] || role.name}</option>
                                    ))}
                                    {/* Fallback if current row has an unassignable role, to show the error */}
                                    {!unitAllowedRoles.some(r => r.id === row.Role) && (
                                      <option value={row.Role}>{rolesData?.find(r => r.id === row.Role)?.name || row.Role}</option>
                                    )}
                                  </>
                                )
                              })()}
                            </select>
                            {row._errors?.Role && <p className="text-[10px] text-red-500 mt-1 font-medium px-1">{row._errors.Role}</p>}
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={row.Password}
                              onChange={e => handleCellChange(row.id, 'Password', e.target.value)}
                              className={cn(
                                "w-full px-3 py-1.5 rounded-lg border text-sm transition-colors bg-transparent hover:bg-white focus:bg-white",
                                row._errors?.Password ? "border-red-300 bg-red-50" : "border-transparent hover:border-gray-300"
                              )}
                              placeholder="Tự động sinh..."
                            />
                            {row._errors?.Password && <p className="text-[10px] text-red-500 mt-1 font-medium px-1">{row._errors.Password}</p>}
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={row.OrgUnitCode || ''}
                              onChange={e => handleCellChange(row.id, 'OrgUnitCode', e.target.value)}
                              className={cn(
                                "w-full px-3 py-1.5 rounded-lg border text-sm transition-colors bg-transparent hover:bg-white focus:bg-white",
                                row._errors?.OrgUnitCode ? "border-red-300 bg-red-50" : "border-transparent hover:border-gray-300"
                              )}
                            >
                              <option value="">-- Chọn đơn vị --</option>
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
                            {row._errors?.OrgUnitCode && <p className="text-[10px] text-red-500 mt-1 font-medium px-1">{row._errors.OrgUnitCode}</p>}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={() => handleRemoveRow(row.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
                  <div className="text-center py-12 text-gray-500 text-sm">
                    Không có dòng dữ liệu nào
                  </div>
                )}
                <div className="bg-gray-50 border-t border-gray-200 p-3 flex justify-center">
                  <button
                    onClick={handleAddRow}
                    className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-xl transition-colors"
                  >
                    <Plus size={16} /> Thêm dòng mới
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <p className="text-sm font-bold text-gray-500">
            Tổng cộng: <span className="text-gray-900">{data.length}</span> dòng hợp lệ
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isImporting}
              className="px-6 py-2.5 rounded-xl text-sm font-bold border border-gray-200 hover:bg-white transition-colors text-gray-600 disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              onClick={handleSave}
              disabled={isImporting || hasAnyErrors || data.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 disabled:opacity-50 transition-all active:scale-95"
            >
              {isImporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Đang Import...
                </>
              ) : (
                <>
                  <Save size={16} /> Xác nhận Import
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
