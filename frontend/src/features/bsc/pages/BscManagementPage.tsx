import { useState, useRef } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useBscPerspectives, useBscMutations } from '../hooks/useBsc'
import { useSidebarSettings } from '@/features/organization/hooks/useSidebarSettings'
import { Plus, Layers, Edit2, Trash2, GripVertical, FileUp } from 'lucide-react'
import { PerspectiveResponse, BscPerspectiveStatus } from '../types'
import PerspectiveFormModal from '../components/PerspectiveFormModal'
import ImportBscGuideModal from '../components/ImportBscGuideModal'
import ConfirmDialog from '@/components/common/ConfirmDialog'

export default function BscManagementPage() {
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: perspectives, isLoading } = useBscPerspectives(organizationId)
  const { deletePerspective, importPerspectives } = useBscMutations()

  const { data: customLabels = {} } = useSidebarSettings(organizationId!)
  const pageTitle = (customLabels as Record<string, string>)['/bsc'] || 'Thẻ điểm cân bằng (BSC)'

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selected, setSelected] = useState<PerspectiveResponse | undefined>()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isImportGuideOpen, setIsImportGuideOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && organizationId) {
      importPerspectives.mutate({ organizationId, file })
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleAdd = () => {
    setSelected(undefined)
    setIsModalOpen(true)
  }

  const handleEdit = (p: PerspectiveResponse) => {
    setSelected(p)
    setIsModalOpen(true)
  }

  if (isLoading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Layers className="text-indigo-600" size={32} />
            {pageTitle}
          </h1>
          <p className="text-slate-500 font-medium mt-1">Cấu hình các viễn cảnh chiến lược để nhóm chỉ tiêu KPI</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="file" className="hidden" ref={fileInputRef} accept=".xlsx" onChange={handleImport} />
          <button
            onClick={() => setIsImportGuideOpen(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95"
          >
            <FileUp size={20} />
            Import Excel
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
          >
            <Plus size={20} />
            Viễn cảnh mới
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {perspectives?.map(p => (
          <div
            key={p.id}
            className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4 transition-all hover:shadow-lg hover:shadow-indigo-500/5"
          >
            <GripVertical size={18} className="text-slate-300 shrink-0" />
            <div
              className="w-3 h-10 rounded-full shrink-0"
              style={{ backgroundColor: p.color || '#94a3b8' }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-md uppercase">
                  {p.code}
                </span>
                {p.status === BscPerspectiveStatus.INACTIVE && (
                  <span className="text-[10px] font-black text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md uppercase">Tạm ẩn</span>
                )}
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">{p.name}</h3>
              {p.description && <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{p.description}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => handleEdit(p)} className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all">
                <Edit2 size={18} />
              </button>
              <button onClick={() => setDeleteId(p.id)} className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}

        {(!perspectives || perspectives.length === 0) && (
          <div className="flex flex-col items-center justify-center p-20 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 mb-4">
              <Layers size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Chưa có viễn cảnh nào</h3>
            <p className="text-slate-500 max-w-sm mt-2">Hãy tạo các viễn cảnh BSC (Tài chính, Khách hàng, Quy trình nội bộ, Học hỏi & phát triển) cho tổ chức.</p>
          </div>
        )}
      </div>

      <PerspectiveFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        organizationId={organizationId || ''}
        perspective={selected}
      />

      <ImportBscGuideModal
        open={isImportGuideOpen}
        onClose={() => setIsImportGuideOpen(false)}
        onSelectFile={() => fileInputRef.current?.click()}
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deletePerspective.mutate(deleteId)
          setDeleteId(null)
        }}
        title="Xóa viễn cảnh"
        description="Bạn có chắc chắn muốn xóa viễn cảnh này? Các KPI đang gán vào viễn cảnh sẽ được gỡ liên kết."
        confirmLabel="Xóa"
        loading={deletePerspective.isPending}
      />
    </div>
  )
}
