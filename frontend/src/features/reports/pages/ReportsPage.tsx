import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, Plus, Search, MoreVertical, Trash2, Edit, FileBarChart } from 'lucide-react'
import { useReports } from '../hooks/useReports'
import { useCreateReport, useDeleteReport } from '../hooks/useReportMutations'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Nháp', color: 'text-amber-500 bg-amber-500/10' },
  PUBLISHED: { label: 'Đã xuất bản', color: 'text-emerald-500 bg-emerald-500/10' },
  ARCHIVED: { label: 'Lưu trữ', color: 'text-gray-500 bg-gray-500/10' },
}

export default function ReportsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const { data, isLoading } = useReports({ page, size: 20 })
  const createMutation = useCreateReport()
  const deleteMutation = useDeleteReport()

  const filtered = data?.content?.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  ) || []

  const handleCreate = () => {
    if (!newName.trim()) return
    createMutation.mutate({ name: newName, description: newDesc || undefined }, {
      onSuccess: (report) => { setShowCreate(false); setNewName(''); setNewDesc(''); navigate(`/reports/${report.id}`) }
    })
  }

  const handleDelete = (id: string) => {
    if (confirm('Bạn có chắc muốn xóa báo cáo này?')) {
      deleteMutation.mutate(id)
      setMenuOpen(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="text-[var(--color-primary)]" size={28} />
            Báo cáo thống kê
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)] mt-1">
            Tạo dashboard với biểu đồ từ các nguồn dữ liệu đã tạo.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-all shadow-sm font-medium text-sm"
        >
          <Plus size={18} /> Tạo báo cáo
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
        <input
          type="text"
          placeholder="Tìm kiếm báo cáo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-40 rounded-xl bg-[var(--color-accent)] animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-muted-foreground)]">
          <FileBarChart size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Chưa có báo cáo nào</p>
          <p className="text-sm mt-1">Tạo báo cáo đầu tiên để bắt đầu phân tích dữ liệu</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(report => (
            <div
              key={report.id}
              onClick={() => navigate(`/reports/${report.id}`)}
              className="relative group bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5 cursor-pointer hover:border-[var(--color-primary)]/50 hover:shadow-lg hover:shadow-[var(--color-primary)]/5 transition-all duration-200"
            >
              {/* Menu */}
              <div className="absolute top-3 right-3" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setMenuOpen(menuOpen === report.id ? null : report.id)}
                  className="p-1.5 rounded-lg hover:bg-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical size={16} className="text-[var(--color-muted-foreground)]" />
                </button>
                {menuOpen === report.id && (
                  <div className="absolute right-0 top-8 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                    <button
                      onClick={() => { navigate(`/reports/${report.id}`); setMenuOpen(null) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-accent)]"
                    >
                      <Edit size={14} /> Chỉnh sửa
                    </button>
                    <button
                      onClick={() => handleDelete(report.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 size={14} /> Xóa
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center shrink-0">
                  <BarChart3 size={18} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate group-hover:text-[var(--color-primary)] transition-colors">{report.name}</h3>
                  {report.description && (
                    <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5 truncate">{report.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4 text-xs text-[var(--color-muted-foreground)]">
                <span>{report.datasources?.length || 0} nguồn dữ liệu</span>
                <span>·</span>
                <span>{report.widgets?.length || 0} biểu đồ</span>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border)]">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_LABELS[report.status]?.color || ''}`}>
                  {STATUS_LABELS[report.status]?.label || report.status}
                </span>
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {new Date(report.createdAt).toLocaleDateString('vi-VN')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] disabled:opacity-40 hover:bg-[var(--color-accent)]">Trước</button>
          <span className="text-sm text-[var(--color-muted-foreground)]">{page + 1} / {data.totalPages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={data.last} className="px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] disabled:opacity-40 hover:bg-[var(--color-accent)]">Sau</button>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="bg-[var(--color-card)] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Tạo Báo cáo mới</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Tên báo cáo <span className="text-red-500">*</span></label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="VD: Báo cáo doanh thu Q1" className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Mô tả</label>
                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Mô tả ngắn gọn..." rows={3} className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-accent)]">Hủy</button>
              <button onClick={handleCreate} disabled={!newName.trim() || createMutation.isPending} className="px-4 py-2 text-sm rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 font-medium">{createMutation.isPending ? 'Đang tạo...' : 'Tạo'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
