import { useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react';
import dagre from 'dagre';
import '@xyflow/react/dist/style.css';
import type { OrgUnitTreeResponse } from '../types/org-unit';
import { MoreVertical, Plus, Edit2, Trash2 } from 'lucide-react';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 220;
const nodeHeight = 80;

const getLayoutedElements = <T extends Node>(nodes: T[], edges: Edge[], direction = 'LR') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    } as T;
  });

  return { nodes: newNodes, edges };
};

type CustomNodeData = {
  id: string;
  name: string;
  code?: string;
  type: string;
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

function CustomNode({ data }: NodeProps<AppNode>) {
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
          <div className="text-eyebrow text-[var(--color-info)] mb-0.5">{data.type}</div>
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
              title="Thao tác"
            >
              <MoreVertical className={`w-4 h-4 transition-transform duration-300 ${isMenuOpen ? 'rotate-90' : ''}`} />
            </button>
            
            {isMenuOpen && (
              <div className={`absolute right-0 w-40 ${openUp ? 'bottom-full mb-2 origin-bottom-right' : 'top-full mt-2 origin-top-right'} bg-white border border-gray-200 rounded-card shadow-2xl z-[110] animate-in fade-in zoom-in-95 duration-200 ring-1 ring-black/5`}>
                  <div className="py-2">
                    {canAddChild && (
                      <button type="button" className="flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[var(--color-muted-foreground)]" onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); data.onAddChild(data.id, data.name, data.level); }}>
                        <Plus aria-hidden="true" className="w-4 h-4 mr-2.5 text-[var(--color-info)] group-hover/item:scale-110 transition-transform" /> 
                        <span className="font-medium">Thêm con</span>
                      </button>
                    )}
                    <button type="button" className="flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[var(--color-muted-foreground)]" onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); data.onEdit(data.node); }}>
                      <Edit2 aria-hidden="true" className="w-4 h-4 mr-2.5 text-[var(--color-warning)] group-hover/item:scale-110 transition-transform" /> 
                      <span className="font-medium">Sửa</span>
                    </button>
                    <div className="h-px bg-[var(--color-muted)] my-1 mx-2" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); data.onDelete(data.id); }}
                      disabled={data.hasChildren}
                      className={`flex items-center w-full px-4 py-2.5 text-sm text-left transition-colors group/item ${!data.hasChildren ? 'text-[var(--color-error)] hover:bg-[var(--color-error-bg)]' : 'text-[var(--color-subtle-foreground)] cursor-not-allowed'}`}
                    >
                      <Trash2 className={`w-4 h-4 mr-2.5 ${!data.hasChildren ? 'group-hover/item:scale-110 transition-transform' : ''}`} /> 
                      <span className="font-medium">Xoá</span>
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

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    const flatNodes: AppNode[] = [];
    const flatEdges: Edge[] = [];

    const traverse = (nodeData: OrgUnitTreeResponse, parentId: string | null = null) => {
      flatNodes.push({
        id: nodeData.id,
        type: 'custom',
        data: {
          id: nodeData.id,
          name: nodeData.name,
          code: nodeData.code,
          type: nodeData.type,
          level: nodeData.level,
          hasChildren: !!nodeData.children && nodeData.children.length > 0,
          onAddChild,
          onEdit,
          onDelete,
          maxDepth,
          node: nodeData,
        },
        position: { x: 0, y: 0 },
      });

      if (parentId) {
        flatEdges.push({
          id: `${parentId}-${nodeData.id}`,
          source: parentId,
          target: nodeData.id,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#9ca3af', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 15,
            height: 15,
            color: '#9ca3af',
          },
        });
      }

      if (nodeData.children) {
        nodeData.children.forEach((child) => traverse(child, nodeData.id));
      }
    };

    data.forEach((root) => traverse(root));

    const layouted = getLayoutedElements(flatNodes, flatEdges);
    return {
      nodes: layouted.nodes,
      edges: layouted.edges,
    };
  }, [data, maxDepth, onAddChild, onEdit, onDelete]);

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
        .react-flow__edge-path {
          stroke-width: 2.5 !important;
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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        attributionPosition="bottom-right"
        minZoom={0.2}
        maxZoom={1.5}
      >
        <Background color="#94a3b8" gap={20} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}

