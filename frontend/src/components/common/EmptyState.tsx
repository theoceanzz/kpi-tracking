import { FileQuestion } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[var(--color-muted)] flex items-center justify-center mb-4">
        <FileQuestion className="text-[var(--color-muted-foreground)]" size={28} />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      {description && (
        <p className="text-[var(--color-muted-foreground)] text-sm max-w-sm mb-4">{description}</p>
      )}
      {action}
    </div>
  )
}
