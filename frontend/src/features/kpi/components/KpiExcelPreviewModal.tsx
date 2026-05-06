import { useState, useEffect } from 'react'
import { read, write, utils } from 'xlsx'
import { 
  X, Save, AlertCircle, Trash2, Plus, FileSpreadsheet, 
  ListPlus, Search, User, UserCheck, Check,
  Scale, ArrowRight
} from 'lucide-react'
import { useKpiTotalWeight } from '@/features/kpi/hooks/useKpiTotalWeight'
import { toast } from 'sonner'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/store/authStore'
import { kpiApi } from '@/features/kpi/api/kpiApi'

interface KpiExcelPreviewModalProps {
  open: boolean
  file: File | null
  onClose: () => void
  onImport: (modifiedFile: File) => void
  isImporting: boolean
}

interface KpiRow {
  id: string
  Name: string
  Description: string
  Weight: string
  TargetValue: string
  MinimumValue: string
  Unit: string
  Frequency: string
  EmployeeCode: string
  Period: string
  OrgUnit: string
  _errors?: Record<string, string>
}

const frequencyOptions = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']

const kpiRowSchema = z.object({
  Name: z.string().min(1, 'Tên chỉ tiêu là bắt buộc'),
  Description: z.string().optional().nullable(),
  Weight: z.string().refine(val => {
    const n = Number(val)
    return !isNaN(n) && n >= 1 && n <= 100
  }, 'Trọng số phải từ 1-100'),
  TargetValue: z.string().refine(val => !isNaN(Number(val)), 'Giá trị mục tiêu phải là số'),
  MinimumValue: z.string().refine(val => !val || !isNaN(Number(val)), 'Giá trị tối thiểu phải là số').optional().nullable(),
  Unit: z.string().min(1, 'Đơn vị là bắt buộc'),
  Frequency: z.string().refine(val => frequencyOptions.includes(val.toUpperCase()), 'Tần suất không hợp lệ'),
  EmployeeCode: z.string().min(1, 'Mã nhân viên là bắt buộc'),
  Period: z.string().min(1, 'Đợt KPI là bắt buộc'),
  OrgUnit: z.string().min(1, 'Phòng ban là bắt buộc'),
})

