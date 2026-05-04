import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Type, Hash, Calendar, Link2, CheckCircle2, ListChecks, User as UserIcon, X, Search, ChevronDown } from 'lucide-react'
import { useDatasource, useDatasourceRows } from '../hooks/useDatasources'
import { useAddColumn, useDeleteColumn, useAddRow, useUpdateRow, useDeleteRow, useUpdateDatasource } from '../hooks/useDatasourceMutations'
import { useUsers } from '@/features/users/hooks/useUsers'
import type { ColumnDataType, CellValueRequest, DsColumn } from '@/types/datasource'

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
  const [newColName, setNewColName] = useState('')
  const [newColType, setNewColType] = useState<ColumnDataType>('TEXT')
  const [newColOptions, setNewColOptions] = useState<SelectOption[]>([])
  const [newColIsMultiUser, setNewColIsMultiUser] = useState(false)

  // Edit State
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null)
  
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  const columns = ds?.columns || []
  const rows = rowsData?.content || []

  // Create Column
  const handleAddColumn = () => {
    if (!newColName.trim() || !id) return
    const config: ColConfig = {}
    if (newColType === 'SELECT_ONE' || newColType === 'SELECT_MULTI') {
      config.options = newColOptions
    }
    if (newColType === 'USER') {
      config.isMultiSelect = newColIsMultiUser
    }

    addColumnMut.mutate(
      { datasourceId: id, data: { name: newColName, dataType: newColType, config: JSON.stringify(config) } },
      { onSuccess: () => { 
        setShowAddCol(false); setNewColName(''); setNewColType('TEXT'); setNewColOptions([]); setNewColIsMultiUser(false)
      }}
    )
  }

  const handleAddRow = () => {
    if (!id) return
    addRowMut.mutate({ datasourceId: id })
  }

  // --- Rendering Cells ---
  const renderCellDisplayValue = (row: typeof rows[0], col: DsColumn) => {
    const cell = row.cells?.[col.id]
    if (!cell) return <span className="text-slate-400 italic">Trống</span>

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
                <span key={v} className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm" style={{ backgroundColor: opt.color }}>
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
              if (!u) return <span key={uid} className="text-xs text-slate-500">?</span>
              return (
                <div key={uid} className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700">
                  {u.avatarUrl ? (
                    <img src={u.avatarUrl} className="w-4 h-4 rounded-full" alt="avatar" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[8px] font-bold">
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
        <input 
          type="date" 
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => save(draft)}
          onKeyDown={e => { if(e.key === 'Enter') save(draft); if(e.key === 'Escape') onClose() }}
          className="w-full h-full min-w-[120px] bg-transparent outline-none ring-2 ring-indigo-500 rounded px-2 py-1 text-xs" 
          autoFocus 
        />
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
          className="w-full bg-transparent outline-none ring-2 ring-indigo-500 rounded px-2 -ml-2 text-xs h-full" 
          autoFocus 
        />
      )
    }

    // Dropdown Editor for Selects & Users
    return (
      <div ref={ref} className="absolute top-full left-0 mt-1 min-w-[200px] bg-white dark:bg-slate-900 shadow-xl rounded-xl border border-slate-200 dark:border-slate-800 z-50 p-2 overflow-hidden flex flex-col max-h-[300px]">
        
        {col.dataType === 'USER' && (
          <div className="relative mb-2 shrink-0">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm user..." 
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs outline-none border border-slate-200 dark:border-slate-700" 
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
                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs transition-colors ${selected ? 'bg-indigo-50 dark:bg-indigo-900/30 font-medium' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  <div className="w-5 h-5 shrink-0 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    {u.avatarUrl ? <img src={u.avatarUrl} /> : <div className="w-full h-full flex items-center justify-center text-[9px] font-bold bg-indigo-500 text-white">{u.fullName.charAt(0)}</div>}
                  </div>
                  <span className="flex-1 truncate">{u.fullName}</span>
                  {selected && <CheckCircle2 size={14} className="text-indigo-600" />}
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
                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800`}
                >
                  <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: o.color }} />
                  <span className="flex-1 truncate">{o.label}</span>
                  {selected && <CheckCircle2 size={14} className="text-indigo-600" />}
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }

  if (dsLoading) {
    return <div className="space-y-4 animate-pulse"><div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded" /><div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-xl" /></div>
  }

  if (!ds) return <div className="text-center py-16 text-slate-500">Không tìm thấy datasource</div>

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/datasources')} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {ds.icon && <span className="text-xl">{ds.icon}</span>}
          {editingTitle ? (
            <input
              value={titleDraft} onChange={e => setTitleDraft(e.target.value)} onBlur={handleTitleSave} onKeyDown={e => e.key === 'Enter' && handleTitleSave()}
              className="text-xl font-bold bg-transparent border-b-2 border-indigo-600 outline-none" autoFocus
            />
          ) : (
            <h1 className="text-xl font-bold truncate cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => { setEditingTitle(true); setTitleDraft(ds.name) }}>
              {ds.name}
            </h1>
          )}
        </div>
        <span className="text-xs text-slate-500 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">{ds.orgUnitName}</span>
      </div>

      {ds.description && <p className="text-sm text-slate-500 ml-11">{ds.description}</p>}

      {/* Spreadsheet */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="overflow-x-auto overflow-y-visible pb-32">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50">
                <th className="w-12 px-3 py-3 text-left text-xs font-black uppercase text-slate-400 border-b border-r border-slate-200 dark:border-slate-800 sticky top-0 bg-slate-50 dark:bg-slate-800/90 z-20">#</th>
                {columns.map(col => (
                  <th key={col.id} className="min-w-[180px] px-3 py-3 text-left border-b border-r border-slate-200 dark:border-slate-800 group sticky top-0 bg-slate-50 dark:bg-slate-800/90 z-20">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                        {getTypeIcon(col.dataType)}
                        <span>{col.name}</span>
                      </div>
                      <button onClick={() => { if (confirm(`Xóa cột "${col.name}"?`)) deleteColumnMut.mutate(col.id) }} className="p-1 rounded bg-red-50 text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </th>
                ))}
                <th className="w-12 px-2 py-3 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-slate-50 dark:bg-slate-800/90 z-20">
                  <button onClick={() => setShowAddCol(true)} className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-colors">
                    <Plus size={16} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {rowsLoading ? (
                <tr><td colSpan={columns.length + 2} className="text-center py-8 text-slate-500">Đang tải...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={columns.length + 2} className="text-center py-8 text-slate-500">Chưa có dữ liệu.</td></tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group/row">
                    <td className="px-3 py-2 text-xs text-slate-400 font-medium border-r border-b border-slate-200 dark:border-slate-800 text-center">
                      <span className="group-hover/row:hidden">{idx + 1}</span>
                      <button onClick={() => { if (confirm('Xóa hàng này?')) deleteRowMut.mutate(row.id) }} className="hidden group-hover/row:inline-flex p-1 rounded bg-red-50 text-red-500">
                        <Trash2 size={12} />
                      </button>
                    </td>
                    {columns.map(col => {
                      const isEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id
                      return (
                        <td key={col.id} className={`px-3 py-2 border-r border-b border-slate-200 dark:border-slate-800 relative cursor-pointer min-h-[36px] align-middle hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${isEditing ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-50/10' : ''}`} onClick={() => !isEditing && startEdit(row.id, col.id)}>
                          <div className="min-h-[20px] flex items-center">
                            {isEditing ? (
                              <CellEditor row={row} col={col} onClose={() => setEditingCell(null)} />
                            ) : (
                              renderCellDisplayValue(row, col)
                            )}
                          </div>
                          {!isEditing && (col.dataType === 'SELECT_ONE' || col.dataType === 'SELECT_MULTI' || col.dataType === 'USER' || col.dataType === 'DATE') && (
                            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 opacity-0 group-hover/row:opacity-100" />
                          )}
                        </td>
                      )
                    })}
                    <td className="border-b border-slate-200 dark:border-slate-800" />
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <button onClick={handleAddRow} disabled={addRowMut.isPending} className="w-full py-3 text-sm font-bold text-slate-500 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-t border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2">
          <Plus size={16} /> Thêm hàng mới
        </button>
      </div>

      {/* Add Column Modal */}
      {showAddCol && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowAddCol(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-[24px] shadow-2xl w-full max-w-md mx-4 p-8 border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-black mb-6">Tạo cột mới</h3>
            <div className="space-y-5">
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-400 mb-2">Tên cột <span className="text-red-500">*</span></label>
                <input value={newColName} onChange={e => setNewColName(e.target.value)} placeholder="Nhập tên cột..." className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-indigo-500 text-sm font-medium" autoFocus />
              </div>
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-400 mb-2">Loại dữ liệu</label>
                <div className="grid grid-cols-2 gap-2 h-40 overflow-y-auto pr-1">
                  {DATA_TYPE_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setNewColType(opt.value)} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-bold transition-all ${newColType === opt.value ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/30' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'}`}>
                      <div className={`p-1.5 rounded-lg ${newColType === opt.value ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'bg-slate-100 dark:bg-slate-800'}`}>{opt.icon}</div>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Option Builder for Select Types */}
              {(newColType === 'SELECT_ONE' || newColType === 'SELECT_MULTI') && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <label className="block text-[11px] font-black uppercase text-slate-400 mb-3 flex justify-between">Tùy chọn Option <span>{newColOptions.length}</span></label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {newColOptions.map(opt => (
                      <div key={opt.id} className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold text-white shadow-sm" style={{ backgroundColor: opt.color }}>
                        {opt.label}
                        <X size={10} className="cursor-pointer hover:scale-125 transition-transform" onClick={() => setNewColOptions(prev => prev.filter(p => p.id !== opt.id))} />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      id="opt-draft"
                      placeholder="Nhập tên tag..." 
                      className="flex-1 bg-white dark:bg-slate-900 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-500"
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
                    <button 
                      onClick={() => {
                        const input = document.getElementById('opt-draft') as HTMLInputElement
                        const val = input.value.trim()
                        if (val) {
                          setNewColOptions(p => [...p, { id: generateId(), label: val, color: COLORS[p.length % COLORS.length] || '#ef4444' }])
                          input.value = ''
                        }
                      }}
                      className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold shrink-0 hover:bg-slate-800"
                    >Thêm</button>
                  </div>
                </div>
              )}

              {/* Settings for User */}
              {newColType === 'USER' && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between cursor-pointer" onClick={() => setNewColIsMultiUser(!newColIsMultiUser)}>
                  <div>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-200">Cho phép chọn nhiều</div>
                    <div className="text-xs text-slate-500 font-medium">Bật nếu một ô có thuộc tính nhiều nhân sự</div>
                  </div>
                  <div className={`w-10 h-6 rounded-full p-1 transition-colors ${newColIsMultiUser ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${newColIsMultiUser ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowAddCol(false)} className="flex-1 py-3 text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800">Hủy bỏ</button>
              <button onClick={handleAddColumn} disabled={!newColName.trim() || addColumnMut.isPending} className="flex-[2] py-3 text-sm font-bold rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-50">Tạo Cột</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
