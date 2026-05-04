import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Database, Plus, Search, MoreVertical, Trash2, Edit, Table2, BarChart3 } from 'lucide-react'
import { useDatasources } from '../hooks/useDatasources'
import { useCreateDatasource, useDeleteDatasource } from '../hooks/useDatasourceMutations'
import type { Datasource } from '@/types/datasource'

export default function DatasourcesPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const { data, isLoading } = useDatasources({ page, size: 20 })
  const createMutation = useCreateDatasource()
  const deleteMutation = useDeleteDatasource()

  const filtered = data?.content?.filter(ds =>
    ds.name.toLowerCase().includes(search.toLowerCase())
  ) || []

  const handleCreate = () => {
    if (!newName.trim()) return
    createMutation.mutate({ name: newName, description: newDesc || undefined }, {
      onSuccess: () => { setShowCreate(false); setNewName(''); setNewDesc('') }
    })
  }

  const handleDelete = (id: string) => {
    if (confirm('Bạn có chắc muốn xóa datasource này?')) {
      deleteMutation.mutate(id)
      setMenuOpen(null)
    }
  }

  const getTypeIcon = (ds: Datasource) => {
    const colCount = ds.columns?.length || 0
    if (colCount === 0) return <Table2 size={18} className="text-indigo-400" />
    return <Database size={18} className="text-emerald-400" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="text-[var(--color-primary)]" size={28} />
            Nguồn dữ liệu
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)] mt-1">
            Tạo và quản lý bảng dữ liệu như Excel. Dữ liệu dùng cho báo cáo thống kê.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-all shadow-sm font-medium text-sm"
        >
          <Plus size={18} /> Tạo mới
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
        <input
          type="text"
          placeholder="Tìm kiếm datasource..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-[var(--color-accent)] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-muted-foreground)]">
          <Database size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Chưa có datasource nào</p>
          <p className="text-sm mt-1">Tạo datasource đầu tiên để bắt đầu nhập liệu</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(ds => (
            <div
              key={ds.id}
              onClick={() => navigate(`/datasources/${ds.id}`)}
              className="relative group bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5 cursor-pointer hover:border-[var(--color-primary)]/50 hover:shadow-lg hover:shadow-[var(--color-primary)]/5 transition-all duration-200"
            >
              {/* Menu */}
              <div className="absolute top-3 right-3" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setMenuOpen(menuOpen === ds.id ? null : ds.id)}
                  className="p-1.5 rounded-lg hover:bg-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical size={16} className="text-[var(--color-muted-foreground)]" />
                </button>
                {menuOpen === ds.id && (
                  <div className="absolute right-0 top-8 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                    <button
                      onClick={() => { navigate(`/datasources/${ds.id}`); setMenuOpen(null) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-accent)] transition-colors"
                    >
                      <Edit size={14} /> Chỉnh sửa
                    </button>
                    <button
                      onClick={() => handleDelete(ds.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 size={14} /> Xóa
                    </button>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--color-accent)] flex items-center justify-center shrink-0">
                  {ds.icon ? <span className="text-lg">{ds.icon}</span> : getTypeIcon(ds)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate group-hover:text-[var(--color-primary)] transition-colors">{ds.name}</h3>
                  {ds.description && (
                    <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5 truncate">{ds.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 mt-4 text-xs text-[var(--color-muted-foreground)]">
                <span className="flex items-center gap-1">
                  <Table2 size={12} /> {ds.columns?.length || 0} cột
                </span>
                <span className="flex items-center gap-1">
                  <BarChart3 size={12} /> {ds.rowCount} hàng
                </span>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border)]">
                <span className="text-xs text-[var(--color-muted-foreground)]">{ds.orgUnitName}</span>
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {new Date(ds.createdAt).toLocaleDateString('vi-VN')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] disabled:opacity-40 hover:bg-[var(--color-accent)] transition-colors"
          >Trước</button>
          <span className="text-sm text-[var(--color-muted-foreground)]">
            {page + 1} / {data.totalPages}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={data.last}
            className="px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] disabled:opacity-40 hover:bg-[var(--color-accent)] transition-colors"
          >Sau</button>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="bg-[var(--color-card)] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Tạo Datasource mới</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Tên datasource <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="VD: Doanh thu Q1 2026"
                  className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Mô tả</label>
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Mô tả ngắn gọn..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-accent)] transition-colors">Hủy</button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || createMutation.isPending}
                className="px-4 py-2 text-sm rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-all font-medium"
              >
                {createMutation.isPending ? 'Đang tạo...' : 'Tạo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
