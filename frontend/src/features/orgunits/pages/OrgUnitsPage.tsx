import { useOrgUnitTree } from '../hooks/useOrgUnitTree'
import { Link } from 'react-router-dom'
import { Building2, ChevronRight, Share2, Plus } from 'lucide-react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'

// A simple recursive component to render the tree
function OrgUnitNode({ node, level = 0 }: { node: any; level?: number }) {
  return (
    <div className="flex flex-col">
      <div 
        className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        style={{ paddingLeft: `${(level + 1) * 1.5}rem` }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
            {node.children && node.children.length > 0 ? <Share2 size={14} /> : <Building2 size={14} />}
          </div>
          <Link to={`/org-units/${node.id}`} className="font-bold text-sm hover:text-indigo-600 transition-colors">
            {node.name}
          </Link>
          <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {node.unitCode}
          </span>
        </div>
        <div className="flex items-center gap-2">
           <Link to={`/org-units/${node.id}`} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors">
             <ChevronRight size={16} />
           </Link>
        </div>
      </div>
      
      {node.children && node.children.length > 0 && (
        <div className="flex flex-col relative before:absolute before:left-[2.2rem] before:top-0 before:bottom-0 before:w-px before:bg-slate-200 dark:before:bg-slate-800" style={{ marginLeft: `${level * 1.5}rem`}}>
          {node.children.map((child: any) => (
            <OrgUnitNode key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function OrgUnitsPage() {
  const { data: treeData, isLoading } = useOrgUnitTree()

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Cơ cấu Tổ chức</h1>
          <p className="text-slate-500 mt-1">Quản lý sơ đồ đơn vị, phòng ban và chi nhánh</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm">
          <Plus size={16} /> Thêm Đơn vị
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6"><LoadingSkeleton rows={5} /></div>
        ) : treeData && treeData.length > 0 ? (
          <div className="flex flex-col">
            {treeData.map(node => (
              <OrgUnitNode key={node.id} node={node} />
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-slate-500">
            <Building2 size={48} className="mx-auto mb-4 text-slate-300" />
            <p className="font-bold">Chưa có dữ liệu cơ cấu tổ chức</p>
          </div>
        )}
      </div>
    </div>
  )
}
