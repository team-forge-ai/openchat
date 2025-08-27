import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

type ServerStatusType = 'error' | 'ready' | 'starting' | 'offline'

interface ServerStatusIndicatorProps {
  statusType: ServerStatusType
  statusText: string
  iconColor: string
}

/**
 * Displays the server status icon and text
 */
export function ServerStatusIndicator({
  statusType,
  statusText,
  iconColor,
}: ServerStatusIndicatorProps) {
  const getIcon = () => {
    switch (statusType) {
      case 'error':
        return <AlertCircle className={`h-4 w-4 ${iconColor}`} />
      case 'ready':
        return <CheckCircle className={`h-4 w-4 ${iconColor}`} />
      case 'starting':
        return <Loader2 className={`h-4 w-4 animate-spin ${iconColor}`} />
      case 'offline':
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  return (
    <div className="flex items-center gap-2 text-[10px] uppercase font-semibold">
      {getIcon()}
      <span className="text-muted-foreground/80 cursor-default">
        {statusText}
      </span>
    </div>
  )
}
