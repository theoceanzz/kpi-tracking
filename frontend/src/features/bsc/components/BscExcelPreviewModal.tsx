import { useState, useEffect } from 'react'
import { read, write, utils } from 'xlsx'
import { X, Save, AlertCircle, Trash2, Plus, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useFixedPerspectives } from '../hooks/useBsc'

interface BscExcelPreviewModalProps {
  open: boolean
  file: File | null
  onClose: () => void
  onImport: (modifiedFile: File) => void
  isImporting: boolean
}

interface BscRow {
  id: string
  Code: string
  Name: string
  FixedPerspective: string
  Description?: string
  Color?: string
  DisplayOrder?: string
  Status?: string
  _errors?: Record<string, string>
}

const DEFAULT_COLOR = '#8b5cf6'
const DEFAULT_FIXED = 'INTERNAL_PROCESS'
const FIXED_FALLBACK = [
  { code: 'FINANCIAL', name: 'Tài chính' },
  { code: 'CUSTOMER', name: 'Khách hàng' },
  { code: 'INTERNAL_PROCESS', name: 'Quy trình nội bộ' },
  { code: 'LEARNING_GROWTH', name: 'Học hỏi & phát triển' },
]
const FIXED_CODES = FIXED_FALLBACK.map(f => f.code)

export default function BscExcelPreviewModal({ open, file, onClose, onImport, isImporting }: BscExcelPreviewModalProps) {
  const [data, setData] = useState<BscRow[]>([])
  const [loading, setLoading] = useState(false)
  const { data: fixedPerspectives } = useFixedPerspectives()
  const fixedOptions = fixedPerspectives?.length ? fixedPerspectives : FIXED_FALLBACK

  useEffect(() => {
    if (open && file) parseFile(file)
    else setData([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file])

  const validateAllRows = (rows: BscRow[]): BscRow[] => {
    const codeCounts = new Map<string, number>()
    const orderCounts = new Map<string, number>()
    rows.forEach(r => {
      const c = (r.Code || '').trim().toLowerCase()
      if (c) codeCounts.set(c, (codeCounts.get(c) || 0) + 1)
      const o = (r.DisplayOrder || '').toString().trim()
      if (o && !isNaN(Number(o))) orderCounts.set(o, (orderCounts.get(o) || 0) + 1)
    })
    return rows.map(row => {
      const errors: Record<string, string> = {}
      const code = (row.Code || '').trim()
      if (!code) errors['Code'] = 'Mã là bắt buộc'
      else if (!/^[A-Za-z0-9_]+$/.test(code)) errors['Code'] = 'Mã chỉ gồm chữ, số, gạch dưới'
      else if (FIXED_CODES.includes(code.toUpperCase())) errors['Code'] = 'Trùng mã viễn cảnh cố định'
      else if ((codeCounts.get(code.toLowerCase()) || 0) > 1) errors['Code'] = 'Mã bị trùng trong tệp'
      if (!(row.Name || '').trim()) errors['Name'] = 'Tên là bắt buộc'
      if (row.FixedPerspective && row.FixedPerspective.trim() && !FIXED_CODES.includes(row.FixedPerspective.trim().toUpperCase())) errors['FixedPerspective'] = 'Viễn cảnh không hợp lệ'
      if (row.Color && row.Color.trim() && !/^#([0-9A-Fa-f]{6})$/.test(row.Color.trim())) errors['Color'] = 'Màu #RRGGBB'
      const order = (row.DisplayOrder || '').toString().trim()
      if (order && isNaN(Number(order))) errors['DisplayOrder'] = 'Phải là số'
      else if (order && (orderCounts.get(order) || 0) > 1) errors['DisplayOrder'] = 'Thứ tự bị trùng'
      if (row.Status && row.Status.trim() && !['ACTIVE', 'INACTIVE'].includes(row.Status.trim().toUpperCase())) errors['Status'] = 'ACTIVE/INACTIVE'
      return { ...row, _errors: Object.keys(errors).length > 0 ? errors : undefined }
    })
  }

  const parseFile = async (f: File) => {
    setLoading(true)
    try {
      const buffer = await f.arrayBuffer()
      const wb = read(buffer)
      const sheetName = wb.SheetNames[0]
      if (!sheetName) throw new Error('empty')
      const ws = wb.Sheets[sheetName]
      if (!ws) throw new Error('empty')
      const rawData = utils.sheet_to_json<any>(ws)

      const parsed: BscRow[] = rawData.map((row, index) => ({
        id: `row-${index}`,
        Code: (row['Code'] || '').toString().trim(),
        Name: (row['Name'] || '').toString().trim(),
        FixedPerspective: ((row['FixedPerspective'] ?? row['Perspective'] ?? '').toString().trim() || DEFAULT_FIXED).toUpperCase(),
        Description: (row['Description'] || '').toString().trim(),
        Color: (row['Color'] || '').toString().trim() || DEFAULT_COLOR,
        DisplayOrder: (row['DisplayOrder'] ?? '').toString().trim(),
        Status: ((row['Status'] || '').toString().trim() || 'ACTIVE').toUpperCase(),
      })).filter(r => r.Code || r.Name)

      if (parsed.length === 0) {
        toast.error('File không có dữ liệu hoặc sai định dạng.')
        onClose()
        return
      }
      setData(validateAllRows(parsed))
    } catch {
      toast.error('Lỗi khi đọc file Excel')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleCellChange = (id: string, field: keyof BscRow, value: string) => {
    setData(prev => validateAllRows(prev.map(r => r.id === id ? { ...r, [field]: value } : r)))
  }

  const handleRemoveRow = (id: string) => setData(prev => validateAllRows(prev.filter(r => r.id !== id)))

  const handleAddRow = () => {
    setData(prev => validateAllRows([...prev, {
      id: `new-${Date.now()}`, Code: '', Name: '', FixedPerspective: DEFAULT_FIXED, Description: '', Color: DEFAULT_COLOR, DisplayOrder: '', Status: 'ACTIVE',
    }]))
  }

  const hasAnyErrors = data.some(r => r._errors && Object.keys(r._errors).length > 0)

  const handleSave = () => {
    if (hasAnyErrors) { toast.error('Vui lòng sửa các lỗi trong bảng trước khi import'); return }
    if (data.length === 0) { toast.error('Không có dữ liệu để import'); return }
    try {
      const exportData = data.map(r => {
        const rowData: any = { Code: r.Code, Name: r.Name }
        rowData.FixedPerspective = (r.FixedPerspective || DEFAULT_FIXED).toUpperCase()
        if (r.Description) rowData.Description = r.Description
        if (r.Color) rowData.Color = r.Color
        if (r.DisplayOrder !== undefined && r.DisplayOrder !== '') rowData.DisplayOrder = r.DisplayOrder
        if (r.Status) rowData.Status = r.Status
        return rowData
      })
      const ws = utils.json_to_sheet(exportData)
      const wb = utils.book_new()
      utils.book_append_sheet(wb, ws, 'Hạng mục BSC')
      const wbout = write(wb, { type: 'array', bookType: 'xlsx' })
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const newFile = new File([blob], file?.name || 'import_bsc.xlsx', { type: blob.type })
      onImport(newFile)
    } catch {
      toast.error('Lỗi khi tạo file import')
    }
  }

  if (!open) return null

  const inputCls = (err?: string) => cn(
    'w-full px-3 py-1.5 rounded-lg border text-sm transition-colors dark:bg-slate-900 dark:text-white',
    err
      ? 'border-rose-300 bg-rose-50 dark:bg-rose-900/20 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
      : 'border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-transparent hover:bg-white focus:bg-white'
  )

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-[24px] shadow-2xl w-full max-w-[95vw] lg:max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Xem trước & Kiểm tra hạng mục BSC</h2>
              <p className="text-xs text-slate-500">File: {file?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-500">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-6">
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
                    <p className="text-xs mt-1">Vui lòng sửa các ô báo đỏ (thiếu mã/tên, mã trùng, màu sai...) trước khi Import.</p>
                  </div>
                </div>
              )}

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 w-12 text-center">STT</th>
                        <th className="px-4 py-3 min-w-[160px]">Mã <span className="text-rose-500">*</span></th>
                        <th className="px-4 py-3 min-w-[200px]">Tên <span className="text-rose-500">*</span></th>
                        <th className="px-4 py-3 min-w-[180px]">Viễn cảnh</th>
                        <th className="px-4 py-3 min-w-[260px]">Mô tả</th>
                        <th className="px-4 py-3 min-w-[180px]">Màu</th>
                        <th className="px-4 py-3 min-w-[100px]">Thứ tự</th>
                        <th className="px-4 py-3 min-w-[140px]">Trạng thái</th>
                        <th className="px-4 py-3 w-16 text-center">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.map((row, index) => (
                        <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 text-center text-slate-400 font-medium">{index + 1}</td>
                          <td className="px-4 py-2">
                            <input value={row.Code} onChange={e => handleCellChange(row.id, 'Code', e.target.value)} className={inputCls(row._errors?.Code)} />
                            {row._errors?.Code && <p className="text-[10px] text-rose-500 mt-1 font-medium px-1">{row._errors.Code}</p>}
                          </td>
                          <td className="px-4 py-2">
                            <input value={row.Name} onChange={e => handleCellChange(row.id, 'Name', e.target.value)} className={inputCls(row._errors?.Name)} />
                            {row._errors?.Name && <p className="text-[10px] text-rose-500 mt-1 font-medium px-1">{row._errors.Name}</p>}
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={FIXED_CODES.includes((row.FixedPerspective || '').toUpperCase()) ? (row.FixedPerspective || '').toUpperCase() : DEFAULT_FIXED}
                              onChange={e => handleCellChange(row.id, 'FixedPerspective', e.target.value)}
                              className={inputCls(row._errors?.FixedPerspective)}
                            >
                              {fixedOptions.map(fp => (
                                <option key={fp.code} value={fp.code}>{fp.name}</option>
                              ))}
                            </select>
                            {row._errors?.FixedPerspective && <p className="text-[10px] text-rose-500 mt-1 font-medium px-1">{row._errors.FixedPerspective}</p>}
                          </td>
                          <td className="px-4 py-2">
                            <input value={row.Description || ''} onChange={e => handleCellChange(row.id, 'Description', e.target.value)} className={inputCls()} />
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={/^#([0-9A-Fa-f]{6})$/.test(row.Color || '') ? row.Color : DEFAULT_COLOR}
                                onChange={e => handleCellChange(row.id, 'Color', e.target.value)}
                                className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent cursor-pointer shrink-0"
                              />
                              <input value={row.Color || ''} onChange={e => handleCellChange(row.id, 'Color', e.target.value)} className={cn(inputCls(row._errors?.Color), 'font-mono text-sm min-w-[100px]')} />
                            </div>
                            {row._errors?.Color && <p className="text-[10px] text-rose-500 mt-1 font-medium px-1">{row._errors.Color}</p>}
                          </td>
                          <td className="px-4 py-2">
                            <input value={row.DisplayOrder || ''} onChange={e => handleCellChange(row.id, 'DisplayOrder', e.target.value)} placeholder="Tự động" className={inputCls(row._errors?.DisplayOrder)} />
                            {row._errors?.DisplayOrder && <p className="text-[10px] text-rose-500 mt-1 font-medium px-1">{row._errors.DisplayOrder}</p>}
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={(row.Status || 'ACTIVE').toUpperCase()}
                              onChange={e => handleCellChange(row.id, 'Status', e.target.value)}
                              className={inputCls(row._errors?.Status)}
                            >
                              <option value="ACTIVE">Đang dùng</option>
                              <option value="INACTIVE">Tạm ẩn</option>
                            </select>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button onClick={() => handleRemoveRow(row.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {data.length === 0 && <div className="text-center py-12 text-slate-500 text-sm">Không có dòng dữ liệu nào</div>}
                <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 p-3 flex justify-center">
                  <button onClick={handleAddRow} className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-4 py-2 rounded-xl transition-colors">
                    <Plus size={16} /> Thêm dòng mới
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <p className="text-sm font-bold text-slate-500">
            Tổng cộng: <span className="text-slate-900 dark:text-white">{data.length}</span> hạng mục
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} disabled={isImporting} className="px-6 py-2.5 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300 disabled:opacity-50">
              Hủy bỏ
            </button>
            <button onClick={handleSave} disabled={isImporting || hasAnyErrors || data.length === 0} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 disabled:opacity-50 transition-all active:scale-95">
              {isImporting ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Đang Import...</>
              ) : (
                <><Save size={16} /> Xác nhận Import</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
