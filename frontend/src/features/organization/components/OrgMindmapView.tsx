import { useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Panel,
  BaseEdge,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type NodeTypes,
  type EdgeProps,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { OrgUnitTreeResponse } from '../types/org-unit';
import { MoreVertical, Plus, Edit2, Trash2 } from 'lucide-react';
import { RELATION_EDGE_STYLE, flattenOrgTree, layoutOrgChart, orthogonalRoute, relationOf, toSvgPath, type RoutePoint } from './orgChartLayout';
import type { OrgUnitRelationType } from '../types/org-unit';

type CustomNodeData = {
  id: string;
  name: string;
  code?: string;
  type: string;
  /** Quan hệ với đơn vị cha — tham mưu/giám sát thay nhãn cấp trên ô bằng nhãn quan hệ. */
  relation: OrgUnitRelationType;
  level: number;
  hasChildren: boolean;
  onAddChild: (id: string, name: string, level: number) => void;
  onEdit: (node: OrgUnitTreeResponse) => void;
  onDelete: (id: string) => void;
  maxDepth: number;
  node: OrgUnitTreeResponse;
};

type AppNode = Node<CustomNodeData, 'custom'>;

import { useNavigate } from 'react-router-dom';

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next'

function CustomNode({ data }: NodeProps<AppNode>) {
  const { t } = useTranslation('organization')
  const canAddChild = data.level < data.maxDepth;
  const navigate = useNavigate();
  const [openUp, setOpenUp] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const spaceBelow = windowHeight - rect.bottom;
      setOpenUp(spaceBelow < 160);
    }
  };

  return (
    <div 
      className="px-4 py-3 shadow-md rounded-control bg-[var(--color-card)] border border-[var(--color-border)] w-[220px] relative group hover:border-[var(--color-info-border)] hover:shadow-lg transition-all cursor-pointer z-0 hover:z-[1000]"
      onClick={() => {
        if (isMenuOpen) {
          setIsMenuOpen(false);
        } else {
          navigate(`/org-units/${data.id}`);
        }
      }}
    >
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-gray-400" />
      
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0 pr-6">
          {/* Trực tuyến: nhãn theo cấp như cũ. Tham mưu / giám sát: nhãn quan hệ — loại đơn vị hiện đặt
              theo cấp (mọi đơn vị cùng cấp chung một tên) nên "Bộ môn" trên Hội đồng Khoa học là sai. */}
          <div className="text-eyebrow text-[var(--color-info)] mb-0.5">
            {data.relation === 'DIRECT' ? data.type : t(`OrgMindmapView.nodeLabel.${data.relation}`)}
          </div>
          <div className="text-sm font-medium text-[var(--color-foreground)] truncate">{data.name}</div>
          {data.code && (
            <div className="text-xs font-mono text-[var(--color-subtle-foreground)] mt-0.5 truncate bg-[var(--color-muted)] px-1.5 py-0.5 rounded border border-[var(--color-border)] w-fit">
              {data.code}
            </div>
          )}
        </div>

        {/* Action Menu */}
        <div className="absolute top-2 right-2 flex z-[100]">
          <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()} ref={menuRef}>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleMouseEnter(); // Calculate openUp direction
                setIsMenuOpen(!isMenuOpen);
              }}
              className={`p-1.5 rounded-control transition-all duration-200 border shadow-sm ${
                isMenuOpen 
                  ? 'bg-[var(--color-info-solid)] border-[var(--color-info-border)] text-white scale-110' 
                  : 'bg-[var(--color-card)] border-[var(--color-border)] text-[var(--color-subtle-foreground)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-muted-foreground)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-card)]'
              }`}
              title={t('OrgMindmapView.actions')}
            >
              <MoreVertical className={`w-4 h-4 transition-transform duration-300 ${isMenuOpen ? 'rotate-90' : ''}`} />
            </button>
            
            {isMenuOpen && (
              <div className={`absolute right-0 w-40 ${openUp ? 'bottom-full mb-2 origin-bottom-right' : 'top-full mt-2 origin-top-right'} bg-white border border-gray-200 rounded-card shadow-2xl z-[110] animate-in fade-in zoom-in-95 duration-200 ring-1 ring-black/5`}>
                  <div className="py-2">
                    {canAddChild && (
                      <button type="button" className="flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[var(--color-muted-foreground)]" onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); data.onAddChild(data.id, data.name, data.level); }}>
                        <Plus aria-hidden="true" className="w-4 h-4 mr-2.5 text-[var(--color-info)] group-hover/item:scale-110 transition-transform" /> 
                        <span className="font-medium">{t('OrgMindmapView.addChild')}</span>
                      </button>
                    )}
                    <button type="button" className="flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[var(--color-muted-foreground)]" onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); data.onEdit(data.node); }}>
                      <Edit2 aria-hidden="true" className="w-4 h-4 mr-2.5 text-[var(--color-warning)] group-hover/item:scale-110 transition-transform" /> 
                      <span className="font-medium">{t('OrgMindmapView.edit')}</span>
                    </button>
                    <div className="h-px bg-[var(--color-muted)] my-1 mx-2" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); data.onDelete(data.id); }}
                      disabled={data.hasChildren}
                      className={`flex items-center w-full px-4 py-2.5 text-sm text-left transition-colors group/item ${!data.hasChildren ? 'text-[var(--color-error)] hover:bg-[var(--color-error-bg)]' : 'text-[var(--color-subtle-foreground)] cursor-not-allowed'}`}
                    >
                      <Trash2 className={`w-4 h-4 mr-2.5 ${!data.hasChildren ? 'group-hover/item:scale-110 transition-transform' : ''}`} /> 
                      <span className="font-medium">{t('OrgMindmapView.delete')}</span>
                    </button>
                  </div>
                </div>
            )}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-gray-400" />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

