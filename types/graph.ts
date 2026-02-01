import type { Node, Edge } from '@xyflow/react'
import type { Mode } from './output'
import type { EntityType } from './knowledge'

export interface GraphNode extends Node {
  readonly data: GraphNodeData
}

export interface GraphNodeData {
  readonly knowledgeId: string
  readonly label: string
  readonly snippet: string
  readonly mode: Mode
  readonly nodeType: EntityType
  readonly size: 'small' | 'medium' | 'large'
  readonly isHighlighted: boolean
  readonly isNew: boolean
  readonly accessCount: number
  readonly lastAccessed: Date
  [key: string]: unknown // Index signature for React Flow compatibility
}

export interface GraphEdge extends Edge {
  readonly data: GraphEdgeData
}

export interface GraphEdgeData {
  readonly relationshipType: RelationshipType
  readonly strength: number
  readonly label?: string
  [key: string]: unknown // Index signature for React Flow compatibility
}

export type RelationshipType =
  | 'related'
  | 'derived'
  | 'references'
  | 'belongs_to'
  | 'works_on'
  | 'uses'
  | 'mentions'

export interface GraphState {
  readonly nodes: readonly GraphNode[]
  readonly edges: readonly GraphEdge[]
  readonly focusedNodeId: string | null
  readonly selectedNodeIds: readonly string[]
  readonly visibleModes: readonly Mode[]
  readonly zoom: number
  readonly position: { x: number; y: number }
}

export interface GraphLayout {
  readonly type: 'force' | 'radial' | 'hierarchical'
  readonly spacing: number
  readonly animated: boolean
}

export interface GraphFilter {
  readonly modes: readonly Mode[]
  readonly nodeTypes: readonly EntityType[]
  readonly minConnections: number
  readonly showOrphans: boolean
}

export interface GraphAnimation {
  readonly nodeId: string
  readonly type: 'appear' | 'highlight' | 'pulse' | 'connect'
  readonly duration: number
}

export interface NodePosition {
  readonly id: string
  readonly x: number
  readonly y: number
}

export interface GraphUpdate {
  readonly addedNodes: readonly GraphNode[]
  readonly removedNodeIds: readonly string[]
  readonly addedEdges: readonly GraphEdge[]
  readonly removedEdgeIds: readonly string[]
  readonly highlightedNodeIds: readonly string[]
}
