import { useState, useEffect, useMemo, useCallback } from 'react'
import { z } from 'zod'
import { read, write, utils } from 'xlsx'
import { X, Save, Trash2, FileSpreadsheet, Check, CheckSquare, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useRoles } from '../hooks/useUserRoles'
import { useOrgUnitTree } from '../hooks/useOrganizationStructure'

interface OrgExcelPreviewModalProps {
  open: boolean
  file: File | null
  onClose: () => void
  onImport: (modifiedFile: File) => void
  isImporting: boolean
  orgId: string
  hierarchyLevels: Record<number, string>
}

/**
 * Ràng buộc từng dòng. Trùng mã trong tệp và mã cha có tồn tại hay không phải nhìn cả tệp
 * lẫn dữ liệu hệ thống, nên nằm ở `validateBatch` bên dưới chứ không ở đây.
 */
const rowSchema = z.object({
  Name: z.string().trim().min(1, 'Tên đơn vị là bắt buộc'),
  Code: z.string().trim().min(1, 'Mã đơn vị là bắt buộc'),
  Email: z.string().email('Email không hợp lệ').or(z.literal('')).optional(),
})

interface OrgUnitRow {
  id: string
  Name: string
  Code: string
  ParentCode: string
  Email: string
  Phone: string
  Address: string
  RoleIds: string // Comma separated IDs
  _errors?: Record<string, string>
}

