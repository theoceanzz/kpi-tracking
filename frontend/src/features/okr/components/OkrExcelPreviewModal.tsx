import { useState, useEffect } from 'react'
import { read, write, utils } from 'xlsx'
import { Save, AlertCircle, Trash2, Plus, Check, ChevronDown, Loader2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { useOrgUnitTree } from '../../orgunits/hooks/useOrgUnitTree'
import { OrgUnitTreeResponse } from '@/types/orgUnit'

interface OkrExcelPreviewModalProps {
  open: boolean
  file: File | null
  onClose: () => void
  onImport: (modifiedFile: File) => void
  isImporting: boolean
}

interface OkrRow {
  id: string
  ObjectiveCode: string
  ObjectiveName: string
  ObjectiveDescription?: string
  ObjectiveStartDate?: string
  ObjectiveEndDate?: string
  KeyResultCode: string
  KeyResultName: string
  KeyResultDescription?: string
  KeyResultTarget?: string
  KeyResultUnit?: string
  OrgUnitCode?: string
  _errors?: Record<string, string>
}

// Basic format validation
const rowSchema = z.object({
  ObjectiveCode: z.string().min(1, 'Mã Mục tiêu là bắt buộc'),
  ObjectiveName: z.string().min(1, 'Tên Mục tiêu là bắt buộc'),
  ObjectiveDescription: z.string().optional(),
  ObjectiveStartDate: z.string().optional(),
  ObjectiveEndDate: z.string().optional(),
  KeyResultCode: z.string().min(1, 'Mã KR là bắt buộc'),
  KeyResultName: z.string().min(1, 'Tên KR là bắt buộc'),
  KeyResultDescription: z.string().optional(),
  KeyResultTarget: z.string().optional(),
  KeyResultUnit: z.string().optional(),
  OrgUnitCode: z.string().min(1, 'Mã phòng ban là bắt buộc'),
})

export default function OkrExcelPreviewModal({ open, file, onClose, onImport, isImporting }: OkrExcelPreviewModalProps) {
  const [data, setData] = useState<OkrRow[]>([])
  const [loading, setLoading] = useState(false)
  const { data: orgUnitTree } = useOrgUnitTree()

  const flattenOrgUnits = (units: OrgUnitTreeResponse[], level = 0): { id: string, name: string, code: string, level: number }[] => {
    return units.reduce((acc: any[], unit) => {
      acc.push({ id: unit.id, name: unit.name, code: unit.code || '', level })
      if (unit.children && unit.children.length > 0) {
        acc.push(...flattenOrgUnits(unit.children, level + 1))
      }
      return acc
    }, [])
  }

  const allOrgUnits = orgUnitTree ? flattenOrgUnits(orgUnitTree) : []
  const rootUnitCode = allOrgUnits[0]?.code || ''

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
      const wb = read(buffer, { cellDates: true })
      const sheetName = wb.SheetNames[0]
      if (!sheetName) throw new Error('File Excel không có sheet nào')
      const ws = wb.Sheets[sheetName]
      if (!ws) throw new Error('Không tìm thấy sheet dữ liệu')
      const rawData = utils.sheet_to_json<any>(ws)

      const formatExcelDate = (val: any) => {
        if (!val) return ''
        if (val instanceof Date) return val.toISOString().split('T')[0]
        if (typeof val === 'number') {
          // Excel serial date format
          const date = new Date(Math.round((val - 25569) * 86400 * 1000))
          return date.toISOString().split('T')[0]
        }
        const str = val.toString().trim()
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
        // Fallback for other formats like DD/MM/YYYY
        const d = new Date(str)
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
        return str
      }

      let lastObjCode = ''
      let lastObjName = ''
      let lastObjDesc = ''
      let lastObjStart = ''
      let lastObjEnd = ''
      let lastObjOrgCode = ''

      const parsed: OkrRow[] = rawData.map((row, index) => {
        const currentObjCode = (row['ObjectiveCode'] || '').toString().trim()
        const currentObjName = (row['ObjectiveName'] || '').toString().trim()
        const currentObjDesc = (row['ObjectiveDescription'] || '').toString().trim()
        const currentObjStart = formatExcelDate(row['ObjectiveStartDate'])
        const currentObjEnd = formatExcelDate(row['ObjectiveEndDate'])
        const currentObjOrgCode = (row['ObjectiveOrgUnitCode'] || row['OrgUnitCode'] || '').toString().trim()

        if (currentObjCode || currentObjName) {
          lastObjCode = currentObjCode
          lastObjName = currentObjName
          lastObjDesc = currentObjDesc
          lastObjStart = currentObjStart
          lastObjEnd = currentObjEnd
          lastObjOrgCode = currentObjOrgCode
        }

        const finalOrgCode = currentObjOrgCode || lastObjOrgCode || rootUnitCode
        const expandedOrgCode = (finalOrgCode === rootUnitCode && rootUnitCode !== '') 
          ? allOrgUnits.map(u => u.code).join(', ') 
          : finalOrgCode

        return {
          id: `row-${index}`,
          ObjectiveCode: currentObjCode || lastObjCode,
          ObjectiveName: currentObjName || lastObjName,
          ObjectiveDescription: currentObjDesc || lastObjDesc,
          ObjectiveStartDate: currentObjStart || lastObjStart,
          ObjectiveEndDate: currentObjEnd || lastObjEnd,
          OrgUnitCode: expandedOrgCode,
          KeyResultCode: (row['KeyResultCode'] || '').toString().trim(),
          KeyResultName: (row['KeyResultName'] || '').toString().trim(),
          KeyResultDescription: (row['KeyResultDescription'] || '').toString().trim(),
          KeyResultTarget: (row['KeyResultTarget'] ?? '').toString().trim(),
          KeyResultUnit: (row['KeyResultUnit'] || '').toString().trim(),
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

  const validateRow = (row: OkrRow): OkrRow => {
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

    if (row.KeyResultTarget && isNaN(Number(row.KeyResultTarget))) {
      errors['KeyResultTarget'] = 'Mục tiêu phải là số'
    }

    return { ...row, _errors: Object.keys(errors).length > 0 ? errors : undefined }
  }

  const validateAllRows = (rows: OkrRow[]): OkrRow[] => {
    const validatedRows = rows.map(row => validateRow(row))

    const krCodeCounts = new Map<string, number>()

    validatedRows.forEach(row => {
      if (row.KeyResultCode) {
        const krCode = row.KeyResultCode.toLowerCase()
        krCodeCounts.set(krCode, (krCodeCounts.get(krCode) || 0) + 1)
      }
    })

    return validatedRows.map(row => {
      const errors = { ...(row._errors || {}) }

      if (row.KeyResultCode) {
        const krCode = row.KeyResultCode.toLowerCase()
        if ((krCodeCounts.get(krCode) || 0) > 1) {
          errors['KeyResultCode'] = 'Mã KR bị trùng lặp trong tệp tin'
        }
      }

      return { ...row, _errors: Object.keys(errors).length > 0 ? errors : undefined }
    })
  }

  const handleCellChange = (id: string, field: keyof OkrRow, value: string) => {
    setData((prev: any[]) => {
      const updatedRows = prev.map((row: any) => row.id === id ? { ...row, [field]: value } : row);
      return validateAllRows(updatedRows);
    })
  }

  const toggleUnitCodeInRow = (currentRow: OkrRow, unitCode: string) => {
    const currentCodes = (currentRow.OrgUnitCode || '').split(',').map(c => c.trim()).filter(Boolean)
    const isRoot = unitCode === allOrgUnits[0]?.code
    let nextCodes: string[] = []

    if (isRoot) {
      if (currentCodes.includes(unitCode)) {
        nextCodes = []
      } else {
        nextCodes = allOrgUnits.map(u => u.code)
      }
    } else {
      if (currentCodes.includes(unitCode)) {
        nextCodes = currentCodes.filter(c => c !== unitCode && c !== allOrgUnits[0]?.code)
      } else {
        const tempCodes = [...currentCodes, unitCode]
        const rootCode = allOrgUnits[0]?.code
        const allOtherCodes = allOrgUnits.filter(u => u.code !== rootCode).map(u => u.code)
        const allOthersSelected = allOtherCodes.every(c => tempCodes.includes(c))
        
        if (allOthersSelected && rootCode) {
          nextCodes = allOrgUnits.map(u => u.code)
        } else {
          nextCodes = tempCodes
        }
      }
    }
    handleCellChange(currentRow.id, 'OrgUnitCode', nextCodes.join(', '))
  }

  const handleRemoveRow = (id: string) => {
    setData((prev: any[]) => validateAllRows(prev.filter((r: any) => r.id !== id)))
  }

  const handleAddRow = () => {
    const newRow: OkrRow = {
      id: `new-${Date.now()}`,
      ObjectiveCode: '',
      ObjectiveName: '',
      KeyResultCode: '',
      KeyResultName: '',
      OrgUnitCode: rootUnitCode,
    }
    setData((prev: any[]) => validateAllRows([...prev, newRow]))
  }

  const handleSave = () => {
    const hasErrors = data.some((r: OkrRow) => r._errors && Object.keys(r._errors).length > 0)
    if (hasErrors) {
      toast.error('Vui lòng sửa các lỗi trong bảng trước khi import')
      return
    }

    if (data.length === 0) {
      toast.error('Không có dữ liệu để import')
      return
    }

    try {
      const exportData = data.map(r => {
        const rowData: any = {
          ObjectiveCode: r.ObjectiveCode,
          ObjectiveName: r.ObjectiveName,
          KeyResultCode: r.KeyResultCode,
          KeyResultName: r.KeyResultName,
        }
        if (r.ObjectiveDescription) rowData.ObjectiveDescription = r.ObjectiveDescription
        if (r.ObjectiveStartDate) rowData.ObjectiveStartDate = r.ObjectiveStartDate
        if (r.ObjectiveEndDate) rowData.ObjectiveEndDate = r.ObjectiveEndDate
        if (r.KeyResultDescription) rowData.KeyResultDescription = r.KeyResultDescription
        if (r.KeyResultTarget !== '') rowData.KeyResultTarget = r.KeyResultTarget
        if (r.KeyResultUnit) rowData.KeyResultUnit = r.KeyResultUnit
        if (r.OrgUnitCode) rowData.OrgUnitCode = r.OrgUnitCode
        return rowData
      })
      
      const ws = utils.json_to_sheet(exportData)
      const wb = utils.book_new()
      utils.book_append_sheet(wb, ws, 'Danh sách OKR')
      
      const wbout = write(wb, { type: 'array', bookType: 'xlsx' })
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const newFile = new File([blob], file?.name || 'import_okrs.xlsx', { type: blob.type })
      
      onImport(newFile)
    } catch {
      toast.error('Lỗi khi tạo file import')
    }
  }

  if (!open) return null

  const hasAnyErrors = data.some((r: OkrRow) => r._errors && Object.keys(r._errors).length > 0)

  return (
    <Dialog
      open
      onClose={onClose}
      size="full"
      dismissible={!isImporting}
      title="Xem trước & Kiểm tra dữ liệu OKR"
      description={`File: ${file?.name ?? ''}`}
      footer={
        <DialogFooter
          note={<>Tổng cộng: <span className="font-medium text-[var(--color-foreground)] tabular-nums">{data.length}</span> dòng hợp lệ</>}
          secondary={<Button variant="outline" onClick={onClose} disabled={isImporting}>Hủy bỏ</Button>}
          primary={
            <Button onClick={handleSave} disabled={isImporting || hasAnyErrors || data.length === 0}>
              {isImporting ? <><Loader2 className="animate-spin" aria-hidden="true" /> Đang Import...</> : <><Save aria-hidden="true" /> Xác nhận Import</>}
            </Button>
          }
        />
      }
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 text-[var(--color-subtle-foreground)]">
          <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="font-medium text-sm">Đang đọc file...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {hasAnyErrors && (
            <div className="p-4 bg-[var(--color-error-bg)] text-[var(--color-error)] rounded-card flex items-start gap-3 border border-[var(--color-error-border)]">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Phát hiện dữ liệu không hợp lệ</p>
                <p className="text-xs mt-1">Vui lòng kiểm tra và sửa các ô được báo đỏ (trùng mã KR, thiếu trường bắt buộc...) trước khi tiến hành Import.</p>
              </div>
            </div>
          )}

          <div className="border border-[var(--color-border)] rounded-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-eyebrow bg-[var(--color-muted)] border-b border-[var(--color-border)] sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center">STT</th>
                    <th className="px-4 py-3 min-w-[150px]">Mã Mục tiêu <span className="text-[var(--color-error)]">*</span></th>
                    <th className="px-4 py-3 min-w-[250px]">Tên Mục tiêu <span className="text-[var(--color-error)]">*</span></th>
                    <th className="px-4 py-3 min-w-[150px]">Ngày bắt đầu</th>
                    <th className="px-4 py-3 min-w-[150px]">Ngày kết thúc</th>
                    <th className="px-4 py-3 min-w-[150px]">Mã KR <span className="text-[var(--color-error)]">*</span></th>
                    <th className="px-4 py-3 min-w-[250px]">Tên KR <span className="text-[var(--color-error)]">*</span></th>
                    <th className="px-4 py-3 min-w-[300px]">Phòng ban</th>
                    <th className="px-4 py-3 min-w-[180px]">Target KR</th>
                    <th className="px-4 py-3 min-w-[150px]">Đơn vị KR</th>
                    <th className="px-4 py-3 w-16 text-center">Xóa</th>
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
                          value={row.ObjectiveCode}
                          onChange={e => handleCellChange(row.id, 'ObjectiveCode', e.target.value)}
                          className={cn(
                            "w-full px-3 py-1.5 rounded-control border text-sm transition-colors",
                            row._errors?.ObjectiveCode 
                              ? "border-[var(--color-error-border)] bg-[var(--color-error-bg)] focus:border-[var(--color-error-border)] focus:ring-1 focus:ring-[var(--color-error-solid)]" 
                              : "border-transparent hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-ring)] bg-transparent hover:bg-[var(--color-card)] focus:bg-[var(--color-card)]"
                          )}
                        />
                        {row._errors?.ObjectiveCode && <p className="text-xs text-[var(--color-error)] mt-1 font-medium px-1">{row._errors.ObjectiveCode}</p>}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={row.ObjectiveName}
                          onChange={e => handleCellChange(row.id, 'ObjectiveName', e.target.value)}
                          className={cn(
                            "w-full px-3 py-1.5 rounded-control border text-sm transition-colors",
                            row._errors?.ObjectiveName 
                              ? "border-[var(--color-error-border)] bg-[var(--color-error-bg)] focus:border-[var(--color-error-border)] focus:ring-1 focus:ring-[var(--color-error-solid)]" 
                              : "border-transparent hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-ring)] bg-transparent hover:bg-[var(--color-card)] focus:bg-[var(--color-card)]"
                          )}
                        />
                        {row._errors?.ObjectiveName && <p className="text-xs text-[var(--color-error)] mt-1 font-medium px-1">{row._errors.ObjectiveName}</p>}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="date"
                          value={row.ObjectiveStartDate || ''}
                          onChange={e => handleCellChange(row.id, 'ObjectiveStartDate', e.target.value)}
                          className="w-full px-3 py-1.5 rounded-control border border-transparent hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-ring)] bg-transparent hover:bg-[var(--color-card)] focus:bg-[var(--color-card)] text-sm transition-colors"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="date"
                          value={row.ObjectiveEndDate || ''}
                          onChange={e => handleCellChange(row.id, 'ObjectiveEndDate', e.target.value)}
                          className="w-full px-3 py-1.5 rounded-control border border-transparent hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-ring)] bg-transparent hover:bg-[var(--color-card)] focus:bg-[var(--color-card)] text-sm transition-colors"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={row.KeyResultCode}
                          onChange={e => handleCellChange(row.id, 'KeyResultCode', e.target.value)}
                          className={cn(
                            "w-full px-3 py-1.5 rounded-control border text-sm transition-colors",
                            row._errors?.KeyResultCode 
                              ? "border-[var(--color-error-border)] bg-[var(--color-error-bg)] focus:border-[var(--color-error-border)] focus:ring-1 focus:ring-[var(--color-error-solid)]" 
                              : "border-transparent hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-ring)] bg-transparent hover:bg-[var(--color-card)] focus:bg-[var(--color-card)]"
                          )}
                        />
                        {row._errors?.KeyResultCode && <p className="text-xs text-[var(--color-error)] mt-1 font-medium px-1">{row._errors.KeyResultCode}</p>}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={row.KeyResultName}
                          onChange={e => handleCellChange(row.id, 'KeyResultName', e.target.value)}
                          className={cn(
                            "w-full px-3 py-1.5 rounded-control border text-sm transition-colors",
                            row._errors?.KeyResultName 
                              ? "border-[var(--color-error-border)] bg-[var(--color-error-bg)] focus:border-[var(--color-error-border)] focus:ring-1 focus:ring-[var(--color-error-solid)]" 
                              : "border-transparent hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-ring)] bg-transparent hover:bg-[var(--color-card)] focus:bg-[var(--color-card)]"
                          )}
                        />
                        {row._errors?.KeyResultName && <p className="text-xs text-[var(--color-error)] mt-1 font-medium px-1">{row._errors.KeyResultName}</p>}
                      </td>
                      <td className="px-4 py-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="w-full min-h-[36px] px-3 py-1.5 rounded-control border border-transparent hover:border-[var(--color-border-strong)] bg-transparent hover:bg-[var(--color-card)] text-xs font-medium transition-all flex items-center justify-between group focus:ring-1 focus:ring-[var(--color-ring)]"
                            >
                              <span className="truncate max-w-[200px]">
                                {(() => {
                                  const codes = (row.OrgUnitCode || '').split(',').map(c => c.trim()).filter(Boolean)
                                  if (codes.length === 0) return 'Chọn phòng ban'
                                  if (codes.length === 1) return allOrgUnits.find(u => u.code === codes[0])?.name || codes[0]
                                  return `Đã chọn ${codes.length} đơn vị`
                                })()}
                              </span>
                              <ChevronDown size={14} className="opacity-40 group-hover:opacity-70 transition-opacity ml-2 shrink-0" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="z-[300] p-2 w-[300px] max-h-[300px] overflow-y-auto custom-scrollbar" align="start">
                            <div className="space-y-1">
                              {allOrgUnits.map((unit) => {
                                const currentCodes = (row.OrgUnitCode || '').split(',').map(c => c.trim()).filter(Boolean)
                                const isSelected = currentCodes.includes(unit.code)
                                return (
                                  <div 
                                    key={unit.id}
                                    onClick={() => toggleUnitCodeInRow(row, unit.code)}
                                    className={cn(
                                      "flex items-center gap-3 px-3 py-2 rounded-card cursor-pointer transition-colors group",
                                      isSelected ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]" : "hover:bg-[var(--color-muted)]"
                                    )}
                                  >
                                    <div className={cn(
                                      "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                      isSelected ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-[var(--color-primary-foreground)]" : "border-[var(--color-border)] group-hover:border-[var(--color-primary)]"
                                    )}>
                                      {isSelected && <Check size={10} strokeWidth={4} />}
                                    </div>
                                    <span className="text-xs font-medium truncate" style={{ marginLeft: `${unit.level * 12}px` }}>
                                      {unit.name}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>
                        {row._errors?.OrgUnitCode && <p className="text-xs text-[var(--color-error)] mt-1 font-medium px-1">{row._errors.OrgUnitCode}</p>}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={row.KeyResultTarget || ''}
                          onChange={e => handleCellChange(row.id, 'KeyResultTarget', e.target.value)}
                          className={cn(
                            "w-full px-3 py-1.5 rounded-control border text-sm transition-colors",
                            row._errors?.KeyResultTarget 
                              ? "border-[var(--color-error-border)] bg-[var(--color-error-bg)] focus:border-[var(--color-error-border)] focus:ring-1 focus:ring-[var(--color-error-solid)]" 
                              : "border-transparent hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-ring)] bg-transparent hover:bg-[var(--color-card)] focus:bg-[var(--color-card)]"
                          )}
                        />
                        {row._errors?.KeyResultTarget && <p className="text-xs text-[var(--color-error)] mt-1 font-medium px-1">{row._errors.KeyResultTarget}</p>}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={row.KeyResultUnit || ''}
                          onChange={e => handleCellChange(row.id, 'KeyResultUnit', e.target.value)}
                          className="w-full px-3 py-1.5 rounded-control border border-transparent hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-ring)] bg-transparent hover:bg-[var(--color-card)] focus:bg-[var(--color-card)] text-sm transition-colors"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => handleRemoveRow(row.id)}
                          className="p-1.5 text-[var(--color-subtle-foreground)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)] dark:hover:bg-[var(--color-error-bg)] rounded-control transition-colors"
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
