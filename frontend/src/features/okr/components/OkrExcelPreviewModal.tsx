import { useState, useEffect } from 'react'
import { read, write, utils } from 'xlsx'
import { X, Save, AlertCircle, Trash2, Plus, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { useOrgUnitTree } from '../../orgunits/hooks/useOrgUnitTree'
import { OrgUnitTreeResponse } from '@/types/orgUnit'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
  OrgUnitCode: z.string().optional(),
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
      const wb = read(buffer)
      const sheetName = wb.SheetNames[0]
      if (!sheetName) throw new Error('File Excel không có sheet nào')
      const ws = wb.Sheets[sheetName]
      if (!ws) throw new Error('Không tìm thấy sheet dữ liệu')
      const rawData = utils.sheet_to_json<any>(ws)

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
        const currentObjStart = (row['ObjectiveStartDate'] || '').toString().trim()
        const currentObjEnd = (row['ObjectiveEndDate'] || '').toString().trim()
        const currentObjOrgCode = (row['ObjectiveOrgUnitCode'] || row['OrgUnitCode'] || '').toString().trim()

        if (currentObjCode || currentObjName) {
          lastObjCode = currentObjCode
          lastObjName = currentObjName
          lastObjDesc = currentObjDesc
          lastObjStart = currentObjStart
          lastObjEnd = currentObjEnd
          lastObjOrgCode = currentObjOrgCode
        }

        return {
          id: `row-${index}`,
          ObjectiveCode: currentObjCode || lastObjCode,
          ObjectiveName: currentObjName || lastObjName,
          ObjectiveDescription: currentObjDesc || lastObjDesc,
          ObjectiveStartDate: currentObjStart || lastObjStart,
          ObjectiveEndDate: currentObjEnd || lastObjEnd,
          OrgUnitCode: currentObjOrgCode || lastObjOrgCode || rootUnitCode,
          KeyResultCode: (row['KeyResultCode'] || '').toString().trim(),
          KeyResultName: (row['KeyResultName'] || '').toString().trim(),
          KeyResultDescription: (row['KeyResultDescription'] || '').toString().trim(),
          KeyResultTarget: (row['KeyResultTarget'] || '').toString().trim(),
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
    } catch (error) {
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
        if (r.KeyResultTarget) rowData.KeyResultTarget = r.KeyResultTarget
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
    } catch (e) {
      toast.error('Lỗi khi tạo file import')
    }
  }

  if (!open) return null

  const hasAnyErrors = data.some((r: OkrRow) => r._errors && Object.keys(r._errors).length > 0)

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-[24px] shadow-2xl w-full max-w-[95vw] lg:max-w-7xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Xem trước & Kiểm tra dữ liệu OKR</h2>
              <p className="text-xs text-slate-500">File: {file?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-500">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="font-medium text-sm">Đang đọc file...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {hasAnyErrors && (
                <div className="p-4 bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 rounded-xl flex items-start gap-3 border border-rose-100 dark:border-rose-900/30">
                  <AlertCircle size={20} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold">Phát hiện dữ liệu không hợp lệ</p>
                    <p className="text-xs mt-1">Vui lòng kiểm tra và sửa các ô được báo đỏ (trùng mã KR, thiếu trường bắt buộc...) trước khi tiến hành Import.</p>
                  </div>
                </div>
              )}

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 w-12 text-center">STT</th>
                        <th className="px-4 py-3 min-w-[150px]">Mã Mục tiêu <span className="text-rose-500">*</span></th>
                        <th className="px-4 py-3 min-w-[250px]">Tên Mục tiêu <span className="text-rose-500">*</span></th>
                        <th className="px-4 py-3 min-w-[150px]">Mã KR <span className="text-rose-500">*</span></th>
                        <th className="px-4 py-3 min-w-[250px]">Tên KR <span className="text-rose-500">*</span></th>
                        <th className="px-4 py-3 min-w-[300px]">Phòng ban</th>
                        <th className="px-4 py-3 min-w-[180px]">Target KR</th>
                        <th className="px-4 py-3 min-w-[150px]">Đơn vị KR</th>
                        <th className="px-4 py-3 w-16 text-center">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.map((row, index) => (
                        <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 text-center text-slate-400 font-medium">
                            {index + 1}
                          </td>
                          <td className="px-4 py-2">
                            <input
                              value={row.ObjectiveCode}
                              onChange={e => handleCellChange(row.id, 'ObjectiveCode', e.target.value)}
                              className={cn(
                                "w-full px-3 py-1.5 rounded-lg border text-sm transition-colors dark:bg-slate-900 dark:text-white",
                                row._errors?.ObjectiveCode 
                                  ? "border-rose-300 bg-rose-50 dark:bg-rose-900/20 focus:border-rose-500 focus:ring-1 focus:ring-rose-500" 
                                  : "border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-transparent hover:bg-white focus:bg-white"
                              )}
                            />
                            {row._errors?.ObjectiveCode && <p className="text-[10px] text-rose-500 mt-1 font-medium px-1">{row._errors.ObjectiveCode}</p>}
                          </td>
                          <td className="px-4 py-2">
                            <input
                              value={row.ObjectiveName}
                              onChange={e => handleCellChange(row.id, 'ObjectiveName', e.target.value)}
                              className={cn(
                                "w-full px-3 py-1.5 rounded-lg border text-sm transition-colors dark:bg-slate-900 dark:text-white",
                                row._errors?.ObjectiveName 
                                  ? "border-rose-300 bg-rose-50 dark:bg-rose-900/20 focus:border-rose-500 focus:ring-1 focus:ring-rose-500" 
                                  : "border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-transparent hover:bg-white focus:bg-white"
                              )}
                            />
                            {row._errors?.ObjectiveName && <p className="text-[10px] text-rose-500 mt-1 font-medium px-1">{row._errors.ObjectiveName}</p>}
                          </td>
                          <td className="px-4 py-2">
                            <input
                              value={row.KeyResultCode}
                              onChange={e => handleCellChange(row.id, 'KeyResultCode', e.target.value)}
                              className={cn(
                                "w-full px-3 py-1.5 rounded-lg border text-sm transition-colors dark:bg-slate-900 dark:text-white",
                                row._errors?.KeyResultCode 
                                  ? "border-rose-300 bg-rose-50 dark:bg-rose-900/20 focus:border-rose-500 focus:ring-1 focus:ring-rose-500" 
                                  : "border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-transparent hover:bg-white focus:bg-white"
                              )}
                            />
                            {row._errors?.KeyResultCode && <p className="text-[10px] text-rose-500 mt-1 font-medium px-1">{row._errors.KeyResultCode}</p>}
                          </td>
                          <td className="px-4 py-2">
                            <input
                              value={row.KeyResultName}
                              onChange={e => handleCellChange(row.id, 'KeyResultName', e.target.value)}
                              className={cn(
                                "w-full px-3 py-1.5 rounded-lg border text-sm transition-colors dark:bg-slate-900 dark:text-white",
                                row._errors?.KeyResultName 
                                  ? "border-rose-300 bg-rose-50 dark:bg-rose-900/20 focus:border-rose-500 focus:ring-1 focus:ring-rose-500" 
                                  : "border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-transparent hover:bg-white focus:bg-white"
                              )}
                            />
                            {row._errors?.KeyResultName && <p className="text-[10px] text-rose-500 mt-1 font-medium px-1">{row._errors.KeyResultName}</p>}
                          </td>
                          <td className="px-4 py-2">
                            <Select value={row.OrgUnitCode} onValueChange={val => handleCellChange(row.id, 'OrgUnitCode', val)}>
                              <SelectTrigger className="w-full h-9 rounded-lg border-transparent hover:border-slate-300 dark:hover:border-slate-700 bg-transparent hover:bg-white dark:hover:bg-slate-900 text-sm font-bold transition-all focus:ring-1 focus:ring-indigo-500">
                                <SelectValue placeholder="Chọn phòng ban" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 max-h-[250px] z-[300]">
                                {allOrgUnits.map((unit) => (
                                  <SelectItem key={unit.id} value={unit.code} className="text-sm font-bold">
                                    {Array(unit.level).fill('\u00A0\u00A0').join('')} {unit.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-2">
                            <input
                              value={row.KeyResultTarget || ''}
                              onChange={e => handleCellChange(row.id, 'KeyResultTarget', e.target.value)}
                              className={cn(
                                "w-full px-3 py-1.5 rounded-lg border text-sm transition-colors dark:bg-slate-900 dark:text-white",
                                row._errors?.KeyResultTarget 
                                  ? "border-rose-300 bg-rose-50 dark:bg-rose-900/20 focus:border-rose-500 focus:ring-1 focus:ring-rose-500" 
                                  : "border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-transparent hover:bg-white focus:bg-white"
                              )}
                            />
                            {row._errors?.KeyResultTarget && <p className="text-[10px] text-rose-500 mt-1 font-medium px-1">{row._errors.KeyResultTarget}</p>}
                          </td>
                          <td className="px-4 py-2">
                            <input
                              value={row.KeyResultUnit || ''}
                              onChange={e => handleCellChange(row.id, 'KeyResultUnit', e.target.value)}
                              className="w-full px-3 py-1.5 rounded-lg border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-transparent hover:bg-white focus:bg-white text-sm transition-colors dark:bg-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={() => handleRemoveRow(row.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
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
                  <div className="text-center py-12 text-slate-500 text-sm">
                    Không có dòng dữ liệu nào
                  </div>
                )}
                <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 p-3 flex justify-center">
                  <button
                    onClick={handleAddRow}
                    className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-4 py-2 rounded-xl transition-colors"
                  >
                    <Plus size={16} /> Thêm dòng mới
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <p className="text-sm font-bold text-slate-500">
            Tổng cộng: <span className="text-slate-900 dark:text-white">{data.length}</span> dòng hợp lệ
          </p>
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
              disabled={isImporting || hasAnyErrors || data.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 disabled:opacity-50 transition-all active:scale-95"
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
