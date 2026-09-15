import { useState, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Database, Plus, Trash2, Type, Hash, Calendar, Link2, CheckCircle2, ListChecks, User as UserIcon, X, Search, ChevronDown } from 'lucide-react'
import { useDatasource, useDatasourceRows } from '../hooks/useDatasources'
import { useAddColumn, useDeleteColumn, useAddRow, useUpdateRow, useDeleteRow, useUpdateDatasource } from '../hooks/useDatasourceMutations'
import { useUsers } from '@/features/users/hooks/useUsers'
import { format } from 'date-fns'
import { addColumnSchema, type AddColumnFormData } from '../schemas/datasourceSchema'
import type { CellValueRequest, ColumnDataType, DsColumn } from '@/types/datasource'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { Button } from '@/components/ui/button'


const DATA_TYPE_OPTIONS: { value: ColumnDataType; label: string; icon: React.ReactNode }[] = [
  { value: 'TEXT', label: 'Văn bản', icon: <Type size={14} /> },
  { value: 'NUMBER', label: 'Số', icon: <Hash size={14} /> },
  { value: 'DATE', label: 'Ngày', icon: <Calendar size={14} /> },
  { value: 'SELECT_ONE', label: 'Chọn một', icon: <CheckCircle2 size={14} /> },
  { value: 'SELECT_MULTI', label: 'Chọn nhiều', icon: <ListChecks size={14} /> },
  { value: 'USER', label: 'Người dùng', icon: <UserIcon size={14} /> },
  { value: 'URL', label: 'URL', icon: <Link2 size={14} /> },
]

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#64748b']

function getTypeIcon(type: ColumnDataType) {
  const opt = DATA_TYPE_OPTIONS.find(o => o.value === type)
  return opt?.icon || <Type size={14} />
}

interface SelectOption {
  id: string
  label: string
  color: string
}

interface ColConfig {
  options?: SelectOption[]
  isMultiSelect?: boolean
}

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substring(2, 9)

