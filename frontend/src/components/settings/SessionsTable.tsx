'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import LaptopIcon from '@mui/icons-material/Laptop'
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone'
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows'
import { useColors } from '@/lib/colors'
import { podAge } from '@/lib/formatters'
import type { SessionInfo } from '@/lib/api'

function parseDevice(userAgent: string): { icon: React.ReactNode; label: string } {
  if (/iPhone|iPad|Android/.test(userAgent))
    return { icon: <PhoneIphoneIcon fontSize="small" />, label: 'Mobile' }
  if (/Macintosh|Windows|Linux/.test(userAgent))
    return { icon: <LaptopIcon fontSize="small" />, label: 'Desktop' }
  return { icon: <DesktopWindowsIcon fontSize="small" />, label: 'Unknown' }
}

function parseBrowser(userAgent: string): string {
  if (/edg\//i.test(userAgent)) return 'Edge'
  if (/chrome/i.test(userAgent) && !/chromium/i.test(userAgent)) return 'Chrome'
  if (/firefox/i.test(userAgent)) return 'Firefox'
  if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return 'Safari'
  return 'Unknown'
}

interface SessionsTableProps {
  sessions: SessionInfo[] | undefined
  isLoading: boolean
  isError: boolean
}

export default function SessionsTable({ sessions, isLoading, isError }: SessionsTableProps) {
  const colors = useColors()
  if (isError) {
    return <Alert severity="error">Could not load sessions.</Alert>
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Skeleton variant="rounded" height={40} />
        <Skeleton variant="rounded" height={40} />
      </Box>
    )
  }

  if (!sessions || sessions.length === 0) {
    return (
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
        }}
      >
        No active sessions found.
      </Typography>
    )
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Device</TableCell>
          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>IP Address</TableCell>
          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Browser</TableCell>
          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Created</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {sessions.map((session) => {
          const device = parseDevice(session.userAgent)
          return (
            <TableRow key={session.id} sx={{ '&:last-child td': { border: 0 } }}>
              <TableCell sx={{ fontSize: 12 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {device.icon}
                  {device.label}
                  {session.isCurrent && (
                    <Chip
                      label="Current"
                      size="small"
                      sx={{
                        ml: 0.5,
                        height: 18,
                        fontSize: 10,
                        bgcolor: colors.successBg,
                        color: colors.success,
                      }}
                    />
                  )}
                </Box>
              </TableCell>
              <TableCell sx={{ fontSize: 12, fontFamily: 'monospace' }}>
                {session.ipAddress}
              </TableCell>
              <TableCell sx={{ fontSize: 12 }}>{parseBrowser(session.userAgent)}</TableCell>
              <TableCell sx={{ fontSize: 12 }}>{podAge(session.createdAt)}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
