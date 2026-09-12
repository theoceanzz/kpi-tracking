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
    <div className="bg-[var(--color-card)] rounded-card shadow-sm border p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <h2 className="text-section-title whitespace-nowrap">Danh sách tổ chức</h2>
        <div className="relative w-full sm:w-auto">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--color-subtle-foreground)]" />
          <input
            type="text"
            placeholder="Tìm kiếm..."
            className="pl-9 pr-4 py-2 border rounded-control focus:ring-2 focus:ring-[var(--color-info-solid)] outline-none text-sm w-full sm:w-auto"
          />
        </div>
      </div>
      
      {data.length === 0 ? (
        <div className="border rounded-control px-4 py-8 text-center text-[var(--color-muted-foreground)]">
          Chưa có dữ liệu
        </div>
      ) : (
        <>
          <div className="hidden md:block border rounded-control overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[var(--color-muted)] border-b">
                <tr>
                  <th className="px-4 py-3 font-medium text-[var(--color-muted-foreground)]">Tên</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-muted-foreground)]">Mã</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-muted-foreground)]">Phân loại</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-muted-foreground)]">Cấp bậc</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-muted-foreground)]">Trạng thái</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-muted-foreground)] text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
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

          <div className="md:hidden border rounded-control divide-y">
            {data.map(node => (
              <TreeNodeCard
                key={node.id}
                node={node}
                level={0}
                onAddChild={onAddChild}
                onEdit={onEdit}
                onDelete={onDelete}
                maxDepth={maxDepth}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

import { useRef } from 'react'
import { Button } from '@/components/ui/button'

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
      <tr className="border-b hover:bg-[var(--color-muted)] transition-colors group relative hover:z-20">
        <td className="px-4 py-3">
          <div className="flex items-center" style={{ paddingLeft: `${level * 24}px` }}>
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className={`mr-2 p-0.5 rounded hover:bg-gray-200 text-gray-500 transition-colors ${hasChildren ? '' : 'invisible'}`}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            <span 
              className="font-medium text-[var(--color-info)] hover:underline cursor-pointer"
              onClick={() => navigate(`/org-units/${node.id}`)}
            >
              {node.name}
            </span>
          </div>
        </td>
        <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
          <code className="text-xs font-mono bg-[var(--color-muted)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">{node.code || '—'}</code>
        </td>
        <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
          <span className="text-eyebrow px-2.5 py-1 bg-[var(--color-muted)] text-[var(--color-foreground)] rounded-control">{node.type}</span>
        </td>
        <td className="px-4 py-3 text-[var(--color-muted-foreground)]">Level {node.level}</td>
        <td className="px-4 py-3">
          <span className="px-2 py-1 bg-[var(--color-success-bg)] text-[var(--color-success)] rounded-control text-xs font-medium">HOẠT ĐỘNG</span>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end">
            <div className="relative inline-block text-left group/menu" ref={menuRef} onMouseEnter={handleMouseEnter} onFocus={handleMouseEnter}>
              <button className="p-1.5 hover:bg-[var(--color-card)] hover:shadow-sm border border-transparent hover:border-[var(--color-border)] rounded-control text-[var(--color-subtle-foreground)] hover:text-[var(--color-muted-foreground)] transition-all">
                <MoreVertical className="w-4 h-4" />
              </button>
              
              {/* Transparent bridge to prevent losing hover state */}
              <div className="absolute right-0 h-2 w-10 -bottom-2 bg-transparent hidden group-hover/menu:block" />

              {/* Dropdown menu */}
              <div className={`absolute right-0 w-40 ${openUp ? 'bottom-full mb-1.5 origin-bottom-right' : 'top-full mt-1.5 origin-top-right'} bg-white border border-gray-200 rounded-card shadow-xl hidden group-hover/menu:block z-[110] animate-in fade-in zoom-in-95 duration-100`}>
                <div className="py-2 text-left">
                  {canAddChild && (
                    <Button variant="ghost" className="w-full" onClick={() => onAddChild(node.id, node.name, node.level)}>
                      <Plus aria-hidden="true" className="w-4 h-4 mr-2 text-[var(--color-info)]" /> Thêm con
                    </Button>
                  )}
                  <Button variant="ghost" className="w-full" onClick={() => onEdit(node)}>
                    <Edit2 aria-hidden="true" className="w-4 h-4 mr-2 text-[var(--color-warning)]" /> Sửa
                  </Button>
                  <div className="h-px bg-[var(--color-muted)] my-1" />
                  <button 
                    onClick={() => onDelete(node.id)}
                    disabled={hasChildren}
                    className={`flex items-center w-full px-4 py-2 text-sm transition-colors ${!hasChildren ? 'text-[var(--color-error)] hover:bg-[var(--color-error-bg)]' : 'text-[var(--color-subtle-foreground)] cursor-not-allowed'}`}
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

function TreeNodeCard({
  node, level, onAddChild, onEdit, onDelete, maxDepth
}: {
  node: OrgUnitTreeResponse
  level: number
  onAddChild: (id: string, name: string, level: number) => void
  onEdit: (node: OrgUnitTreeResponse) => void
  onDelete: (id: string) => void
  maxDepth: number
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const navigate = useNavigate()
  const hasChildren = node.children && node.children.length > 0
  const canAddChild = node.level < maxDepth

  return (
    <>
      <div className="p-3" style={{ paddingLeft: `${12 + level * 20}px` }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`p-0.5 rounded hover:bg-gray-200 text-gray-500 transition-colors shrink-0 ${hasChildren ? '' : 'invisible'}`}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            <div className="min-w-0 flex-1">
              <span
                className="font-medium text-[var(--color-info)] hover:underline cursor-pointer block truncate"
                onClick={() => navigate(`/org-units/${node.id}`)}
              >
                {node.name}
              </span>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <code className="text-xs font-mono bg-[var(--color-muted)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">{node.code || '—'}</code>
                <span className="text-eyebrow px-2 py-0.5 bg-[var(--color-muted)] text-[var(--color-foreground)] rounded">{node.type}</span>
                <span className="text-caption">Level {node.level}</span>
                <span className="px-2 py-0.5 bg-[var(--color-success-bg)] text-[var(--color-success)] rounded text-xs font-medium">HOẠT ĐỘNG</span>
              </div>
            </div>
          </div>
          <div className="relative shrink-0">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-1.5 hover:bg-[var(--color-card)] hover:shadow-sm border border-transparent hover:border-[var(--color-border)] rounded-control text-[var(--color-subtle-foreground)] hover:text-[var(--color-muted-foreground)] transition-all"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-[100]" onClick={() => setIsMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1.5 w-40 bg-[var(--color-card)] border border-[var(--color-border)] rounded-card shadow-xl z-[110] animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                  <div className="py-2 text-left">
                    {canAddChild && (
                      <Button variant="ghost" className="w-full" onClick={() => { setIsMenuOpen(false); onAddChild(node.id, node.name, node.level) }}>
                        <Plus aria-hidden="true" className="w-4 h-4 mr-2 text-[var(--color-info)]" /> Thêm con
                      </Button>
                    )}
                    <Button variant="ghost" className="w-full" onClick={() => { setIsMenuOpen(false); onEdit(node) }}>
                      <Edit2 aria-hidden="true" className="w-4 h-4 mr-2 text-[var(--color-warning)]" /> Sửa
                    </Button>
                    <div className="h-px bg-[var(--color-muted)] my-1" />
                    <button
                      onClick={() => { setIsMenuOpen(false); onDelete(node.id) }}
                      disabled={hasChildren}
                      className={`flex items-center w-full px-4 py-2 text-sm transition-colors ${!hasChildren ? 'text-[var(--color-error)] hover:bg-[var(--color-error-bg)]' : 'text-[var(--color-subtle-foreground)] cursor-not-allowed'}`}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Xoá
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {isExpanded && node.children?.map(child => (
        <TreeNodeCard
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
