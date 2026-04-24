import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  totalElements: number
  size: number
}

export default function Pagination({ currentPage, totalPages, onPageChange, totalElements, size }: PaginationProps) {
  const start = totalElements === 0 ? 0 : currentPage * size + 1
  const end = Math.min((currentPage + 1) * size, totalElements)

  const pages = []
  const delta = 2
  for (let i = 0; i < totalPages; i++) {
    if (i === 0 || i === totalPages - 1 || (i >= currentPage - delta && i <= currentPage + delta)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== -1) {
      pages.push(-1)
    }
  }

  const btnCls = "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all border border-transparent"
  const activeCls = "bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/20"
  const inactiveCls = "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
  const disabledCls = "text-slate-300 dark:text-slate-700 cursor-not-allowed"

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 dark:border-slate-800">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
        Hiển thị <span className="text-slate-900 dark:text-white">{start} - {end}</span> trong <span className="text-slate-900 dark:text-white">{totalElements}</span> nhân sự
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(0)}
            disabled={currentPage === 0}
            className={`${btnCls} ${currentPage === 0 ? disabledCls : inactiveCls}`}
          >
            <ChevronsLeft size={18} />
          </button>
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 0}
            className={`${btnCls} ${currentPage === 0 ? disabledCls : inactiveCls}`}
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex items-center mx-2 gap-1">
            {pages.map((p, idx) => p === -1 ? (
              <span key={`gap-${idx}`} className="w-10 text-center text-slate-300">...</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`${btnCls} ${currentPage === p ? activeCls : inactiveCls}`}
              >
                {p + 1}
              </button>
            ))}
          </div>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages - 1}
            className={`${btnCls} ${currentPage === totalPages - 1 ? disabledCls : inactiveCls}`}
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => onPageChange(totalPages - 1)}
            disabled={currentPage === totalPages - 1}
            className={`${btnCls} ${currentPage === totalPages - 1 ? disabledCls : inactiveCls}`}
          >
            <ChevronsRight size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
