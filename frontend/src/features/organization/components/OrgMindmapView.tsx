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
      className="px-4 py-3 shadow-md rounded-lg bg-white border border-gray-200 w-[220px] relative group hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer z-0 hover:z-[1000]"
      onClick={() => navigate(`/org-units/${data.id}`)}
    >
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-gray-400" />
      
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0 pr-6">
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-0.5">{data.type}</div>
          <div className="text-sm font-bold text-gray-800 truncate">{data.name}</div>
          {data.code && (
            <div className="text-[10px] font-mono text-gray-400 mt-0.5 truncate bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 w-fit">
              {data.code}
            </div>
          )}
        </div>

        {/* Action Menu - Only visible on hover */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 flex z-[100]">
          <div className="relative inline-block text-left group/menu" onClick={(e) => e.stopPropagation()} ref={menuRef} onMouseEnter={handleMouseEnter}>
            <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 bg-white border shadow-sm transition-colors">
              <MoreVertical className="w-4 h-4" />
            </button>
            
            {/* Transparent bridge to prevent losing hover state */}
            <div className="absolute right-0 h-2 w-10 -bottom-2 bg-transparent hidden group-hover/menu:block" />

            <div className={`absolute right-0 w-40 ${openUp ? 'bottom-full mb-1.5 origin-bottom-right' : 'top-full mt-1.5 origin-top-right'} bg-white border border-gray-200 rounded-xl shadow-xl hidden group-hover/menu:block z-[110] animate-in fade-in zoom-in-95 duration-100`}>
              <div className="py-2">
                {canAddChild && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); data.onAddChild(data.id, data.name, data.level); }}
                    className="flex items-center w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-blue-50 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2 text-blue-500" /> Thêm con
                  </button>
                )}
                <button 
                  onClick={(e) => { e.stopPropagation(); data.onEdit(data.node); }}
                  className="flex items-center w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-blue-50 transition-colors"
                >
                  <Edit2 className="w-4 h-4 mr-2 text-amber-500" /> Sửa
                </button>
                <div className="h-px bg-gray-100 my-1" />
                <button 
                  onClick={(e) => { e.stopPropagation(); data.onDelete(data.id); }}
                  disabled={data.hasChildren}
                  className={`flex items-center w-full px-4 py-2 text-sm text-left transition-colors ${!data.hasChildren ? 'text-red-600 hover:bg-red-50' : 'text-gray-300 cursor-not-allowed'}`}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Xoá
                </button>
              </div>
            </div>
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
    <div className="w-full h-[700px] border rounded-xl bg-gray-50 overflow-hidden relative group/mindmap">
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
        }
        .react-flow__controls-button:hover {
          background-color: #f8fafc !important;
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