/**
 * Cạnh của sơ đồ khi có nhánh tham mưu/giám sát: đi theo làn dagre chừa trong cột nửa cấp (xem
 * `orthogonalRoute`) thay vì `smoothstep` — smoothstep bẻ góc giữa đoạn, chui qua các ô nhánh bên.
 */
function OrgRouteEdge({ sourceX, sourceY, targetX, targetY, data, style, markerEnd }: EdgeProps) {
  const d = data as { relation?: OrgUnitRelationType; via?: RoutePoint[] } | undefined;
  // Cạnh nhánh bên bẻ góc muộn hơn để đường dọc của nó không trùng đường dọc trực tuyến.
  const bendAt = d?.relation && d.relation !== 'DIRECT' ? 0.75 : 0.5;
  const path = toSvgPath(orthogonalRoute({ x: sourceX, y: sourceY }, { x: targetX, y: targetY }, d?.via ?? [], bendAt));
  return <BaseEdge path={path} style={style} markerEnd={markerEnd} />;
}

const edgeTypes: EdgeTypes = {
  orgRoute: OrgRouteEdge,
};

interface OrgMindmapViewProps {
  data: OrgUnitTreeResponse[];
  maxDepth: number;
  onAddChild: (id: string, name: string, level: number) => void;
  onEdit: (node: OrgUnitTreeResponse) => void;
  onDelete: (id: string) => void;
}

export function OrgMindmapView({ data, maxDepth, onAddChild, onEdit, onDelete }: OrgMindmapViewProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => layoutOrgChart(
    flattenOrgTree<CustomNodeData>(data, (unit) => ({
      id: unit.id,
      name: unit.name,
      code: unit.code,
      type: unit.type,
      relation: relationOf(unit),
      level: unit.level,
      hasChildren: !!unit.children && unit.children.length > 0,
      onAddChild,
      onEdit,
      onDelete,
      maxDepth,
      node: unit,
    })),
  ), [data, maxDepth, onAddChild, onEdit, onDelete]);

  useEffect(() => {
    if (layoutedNodes.length > 0) {
      setNodes([...layoutedNodes]);
      setEdges([...layoutedEdges]);
    }
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  return (
    // Chiều cao theo viewport chứ KHÔNG dùng h-full: canvas này giờ nằm trong trang
    // "Thiết lập công ty", mà height:100% chỉ giải được khi MỌI tổ tiên đều có chiều cao
    // xác định — chuỗi đó đứt ở khung trang gộp nên ReactFlow tính ra 0 và không vẽ gì.
    <div className="w-full h-[calc(100vh-320px)] min-h-[420px] border rounded-card bg-[var(--color-muted)] overflow-hidden relative group/mindmap">
      <style>{`
        .react-flow__pane {
          cursor: crosshair !important;
        }
        .react-flow__pane.dragging {
          cursor: grabbing !important;
        }
        .react-flow__handle {
          width: 8px !important;
          height: 8px !important;
          border: 2px solid white !important;
        }
        /* Custom black/gray controls for better visibility */
        .react-flow__controls-button {
          background-color: white !important;
          border-bottom: 1px solid #eee !important;
          fill: #333 !important;
          width: 32px !important;
          height: 32px !important;
        }
        .react-flow__controls-button:hover {
          background-color: #f8fafc !important;
        }
        .react-flow__node:hover {
          z-index: 40 !important;
        }
        @media (pointer: coarse) {
          .react-flow__controls-button {
            width: 40px !important;
            height: 40px !important;
          }
        }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        attributionPosition="bottom-right"
        minZoom={0.2}
        maxZoom={1.5}
      >
        <Background color="#94a3b8" gap={20} size={1} />
        <Controls />
        <Panel position="top-left">
          <RelationLegend />
        </Panel>
      </ReactFlow>
    </div>
  );
}

const LEGEND_ORDER: OrgUnitRelationType[] = ['DIRECT', 'ADVISORY', 'SUPERVISORY'];

/** Chú thích kiểu nét — vẽ từ đúng bảng kiểu nét của cạnh nên không lệch nhau. */
function RelationLegend() {
  const { t } = useTranslation('organization');
  return (
    <div className="rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 shadow-sm">
      <p className="text-eyebrow mb-1.5">{t('OrgMindmapView.legendTitle')}</p>
      <ul className="space-y-1">
        {LEGEND_ORDER.map((relation) => {
          const style = RELATION_EDGE_STYLE[relation];
          return (
            <li key={relation} className="flex items-center gap-2 text-xs text-[var(--color-foreground)]">
              <svg width="32" height="8" aria-hidden="true" className="shrink-0">
                <line x1="0" y1="4" x2="32" y2="4" stroke={style.stroke} strokeWidth={style.strokeWidth} strokeDasharray={style.strokeDasharray} />
              </svg>
              {t(`OrgMindmapView.relation.${relation}`)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
