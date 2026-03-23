import Chip from '@mui/material/Chip'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { fmtCpu, fmtMem, podAge } from '@/lib/formatters'
import { getPodStatusStyle } from '@/components/cluster/statusColors'
import type { useColors } from '@/lib/colors'

export interface PodRowPod {
  name: string
  status: string
  readyContainers: number
  totalContainers: number
  cpuUsage: number
  memUsage: number
  startedAt: string
  ownerKind?: string
  ownerName?: string
}

function ownerStyle(kind: string) {
  if (kind === 'Deployment')  return { color: '#7C3AED', bgcolor: 'rgba(124,58,237,0.12)' }
  if (kind === 'StatefulSet') return { color: '#6366F1', bgcolor: 'rgba(99,102,241,0.12)' }
  if (kind === 'Job' || kind === 'CronJob') return { color: '#14B8A6', bgcolor: 'rgba(20,184,166,0.12)' }
  return { color: '#94A3B8', bgcolor: 'rgba(148,163,184,0.12)' }
}

export default function PodRow({
  pod,
  onClick,
  isDark,
  colors,
  showOwner,
}: {
  pod: PodRowPod
  onClick?: () => void
  isDark: boolean
  colors: ReturnType<typeof useColors>
  showOwner?: boolean
}) {
  const ss = getPodStatusStyle(pod.status, isDark)
  const os = showOwner && pod.ownerKind ? ownerStyle(pod.ownerKind) : null
  const readyColor = pod.readyContainers === pod.totalContainers
    ? colors.success
    : pod.readyContainers > 0
    ? colors.warning
    : colors.errorLight

  return (
    <TableRow hover onClick={onClick} sx={{ cursor: onClick ? 'pointer' : 'default' }}>
      <TableCell sx={{ maxWidth: showOwner ? 170 : 180, py: 0.75 }}>
        <Tooltip title={pod.name} arrow placement="top-start">
          <Typography sx={{ fontSize: 12, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: showOwner ? 160 : 170, display: 'block' }}>
            {pod.name}
          </Typography>
        </Tooltip>
        <Chip label={pod.status} size="small" sx={{ height: 15, fontSize: 10, bgcolor: ss.bgcolor, color: ss.color, mt: 0.25 }} />
      </TableCell>
      {showOwner && (
        <TableCell sx={{ py: 0.75 }}>
          {os ? (
            <Tooltip title={`${pod.ownerKind}: ${pod.ownerName}`} arrow>
              <Chip
                label={pod.ownerName}
                size="small"
                sx={{ height: 18, fontSize: 10, bgcolor: os.bgcolor, color: os.color, maxWidth: 130, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
              />
            </Tooltip>
          ) : (
            <Typography color="text.disabled" sx={{ fontSize: 12 }}>—</Typography>
          )}
        </TableCell>
      )}
      <TableCell sx={{ py: 0.75 }}>
        <Typography sx={{ fontSize: 12, color: readyColor, fontFamily: 'monospace' }}>
          {pod.readyContainers}/{pod.totalContainers}
        </Typography>
      </TableCell>
      <TableCell sx={{ py: 0.75 }}>
        <Typography sx={{ fontSize: 12, fontFamily: 'monospace', color: 'text.secondary' }}>
          {pod.cpuUsage > 0 ? fmtCpu(pod.cpuUsage) : '—'}
        </Typography>
      </TableCell>
      <TableCell sx={{ py: 0.75 }}>
        <Typography sx={{ fontSize: 12, fontFamily: 'monospace', color: 'text.secondary' }}>
          {pod.memUsage > 0 ? fmtMem(pod.memUsage) : '—'}
        </Typography>
      </TableCell>
      <TableCell sx={{ py: 0.75 }}>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          {podAge(pod.startedAt)}
        </Typography>
      </TableCell>
    </TableRow>
  )
}
