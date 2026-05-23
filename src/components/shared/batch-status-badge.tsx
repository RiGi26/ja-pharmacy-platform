import { Badge } from '@/components/ui/badge'
import type { BatchStatus } from '@/types'

interface Props {
  status: BatchStatus
  daysLeft?: number
}

export function BatchStatusBadge({ status, daysLeft }: Props) {
  const config = {
    LAYAK_JUAL:    { label: 'Layak Jual',    variant: 'success'     as const },
    WARNING:       { label: `Warning${daysLeft !== undefined ? ` (H-${daysLeft})` : ''}`, variant: 'warning' as const },
    DILARANG_JUAL: { label: 'Dilarang Jual', variant: 'destructive' as const },
    DISPOSED:      { label: 'Dimusnahkan',   variant: 'secondary'   as const },
    RETURNED:      { label: 'Diretur',       variant: 'secondary'   as const },
    EMPTY:         { label: 'Habis',         variant: 'outline'     as const },
  }

  const { label, variant } = config[status] ?? { label: status, variant: 'secondary' as const }
  return <Badge variant={variant}>{label}</Badge>
}