export default function KpiExcelPreviewModal({ open, file, onClose, onImport, isImporting }: KpiExcelPreviewModalProps) {
  const [data, setData] = useState<KpiRow[]>([])
  const [loading, setLoading] = useState(false)
  const { user } = useAuthStore()
  
  // Bulk settings state
  const [bulkFreq, setBulkFreq] = useState('MONTHLY')
  const [bulkPeriod, setBulkPeriod] = useState('')
  const [bulkOrgUnit, setBulkOrgUnit] = useState('')
  const [bulkEmpCode, setBulkEmpCode] = useState('')

  // Fetch data for dropdowns
  const { data: periodsData } = useKpiPeriods({ 
    size: 100, 
    organizationId: user?.memberships?.[0]?.organizationId 
  })
  const { data: orgTree } = useOrgUnitTree()
  const { data: usersData } = useUsers({ 
    page: 0, 
    size: 1000,
    organizationId: user?.memberships?.[0]?.organizationId
  })
  const allUsers = usersData?.content || []

  const flatOrgUnits = (() => {
    const flatten = (nodes: any[]): any[] => {
      let res: any[] = []
      nodes.forEach(n => {
        res.push(n)
        if (n.children?.length) res = res.concat(flatten(n.children))
      })
      return res
    }
    const allUnits = orgTree ? flatten(orgTree) : []
    
    // Filter based on user permissions/role
    const isGlobalAdmin = user?.permissions?.includes('SYSTEM:ADMIN')
    if (isGlobalAdmin) return allUnits

    // For non-admins (Heads/Team Leads), only show units they are a member of
    // and EXCLUDE the root organization (parent is null) because managers 
    // usually only manage specific teams/departments, not the whole company unit.
    const userUnitIds = user?.memberships?.map(m => m.orgUnitId) || []
    return allUnits.filter(u => userUnitIds.includes(u.id) && u.parentId !== null)
  })()

  // Set default bulk settings once data is loaded
  useEffect(() => {
    if (flatOrgUnits.length > 0) {
      const isCurrentValid = flatOrgUnits.some(u => u.name === bulkOrgUnit)
      if (!bulkOrgUnit || !isCurrentValid) {
        setBulkOrgUnit(flatOrgUnits[0].name)
      }
    }
  }, [flatOrgUnits, bulkOrgUnit])

  useEffect(() => {
    const firstPeriod = periodsData?.content?.[0]
    if (firstPeriod && !bulkPeriod) {
      setBulkPeriod(firstPeriod.name)
    }
  }, [periodsData, bulkPeriod])

  // Automatically apply defaults to rows with empty values
  useEffect(() => {
    if (data.length > 0 && (bulkPeriod || bulkOrgUnit)) {
      let hasChanges = false
      const updated = data.map(row => {
        let needsUpdate = false
        const newRow = { ...row }
        
        if (!newRow.Period && bulkPeriod) {
          newRow.Period = bulkPeriod
          needsUpdate = true
        }
        if (!newRow.OrgUnit && bulkOrgUnit) {
          newRow.OrgUnit = bulkOrgUnit
          needsUpdate = true
        }
        
        if (needsUpdate) {
          hasChanges = true
          return validateRow(newRow)
        }
        return row
      })
      
      if (hasChanges) {
        setData(updated)
      }
    }
  }, [bulkPeriod, bulkOrgUnit, data])

  useEffect(() => {
    if (open && file) {
      parseFile(file)
    } else {
      setData([])
    }
  }, [open, file])

  // Re-validate when users are loaded to check EmployeeCode existence
  useEffect(() => {
    if (allUsers.length > 0 && data.length > 0) {
      setData(prev => prev.map(row => validateRow(row)))
    }
  }, [allUsers.length])

  const parseFile = async (f: File) => {
    setLoading(true)
    try {
      const buffer = await f.arrayBuffer()
      const wb = read(buffer)
      const sheetName = wb.SheetNames[0]
      if (!sheetName) throw new Error('File không có sheet nào')
      const ws = wb.Sheets[sheetName]
      if (!ws) throw new Error('Không thể đọc dữ liệu từ sheet')
      const rawData = utils.sheet_to_json<any>(ws)

      const parsed: KpiRow[] = rawData.map((row, index) => {
        const rawOrgValue = (row['OrgUnitCode'] || row['OrgUnit'] || bulkOrgUnit || '').toString().trim()
        
        const item: KpiRow = {
          id: `row-${index}`,
          Name: (row['Name'] || '').toString().trim(),
          Description: (row['Description'] || '').toString().trim(),
          Weight: (row['Weight'] || '').toString().trim(),
          TargetValue: (row['TargetValue'] || '').toString().trim(),
          MinimumValue: (row['MinimumValue'] || '').toString().trim(),
          Unit: (row['Unit'] || '').toString().trim(),
          Frequency: (row['Frequency'] || bulkFreq || 'MONTHLY').toString().toUpperCase().trim(),
          EmployeeCode: (row['EmployeeCode'] || bulkEmpCode || '').toString().trim(),
          Period: (row['Period'] || bulkPeriod || '').toString().trim(),
          OrgUnit: rawOrgValue,
        }

        // Smart Matching: Check if item.OrgUnit is a Code or a Name (Case-insensitive)
        const matchedByCode = flatOrgUnits.find(u => 
          u.code?.toLowerCase() === item.OrgUnit.toLowerCase() || 
          u.name?.toLowerCase() === item.OrgUnit.toLowerCase()
        )
        
        if (matchedByCode) {
          item.OrgUnit = matchedByCode.name
        } else if (bulkOrgUnit) {
          item.OrgUnit = bulkOrgUnit
        }

        return validateRow(item)
      })

      if (parsed.length === 0) {
        toast.error('File không có dữ liệu hoặc sai định dạng.')
        onClose()
        return
      }

      setData(parsed)
    } catch (error) {
      toast.error('Lỗi khi đọc file Excel/CSV')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const validateRow = (row: KpiRow): KpiRow => {
    const result = kpiRowSchema.safeParse(row)
    const errors: Record<string, string> = {}
    
    if (!result.success) {
      result.error.issues.forEach(issue => {
        const path = issue.path[0]
        if (typeof path === 'string') {
          errors[path] = issue.message
        }
      })
    }

    // Check if EmployeeCode exists in system and belongs to the specified OrgUnit
    if (row.EmployeeCode && allUsers.length > 0) {
      const codes = row.EmployeeCode.split(',').map(s => s.trim()).filter(Boolean)
      
      // 1. Check existence
      const nonExistentCodes = codes.filter(code => !allUsers.some(u => u.employeeCode === code))
      
      if (nonExistentCodes.length > 0) {
        errors['EmployeeCode'] = `Mã không tồn tại: ${nonExistentCodes.join(', ')}`
      } else if (row.OrgUnit) {
        // 2. Check department mismatch
        const mismatchedCodes = codes.filter(code => {
          const u = allUsers.find(user => user.employeeCode === code)
          return !u?.memberships?.some(m => 
            m.orgUnitName?.toLowerCase().trim() === row.OrgUnit.toLowerCase().trim()
          )
        })

        if (mismatchedCodes.length > 0) {
          errors['EmployeeCode'] = `Nhân viên ${mismatchedCodes.join(', ')} không thuộc ${row.OrgUnit}`
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      return { ...row, _errors: errors }
    }
    return { ...row, _errors: undefined }
  }

  const handleCellChange = (id: string, field: keyof KpiRow, value: string) => {
    setData(prev => prev.map(row => {
      if (row.id === id) {
        let updated = { ...row, [field]: value }
        return validateRow(updated)
      }
      return row
    }))
  }

  const handleRemoveRow = (id: string) => {
    setData(prev => prev.filter(r => r.id !== id))
  }

  const handleAddRow = () => {
    const newRow = validateRow({
      id: `new-${Date.now()}`,
      Name: '',
      Description: '',
      Weight: '10',
      TargetValue: '0',
      MinimumValue: '0',
      Unit: '',
      Frequency: bulkFreq || 'MONTHLY',
      EmployeeCode: bulkEmpCode || '',
      Period: bulkPeriod || '',
      OrgUnit: bulkOrgUnit || '',
    })
    setData([...data, newRow])
  }

  const handleBulkApply = () => {
    if (!bulkFreq && !bulkPeriod && !bulkOrgUnit && !bulkEmpCode) {
      toast.error('Vui lòng chọn ít nhất một giá trị để áp dụng')
      return
    }

    setData(prev => prev.map(row => {
      const updated = {
        ...row,
        Frequency: bulkFreq || row.Frequency,
        Period: bulkPeriod || row.Period,
        OrgUnit: bulkOrgUnit || row.OrgUnit,
        EmployeeCode: bulkEmpCode || row.EmployeeCode,
      }
      return validateRow(updated)
    }))
    toast.success('Đã áp dụng thông tin hàng loạt')
  }

  const handleSave = async () => {
    if (data.length === 0) {
      toast.error('Không có dữ liệu để import')
      return
    }

    // Validate all rows first
    const invalidRows = data.filter(row => row._errors && Object.keys(row._errors).length > 0)
    if (invalidRows.length > 0) {
      toast.error(`Còn ${invalidRows.length} dòng dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.`)
      return
    }

    // Check total weight per unit (OrgUnit + Period)
    const uniqueGroups = Array.from(new Set(data.map(r => `${r.OrgUnit}|${r.Period}`)))
    
    setLoading(true)
    const validations = await Promise.all(uniqueGroups.map(async (groupKey) => {
      const [unitName, periodName] = groupKey.split('|')
      if (!unitName || !periodName) return { unitName, total: 0, isValid: true }

      const excelWeight = data
        .filter(r => r.OrgUnit === unitName && r.Period === periodName)
        .reduce((sum, r) => sum + (parseFloat(r.Weight) || 0), 0)
      
      const unitId = flatOrgUnits.find(u => u.name === unitName)?.id
      const periodId = periodsData?.content?.find((p: any) => p.name === periodName)?.id

      let systemWeight = 0
      if (unitId && periodId) {
        try {
          systemWeight = await kpiApi.getTotalWeight(unitId, periodId)
        } catch (e) {
          // Fallback if API fails
        }
      }

      const total = systemWeight + excelWeight
      return { unitName, total, isValid: Math.abs(total - 100) < 0.01 }
    }))

    const invalidGroups = validations.filter(v => !v.isValid)
    if (invalidGroups.length > 0) {
      setLoading(false)
      const errorMsg = invalidGroups.map(v => `${v.unitName} (${v.total.toFixed(1)}%)`).join(', ')
      toast.error(`Tổng trọng số mỗi đơn vị phải đạt 100%. Kiểm tra: ${errorMsg}`)
      return
    }


    try {
      const exportData = data.map(({ Name, Description, Weight, TargetValue, MinimumValue, Unit, Frequency, EmployeeCode, Period, OrgUnit }) => ({
        Name, Description, Weight, TargetValue, MinimumValue, Unit, Frequency, EmployeeCode, Period, OrgUnit
      }))
      
      const ws = utils.json_to_sheet(exportData)
      const wb = utils.book_new()
      utils.book_append_sheet(wb, ws, 'KPIs')
      
      const wbout = write(wb, { type: 'array', bookType: 'xlsx' })
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const newFile = new File([blob], file?.name || 'import_kpis.xlsx', { type: blob.type })
      
      onImport(newFile)
    } catch (e) {
      toast.error('Lỗi khi tạo file import')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const hasAnyErrors = data.some(r => r._errors && Object.keys(r._errors).length > 0)

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-[95vw] lg:max-w-7xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Xem trước & Kiểm tra Chỉ tiêu</h2>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">File: {file?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-500">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-slate-200">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="font-black text-sm uppercase tracking-tighter">Đang phân tích dữ liệu...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Real-time Weight Summary Panel */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(() => {
                  const uniquePairs = Array.from(new Set(data.map(r => `${r.OrgUnit}|${r.Period}`)))
                  return uniquePairs.map(pair => {
                    const [unitName, periodName] = pair.split('|')
                    if (!unitName || !periodName) return null
                    
                    const unitId = flatOrgUnits.find(u => u.name === unitName)?.id
                    const periodId = periodsData?.content?.find((p: any) => p.name === periodName)?.id
                    
                    const excelWeight = data
                      .filter(r => r.OrgUnit === unitName && r.Period === periodName)
                      .reduce((sum, r) => sum + (parseFloat(r.Weight) || 0), 0)
                    
                    return (
                      <UnitWeightStatus 
                        key={pair}
                        unitId={unitId}
                        unitName={unitName}
                        periodId={periodId}
                        periodName={periodName}
                        excelWeight={excelWeight}
                      />
                    )
                  })
                })()}
              </div>
              {hasAnyErrors && (
                <div className="p-5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-3xl flex items-start gap-4 border border-rose-100 dark:border-rose-900/30 shadow-sm animate-in shake duration-500">
                  <AlertCircle size={24} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-black uppercase tracking-tight">Phát hiện dữ liệu không hợp lệ</p>
                    <p className="text-xs mt-1 font-medium opacity-80">Vui lòng kiểm tra và sửa các ô được đánh dấu đỏ trước khi tiến hành Import chính thức.</p>
                  </div>
                </div>
              )}

              {/* Bulk Assignment Panel */}
              <div className="p-6 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-[32px] border border-indigo-100 dark:border-indigo-900/30 relative z-20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                    <ListPlus size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Thiết lập hàng loạt</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gán nhanh thông tin cho tất cả các dòng</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tần suất</label>
                    <select 
                      value={bulkFreq}
                      onChange={e => setBulkFreq(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border-none shadow-sm text-sm font-bold focus:ring-2 focus:ring-indigo-500"
                    >
                      {frequencyOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Đợt KPI</label>
                    <select 
                      value={bulkPeriod}
                      onChange={e => setBulkPeriod(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border-none shadow-sm text-sm font-bold focus:ring-2 focus:ring-indigo-500"
                    >
                      {periodsData?.content?.map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Phòng ban</label>
                    <select 
                      value={bulkOrgUnit}
                      onChange={e => setBulkOrgUnit(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border-none shadow-sm text-sm font-bold focus:ring-2 focus:ring-indigo-500"
                    >
                      {flatOrgUnits.map((u: any) => <option key={u.id} value={u.name}>{u.name} ({u.code})</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Mã nhân viên (S)</label>
                    <div className="relative group/search">
                      <input 
                        value={bulkEmpCode}
                        onChange={e => setBulkEmpCode(e.target.value)}
                        placeholder="Chọn hoặc nhập mã..."
                        className="w-full px-4 py-2.5 pl-10 rounded-2xl bg-white dark:bg-slate-800 border-none shadow-sm text-sm font-black focus:ring-2 focus:ring-indigo-500"
                      />
                      <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      
                      {/* Search results dropdown */}
                      <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 z-50 max-h-60 overflow-y-auto p-2 space-y-1 hidden group-focus-within/search:block">
                        {(() => {
                          const selectedCodes = bulkEmpCode.split(',').map(s => s.trim()).filter(Boolean)
                          const parts = bulkEmpCode.split(',')
                          const lastPart = (parts[parts.length - 1] ?? '').trim().toLowerCase()
                          
                          // If last part is an exact match of an already selected code, treat it as "not searching"
                          const isExactMatch = selectedCodes.some(c => c.toLowerCase() === lastPart)
                          const effectiveSearch = isExactMatch ? '' : lastPart

                          const filtered = allUsers.filter(u => {
                            const matchesOrg = !bulkOrgUnit || u.memberships?.some(m => 
                              m.orgUnitName?.toLowerCase().trim() === bulkOrgUnit.toLowerCase().trim()
                            )
                            const isSelected = u.employeeCode && selectedCodes.includes(u.employeeCode)
                            const matchesSearch = !effectiveSearch || 
                              u.fullName.toLowerCase().includes(effectiveSearch) || 
                              u.employeeCode?.toLowerCase().includes(effectiveSearch)
                            
                            return matchesOrg && (isSelected || matchesSearch)
                          })

                          // Sort: selected ones first
                          return filtered.sort((a, b) => {
                            const aSel = a.employeeCode && selectedCodes.includes(a.employeeCode) ? 1 : 0
                            const bSel = b.employeeCode && selectedCodes.includes(b.employeeCode) ? 1 : 0
                            return bSel - aSel
                          }).slice(0, 50).map(u => (
                            <button
                              key={u.id}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                const current = bulkEmpCode.split(',').map(s => s.trim()).filter(Boolean)
                                if (u.employeeCode) {
                                  if (current.includes(u.employeeCode)) {
                                    setBulkEmpCode(current.filter(c => c !== u.employeeCode).join(', ') + (current.length > 0 ? ', ' : ''))
                                  } else {
                                    setBulkEmpCode([...current, u.employeeCode].join(', ') + ', ')
                                  }
                                }
                              }}
                              className={cn(
                                "w-full text-left px-4 py-2 rounded-xl flex items-center justify-between group transition-colors",
                                u.employeeCode && selectedCodes.includes(u.employeeCode) 
                                  ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 font-bold" 
                                  : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                              )}
                            >
                              <div className="flex flex-col">
                                <span className="text-sm">{u.fullName}</span>
                                <span className="text-[10px] text-slate-500 font-bold uppercase">{u.employeeCode}</span>
                              </div>
                              <UserCheck 
                                size={14} 
                                className={cn(
                                  "text-indigo-500 transition-opacity",
                                  u.employeeCode && selectedCodes.includes(u.employeeCode) ? "opacity-100" : "opacity-0 group-hover:opacity-50"
                                )} 
                              />
                            </button>
                          ))
                        })()}
                        {allUsers.length === 0 && (
                          <p className="p-3 text-center text-xs text-slate-400 font-bold uppercase">Không có dữ liệu nhân viên</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-end">
                    <button 
                      onClick={handleBulkApply}
                      className="w-full bg-slate-900 dark:bg-indigo-600 text-white py-2.5 rounded-2xl text-xs font-black uppercase tracking-tighter hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
                    >
                      Áp dụng tất cả
                    </button>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-[24px] overflow-hidden shadow-sm bg-white dark:bg-slate-900">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-slate-400 font-black uppercase text-[10px] tracking-widest sticky top-0 z-10">
                      <tr>
                        <th className="px-5 py-4 w-12 text-center">STT</th>
                        <th className="px-5 py-4 min-w-[200px]">Tên chỉ tiêu <span className="text-rose-500">*</span></th>
                        <th className="px-5 py-4 min-w-[150px]">Trọng số <span className="text-rose-500">*</span></th>
                        <th className="px-5 py-4 min-w-[150px]">Mục tiêu <span className="text-rose-500">*</span></th>
                        <th className="px-5 py-4 min-w-[120px]">Đơn vị <span className="text-rose-500">*</span></th>
                        <th className="px-5 py-4 min-w-[150px]">Tần suất <span className="text-rose-500">*</span></th>
                        <th className="px-5 py-4 min-w-[160px]">Mã nhân viên <span className="text-rose-500">*</span></th>
                        <th className="px-5 py-4 min-w-[220px]">Đợt KPI <span className="text-rose-500">*</span></th>
                        <th className="px-5 py-4 min-w-[300px]">Phòng ban / Đơn vị <span className="text-rose-500">*</span></th>
                        <th className="px-5 py-4 w-16 text-center">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.map((row, index) => (
                        <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group">
                          <td className="px-5 py-4 text-center text-slate-400 font-black text-xs">
                            {index + 1}
                          </td>
                          <td className="px-5 py-3">
                            <input
                              value={row.Name}
                              onChange={e => handleCellChange(row.id, 'Name', e.target.value)}
                              className={cn(
                                "w-full px-4 py-2 rounded-xl border text-sm font-bold transition-all",
                                row._errors?.Name 
                                  ? "border-rose-300 bg-rose-50 dark:bg-rose-900/10 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20" 
                                  : "border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-transparent hover:bg-white dark:hover:bg-slate-800"
                              )}
                              placeholder="Nhập tên..."
                            />
                            {row._errors?.Name && <p className="text-[9px] text-rose-500 mt-1 font-black uppercase px-2">{row._errors.Name}</p>}
                          </td>
                          <td className="px-5 py-3">
                            <div className="relative">
                                <input
                                value={row.Weight}
                                onChange={e => handleCellChange(row.id, 'Weight', e.target.value)}
                                className={cn(
                                    "w-full px-4 py-2 pr-8 rounded-xl border text-sm font-black transition-all",
                                    row._errors?.Weight ? "border-rose-300 bg-rose-50 dark:bg-rose-900/10" : "border-transparent hover:border-slate-200 focus:border-indigo-500"
                                )}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">%</span>
                            </div>
                            {row._errors?.Weight && <p className="text-[9px] text-rose-500 mt-1 font-black uppercase px-2">{row._errors.Weight}</p>}
                          </td>
                          <td className="px-5 py-3">
                            <input
                              value={row.TargetValue}
                              onChange={e => handleCellChange(row.id, 'TargetValue', e.target.value)}
                              className={cn(
                                "w-full px-4 py-2 rounded-xl border text-sm font-black transition-all",
                                row._errors?.TargetValue ? "border-rose-300 bg-rose-50 dark:bg-rose-900/10" : "border-transparent hover:border-slate-200 focus:border-indigo-500"
                              )}
                            />
                            {row._errors?.TargetValue && <p className="text-[9px] text-rose-500 mt-1 font-black uppercase px-2">{row._errors.TargetValue}</p>}
                          </td>
                          <td className="px-5 py-3">
                            <input
                              value={row.Unit}
                              onChange={e => handleCellChange(row.id, 'Unit', e.target.value)}
                              className={cn(
                                "w-full px-4 py-2 rounded-xl border text-sm font-bold transition-all",
                                row._errors?.Unit ? "border-rose-300 bg-rose-50 dark:bg-rose-900/10" : "border-transparent hover:border-slate-200 focus:border-indigo-500"
                              )}
                              placeholder="VD: VND, %..."
                            />
                            {row._errors?.Unit && <p className="text-[9px] text-rose-500 mt-1 font-black uppercase px-2">{row._errors.Unit}</p>}
                          </td>
                          <td className="px-5 py-3">
                            <select
                              value={row.Frequency}
                              onChange={e => handleCellChange(row.id, 'Frequency', e.target.value)}
                              className={cn(
                                "w-full px-4 py-2 rounded-xl border text-sm font-bold transition-all bg-transparent outline-none",
                                row._errors?.Frequency ? "border-rose-300 bg-rose-50" : "border-transparent hover:border-slate-200 focus:border-indigo-500"
                              )}
                            >
                              <option value="">-- Chọn --</option>
                              {frequencyOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                            {row._errors?.Frequency && <p className="text-[9px] text-rose-500 mt-1 font-black uppercase px-2">{row._errors.Frequency}</p>}
                          </td>
                          <td className="px-5 py-3 min-w-[200px]">
                            <div className="relative group/cell">
                              <input
                                value={row.EmployeeCode}
                                onChange={e => handleCellChange(row.id, 'EmployeeCode', e.target.value)}
                                className={cn(
                                  "w-full px-4 py-2 pl-9 rounded-xl border text-sm font-bold transition-all bg-transparent outline-none",
                                  row._errors?.EmployeeCode ? "border-rose-300 bg-rose-50" : "border-transparent hover:border-slate-200 focus:border-indigo-500"
                                )}
                                placeholder="Chọn NV..."
                              />
                              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                              
                              <div className={cn(
                                "absolute left-0 w-64 z-50 max-h-48 overflow-y-auto p-2 space-y-1 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 hidden group-focus-within/cell:block",
                                index >= data.length / 2 ? "bottom-full mb-1" : "top-full mt-1"
                              )}>
                                {(() => {
                                  const selectedCodes = row.EmployeeCode.split(',').map(s => s.trim()).filter(Boolean)
                                  const parts = row.EmployeeCode.split(',')
                                  const lastPart = (parts[parts.length - 1] ?? '').trim().toLowerCase()

                                  // If last part is an exact match of an already selected code, treat it as "not searching"
                                  const isExactMatch = selectedCodes.some(c => c.toLowerCase() === lastPart)
                                  const effectiveSearch = isExactMatch ? '' : lastPart

                                  const filtered = allUsers.filter(u => {
                                    const matchesOrg = !row.OrgUnit || u.memberships?.some(m => 
                                      m.orgUnitName?.toLowerCase().trim() === row.OrgUnit.toLowerCase().trim()
                                    )
                                    const isSelected = u.employeeCode && selectedCodes.includes(u.employeeCode)
                                    const matchesSearch = !effectiveSearch || 
                                      u.fullName.toLowerCase().includes(effectiveSearch) || 
                                      u.employeeCode?.toLowerCase().includes(effectiveSearch)
                                    
                                    return matchesOrg && (isSelected || matchesSearch)
                                  })

                                  return filtered.sort((a, b) => {
                                    const aSel = a.employeeCode && selectedCodes.includes(a.employeeCode) ? 1 : 0
                                    const bSel = b.employeeCode && selectedCodes.includes(b.employeeCode) ? 1 : 0
                                    return bSel - aSel
                                  }).slice(0, 10).map(u => (
                                    <button
                                      key={u.id}
                                      onMouseDown={(e) => {
                                        e.preventDefault()
                                        const current = row.EmployeeCode.split(',').map(s => s.trim()).filter(Boolean)
                                        if (u.employeeCode) {
                                          let newValue = ''
                                          if (current.includes(u.employeeCode)) {
                                            newValue = current.filter(c => c !== u.employeeCode).join(', ') + (current.length > 0 ? ', ' : '')
                                          } else {
                                            newValue = [...current, u.employeeCode].join(', ') + ', '
                                          }
                                          handleCellChange(row.id, 'EmployeeCode', newValue)
                                        }
                                      }}
                                      className={cn(
                                        "w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-colors",
                                        u.employeeCode && selectedCodes.includes(u.employeeCode)
                                          ? "bg-indigo-50 dark:bg-indigo-900/30"
                                          : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                      )}
                                    >
                                      <div className={cn(
                                        "w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black transition-colors",
                                        u.employeeCode && selectedCodes.includes(u.employeeCode)
                                          ? "bg-indigo-600 text-white"
                                          : "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600"
                                      )}>
                                        {u.employeeCode && selectedCodes.includes(u.employeeCode) ? <Check size={12} /> : u.fullName.charAt(0)}
                                      </div>
                                      <div className="flex flex-col flex-1">
                                        <span className={cn(
                                          "text-xs font-bold transition-colors",
                                          u.employeeCode && selectedCodes.includes(u.employeeCode) ? "text-indigo-600" : "text-slate-900 dark:text-white"
                                        )}>{u.fullName}</span>
                                        <span className="text-[10px] text-slate-500 font-bold uppercase">{u.employeeCode}</span>
                                      </div>
                                      {u.employeeCode && selectedCodes.includes(u.employeeCode) && (
                                        <UserCheck size={12} className="text-indigo-600" />
                                      )}
                                    </button>
                                  ))
                                })()}
                              </div>
                            </div>
                            {row._errors?.EmployeeCode && <p className="text-[9px] text-rose-500 mt-1 font-black uppercase px-2">{row._errors.EmployeeCode}</p>}
                          </td>
                          <td className="px-5 py-3">
                            <select
                              value={row.Period}
                              onChange={e => handleCellChange(row.id, 'Period', e.target.value)}
                              className={cn(
                                "w-full px-4 py-2 rounded-xl border text-sm font-bold transition-all bg-transparent outline-none",
                                row._errors?.Period ? "border-rose-300 bg-rose-50" : "border-transparent hover:border-slate-200 focus:border-indigo-500"
                              )}
                            >
                              {periodsData?.content?.map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}
                            </select>
                            {row._errors?.Period && <p className="text-[9px] text-rose-500 mt-1 font-black uppercase px-2">{row._errors.Period}</p>}
                          </td>
                          <td className="px-5 py-3">
                            <select
                              value={row.OrgUnit}
                              onChange={e => handleCellChange(row.id, 'OrgUnit', e.target.value)}
                              className={cn(
                                "w-full px-4 py-2 rounded-xl border text-sm font-bold transition-all bg-transparent outline-none",
                                row._errors?.OrgUnit ? "border-rose-300 bg-rose-50" : "border-transparent hover:border-slate-200 focus:border-indigo-500"
                              )}
                            >
                              {flatOrgUnits.map((u: any) => <option key={u.id} value={u.name}>{u.name} ({u.code})</option>)}
                            </select>
                            {row._errors?.OrgUnit && <p className="text-[9px] text-rose-500 mt-1 font-black uppercase px-2">{row._errors.OrgUnit}</p>}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <button
                              onClick={() => handleRemoveRow(row.id)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all"
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
                  <div className="text-center py-20 text-slate-400 font-bold italic">
                    Không có dữ liệu để hiển thị
                  </div>
                )}
                <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 p-4 flex justify-center">
                  <button
                    onClick={handleAddRow}
                    className="flex items-center gap-2 text-sm font-black text-indigo-600 hover:text-indigo-700 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-6 py-2.5 rounded-2xl transition-all shadow-sm hover:shadow-md"
                  >
                    <Plus size={18} /> Thêm dòng mới
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/50">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
            Tổng cộng: <span className="text-slate-900 dark:text-white">{data.length}</span> chỉ tiêu sẵn sàng
          </p>
          <div className="flex gap-4">
            <button
              onClick={onClose}
              disabled={isImporting}
              className="px-8 py-3 rounded-2xl text-sm font-black text-slate-500 hover:bg-white dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-200 disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              onClick={handleSave}
              disabled={isImporting || hasAnyErrors || data.length === 0}
              className="flex items-center gap-2 px-10 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 disabled:opacity-50 transition-all active:scale-95"
            >
              {isImporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Đang Import...
                </>
              ) : (
                <>
                  <Save size={18} /> Xác nhận Import
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function UnitWeightStatus({ unitId, unitName, periodId, periodName, excelWeight }: { 
  unitId?: string, unitName: string, periodId?: string, periodName: string, excelWeight: number 
}) {
  const { data: systemWeight = 0 } = useKpiTotalWeight(unitId, periodId)
  const total = systemWeight + excelWeight
  const isPerfect = Math.abs(total - 100) < 0.01
  const isOver = total > 100.01

  return (
    <div className={cn(
      "p-4 rounded-[24px] border transition-all duration-300 shadow-sm",
      isPerfect 
        ? "bg-emerald-50/50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30" 
        : isOver
          ? "bg-rose-50/50 border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/30"
          : "bg-amber-50/50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30"
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            isPerfect ? "bg-emerald-500 text-white" : isOver ? "bg-rose-500 text-white" : "bg-amber-500 text-white"
          )}>
            <Scale size={16} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Phòng ban</p>
            <p className="text-sm font-black text-slate-900 dark:text-white truncate max-w-[120px]">{unitName}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Đợt</p>
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400">{periodName}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 p-2.5 bg-white dark:bg-slate-800/50 rounded-2xl border border-inherit">
        <div className="text-center flex-1">
          <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Hiện tại</p>
          <p className="text-sm font-black text-slate-700 dark:text-slate-300">{systemWeight}%</p>
        </div>
        <Plus size={12} className="text-slate-300" />
        <div className="text-center flex-1">
          <p className="text-[9px] font-black text-indigo-500 uppercase mb-0.5">Excel</p>
          <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{excelWeight}%</p>
        </div>
        <ArrowRight size={12} className="text-slate-300" />
        <div className="text-center flex-1">
          <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Tổng cộng</p>
          <p className={cn(
            "text-sm font-black",
            isPerfect ? "text-emerald-600" : isOver ? "text-rose-600" : "text-amber-600"
          )}>{total.toFixed(1)}%</p>
        </div>
      </div>
      
      {!isPerfect && (
        <p className={cn(
          "text-[10px] font-bold mt-2 text-center uppercase tracking-tight",
          isOver ? "text-rose-500" : "text-amber-500"
        )}>
          {isOver ? "Vượt quá 100% trọng số!" : `Còn thiếu ${(100 - total).toFixed(1)}% để đạt 100%`}
        </p>
      )}
    </div>
  )
}
