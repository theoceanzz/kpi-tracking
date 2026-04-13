import { useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import DepartmentCard from '../components/DepartmentCard'
import DepartmentFormModal from '../components/DepartmentFormModal'
import { useDepartments } from '../hooks/useDepartments'
import { Plus } from 'lucide-react'

export default function DepartmentsPage() {
  const { data, isLoading } = useDepartments()
  const [showForm, setShowForm] = useState(false)
  const departments = data?.content ?? []

  return (
    <div>
      <PageHeader
        title="Quản lý phòng ban"
        description="Tổ chức cấu trúc phòng ban trong công ty"
        action={
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition">
            <Plus size={16} /> Tạo phòng ban
          </button>
        }
      />

      {isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : departments.length === 0 ? (
        <EmptyState title="Chưa có phòng ban" description="Hãy tạo phòng ban đầu tiên để bắt đầu quản lý nhân sự." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept) => (
            <DepartmentCard key={dept.id} department={dept} />
          ))}
        </div>
      )}

      <DepartmentFormModal open={showForm} onClose={() => setShowForm(false)} />
    </div>
  )
}
