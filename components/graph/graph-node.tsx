'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { motion } from 'framer-motion'
import type { GraphNodeData } from '@/types/graph'
import type { EntityType } from '@/types/knowledge'

const entityTypeColors: Record<EntityType, { bg: string; border: string; text: string }> = {
  person: {
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
    text: 'text-pink-400',
  },
  project: {
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/30',
    text: 'text-indigo-400',
  },
  technology: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
  },
  company: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
  },
  deadline: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
  },
  decision: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400',
  },
  fact: {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
    text: 'text-gray-400',
  },
  preference: {
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    text: 'text-violet-400',
  },
  unknown: {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
    text: 'text-gray-400',
  },
}

const entityTypeIcons: Record<EntityType, React.ReactNode> = {
  person: <PersonIcon className="w-3.5 h-3.5" />,
  project: <ProjectIcon className="w-3.5 h-3.5" />,
  technology: <TechIcon className="w-3.5 h-3.5" />,
  company: <CompanyIcon className="w-3.5 h-3.5" />,
  deadline: <DeadlineIcon className="w-3.5 h-3.5" />,
  decision: <DecisionIcon className="w-3.5 h-3.5" />,
  fact: <FactIcon className="w-3.5 h-3.5" />,
  preference: <PreferenceIcon className="w-3.5 h-3.5" />,
  unknown: <FactIcon className="w-3.5 h-3.5" />,
}

const sizeStyles = {
  small: 'min-w-[80px] max-w-[100px] py-2 px-3',
  medium: 'min-w-[100px] max-w-[140px] py-2.5 px-4',
  large: 'min-w-[120px] max-w-[180px] py-3 px-5',
}

type KnowledgeNodeProps = NodeProps & {
  data: GraphNodeData
}

function KnowledgeNode({ data, selected }: KnowledgeNodeProps) {
  const colors = entityTypeColors[data.nodeType] || entityTypeColors.unknown
  const icon = entityTypeIcons[data.nodeType] || entityTypeIcons.unknown
  const size = sizeStyles[data.size]

  return (
    <motion.div
      initial={data.isNew ? { scale: 0, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 500,
        damping: 30,
      }}
      className={`
        ${size}
        ${colors.bg}
        border ${data.isHighlighted || selected ? 'border-[var(--accent)]' : colors.border}
        rounded-[var(--radius-md)]
        shadow-sm
        cursor-pointer
        transition-all duration-[var(--transition-fast)]
        hover:shadow-md hover:scale-105
        ${data.isHighlighted ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-primary)]' : ''}
      `}
    >
      {/* Handle for connections */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-[var(--border)] !border-none"
      />

      {/* Content */}
      <div className="flex items-start gap-2">
        <span className={`flex-shrink-0 ${colors.text}`}>{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--text-primary)] truncate">
            {data.label}
          </p>
          {data.snippet && data.size !== 'small' && (
            <p className="text-[10px] text-[var(--text-tertiary)] truncate mt-0.5">
              {data.snippet}
            </p>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-[var(--border)] !border-none"
      />
    </motion.div>
  )
}

export const GraphNodeComponent = memo(KnowledgeNode)

// Icons
function PersonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function ProjectIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function TechIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

function CompanyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M9 8h1" />
      <path d="M9 12h1" />
      <path d="M9 16h1" />
      <path d="M14 8h1" />
      <path d="M14 12h1" />
      <path d="M14 16h1" />
      <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
    </svg>
  )
}

function DeadlineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function DecisionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  )
}

function FactIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="16" y2="12" />
      <line x1="12" x2="12.01" y1="8" y2="8" />
    </svg>
  )
}

function PreferenceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}
