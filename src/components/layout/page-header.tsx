import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  children?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 sm:mb-10', className)}>
      <div>
        <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight sf-display leading-tight">{title}</h1>
        {description && <p className="text-sm text-gray-500 mt-1.5 font-medium leading-relaxed">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-auto">{children}</div>}
    </div>
  )
}

