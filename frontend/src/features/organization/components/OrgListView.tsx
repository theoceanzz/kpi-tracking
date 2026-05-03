import { Search, ChevronRight, ChevronDown, MoreVertical, Plus, Edit2, Trash2 } from 'lucide-react'
import type { OrgUnitTreeResponse } from '../types/org-unit'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface OrgListViewProps {
  data: OrgUnitTreeResponse[]
  onAddChild: (id: string, name: string, level: number) => void
  onEdit: (node: OrgUnitTreeResponse) => void
  onDelete: (id: string) => void
  maxDepth: number
}

export function OrgListView({ data, onAddChild, onEdit, onDelete, maxDepth }: OrgListViewProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Danh sách tổ chức</h2>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Tìm kiếm..." 
            className="pl-9 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
        </div>
      </div>
      
      <div className="border rounded-md">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600">Tên</th>
              <th className="px-4 py-3 font-medium text-gray-600">Mã</th>
              <th className="px-4 py-3 font-medium text-gray-600">Phân loại</th>
              <th className="px-4 py-3 font-medium text-gray-600">Cấp bậc</th>
              <th className="px-4 py-3 font-medium text-gray-600">Trạng thái</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Chưa có dữ liệu
                </td>
              </tr>
            )}
            {data.map(node => (
              <TreeNodeRow 
                key={node.id} 
                node={node} 
                level={0} 
                onAddChild={onAddChild}
                onEdit={onEdit}
                onDelete={onDelete}
                maxDepth={maxDepth}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

import { useRef } from 'react'

function TreeNodeRow({ 
  node, 
  level, 
  onAddChild, 
  onEdit, 
  onDelete, 
  maxDepth 
}: { 
  node: OrgUnitTreeResponse; 
  level: number;
  onAddChild: (id: string, name: string, level: number) => void
  onEdit: (node: OrgUnitTreeResponse) => void
  onDelete: (id: string) => void
  maxDepth: number
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [openUp, setOpenUp] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const hasChildren = node.children && node.children.length > 0
  const canAddChild = node.level < maxDepth

  const handleMouseEnter = () => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setOpenUp(spaceBelow < 160) // Adjust threshold as needed
    }
  }

  return (
    <>
      <tr className="border-b hover:bg-gray-50/50 transition-colors group relative hover:z-10">
        <td className="px-4 py-3">
          <div className="flex items-center" style={{ paddingLeft: `${level * 24}px` }}>
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className={`mr-2 p-0.5 rounded hover:bg-gray-200 text-gray-500 transition-colors ${hasChildren ? '' : 'invisible'}`}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            <span 
              className="font-medium text-blue-600 hover:underline cursor-pointer"
              onClick={() => navigate(`/org-units/${node.id}`)}
            >
              {node.name}
            </span>
          </div>
        </td>
        <td className="px-4 py-3 text-gray-600">
          <code className="text-xs font-mono bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">{node.code || '—'}</code>
        </td>
        <td className="px-4 py-3 text-gray-600">
          <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-[10px] font-bold uppercase tracking-wider">{node.type}</span>
        </td>
        <td className="px-4 py-3 text-gray-600">Level {node.level}</td>
        <td className="px-4 py-3">
          <span className="px-2 py-1 bg-green-50 text-green-700 rounded-md text-[10px] font-bold">HOẠT ĐỘNG</span>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end">
            <div className="relative inline-block text-left group/menu" ref={menuRef} onMouseEnter={handleMouseEnter} onFocus={handleMouseEnter}>
              <button className="p-1.5 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 rounded-lg text-gray-400 hover:text-gray-600 transition-all">
                <MoreVertical className="w-4 h-4" />
              </button>
              
              {/* Transparent bridge to prevent losing hover state */}
              <div className="absolute right-0 h-2 w-10 -bottom-2 bg-transparent hidden group-hover/menu:block" />

              {/* Dropdown menu */}
              <div className={`absolute right-0 w-40 ${openUp ? 'bottom-full mb-1.5 origin-bottom-right' : 'top-full mt-1.5 origin-top-right'} bg-white border border-gray-200 rounded-xl shadow-xl hidden group-hover/menu:block z-[110] animate-in fade-in zoom-in-95 duration-100`}>
                <div className="py-2 text-left">
                  {canAddChild && (
                    <button 
                      onClick={() => onAddChild(node.id, node.name, node.level)}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                    >
                      <Plus className="w-4 h-4 mr-2 text-blue-500" /> Thêm con
                    </button>
                  )}
                  <button 
                    onClick={() => onEdit(node)}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                  >
                    <Edit2 className="w-4 h-4 mr-2 text-amber-500" /> Sửa
                  </button>
                  <div className="h-px bg-gray-100 my-1" />
                  <button 
                    onClick={() => onDelete(node.id)}
                    disabled={hasChildren}
                    className={`flex items-center w-full px-4 py-2 text-sm transition-colors ${!hasChildren ? 'text-red-600 hover:bg-red-50' : 'text-gray-300 cursor-not-allowed'}`}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Xoá
                  </button>
                </div>
              </div>
            </div>
          </div>
        </td>
      </tr>
      {isExpanded && node.children?.map(child => (
        <TreeNodeRow 
          key={child.id} 
          node={child} 
          level={level + 1} 
          onAddChild={onAddChild}
          onEdit={onEdit}
          onDelete={onDelete}
          maxDepth={maxDepth}
        />
      ))}
    </>
  )
}
