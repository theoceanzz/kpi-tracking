import { useState, useEffect, useMemo } from 'react'
import { read, write, utils } from 'xlsx'
import { X, Save, AlertCircle, Trash2, Plus, FileSpreadsheet, ChevronDown, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface Props {
  open: boolean
  file: File | null
  onClose: () => void
  onImport: (modifiedFile: File) => void
  isImporting: boolean
}

interface Row {
  id: string
  Period: string
  ScorecardName: string
  Vision?: string
  PerspectiveCode: string
  Weight: string
  Status?: string
  ScoringMode?: string
  EmptyPolicy?: string
  /** Mã phòng ban áp dụng (phân tách dấu phẩy); rỗng = toàn tổ chức. Đồng bộ theo kỳ. */
  OrgUnitCodes?: string
  _errors?: Record<string, string>
}

export default function ScorecardExcelPreviewModal({ open, file, onClose, onImport, isImporting }: Props) {
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: periodsData } = useKpiPeriods({ organizationId })
  const periods = periodsData?.content || []
  const periodNames = useMemo(() => periods.map(p => p.name), [periods])

  const { data: orgUnitTreeData } = useOrgUnitTree()
  const flatOrgUnits = useMemo(() => {
    const flatten = (nodes: any[], level = 0): { id: string; name: string; code: string; level: number }[] => {
      let result: { id: string; name: string; code: string; level: number }[] = []
      for (const node of nodes || []) {
        result.push({ id: node.id, name: node.name, code: node.code, level })
        if (node.children?.length) result = result.concat(flatten(node.children, level + 1))
      }
      return result
    }
    return flatten(orgUnitTreeData || [])
  }, [orgUnitTreeData])

  const [data, setData] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [didInitUnits, setDidInitUnits] = useState(false)

  // Mặc định TÍCH HẾT các đơn vị cho dòng nào chưa có phòng ban (chạy 1 lần sau khi nạp cây đơn vị).
  useEffect(() => {
    if (didInitUnits || flatOrgUnits.length === 0 || data.length === 0) return
    const allCodes = flatOrgUnits.map(u => u.code).join(', ')
    setData(prev => prev.map(r => (r.OrgUnitCodes || '').trim() ? r : { ...r, OrgUnitCodes: allCodes }))
    setDidInitUnits(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatOrgUnits, data, didInitUnits])

  // Tick phòng ban trên 1 dòng ⇒ áp cho MỌI dòng cùng kỳ (mỗi kỳ = 1 bộ tiêu chí). Tick gốc ⇒ chọn/bỏ toàn bộ.
  const toggleUnitInGroup = (row: Row, unitCode: string) => {
    const current = (row.OrgUnitCodes || '').split(',').map(c => c.trim()).filter(Boolean)
    const rootCode = flatOrgUnits[0]?.code
    let next: string[]
    if (unitCode === rootCode) {
      next = current.includes(unitCode) ? [] : flatOrgUnits.map(u => u.code)
    } else if (current.includes(unitCode)) {
      next = current.filter(c => c !== unitCode && c !== rootCode)
    } else {
      const temp = [...current, unitCode]
      const allOthers = flatOrgUnits.filter(u => u.code !== rootCode).every(u => temp.includes(u.code))
      next = allOthers && rootCode ? flatOrgUnits.map(u => u.code) : temp
    }
    const joined = next.join(', ')
    const periodKey = (row.Period || '').trim().toLowerCase()
    setData(prev => validateAll(prev.map(r => (r.Period || '').trim().toLowerCase() === periodKey ? { ...r, OrgUnitCodes: joined } : r)))
  }
  const unitLabel = (row: Row) => {
    const codes = (row.OrgUnitCodes || '').split(',').map(c => c.trim()).filter(Boolean)
    if (codes.length === 0) return 'Chọn phòng ban'
    if (codes.length >= flatOrgUnits.length && flatOrgUnits.length > 0) return 'Tất cả đơn vị'
    if (codes.length === 1) return flatOrgUnits.find(u => u.code === codes[0])?.name || codes[0]
    return `Đã chọn ${codes.length} đơn vị`
  }

  useEffect(() => {
    setDidInitUnits(false)
    if (open && file) parseFile(file)
    else setData([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file])

  const validateAll = (rows: Row[]): Row[] => {
    const sums = new Map<string, number>()
    const comboCounts = new Map<string, number>()
    rows.forEach(r => {
      const key = (r.Period || '').trim().toLowerCase()
      if (key) sums.set(key, (sums.get(key) || 0) + (Number(r.Weight) || 0))
      const code = (r.PerspectiveCode || '').trim().toLowerCase()
      if (key && code) {
        const combo = `${key}##${code}`
        comboCounts.set(combo, (comboCounts.get(combo) || 0) + 1)
      }
    })
    return rows.map(r => {
      const errors: Record<string, string> = {}
      const periodVal = (r.Period || '').trim()
      const codeVal = (r.PerspectiveCode || '').trim()
      if (!periodVal) errors['Period'] = 'Bắt buộc'
      else if (periodNames.length > 0 && !periodNames.some(n => n.toLowerCase() === periodVal.toLowerCase())) errors['Period'] = 'Kỳ không tồn tại'
      if (!codeVal) errors['PerspectiveCode'] = 'Bắt buộc'
      else if (periodVal && (comboCounts.get(`${periodVal.toLowerCase()}##${codeVal.toLowerCase()}`) || 0) > 1) {
        errors['PerspectiveCode'] = 'Mã hạng mục bị trùng trong kỳ'
      }
      if (!(r.Weight || '').toString().trim() || isNaN(Number(r.Weight))) errors['Weight'] = 'Phải là số'
      const key = periodVal.toLowerCase()
      if (key) {
        const total = sums.get(key) || 0
        if (Math.abs(total - 100) > 0.01) errors['Weight'] = `Tổng kỳ = ${total.toFixed(1)}% (cần 100%)`
      }
      return { ...r, _errors: Object.keys(errors).length > 0 ? errors : undefined }
    })
  }

  // Re-validate khi danh sách kỳ tải xong (để kiểm tra kỳ tồn tại)
  useEffect(() => {
    setData(prev => prev.length > 0 ? validateAll(prev) : prev)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodNames.join('|')])

  const parseFile = async (f: File) => {
    setLoading(true)
    try {
      const buffer = await f.arrayBuffer()
      const wb = read(buffer)
      const ws = wb.Sheets[wb.SheetNames[0]!]
      if (!ws) throw new Error('empty')
      const raw = utils.sheet_to_json<any>(ws)
      let lastPeriod = '', lastName = '', lastVision = ''
      const parsed: Row[] = raw.map((row, index) => {
        const period = (row['Period'] || '').toString().trim() || lastPeriod
        const name = (row['ScorecardName'] || '').toString().trim()
        const vision = (row['Vision'] || '').toString().trim()
        if ((row['Period'] || '').toString().trim()) { lastPeriod = period; lastName = name || lastName; lastVision = vision || lastVision }
        return {
          id: `row-${index}`,
          Period: period,
          ScorecardName: name || lastName,
          Vision: vision || lastVision,
          PerspectiveCode: (row['PerspectiveCode'] || '').toString().trim(),
          Weight: (row['Weight'] ?? '').toString().trim(),
          Status: (row['Status'] || '').toString().trim().toUpperCase(),
          ScoringMode: (row['ScoringMode'] || '').toString().trim().toUpperCase(),
          EmptyPolicy: (row['EmptyPolicy'] || '').toString().trim().toUpperCase(),
          OrgUnitCodes: (row['OrgUnits'] || row['OrgUnitCode'] || row['OrgUnitCodes'] || '').toString().trim(),
        }
      }).filter(r => r.Period || r.PerspectiveCode)
      if (parsed.length === 0) { toast.error('File không có dữ liệu hoặc sai định dạng.'); onClose(); return }
      setData(validateAll(parsed))
    } catch {
      toast.error('Lỗi khi đọc file Excel'); onClose()
    } finally { setLoading(false) }
  }

  // Khớp tên kỳ từ file với option (không phân biệt hoa thường) để select hiển thị đúng
  const matchPeriod = (raw?: string) => {
    const v = (raw || '').trim().toLowerCase()
    return periodNames.find(n => n.toLowerCase() === v) || ''
  }

  const change = (id: string, field: keyof Row, value: string) => setData(prev => validateAll(prev.map(r => r.id === id ? { ...r, [field]: value } : r)))
  const remove = (id: string) => setData(prev => validateAll(prev.filter(r => r.id !== id)))
  const add = () => setData(prev => validateAll([...prev, { id: `new-${Date.now()}`, Period: '', ScorecardName: '', PerspectiveCode: '', Weight: '', Status: 'DRAFT', OrgUnitCodes: '' }]))

  const hasErrors = data.some(r => r._errors && Object.keys(r._errors).length > 0)
  const periodCount = useMemo(() => new Set(data.map(r => (r.Period || '').trim().toLowerCase()).filter(Boolean)).size, [data])

  const save = () => {
    if (hasErrors) { toast.error('Vui lòng sửa các lỗi trước khi import'); return }
    if (data.length === 0) { toast.error('Không có dữ liệu'); return }
    try {
      const exportData = data.map(r => {
        const o: any = { Period: r.Period, ScorecardName: r.ScorecardName, PerspectiveCode: r.PerspectiveCode, Weight: r.Weight }
        if (r.Vision) o.Vision = r.Vision
        if (r.OrgUnitCodes) o.OrgUnits = r.OrgUnitCodes
        if (r.Status) o.Status = r.Status
        if (r.ScoringMode) o.ScoringMode = r.ScoringMode
        if (r.EmptyPolicy) o.EmptyPolicy = r.EmptyPolicy
        return o
      })
      const ws = utils.json_to_sheet(exportData)
      const wb = utils.book_new()
      utils.book_append_sheet(wb, ws, 'Bộ tiêu chí BSC')
      const wbout = write(wb, { type: 'array', bookType: 'xlsx' })
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      onImport(new File([blob], file?.name || 'import_scorecards.xlsx', { type: blob.type }))
    } catch { toast.error('Lỗi khi tạo file import') }
  }

  if (!open) return null

  const inputCls = (err?: string) => cn('w-full px-3 py-1.5 rounded-lg border text-sm transition-colors dark:bg-slate-900 dark:text-white',
    err ? 'border-rose-300 bg-rose-50 dark:bg-rose-900/20 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
      : 'border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-transparent hover:bg-white focus:bg-white')

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-[24px] shadow-2xl w-full max-w-[95vw] lg:max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400"><FileSpreadsheet size={20} /></div>
            <div><h2 className="text-lg font-bold text-slate-900 dark:text-white">Xem trước & Kiểm tra bộ tiêu chí BSC</h2><p className="text-xs text-slate-500">File: {file?.name}</p></div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-500"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" /><p className="font-medium text-sm">Đang đọc file...</p></div>
          ) : (
            <div className="space-y-4">
              {hasErrors && (
                <div className="p-4 bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 rounded-xl flex items-start gap-3 border border-rose-100 dark:border-rose-900/30">
                  <AlertCircle size={20} className="shrink-0 mt-0.5" />
                  <div><p className="text-sm font-bold">Phát hiện dữ liệu không hợp lệ</p><p className="text-xs mt-1">Kiểm tra các ô đỏ — đặc biệt tổng trọng số mỗi kỳ phải bằng 100%.</p></div>
                </div>
              )}

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 w-12 text-center">STT</th>
                        <th className="px-4 py-3 min-w-[180px]">Kỳ <span className="text-rose-500">*</span></th>
                        <th className="px-4 py-3 min-w-[170px]">Tên bộ tiêu chí <span className="text-rose-500">*</span></th>
                        <th className="px-4 py-3 min-w-[180px]">Vision</th>
                        <th className="px-4 py-3 min-w-[200px]">Phòng ban</th>
                        <th className="px-4 py-3 min-w-[160px]">Mã hạng mục <span className="text-rose-500">*</span></th>
                        <th className="px-4 py-3 min-w-[110px]">Trọng số % <span className="text-rose-500">*</span></th>
                        <th className="px-4 py-3 min-w-[140px]">Trạng thái</th>
                        <th className="px-4 py-3 min-w-[150px]">Chế độ điểm</th>
                        <th className="px-4 py-3 min-w-[190px]">Hạng mục rỗng</th>
                        <th className="px-4 py-3 w-16 text-center">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.map((row, index) => (
                        <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 text-center text-slate-400 font-medium">{index + 1}</td>
                          <td className="px-4 py-2">
                            <Select value={matchPeriod(row.Period)} onValueChange={v => change(row.id, 'Period', v)}>
                              <SelectTrigger className={cn('h-9 rounded-lg text-sm font-bold', row._errors?.Period ? 'border-rose-300 bg-rose-50 dark:bg-rose-900/20' : 'border-slate-200 dark:border-slate-700')}>
                                <SelectValue placeholder="— Chọn kỳ —" />
                              </SelectTrigger>
                              <SelectContent className="z-[300] max-h-[260px]">
                                {periodNames.map(n => <SelectItem key={n} value={n} className="text-sm font-bold">{n}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            {row._errors?.Period && <p className="text-[10px] text-rose-500 mt-1 font-medium px-1">{row._errors.Period}</p>}
                          </td>
                          <td className="px-4 py-2"><input value={row.ScorecardName} onChange={e => change(row.id, 'ScorecardName', e.target.value)} className={inputCls()} /></td>
                          <td className="px-4 py-2"><input value={row.Vision || ''} onChange={e => change(row.id, 'Vision', e.target.value)} className={inputCls()} /></td>
                          <td className="px-4 py-2">
                            <Popover>
                              <PopoverTrigger asChild>
                                <button type="button" className="w-full min-h-[36px] px-3 py-1.5 rounded-lg border border-transparent hover:border-slate-300 dark:hover:border-slate-700 bg-transparent hover:bg-white dark:hover:bg-slate-900 text-xs font-bold transition-all flex items-center justify-between group focus:ring-1 focus:ring-indigo-500">
                                  <span className="truncate max-w-[160px]">{unitLabel(row)}</span>
                                  <ChevronDown size={14} className="opacity-40 group-hover:opacity-70 ml-2 shrink-0" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="z-[300] p-2 w-[280px] max-h-[300px] overflow-y-auto custom-scrollbar" align="start">
                                <div className="space-y-1">
                                  {flatOrgUnits.map(unit => {
                                    const codes = (row.OrgUnitCodes || '').split(',').map(c => c.trim()).filter(Boolean)
                                    const isSelected = codes.includes(unit.code)
                                    return (
                                      <div key={unit.id} onClick={() => toggleUnitInGroup(row, unit.code)}
                                        className={cn('flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors group',
                                          isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800')}>
                                        <div className={cn('w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0',
                                          isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 dark:border-slate-700 group-hover:border-indigo-400')}>
                                          {isSelected && <Check size={10} strokeWidth={4} />}
                                        </div>
                                        <span className="text-xs font-bold truncate" style={{ marginLeft: `${unit.level * 12}px` }}>{unit.name}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </td>
                          <td className="px-4 py-2">
                            <input value={row.PerspectiveCode} onChange={e => change(row.id, 'PerspectiveCode', e.target.value)} className={cn(inputCls(row._errors?.PerspectiveCode), 'font-mono text-xs')} />
                            {row._errors?.PerspectiveCode && <p className="text-[10px] text-rose-500 mt-1 font-medium px-1">{row._errors.PerspectiveCode}</p>}
                          </td>
                          <td className="px-4 py-2">
                            <input value={row.Weight} onChange={e => change(row.id, 'Weight', e.target.value)} className={cn(inputCls(row._errors?.Weight), 'text-right font-black')} />
                            {row._errors?.Weight && <p className="text-[10px] text-rose-500 mt-1 font-medium px-1">{row._errors.Weight}</p>}
                          </td>
                          <td className="px-4 py-2">
                            <select value={(row.Status || 'DRAFT').toUpperCase()} onChange={e => change(row.id, 'Status', e.target.value)} className={cn(inputCls(), 'pr-7')}>
                              <option value="DRAFT">Nháp</option>
                              <option value="ACTIVE">Áp dụng</option>
                              <option value="ARCHIVED">Lưu trữ</option>
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <select value={(row.ScoringMode || 'SHADOW').toUpperCase()} onChange={e => change(row.id, 'ScoringMode', e.target.value)} className={cn(inputCls(), 'pr-7')}>
                              <option value="SHADOW">Song song</option>
                              <option value="OFFICIAL">Chính thức</option>
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <select value={(row.EmptyPolicy || 'RENORMALIZE').toUpperCase()} onChange={e => change(row.id, 'EmptyPolicy', e.target.value)} className={cn(inputCls(), 'pr-7')}>
                              <option value="RENORMALIZE">Chuẩn hóa lại</option>
                              <option value="ZERO_FILL">Tính 0đ</option>
                            </select>
                          </td>
                          <td className="px-4 py-2 text-center"><button onClick={() => remove(row.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"><Trash2 size={16} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {data.length === 0 && <div className="text-center py-12 text-slate-500 text-sm">Không có dòng dữ liệu nào</div>}
                <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 p-3 flex justify-center">
                  <button onClick={add} className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-4 py-2 rounded-xl transition-colors"><Plus size={16} /> Thêm dòng mới</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <p className="text-sm font-bold text-slate-500">Tổng cộng: <span className="text-slate-900 dark:text-white">{periodCount}</span> bộ tiêu chí ({data.length} dòng)</p>
          <div className="flex gap-3">
            <button onClick={onClose} disabled={isImporting} className="px-6 py-2.5 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300 disabled:opacity-50">Hủy bỏ</button>
            <button onClick={save} disabled={isImporting || hasErrors || data.length === 0} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 disabled:opacity-50 transition-all active:scale-95">
              {isImporting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Đang Import...</> : <><Save size={16} /> Xác nhận Import</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