export default function OrgExcelPreviewModal({ 
  open, 
  file, 
  onClose, 
  onImport, 
  isImporting, 
  orgId, 
  hierarchyLevels 
}: OrgExcelPreviewModalProps) {
  const [data, setData] = useState<OrgUnitRow[]>([])
  const [loading, setLoading] = useState(false)
  
  const { data: allRoles = [] } = useRoles()
  const { data: orgTree = [] } = useOrgUnitTree(orgId)

  // Flatten tree to easily find existing units
  const existingUnitsMap = useMemo(() => {
    const map = new Map<string, any>()
    const traverse = (nodes: any[]) => {
      nodes.forEach(node => {
        map.set(node.code, node)
        if (node.children) traverse(node.children)
      })
    }
    traverse(orgTree)
    return map
  }, [orgTree])

  const { minDepth, maxDepth, totalLevels } = useMemo(() => {
    const levels = Object.keys(hierarchyLevels || {}).map(Number)
    return {
      minDepth: levels.length > 0 ? Math.min(...levels) : 1,
      maxDepth: levels.length > 0 ? Math.max(...levels) : 5,
      totalLevels: levels.length
    }
  }, [hierarchyLevels])

  // Validation function
  const validateBatch = useCallback((rows: OrgUnitRow[]) => {
    const batchCodes = new Set(rows.map(r => r.Code).filter(Boolean))
    
    return rows.map(row => {
      const errors: Record<string, string> = {}

      const parsed = rowSchema.safeParse(row)
      if (!parsed.success) {
        parsed.error.issues.forEach(issue => {
          const field = issue.path[0]
          if (typeof field === 'string') errors[field] = issue.message
        })
      }
      
      // Duplicated code in batch
      if (row.Code && rows.filter(r => r.Code === row.Code).length > 1) {
        errors.Code = 'Mã đơn vị bị trùng lặp trong tệp tin'
      }

      // Existing code check
      if (row.Code && existingUnitsMap.has(row.Code)) {
        // This is fine for updating, but maybe warn? Let's just focus on ParentCode as requested
      }

      // ParentCode validation
      if (row.ParentCode) {
        const parentExistsInSystem = existingUnitsMap.has(row.ParentCode)
        const parentExistsInBatch = batchCodes.has(row.ParentCode)
        
        if (!parentExistsInSystem && !parentExistsInBatch) {
          errors.ParentCode = `Mã cha '${row.ParentCode}' không tồn tại trong hệ thống hoặc tệp tin`
        }

        // Self-parenting
        if (row.ParentCode === row.Code) {
          errors.ParentCode = 'Mã cha không thể trùng với mã đơn vị'
        }
      }

      return { ...row, _errors: Object.keys(errors).length > 0 ? errors : undefined }
    })
  }, [existingUnitsMap])

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
      if (!sheetName) throw new Error('Excel không có sheet')
      const ws = wb.Sheets[sheetName]
      if (!ws) throw new Error('Không tìm thấy worksheet')
      const rawData = utils.sheet_to_json<any>(ws)

      const parsed: OrgUnitRow[] = rawData.map((row, index) => ({
        id: `row-${index}`,
        Name: (row['Name'] || '').toString().trim(),
        Code: (row['Code'] || '').toString().trim(),
        ParentCode: (row['ParentCode'] || '').toString().trim(),
        Email: (row['Email'] || '').toString().trim(),
        Phone: (row['Phone'] || '').toString().trim(),
        Address: (row['Address'] || '').toString().trim(),
        RoleIds: (row['RoleIds'] || '').toString().trim(),
      }))

      if (parsed.length === 0) {
        toast.error('File không có dữ liệu.')
        onClose()
        return
      }

      setData(validateBatch(parsed))
    } catch (error) {
      toast.error('Lỗi khi đọc file Excel')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  // Calculate level of a unit row
  const getRowLevel = (row: OrgUnitRow, currentData: OrgUnitRow[]): number => {
    if (!row.ParentCode) return minDepth
    
    // Check in existing units
    const existingParent = existingUnitsMap.get(row.ParentCode)
    if (existingParent) return Number(existingParent.level) + 1

    // Check in current batch (recursive lookup)
    const findParentInBatch = (parentCode: string, visited = new Set<string>()): number => {
      if (visited.has(parentCode)) return minDepth // Cycle detection
      visited.add(parentCode)

      const parentRow = currentData.find(r => r.Code === parentCode)
      if (!parentRow) return minDepth // Cannot find, assume top level of batch

      if (!parentRow.ParentCode) return minDepth + 1
      
      const systemParent = existingUnitsMap.get(parentRow.ParentCode)
      if (systemParent) return Number(systemParent.level) + 2

      return findParentInBatch(parentRow.ParentCode, visited) + 1
    }

    return findParentInBatch(row.ParentCode)
  }

  const getFilteredRoles = (calculatedLevel: number) => {
    const isRoot = calculatedLevel === minDepth
    const isBottom = calculatedLevel === maxDepth
    const isMiddle = !isRoot && !isBottom

    return allRoles.filter(role => {
      const roleLevel = role.level
      if (roleLevel === undefined || roleLevel === null) return false
      
      if (totalLevels === 2) {
        if (isRoot) return roleLevel === 2 || roleLevel === 4
        if (isBottom) return roleLevel === 4
      }
      
      if (totalLevels === 3) {
        if (isRoot) return roleLevel === 2 || roleLevel === 4
        if (isMiddle) return roleLevel === 3
        if (isBottom) return roleLevel === 4
      }

      if (totalLevels === 4) {
        if (isRoot) return roleLevel === 1 || roleLevel === 4
        if (calculatedLevel === minDepth + 1) return roleLevel === 2
        if (calculatedLevel === minDepth + 2) return roleLevel === 3
        if (isBottom) return roleLevel === 4
      }
      
      if (totalLevels === 5) {
        if (isRoot) return roleLevel === 0 || roleLevel === 4
        if (calculatedLevel === minDepth + 1) return roleLevel === 1
        if (calculatedLevel === minDepth + 2) return roleLevel === 2
        if (calculatedLevel === minDepth + 3) return roleLevel === 3
        if (isBottom) return roleLevel === 4
      }
      return false
    })
  }

  const handleCellChange = (id: string, field: keyof OrgUnitRow, value: string) => {
    setData(prev => {
      const updated = prev.map(row => row.id === id ? { ...row, [field]: value } : row)
      return validateBatch(updated)
    })
  }

  const toggleRole = (rowId: string, roleId: string) => {
    setData(prev => prev.map(row => {
      if (row.id !== rowId) return row
      
      const currentRoles = row.RoleIds ? row.RoleIds.split(',').filter(Boolean) : []
      const newRoles = currentRoles.includes(roleId)
        ? currentRoles.filter(id => id !== roleId)
        : [...currentRoles, roleId]
      
      return { ...row, RoleIds: newRoles.join(',') }
    }))
  }

  const selectAllRolesForRow = (rowId: string) => {
    setData(prev => prev.map(row => {
      if (row.id !== rowId) return row
      const calculatedLevel = getRowLevel(row, prev)
      const filteredRoles = getFilteredRoles(calculatedLevel)
      const newRoleIds = Array.from(new Set([
        ...row.RoleIds.split(',').filter(Boolean),
        ...filteredRoles.map(r => r.id)
      ])).join(',')
      return { ...row, RoleIds: newRoleIds }
    }))
  }

  const selectAllRolesForBatch = () => {
    setData(prev => prev.map(row => {
      const calculatedLevel = getRowLevel(row, prev)
      const filteredRoles = getFilteredRoles(calculatedLevel)
      const newRoleIds = Array.from(new Set([
        ...row.RoleIds.split(',').filter(Boolean),
        ...filteredRoles.map(r => r.id)
      ])).join(',')
      return { ...row, RoleIds: newRoleIds }
    }))
    toast.success('Đã chọn tất cả vai trò phù hợp cho các đơn vị')
  }

  const handleRemoveRow = (id: string) => {
    setData(prev => validateBatch(prev.filter(r => r.id !== id)))
  }

  const handleSave = () => {
    const hasErrors = data.some(r => r._errors && Object.keys(r._errors).length > 0)
    if (hasErrors) {
      toast.error('Vui lòng sửa các lỗi trong bảng trước khi import')
      return
    }

    try {
      const exportData = data.map(({ Name, Code, ParentCode, Email, Phone, Address, RoleIds }) => ({
        Name, Code, ParentCode, Email, Phone, Address, RoleIds
      }))
      
      const ws = utils.json_to_sheet(exportData)
      const wb = utils.book_new()
      utils.book_append_sheet(wb, ws, 'Import')
      
      const wbout = write(wb, { type: 'array', bookType: 'xlsx' })
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const newFile = new File([blob], file?.name || 'import_orgs.xlsx', { type: blob.type })
      
      onImport(newFile)
    } catch (e) {
      toast.error('Lỗi khi chuẩn bị dữ liệu import')
    }
  }

  if (!open) return null

  const hasAnyErrors = data.some(r => r._errors && Object.keys(r._errors).length > 0)

  return (
    <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-[24px] shadow-2xl w-full max-w-[95vw] lg:max-w-7xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Xem trước & Thiết lập vai trò</h2>
              <p className="text-xs text-slate-500">Tổng cộng {data.length} đơn vị sẽ được import</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="font-medium text-sm">Đang tải dữ liệu...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {hasAnyErrors && (
                <div className="p-4 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-xl flex items-start gap-3 border border-red-100 dark:border-red-900/20">
                  <AlertCircle size={20} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold">Phát hiện dữ liệu không hợp lệ</p>
                    <p className="text-xs mt-1">Vui lòng kiểm tra các ô được tô đỏ. Mã đơn vị cha phải tồn tại trong hệ thống hoặc trong chính file import này.</p>
                  </div>
                </div>
              )}

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-900">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 w-12 text-center">STT</th>
                        <th className="px-4 py-3 min-w-[200px]">Tên đơn vị <span className="text-red-500">*</span></th>
                        <th className="px-4 py-3 min-w-[120px]">Mã đơn vị <span className="text-red-500">*</span></th>
                        <th className="px-4 py-3 min-w-[120px]">Mã cha</th>
                        <th className="px-4 py-3 min-w-[400px]">
                          <div className="flex items-center justify-between">
                            <span>Phạm vi vai trò (Lọc theo phân cấp)</span>
                            <button 
                              onClick={selectAllRolesForBatch}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors capitalize text-[9px] font-black"
                            >
                              <CheckSquare size={12} /> Chọn cho tất cả dòng
                            </button>
                          </div>
                        </th>
                        <th className="px-4 py-3 min-w-[150px]">Thông tin khác</th>
                        <th className="px-4 py-3 w-16 text-center">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.map((row, index) => {
                        const calculatedLevel = getRowLevel(row, data)
                        const filteredRoles = getFilteredRoles(calculatedLevel)
                        const unitTypeLabel = hierarchyLevels[calculatedLevel] || 'Cấp đơn vị'

                        return (
                          <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group">
                            <td className="px-4 py-3 text-center text-slate-400 font-medium"> {index + 1} </td>
                            <td className="px-4 py-2">
                              <input
                                value={row.Name}
                                onChange={e => handleCellChange(row.id, 'Name', e.target.value)}
                                className={cn(
                                  "w-full px-3 py-1.5 rounded-lg border transition-colors bg-transparent text-sm font-bold dark:text-white",
                                  row._errors?.Name ? "border-red-300 bg-red-50" : "border-transparent hover:border-slate-300 focus:border-indigo-500"
                                )}
                                placeholder="Tên đơn vị..."
                              />
                              <div className="px-2 py-0.5 mt-1 text-[9px] font-black uppercase tracking-tighter bg-indigo-50 text-indigo-600 rounded inline-block">
                                {unitTypeLabel}
                              </div>
                              {row._errors?.Name && <p className="text-[10px] text-red-500 mt-1 font-medium">{row._errors.Name}</p>}
                            </td>
                            <td className="px-4 py-2">
                              <input
                                value={row.Code}
                                onChange={e => handleCellChange(row.id, 'Code', e.target.value)}
                                className={cn(
                                  "w-full px-3 py-1.5 rounded-lg border transition-colors bg-transparent text-xs font-mono dark:text-slate-300 uppercase",
                                  row._errors?.Code ? "border-red-300 bg-red-50" : "border-transparent hover:border-slate-300 focus:border-indigo-500"
                                )}
                                placeholder="Mã..."
                              />
                              {row._errors?.Code && <p className="text-[10px] text-red-500 mt-1 font-medium">{row._errors.Code}</p>}
                            </td>
                            <td className="px-4 py-2">
                              <input
                                value={row.ParentCode}
                                onChange={e => handleCellChange(row.id, 'ParentCode', e.target.value)}
                                className={cn(
                                  "w-full px-3 py-1.5 rounded-lg border transition-colors bg-transparent text-xs font-mono dark:text-slate-300 uppercase",
                                  row._errors?.ParentCode ? "border-red-300 bg-red-50" : "border-transparent hover:border-slate-300 focus:border-indigo-500"
                                )}
                                placeholder="Root"
                              />
                              {row._errors?.ParentCode && <p className="text-[10px] text-red-500 mt-1 font-medium">{row._errors.ParentCode}</p>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] text-slate-400 italic">Chọn vai trò được phép:</span>
                                <button 
                                  onClick={() => selectAllRolesForRow(row.id)}
                                  className="text-[9px] font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
                                >
                                  <CheckSquare size={10} /> Chọn tất cả
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-2 scrollbar-thin">
                                {filteredRoles.sort((a,b) => (a.rank||0)-(b.rank||0)).map(role => {
                                  const isSelected = row.RoleIds.split(',').includes(role.id)
                                  return (
                                    <button
                                      key={role.id}
                                      onClick={() => toggleRole(row.id, role.id)}
                                      className={cn(
                                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase transition-all border",
                                        isSelected 
                                          ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-400 group-hover:bg-slate-100"
                                      )}
                                    >
                                      {isSelected && <Check size={10} />}
                                      {role.name}
                                    </button>
                                  )
                                })}
                                {filteredRoles.length === 0 && (
                                  <p className="text-[10px] text-slate-400 italic">Không có vai trò phù hợp cho cấp bậc này</p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2 space-y-1">
                              <input
                                value={row.Email}
                                onChange={e => handleCellChange(row.id, 'Email', e.target.value)}
                                className={cn(
                                  "w-full px-2 py-0.5 rounded text-[10px] border bg-transparent",
                                  row._errors?.Email ? "border-red-300 bg-red-50" : "border-transparent hover:border-slate-200"
                                )}
                                placeholder="Email..."
                              />
                              {row._errors?.Email && <p className="text-[10px] text-red-500 font-medium">{row._errors.Email}</p>}
                              <input
                                value={row.Phone}
                                onChange={e => handleCellChange(row.id, 'Phone', e.target.value)}
                                className="w-full px-2 py-0.5 rounded text-[10px] border border-transparent hover:border-slate-200 bg-transparent"
                                placeholder="Số điện thoại..."
                              />
                            </td>
                            <td className="px-4 py-2 text-center">
                              <button
                                onClick={() => handleRemoveRow(row.id)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-slate-900 dark:text-white">{data.length} Đơn vị</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isImporting}
              className="px-6 py-2.5 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300 disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              onClick={handleSave}
              disabled={isImporting || data.length === 0 || hasAnyErrors}
              className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 disabled:opacity-50 transition-all active:scale-95"
            >
              {isImporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <Save size={16} /> Xác nhận & Import
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
