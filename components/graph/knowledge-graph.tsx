'use client'

import { useCallback, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
  BackgroundVariant,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion, AnimatePresence } from 'framer-motion'
import { useKnowledgeStore } from '@/stores/knowledge-store'
import { useAppStore } from '@/stores/app-store'
import { GraphNodeComponent } from './graph-node'
import type { GraphNode, GraphEdge } from '@/types/graph'

const nodeTypes = {
  knowledge: GraphNodeComponent,
}

interface KnowledgeGraphProps {
  className?: string
  showMinimap?: boolean
  showControls?: boolean
}

export function KnowledgeGraph({
  className = '',
  showMinimap = true,
  showControls = true,
}: KnowledgeGraphProps) {
  const { graph, setGraph, highlightNode, clearHighlights } = useKnowledgeStore()
  const { mode } = useAppStore()

  // Filter nodes by current mode
  const filteredNodes = useMemo(() => {
    return graph.nodes.filter(
      (node) => graph.visibleModes.includes(node.data.mode)
    )
  }, [graph.nodes, graph.visibleModes])

  // Filter edges to only show connections between visible nodes
  const filteredEdges = useMemo(() => {
    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id))
    return graph.edges.filter(
      (edge) =>
        visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    )
  }, [filteredNodes, graph.edges])

  const [nodes, setNodes, onNodesChange] = useNodesState(filteredNodes as Node[])
  const [edges, setEdges, onEdgesChange] = useEdgesState(filteredEdges as Edge[])

  // Sync with store
  useEffect(() => {
    setNodes(filteredNodes as Node[])
  }, [filteredNodes, setNodes])

  useEffect(() => {
    setEdges(filteredEdges as Edge[])
  }, [filteredEdges, setEdges])

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'smoothstep',
            animated: true,
            style: { stroke: 'var(--border)' },
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          eds
        )
      )
    },
    [setEdges]
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      highlightNode(node.id)
    },
    [highlightNode]
  )

  const onPaneClick = useCallback(() => {
    clearHighlights()
  }, [clearHighlights])

  // Custom minimap node color based on entity type
  const minimapNodeColor = useCallback((node: Node) => {
    const data = node.data as GraphNode['data']
    const colors: Record<string, string> = {
      person: 'var(--node-person)',
      project: 'var(--node-project)',
      technology: 'var(--node-technology)',
      company: 'var(--node-company)',
      deadline: 'var(--node-deadline)',
      decision: 'var(--node-decision)',
      fact: 'var(--node-fact)',
      preference: 'var(--node-preference)',
      unknown: 'var(--text-muted)',
    }
    return colors[data.nodeType] || colors.unknown
  }, [])

  if (nodes.length === 0) {
    return (
      <div
        className={`flex items-center justify-center h-full ${className}`}
      >
        <div className="text-center">
          <GraphIcon className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-[var(--text-tertiary)] text-sm">
            Noch keine Daten im Knowledge Graph
          </p>
          <p className="text-[var(--text-muted)] text-xs mt-1">
            Sprich etwas, um Wissen zu sammeln
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`h-full w-full ${className}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{
          padding: 0.2,
          maxZoom: 1.5,
        }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: {
            stroke: 'var(--border)',
            strokeWidth: 2,
          },
        }}
        proOptions={{ hideAttribution: true }}
        className="bg-[var(--bg-primary)]"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="var(--border-subtle)"
        />
        {showControls && (
          <Controls
            showZoom
            showFitView
            showInteractive={false}
            className="!bg-[var(--bg-elevated)] !border-[var(--border)] !rounded-[var(--radius-md)] !shadow-[var(--shadow-md)]"
          />
        )}
        {showMinimap && (
          <MiniMap
            nodeColor={minimapNodeColor}
            maskColor="var(--bg-glass)"
            className="!bg-[var(--bg-elevated)] !border-[var(--border)] !rounded-[var(--radius-md)]"
            style={{
              width: 120,
              height: 80,
            }}
          />
        )}
      </ReactFlow>
    </div>
  )
}

// Panel wrapper with header
interface KnowledgeGraphPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function KnowledgeGraphPanel({ isOpen, onClose }: KnowledgeGraphPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 100 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="absolute inset-y-0 right-0 w-96 bg-[var(--bg-secondary)] border-l border-[var(--border)] shadow-lg flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">
              Knowledge Graph
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Graph */}
          <div className="flex-1">
            <KnowledgeGraph showMinimap={false} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Icons
function GraphIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="M8.5 8.5l7 7" />
      <path d="M8.5 15.5l7-7" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