export default function DatasourceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  const { data: ds, isLoading: dsLoading } = useDatasource(id!)
  const { data: rowsData, isLoading: rowsLoading } = useDatasourceRows(id!, { page: 0, size: 100 })
  const { data: usersData } = useUsers({ size: 1000 })
  const users = usersData?.content || []

  const addColumnMut = useAddColumn()
  const deleteColumnMut = useDeleteColumn()
  const addRowMut = useAddRow()
  const updateRowMut = useUpdateRow()
  const deleteRowMut = useDeleteRow()
  const updateDsMut = useUpdateDatasource()

  const [showAddCol, setShowAddCol] = useState(false)
  const [deleteCol, setDeleteCol] = useState<DsColumn | null>(null)
  const [deleteRowId, setDeleteRowId] = useState<string | null>(null)

  const { register, handleSubmit: handleColumnSubmit, reset: resetColumn, watch: watchColumn, setValue: setColumnValue, formState: { errors: columnErrors } } =
    useForm<AddColumnFormData>({
      resolver: zodResolver(addColumnSchema),
      defaultValues: { name: '', type: 'TEXT', options: [], isMultiUser: false },
    })

  // Kiểu cột, danh sách tag và công tắc "chọn nhiều" đều là điều khiển tự vẽ.
  const newColType = watchColumn('type')
  const newColOptions = watchColumn('options')
  const newColIsMultiUser = watchColumn('isMultiUser')
  const setNewColOptions = (fn: (prev: SelectOption[]) => SelectOption[]) =>
    setColumnValue('options', fn(newColOptions), { shouldValidate: true })

  // Edit State
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null)
  
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  const columns = ds?.columns || []
  const rows = rowsData?.content || []

  // Create Column
  const handleAddColumn = handleColumnSubmit((data) => {
    if (!id) return
    const config: ColConfig = {}
    if (data.type === 'SELECT_ONE' || data.type === 'SELECT_MULTI') {
      config.options = data.options
    }
    if (data.type === 'USER') {
      config.isMultiSelect = data.isMultiUser
    }

    addColumnMut.mutate(
      { datasourceId: id, data: { name: data.name, dataType: data.type, config: JSON.stringify(config) } },
      { onSuccess: () => {
        setShowAddCol(false)
        resetColumn({ name: '', type: 'TEXT', options: [], isMultiUser: false })
      }}
    )
  })

  const handleAddRow = () => {
    if (!id) return
    addRowMut.mutate({ datasourceId: id })
  }

  // --- Rendering Cells ---
  const renderCellDisplayValue = (row: typeof rows[0], col: DsColumn) => {
    const cell = row.cells?.[col.id]
    if (!cell) return <span className="text-[var(--color-subtle-foreground)] italic">Trống</span>

    const config: ColConfig = col.config ? JSON.parse(col.config) : {}

    switch (col.dataType) {
      case 'NUMBER': return <span>{cell.valueNumber?.toString()}</span>
      case 'DATE': return <span>{cell.valueDate ? new Date(cell.valueDate).toLocaleDateString('vi-VN') : ''}</span>
      
      case 'SELECT_ONE':
      case 'SELECT_MULTI': {
        if (!cell.valueText) return null
        const vals = cell.valueText.split(',')
        return (
          <div className="flex flex-wrap gap-1">
            {vals.map(v => {
              const opt = config.options?.find(o => o.id === v)
              if (!opt) return null
              return (
                <span key={v} className="px-2 py-0.5 rounded-full text-xs font-medium text-white shadow-sm" style={{ backgroundColor: opt.color }}>
                  {opt.label}
                </span>
              )
            })}
          </div>
        )
      }

      case 'USER': {
        if (!cell.valueText) return null
        const uids = cell.valueText.split(',')
        return (
          <div className="flex flex-wrap gap-1">
            {uids.map(uid => {
              const u = users.find(user => user.id === uid)
              if (!u) return <span key={uid} className="text-xs text-[var(--color-muted-foreground)]">?</span>
              return (
                <div key={uid} className="flex items-center gap-1.5 px-2 py-1 bg-[var(--color-muted)] rounded-control text-xs font-medium border border-[var(--color-border)]">
                  {u.avatarUrl ? (
                    <img src={u.avatarUrl} className="w-4 h-4 rounded-full" alt="avatar" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-[var(--color-primary)] text-[var(--color-primary-foreground)] flex items-center justify-center text-xs font-medium">
                      {u.fullName?.charAt(0)}
                    </div>
                  )}
                  {u.fullName}
                </div>
              )
            })}
          </div>
        )
      }

      default: return <span className="block truncate">{cell.valueText}</span>
    }
  }

  const startEdit = (rowId: string, colId: string) => {
    setEditingCell({ rowId, colId })
  }

  const handleTitleSave = () => {
    if (!id || !titleDraft.trim()) return
    updateDsMut.mutate({ id, data: { name: titleDraft } })
    setEditingTitle(false)
  }

  // Cell Editor Component
  const CellEditor = ({ row, col, onClose }: { row: typeof rows[0], col: DsColumn, onClose: () => void }) => {
    const config: ColConfig = col.config ? JSON.parse(col.config) : {}
    const cell = row.cells?.[col.id]
    const [draft, setDraft] = useState<string>(
      col.dataType === 'NUMBER' ? (cell?.valueNumber?.toString() || '') :
      col.dataType === 'DATE' ? (cell?.valueDate?.split('T')[0] || '') :
      (cell?.valueText || '')
    )
    const [search, setSearch] = useState('')

    const save = (val: string) => {
      const cellVal: CellValueRequest = {}
      if (col.dataType === 'NUMBER') {
        cellVal.valueNumber = val ? parseFloat(val) : undefined
      } else if (col.dataType === 'DATE') {
        cellVal.valueDate = val ? new Date(val).toISOString() : undefined
      } else {
        cellVal.valueText = val || undefined
      }
      updateRowMut.mutate({ rowId: row.id, data: { cells: { [col.id]: cellVal } } })
      onClose()
    }

    const toggleMulti = (val: string) => {
      const current = draft ? draft.split(',') : []
      if (current.includes(val)) {
        setDraft(current.filter(x => x !== val).join(','))
      } else {
        setDraft([...current, val].join(','))
      }
    }

    // Effects and Refs for closing
    const ref = useRef<HTMLDivElement>(null)
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (ref.current && !ref.current.contains(e.target as Node)) {
          if (col.dataType === 'SELECT_MULTI' || (col.dataType === 'USER' && config.isMultiSelect)) {
            save(draft)
          } else {
            onClose() // standard unmount
          }
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [draft, config])

    if (col.dataType === 'DATE') {
      return (
        <div className="relative w-full h-full min-w-[120px]">
          <input 
            type="date" 
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => save(draft)}
            onKeyDown={e => { if(e.key === 'Enter') save(draft); if(e.key === 'Escape') onClose() }}
            className="w-full h-full bg-transparent outline-none ring-2 ring-[var(--color-ring)] rounded px-2 py-1 text-xs text-transparent" 
            autoFocus 
          />
          <div className="absolute inset-0 left-2 flex items-center pointer-events-none text-xs font-medium text-[var(--color-foreground)]">
            {draft ? format(new Date(draft), 'dd/MM/yyyy') : ''}
          </div>
        </div>
      )
    }


    if (col.dataType === 'TEXT' || col.dataType === 'NUMBER' || col.dataType === 'URL') {
      return (
        <input 
          type="text" 
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => save(draft)}
          onKeyDown={e => { if(e.key === 'Enter') save(draft); if(e.key === 'Escape') onClose() }}
          className="w-full bg-transparent outline-none ring-2 ring-[var(--color-ring)] rounded px-2 -ml-2 text-xs h-full" 
          autoFocus 
        />
      )
    }

    // Dropdown Editor for Selects & Users
    return (
      <div ref={ref} className="absolute top-full left-0 mt-1 min-w-[200px] bg-[var(--color-card)] shadow-xl rounded-card border border-[var(--color-border)] z-50 p-2 overflow-hidden flex flex-col max-h-[300px]">
        
        {col.dataType === 'USER' && (
          <div className="relative mb-2 shrink-0">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-subtle-foreground)]" />
            <input 
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm user..." 
              className="w-full pl-8 pr-3 py-1.5 bg-[var(--color-muted)] rounded-control text-xs outline-none border border-[var(--color-border)]" 
              autoFocus
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {col.dataType === 'USER' ? (
            users.filter(u => u.fullName.toLowerCase().includes(search.toLowerCase())).map(u => {
              const selected = draft.split(',').includes(u.id)
              return (
                <div 
                  key={u.id}
                  onClick={() => {
                    if (config.isMultiSelect) toggleMulti(u.id)
                    else save(u.id)
                  }}
                  className={`flex items-center gap-2 p-2 rounded-control cursor-pointer text-xs transition-colors ${selected ? 'bg-[var(--color-primary-soft)] font-medium' : 'hover:bg-[var(--color-muted)]'}`}
                >
                  <div className="w-5 h-5 shrink-0 rounded-full bg-[var(--color-border)] overflow-hidden">
                    {u.avatarUrl ? <img src={u.avatarUrl} /> : <div className="w-full h-full flex items-center justify-center text-xs font-medium bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">{u.fullName.charAt(0)}</div>}
                  </div>
                  <span className="flex-1 truncate">{u.fullName}</span>
                  {selected && <CheckCircle2 size={14} className="text-[var(--color-primary)]" />}
                </div>
              )
            })
          ) : (
            config.options?.map(o => {
              const selected = draft.split(',').includes(o.id)
              return (
                <div 
                  key={o.id}
                  onClick={() => {
                    if (col.dataType === 'SELECT_MULTI') toggleMulti(o.id)
                    else save(o.id)
                  }}
                  className={`flex items-center gap-2 p-2 rounded-control cursor-pointer text-xs transition-colors hover:bg-[var(--color-muted)]`}
                >
                  <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: o.color }} />
                  <span className="flex-1 truncate">{o.label}</span>
                  {selected && <CheckCircle2 size={14} className="text-[var(--color-primary)]" />}
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }

  if (dsLoading) return <div className="mx-auto max-w-[1600px]"><LoadingSkeleton type="table" rows={8} /></div>

  if (!ds) {
    return (
      <div className="mx-auto max-w-[1600px] rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
        <EmptyState
          icon={Database}
          title="Không tìm thấy nguồn dữ liệu"
          description="Nguồn dữ liệu này có thể đã bị xoá hoặc bạn không có quyền xem."
          action={<Button variant="outline" onClick={() => navigate('/datasources')}><ArrowLeft aria-hidden="true" /> Về danh sách</Button>}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      {/* Header: tên sửa tại chỗ (bấm vào tên), cùng khuôn nút quay lại với các trang chi tiết khác */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate('/datasources')} aria-label="Quay lại" className="shrink-0"><ArrowLeft aria-hidden="true" /></Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {ds.icon && <span className="text-xl" aria-hidden="true">{ds.icon}</span>}
              {editingTitle ? (
                <input
                  value={titleDraft} onChange={e => setTitleDraft(e.target.value)} onBlur={handleTitleSave} onKeyDown={e => e.key === 'Enter' && handleTitleSave()}
                  aria-label="Tên nguồn dữ liệu"
                  className="h-9 rounded-control border border-[var(--color-primary)] bg-[var(--color-card)] px-3 text-lg font-semibold text-[var(--color-foreground)] outline-none ring-2 ring-[var(--color-ring)]" autoFocus
                />
              ) : (
                <button className="min-w-0 text-left" type="button" onClick={() => { setEditingTitle(true); setTitleDraft(ds.name) }} title="Bấm để đổi tên">
                  <h1 className="text-page-title truncate hover:text-[var(--color-primary)]">{ds.name}</h1>
                </button>
              )}
              <Badge variant="outline">{ds.orgUnitName}</Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {ds.description || 'Không có mô tả'} · <span className="tabular-nums">{columns.length} cột · {rows.length} hàng</span>
            </p>
          </div>
        </div>
        <Button onClick={() => setShowAddCol(true)} className="shrink-0"><Plus aria-hidden="true" /> Thêm cột</Button>
      </div>

      {/* Spreadsheet */}
      <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="overflow-x-auto overflow-y-visible pb-32">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-muted)]">
                <th className="sticky top-0 z-20 w-12 border-b border-r border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2.5 text-left text-eyebrow">#</th>
                {columns.map(col => (
                  <th key={col.id} className="group sticky top-0 z-20 min-w-[180px] border-b border-r border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-left">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-2 text-eyebrow normal-case tracking-normal">
                        {getTypeIcon(col.dataType)}
                        <span className="truncate">{col.name}</span>
                      </div>
                      <Button
                        variant="ghost" size="icon-sm"
                        onClick={() => setDeleteCol(col)}
                        aria-label={`Xoá cột ${col.name}`} title="Xoá cột"
                        className="h-6 w-6 text-[var(--color-muted-foreground)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-[var(--color-error)]"
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </th>
                ))}
                <th className="sticky top-0 z-20 w-12 border-b border-[var(--color-border)] bg-[var(--color-muted)] px-2 py-2">
                  <Button variant="ghost" size="icon-sm" onClick={() => setShowAddCol(true)} aria-label="Thêm cột" title="Thêm cột"><Plus aria-hidden="true" /></Button>
                </th>
              </tr>
            </thead>
            <tbody>
              {rowsLoading ? (
                <tr><td colSpan={columns.length + 2} className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">Đang tải…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={columns.length + 2} className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">{columns.length === 0 ? 'Thêm cột đầu tiên để bắt đầu nhập liệu.' : 'Chưa có hàng nào. Bấm "Thêm hàng" ở cuối bảng.'}</td></tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-[var(--color-muted)] transition-colors group/row">
                    <td className="px-3 py-2 text-xs text-[var(--color-subtle-foreground)] font-medium border-r border-b border-[var(--color-border)] text-center">
                      <span className="group-hover/row:hidden">{idx + 1}</span>
                      <Button variant="ghost" size="icon-sm" className="hidden text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" type="button" onClick={() => setDeleteRowId(row.id)} aria-label="Xoá hàng" title="Xoá hàng">
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </td>
                    {columns.map(col => {
                      const isEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id
                      return (
                        <td key={col.id} className={`px-3 py-2 border-r border-b border-[var(--color-border)] relative cursor-pointer min-h-[36px] align-middle hover:bg-[var(--color-muted)] transition-colors ${isEditing ? 'ring-2 ring-[var(--color-ring)] ring-inset bg-[var(--color-primary-soft)]' : ''}`} onClick={() => !isEditing && startEdit(row.id, col.id)}>
                          <div className="min-h-[20px] flex items-center">
                            {isEditing ? (
                              <CellEditor row={row} col={col} onClose={() => setEditingCell(null)} />
                            ) : (
                              renderCellDisplayValue(row, col)
                            )}
                          </div>
                          {!isEditing && (col.dataType === 'SELECT_ONE' || col.dataType === 'SELECT_MULTI' || col.dataType === 'USER' || col.dataType === 'DATE') && (
                            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-subtle-foreground)] opacity-0 group-hover/row:opacity-100" />
                          )}
                        </td>
                      )
                    })}
                    <td className="border-b border-[var(--color-border)]" />
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <Button variant="outline" className="w-full" onClick={handleAddRow} disabled={addRowMut.isPending}>
          <Plus aria-hidden="true" /> Thêm hàng mới
        </Button>
      </div>

      <ConfirmDialog
        open={!!deleteCol}
        onClose={() => setDeleteCol(null)}
        onConfirm={() => { if (deleteCol) deleteColumnMut.mutate(deleteCol.id, { onSettled: () => setDeleteCol(null) }) }}
        title={`Xoá cột "${deleteCol?.name ?? ''}"?`}
        description="Toàn bộ giá trị trong cột này ở mọi hàng sẽ bị xoá và không khôi phục được."
        confirmLabel="Xoá cột"
        loading={deleteColumnMut.isPending}
      />
      <ConfirmDialog
        open={!!deleteRowId}
        onClose={() => setDeleteRowId(null)}
        onConfirm={() => { if (deleteRowId) deleteRowMut.mutate(deleteRowId, { onSettled: () => setDeleteRowId(null) }) }}
        title="Xoá hàng này?"
        description="Hàng dữ liệu sẽ bị xoá khỏi nguồn và các báo cáo đang dùng."
        confirmLabel="Xoá hàng"
        loading={deleteRowMut.isPending}
      />

      {/* Add Column Modal */}
      <Dialog
        open={showAddCol}
        onClose={() => setShowAddCol(false)}
        size="md"
        dismissible={!addColumnMut.isPending}
        title="Tạo cột mới"
        footer={
          <DialogFooter
            secondary={<Button variant="outline" onClick={() => setShowAddCol(false)} disabled={addColumnMut.isPending}>Hủy bỏ</Button>}
            primary={<Button onClick={handleAddColumn} disabled={addColumnMut.isPending}>Tạo Cột</Button>}
          />
        }
      >
        <div className="space-y-5">
          <div>
            <label className="text-label block mb-1.5">Tên cột <span className="text-[var(--color-error)]">*</span></label>
            <input {...register('name')} placeholder="Nhập tên cột..." className="w-full px-4 py-3 rounded-card bg-[var(--color-muted)] border-none outline-none ring-1 ring-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-ring)] text-sm font-medium" autoFocus />
            {columnErrors.name && <p className="mt-1 text-xs text-[var(--color-error)] font-medium">{columnErrors.name.message}</p>}
          </div>
          <div>
            <label className="text-label block mb-1.5">Loại dữ liệu</label>
            <div className="grid grid-cols-2 gap-2 h-40 overflow-y-auto pr-1">
              {DATA_TYPE_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setColumnValue('type', opt.value, { shouldValidate: true })} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-card border text-sm font-semibold transition-all ${newColType === opt.value ? 'bg-[var(--color-primary-soft)] border-[var(--color-border)] text-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]'}`}>
                  <div className={`p-1.5 rounded-control ${newColType === opt.value ? 'bg-[var(--color-primary-soft)]' : 'bg-[var(--color-muted)]'}`}>{opt.icon}</div>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Option Builder for Select Types */}
          {(newColType === 'SELECT_ONE' || newColType === 'SELECT_MULTI') && (
            <div className="p-4 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)]">
              <label className="text-label mb-3 flex justify-between">Tùy chọn Option <span>{newColOptions.length}</span></label>
              <div className="flex flex-wrap gap-2 mb-3">
                {newColOptions.map(opt => (
                  <div key={opt.id} className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium text-white shadow-sm" style={{ backgroundColor: opt.color }}>
                    {opt.label}
                    <X size={10} className="cursor-pointer transition-transform" onClick={() => setNewColOptions(prev => prev.filter(p => p.id !== opt.id))} />
                  </div>
                ))}
              </div>
              {columnErrors.options && <p className="mb-2 text-xs text-[var(--color-error)] font-medium">{columnErrors.options.message}</p>}
              <div className="flex items-center gap-2">
                <input 
                  id="opt-draft"
                  placeholder="Nhập tên tag..." 
                  className="flex-1 bg-[var(--color-card)] px-3 py-2 text-xs rounded-control border border-[var(--color-border)] outline-none focus:border-[var(--color-primary)]"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = e.currentTarget.value.trim()
                      if (val) {
                        setNewColOptions(p => [...p, { id: generateId(), label: val, color: COLORS[p.length % COLORS.length] || '#ef4444' }])
                        e.currentTarget.value = ''
                      }
                    }
                  }}
                />
                <Button size="sm" className="shrink-0" onClick={() => {
                    const input = document.getElementById('opt-draft') as HTMLInputElement
                    const val = input.value.trim()
                    if (val) {
                      setNewColOptions(p => [...p, { id: generateId(), label: val, color: COLORS[p.length % COLORS.length] || '#ef4444' }])
                      input.value = ''
                    }
                  }}>Thêm</Button>
              </div>
            </div>
          )}

          {/* Settings for User */}
          {newColType === 'USER' && (
            <div className="p-4 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] flex items-center justify-between cursor-pointer" onClick={() => setColumnValue('isMultiUser', !newColIsMultiUser)}>
              <div>
                <div className="text-sm font-medium text-[var(--color-foreground)]">Cho phép chọn nhiều</div>
                <div className="text-xs text-[var(--color-muted-foreground)] font-medium">Bật nếu một ô có thuộc tính nhiều nhân sự</div>
              </div>
              <div className={`w-10 h-6 rounded-full p-1 transition-colors ${newColIsMultiUser ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`}>
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${newColIsMultiUser ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  )
}
