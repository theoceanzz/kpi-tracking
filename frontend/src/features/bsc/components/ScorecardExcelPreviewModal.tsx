import { useState, useEffect, useMemo } from 'react'
import { z } from 'zod'
import { read, write, utils } from 'xlsx'
import { Save, AlertCircle, Trash2, Plus, ChevronDown, Check, Loader2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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

/**
 * Ràng buộc từng dòng. Trùng mã trong kỳ và tổng trọng số của kỳ phải nhìn cả tệp mới
 * biết, nên nằm ở `validateAll` bên dưới chứ không ở đây.
 */
const rowSchema = z.object({
  Period: z.string().trim().min(1, 'Bắt buộc'),
  PerspectiveCode: z.string().trim().min(1, 'Bắt buộc'),
  Weight: z.union([z.string(), z.number()])
    .refine(v => String(v ?? '').trim() !== '' && !isNaN(Number(v)), 'Phải là số'),
})

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
  /**
   * Mô tả HẠNG MỤC — chỉ cần khi mã hạng mục chưa có trong tổ chức, backend sẽ tạo mới từ đây.
   * Bảng xem trước chỉ bày ô tên (thứ bắt buộc để tạo); các cột còn lại đi xuyên qua nguyên vẹn,
   * không hiện lên bảng cho đỡ rối nhưng cũng KHÔNG được rơi mất lúc dựng lại tệp.
   */
  PerspectiveName?: string
  FixedPerspective?: string
  Unit?: string
  TargetValue?: string
  MinimumValue?: string
  Color?: string
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
      const parsed = rowSchema.safeParse(r)
      if (!parsed.success) {
        parsed.error.issues.forEach(issue => {
          const field = issue.path[0]
          if (typeof field === 'string') errors[field] = issue.message
        })
      }
      const periodVal = (r.Period || '').trim()
      const codeVal = (r.PerspectiveCode || '').trim()
      // Hai luật dưới đây phải nhìn cả tệp / danh sách kỳ trên server nên không nằm trong schema.
      if (periodVal && periodNames.length > 0 && !periodNames.some(n => n.toLowerCase() === periodVal.toLowerCase())) {
        errors['Period'] = 'Kỳ không tồn tại'
      }
      if (codeVal && periodVal && (comboCounts.get(`${periodVal.toLowerCase()}##${codeVal.toLowerCase()}`) || 0) > 1) {
        errors['PerspectiveCode'] = 'Mã hạng mục bị trùng trong kỳ'
      }
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
          PerspectiveName: (row['PerspectiveName'] || '').toString().trim(),
          FixedPerspective: (row['FixedPerspective'] || row['Perspective'] || '').toString().trim().toUpperCase(),
          Unit: (row['Unit'] || '').toString().trim(),
          TargetValue: (row['TargetValue'] ?? '').toString().trim(),
          MinimumValue: (row['MinimumValue'] ?? '').toString().trim(),
          Color: (row['Color'] || '').toString().trim(),
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
        if (r.PerspectiveName) o.PerspectiveName = r.PerspectiveName
        if (r.FixedPerspective) o.FixedPerspective = r.FixedPerspective
        if (r.Unit) o.Unit = r.Unit
        if (r.TargetValue) o.TargetValue = r.TargetValue
        if (r.MinimumValue) o.MinimumValue = r.MinimumValue
        if (r.Color) o.Color = r.Color
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

  const inputCls = (err?: string) => cn('w-full px-3 py-1.5 rounded-control border text-sm transition-colors',
    err ? 'border-[var(--color-error-border)] bg-[var(--color-error-bg)] focus:border-[var(--color-error-border)] focus:ring-1 focus:ring-[var(--color-error-solid)]'
      : 'border-transparent hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-ring)] bg-transparent hover:bg-[var(--color-card)] focus:bg-[var(--color-card)]')

  return (
    <Dialog
      open
      onClose={onClose}
      size="full"
      dismissible={!isImporting}
      title="Xem trước & Kiểm tra bộ tiêu chí BSC"
      description={`File: ${file?.name ?? ''}`}
      footer={
        <DialogFooter
          note={<>Tổng cộng: <span className="font-medium text-[var(--color-foreground)] tabular-nums">{periodCount}</span> bộ tiêu chí ({data.length} dòng)</>}
          secondary={<Button variant="outline" onClick={onClose} disabled={isImporting}>Hủy bỏ</Button>}
          primary={
            <Button onClick={save} disabled={isImporting || hasErrors || data.length === 0}>
              {isImporting ? <><Loader2 className="animate-spin" aria-hidden="true" /> Đang Import...</> : <><Save aria-hidden="true" /> Xác nhận Import</>}
            </Button>
          }
        />
      }
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 text-[var(--color-subtle-foreground)]"><div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mb-4" /><p className="font-medium text-sm">Đang đọc file...</p></div>
      ) : (
        <div className="space-y-4">
          {hasErrors && (
            <div className="p-4 bg-[var(--color-error-bg)] text-[var(--color-error)] rounded-card flex items-start gap-3 border border-[var(--color-error-border)]">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <div><p className="text-sm font-medium">Phát hiện dữ liệu không hợp lệ</p><p className="text-xs mt-1">Kiểm tra các ô đỏ — đặc biệt tổng trọng số mỗi kỳ phải bằng 100%.</p></div>
            </div>
          )}

          <div className="border border-[var(--color-border)] rounded-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-eyebrow bg-[var(--color-muted)] border-b border-[var(--color-border)] sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center">STT</th>
                    <th className="px-4 py-3 min-w-[180px]">Kỳ <span className="text-[var(--color-error)]">*</span></th>
                    <th className="px-4 py-3 min-w-[170px]">Tên bộ tiêu chí <span className="text-[var(--color-error)]">*</span></th>
                    <th className="px-4 py-3 min-w-[180px]">Vision</th>
                    <th className="px-4 py-3 min-w-[200px]">Phòng ban</th>
                    <th className="px-4 py-3 min-w-[160px]">Mã hạng mục <span className="text-[var(--color-error)]">*</span></th>
                    <th className="px-4 py-3 min-w-[180px]">Tên hạng mục</th>
                    <th className="px-4 py-3 min-w-[110px]">Trọng số % <span className="text-[var(--color-error)]">*</span></th>
                    <th className="px-4 py-3 min-w-[140px]">Trạng thái</th>
                    <th className="px-4 py-3 min-w-[150px]">Chế độ điểm</th>
                    <th className="px-4 py-3 min-w-[190px]">Hạng mục rỗng</th>
                    <th className="px-4 py-3 w-16 text-center">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {data.map((row, index) => (
                    <tr key={row.id} className="hover:bg-[var(--color-muted)] transition-colors">
                      <td className="px-4 py-3 text-center text-[var(--color-subtle-foreground)] font-medium">{index + 1}</td>
                      <td className="px-4 py-2">
                        <Select value={matchPeriod(row.Period)} onValueChange={v => change(row.id, 'Period', v)}>
                          <SelectTrigger className={cn('h-9 rounded-control text-sm font-medium', row._errors?.Period ? 'border-[var(--color-error-border)] bg-[var(--color-error-bg)]' : 'border-[var(--color-border)]')}>
                            <SelectValue placeholder="— Chọn kỳ —" />
                          </SelectTrigger>
                          <SelectContent className="z-[300] max-h-[260px]">
                            {periodNames.map(n => <SelectItem key={n} value={n} className="text-sm font-medium">{n}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {row._errors?.Period && <p className="text-xs text-[var(--color-error)] mt-1 font-medium px-1">{row._errors.Period}</p>}
                      </td>
                      <td className="px-4 py-2"><input value={row.ScorecardName} onChange={e => change(row.id, 'ScorecardName', e.target.value)} className={inputCls()} /></td>
                      <td className="px-4 py-2"><input value={row.Vision || ''} onChange={e => change(row.id, 'Vision', e.target.value)} className={inputCls()} /></td>
                      <td className="px-4 py-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button type="button" className="w-full min-h-[36px] px-3 py-1.5 rounded-control border border-transparent hover:border-[var(--color-border-strong)] bg-transparent hover:bg-[var(--color-card)] text-xs font-medium transition-all flex items-center justify-between group focus:ring-1 focus:ring-[var(--color-ring)]">
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
                                    className={cn('flex items-center gap-3 px-3 py-2 rounded-card cursor-pointer transition-colors group',
                                      isSelected ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'hover:bg-[var(--color-muted)]')}>
                                    <div className={cn('w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0',
                                      isSelected ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'border-[var(--color-border)] group-hover:border-[var(--color-primary)]')}>
                                      {isSelected && <Check size={10} strokeWidth={4} />}
                                    </div>
                                    <span className="text-xs font-medium truncate" style={{ marginLeft: `${unit.level * 12}px` }}>{unit.name}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </td>
                      <td className="px-4 py-2">
                        <input value={row.PerspectiveCode} onChange={e => change(row.id, 'PerspectiveCode', e.target.value)} className={cn(inputCls(row._errors?.PerspectiveCode), 'font-mono text-xs')} />
                        {row._errors?.PerspectiveCode && <p className="text-xs text-[var(--color-error)] mt-1 font-medium px-1">{row._errors.PerspectiveCode}</p>}
                      </td>
                      <td className="px-4 py-2">
                        <input value={row.PerspectiveName || ''}
                          onChange={e => change(row.id, 'PerspectiveName', e.target.value)}
                          placeholder="Bỏ trống nếu mã đã có"
                          className={inputCls()} />
                      </td>
                      <td className="px-4 py-2">
                        <input value={row.Weight} onChange={e => change(row.id, 'Weight', e.target.value)} className={cn(inputCls(row._errors?.Weight), 'text-right font-semibold')} />
                        {row._errors?.Weight && <p className="text-xs text-[var(--color-error)] mt-1 font-medium px-1">{row._errors.Weight}</p>}
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
                          <option value="RENORMALIZE">Bỏ qua hạng mục rỗng</option>
                          <option value="ZERO_FILL">Tính 0 điểm</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-center"><button onClick={() => remove(row.id)} className="p-1.5 text-[var(--color-subtle-foreground)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)] dark:hover:bg-[var(--color-error-bg)] rounded-control transition-colors"><Trash2 size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.length === 0 && <div className="text-center py-12 text-[var(--color-muted-foreground)] text-sm">Không có dòng dữ liệu nào</div>}
            <div className="bg-[var(--color-muted)] border-t border-[var(--color-border)] p-3 flex justify-center">
              <Button variant="ghost" onClick={add}><Plus aria-hidden="true" /> Thêm dòng mới</Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  )
}
